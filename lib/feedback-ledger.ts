import { ensureCommunitySchema, getD1 } from "../db";
import { currentFulfillmentStatus } from "../app/api/fulfillment-cases/generator";
import {
  createIllustrativeFeedback,
  destinationCode,
  stableNumber,
} from "./feedback";
import { randomToken } from "./customer-auth";
import { cleanupExpiredAndInterruptedMedia } from "./media-storage";
import { feedbackGenerationDue } from "./community-rules";

const RETENTION_DAYS = 180;
const LAST_SUCCESS_KEY = "feedback-v2:last-successful-date";

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function maintainFeedbackLedger(
  now = new Date(),
  options: { force?: boolean } = {},
) {
  await ensureCommunitySchema();
  const d1 = await getD1();
  await d1
    .prepare("DELETE FROM feedback_entries WHERE datetime(expires_at) <= CURRENT_TIMESTAMP")
    .run();

  const today = isoDate(now);
  const last = await d1
    .prepare("SELECT value FROM feedback_generator_meta WHERE key = ?")
    .bind(LAST_SUCCESS_KEY)
    .first<{ value: string }>();

  const settings = await d1
    .prepare(
      `SELECT generation_enabled, daily_maximum, generation_interval_days
       FROM feedback_generator_settings WHERE id = 1`,
    )
    .first<{
      generation_enabled: number;
      daily_maximum: number;
      generation_interval_days: number;
    }>();

  const intervalDays = Math.max(
    1,
    Math.min(30, Number(settings?.generation_interval_days ?? 3)),
  );
  const due = feedbackGenerationDue(last?.value ?? null, today, intervalDays);
  const shouldGenerate =
    Boolean(options.force) ||
    (Boolean(settings?.generation_enabled ?? 1) && due);
  const generationCount = shouldGenerate
    ? options.force
      ? 1
      : Math.max(0, Math.min(2, Number(settings?.daily_maximum ?? 1)))
    : 0;
  let insertedCount = 0;
  let mediaAttachedCount = 0;

  if (generationCount > 0) {
    const candidates = await d1
      .prepare(
        `SELECT f.id, f.reference, f.occurred_at, f.destination, f.service,
                f.order_profile, f.product_name, f.specification,
                f.quantity_units, f.items_json, f.order_kind
         FROM fulfillment_cases f
         LEFT JOIN feedback_entries e ON e.sample_case_id = f.id
         WHERE f.is_sample = 1 AND f.is_published = 1 AND e.id IS NULL
         ORDER BY f.occurred_at DESC, f.id DESC
         LIMIT 180`,
      )
      .all<{
        id: number;
        reference: string;
        occurred_at: string;
        destination: string;
        service: string;
        order_profile: string;
        product_name: string;
        specification: string;
        quantity_units: number;
        items_json: string;
        order_kind: string;
      }>();
    const delivered = candidates.results.filter((row) =>
      currentFulfillmentStatus(
        {
          occurredAt: row.occurred_at,
          destination: row.destination as "United States" | "Canada" | "Brazil" | "Mexico",
          service: row.service as "catalogue" | "private_label" | "bulk" | "custom",
          quantityUnits: row.quantity_units,
        },
        now,
      ) === "delivered",
    );

    const ordered = [...delivered].sort(
      (left, right) =>
        stableNumber(`${today}:${left.reference}`) -
        stableNumber(`${today}:${right.reference}`),
    );
    for (const row of ordered.slice(0, generationCount)) {
      const items = safeJson<Array<{ productName?: string; specification?: string }>>(
        row.items_json,
        [],
      );
      const content = createIllustrativeFeedback(row.reference, {
        destination: row.destination,
        service: row.service,
        orderKind: row.order_kind,
        productName: row.product_name,
        itemCount: Math.max(1, items.length),
      });
      const mediaId = await chooseFeedbackMediaAsset(d1, {
        today,
        countryCode: destinationCode(row.destination),
        service: row.service,
        orderKind: row.order_kind,
        productNames: [
          row.product_name,
          ...items.map((item) => item.productName ?? ""),
        ],
        seed: row.reference,
      });
      const publicId = `fb_${randomToken(12)}`;
      const expiresAt = addDays(now, RETENTION_DAYS).toISOString();
      const snapshot = JSON.stringify({
        reference: row.reference,
        occurredAt: row.occurred_at,
        destination: row.destination,
        service: row.service,
        orderProfile: row.order_profile,
        productName: row.product_name,
        specification: row.specification,
        items,
      });
      const insert = d1
        .prepare(
          `INSERT INTO feedback_entries (
            public_id, source_type, sample_case_id, media_asset_id,
            country_code, service, order_kind, order_snapshot_json,
            locale, content_json, original_text, public_text, status,
            risk_flags_json, template_version, submitted_at, reviewed_at,
            published_at, expires_at
          ) VALUES (?, 'illustrative', ?, ?, ?, ?, ?, ?, 'en', ?, '', '',
                    'approved', '[]', 'feedback-v1', CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
          ON CONFLICT(sample_case_id) DO NOTHING`,
        )
        .bind(
          publicId,
          row.id,
          mediaId,
          destinationCode(row.destination),
          row.service,
          row.order_kind,
          snapshot,
          JSON.stringify(content),
          expiresAt,
        );
      const inserted = await insert.run();
      const changed = Number(inserted.meta.changes ?? 0);
      insertedCount += changed;
      if (mediaId && changed > 0) {
        mediaAttachedCount += 1;
        await d1
          .prepare(
            `UPDATE media_library_assets
             SET use_count = use_count + 1,
                 last_used_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
          )
          .bind(mediaId)
          .run();
      }
    }
  }

  if (insertedCount > 0) {
    await d1
      .prepare(
        `INSERT INTO feedback_generator_meta (key, value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(LAST_SUCCESS_KEY, today)
      .run();
  }
  return {
    created: insertedCount,
    mediaAttached: mediaAttachedCount,
    due,
    intervalDays,
    lastSuccessfulDate: insertedCount > 0 ? today : last?.value ?? null,
  };
}

function mediaMatchTerms(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9+]+/g, " ").trim();
  return Array.from(
    new Set([normalized.replaceAll(" ", ""), ...normalized.split(/\s+/)].filter(Boolean)),
  );
}

export async function chooseFeedbackMediaAsset(
  d1: D1Database,
  input: {
    today: string;
    countryCode: string;
    service: string;
    orderKind: string;
    productNames: string[];
    seed: string;
  },
) {
  const rows = await d1
    .prepare(
      `SELECT id, tags_json, source_title, use_count
       FROM media_library_assets
       WHERE status = 'approved'
         AND r2_key <> ''
         AND available_from <= ?
         AND datetime(expires_at) > CURRENT_TIMESTAMP
       ORDER BY use_count ASC, id DESC
       LIMIT 40`,
    )
    .bind(input.today)
    .all<{
      id: number;
      tags_json: string;
      source_title: string;
      use_count: number;
    }>();
  if (rows.results.length === 0) return null;
  const productTerms = Array.from(
    new Set(input.productNames.flatMap(mediaMatchTerms)),
  );
  const scored = rows.results.map((row) => {
    const tags = safeJson<string[]>(row.tags_json, []).map((tag) => tag.toLowerCase());
    const searchable = new Set([
      ...tags,
      ...mediaMatchTerms(row.source_title),
    ]);
    let score = 0;
    if (searchable.has(input.countryCode.toLowerCase())) score += 3;
    if (searchable.has(input.service.toLowerCase())) score += 5;
    if (searchable.has(input.orderKind.toLowerCase())) score += 2;
    for (const term of productTerms) {
      if (searchable.has(term)) score += term.length >= 6 ? 8 : 2;
    }
    score -= Math.min(6, row.use_count * 0.35);
    score += (stableNumber(`${input.seed}:${row.id}`) % 100) / 100;
    return { id: row.id, score };
  });
  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.id ?? null;
}

export async function cleanupExpiredMedia() {
  return cleanupExpiredAndInterruptedMedia();
}

export async function publicFeedback(params: {
  locale: string;
  limit: number;
  offset: number;
  country?: string;
  service?: string;
}) {
  const d1 = await getD1();
  const settings = await d1
    .prepare("SELECT public_limit FROM feedback_generator_settings WHERE id = 1")
    .first<{ public_limit: number }>();
  const effectiveLimit = Math.max(
    1,
    Math.min(params.limit, Number(settings?.public_limit ?? 48)),
  );
  const clauses = [
    "f.status = 'approved'",
    "f.source_type IN ('customer_submitted', 'illustrative')",
    "f.published_at IS NOT NULL",
    "datetime(f.expires_at) > CURRENT_TIMESTAMP",
  ];
  const bindings: Array<string | number> = [];
  if (params.country) {
    clauses.push("f.country_code = ?");
    bindings.push(params.country);
  }
  if (params.service) {
    clauses.push("f.service = ?");
    bindings.push(params.service);
  }
  bindings.push(effectiveLimit, params.offset);
  const rows = await d1
    .prepare(
      `SELECT f.public_id, f.source_type, f.country_code, f.service,
              CASE
                WHEN f.source_type = 'customer_submitted'
                 AND EXISTS (
                   SELECT 1
                   FROM customer_order_links prior_link
                   INNER JOIN manual_fulfillment_orders prior_order
                     ON prior_order.id = prior_link.order_id
                   WHERE prior_link.customer_id = f.customer_id
                     AND prior_order.id <> f.manual_order_id
                     AND (
                       prior_order.occurred_at < current_order.occurred_at
                       OR (
                         prior_order.occurred_at = current_order.occurred_at
                         AND prior_order.id < current_order.id
                       )
                     )
                 ) THEN 'repeat'
                ELSE f.order_kind
              END AS order_kind,
              f.locale, f.content_json, f.public_text,
              f.published_at, m.public_id AS media_public_id,
              m.source_title AS media_alt
       FROM feedback_entries f
       LEFT JOIN manual_fulfillment_orders current_order
         ON current_order.id = f.manual_order_id
       LEFT JOIN media_library_assets m
         ON m.id = f.media_asset_id
        AND m.status = 'approved'
        AND m.available_from <= date('now')
        AND datetime(m.expires_at) > CURRENT_TIMESTAMP
        AND m.r2_key <> ''
       WHERE ${clauses.join(" AND ")}
       ORDER BY datetime(f.published_at) DESC, f.id DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(...bindings)
    .all<{
      public_id: string;
      source_type: string;
      country_code: string;
      service: string;
      order_kind: string;
      locale: string;
      content_json: string;
      public_text: string;
      published_at: string;
      media_public_id: string | null;
      media_alt: string | null;
    }>();
  const locale = (["en", "pt", "es", "fr", "zh"].includes(params.locale)
    ? params.locale
    : "en") as keyof ReturnType<typeof createIllustrativeFeedback>;
  return rows.results.map((row) => ({
    id: row.public_id,
    sourceType: row.source_type,
    countryCode: row.country_code,
    service: row.service,
    orderKind: row.order_kind,
    locale: row.locale,
    text:
      row.source_type === "illustrative"
        ? safeJson<Record<string, string>>(row.content_json, {})[locale] ??
          safeJson<Record<string, string>>(row.content_json, {}).en ??
          ""
        : row.public_text,
    publishedAt: row.published_at,
    mediaUrl: row.media_public_id
      ? `/api/media/${encodeURIComponent(row.media_public_id)}`
      : null,
    mediaAlt: row.media_alt ?? "",
  }));
}
