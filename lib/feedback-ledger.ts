import { ensureCommunitySchema, getD1, getMediaStore } from "../db";
import { currentFulfillmentStatus } from "../app/api/fulfillment-cases/generator";
import {
  createIllustrativeFeedback,
  destinationCode,
  stableNumber,
} from "./feedback";
import { randomToken } from "./customer-auth";

const RETENTION_DAYS = 180;
const LAST_GENERATION_KEY = "feedback-v1:last-generated-date";

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

export async function maintainFeedbackLedger(now = new Date()) {
  await ensureCommunitySchema();
  const d1 = await getD1();
  await d1
    .prepare("DELETE FROM feedback_entries WHERE datetime(expires_at) <= CURRENT_TIMESTAMP")
    .run();

  const today = isoDate(now);
  const last = await d1
    .prepare("SELECT value FROM feedback_generator_meta WHERE key = ?")
    .bind(LAST_GENERATION_KEY)
    .first<{ value: string }>();
  if (last?.value === today) return;

  const settings = await d1
    .prepare(
      `SELECT generation_enabled, daily_maximum, generation_rate_bps
       FROM feedback_generator_settings WHERE id = 1`,
    )
    .first<{
      generation_enabled: number;
      daily_maximum: number;
      generation_rate_bps: number;
    }>();

  const shouldGenerate =
    Boolean(settings?.generation_enabled ?? 1) &&
    stableNumber(`feedback-day:${today}`) % 10_000 <
      Number(settings?.generation_rate_bps ?? 3500);
  const generationCount = shouldGenerate
    ? Math.max(0, Math.min(2, Number(settings?.daily_maximum ?? 1)))
    : 0;

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
      const mediaId = await chooseMediaAsset(
        d1,
        today,
        destinationCode(row.destination),
        row.service,
        row.reference,
      );
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
      if (mediaId && Number(inserted.meta.changes ?? 0) > 0) {
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

  await d1
    .prepare(
      `INSERT INTO feedback_generator_meta (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(LAST_GENERATION_KEY, today)
    .run();
}

async function chooseMediaAsset(
  d1: D1Database,
  today: string,
  countryCode: string,
  service: string,
  seed: string,
) {
  const rows = await d1
    .prepare(
      `SELECT id, tags_json, use_count
       FROM media_library_assets
       WHERE status = 'approved'
         AND r2_key <> ''
         AND available_from <= ?
         AND datetime(expires_at) > CURRENT_TIMESTAMP
       ORDER BY use_count ASC, id DESC
       LIMIT 40`,
    )
    .bind(today)
    .all<{ id: number; tags_json: string; use_count: number }>();
  if (rows.results.length === 0) return null;
  const scored = rows.results.map((row) => {
    const tags = safeJson<string[]>(row.tags_json, []).map((tag) => tag.toLowerCase());
    let score = 0;
    if (tags.includes(countryCode.toLowerCase())) score += 3;
    if (tags.includes(service.toLowerCase())) score += 4;
    score -= row.use_count;
    score += (stableNumber(`${seed}:${row.id}`) % 100) / 100;
    return { id: row.id, score };
  });
  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.id ?? null;
}

export async function cleanupExpiredMedia() {
  await ensureCommunitySchema();
  const d1 = await getD1();
  const expired = await d1
    .prepare(
      `SELECT id, r2_key FROM media_library_assets
       WHERE status <> 'expired' AND datetime(expires_at) <= CURRENT_TIMESTAMP
       LIMIT 100`,
    )
    .all<{ id: number; r2_key: string }>();
  if (expired.results.length === 0) return 0;
  let media: R2Bucket | null = null;
  try {
    media = await getMediaStore();
  } catch {
    media = null;
  }
  for (const row of expired.results) {
    if (media && row.r2_key) await media.delete(row.r2_key);
    await d1
      .prepare(
        `UPDATE media_library_assets
         SET status = 'expired', r2_key = '', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(row.id)
      .run();
  }
  return expired.results.length;
}

export async function publicFeedback(params: {
  locale: string;
  limit: number;
  offset: number;
  country?: string;
  service?: string;
}) {
  await maintainFeedbackLedger();
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
              f.order_kind, f.locale, f.content_json, f.public_text,
              f.published_at, m.public_id AS media_public_id,
              m.source_title AS media_alt
       FROM feedback_entries f
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
  return rows.results.map((row) => {
    const content = safeJson<Record<string, string>>(row.content_json, {});
    return {
      id: row.public_id,
      sourceType: row.source_type,
      countryCode: row.country_code,
      service: row.service,
      orderKind: row.order_kind,
      locale: row.locale,
      text:
        row.source_type === "illustrative"
          ? content[locale] ?? content.en ?? ""
          : row.public_text,
      publishedAt: row.published_at,
      mediaUrl: row.media_public_id
        ? `/api/media/${encodeURIComponent(row.media_public_id)}`
        : null,
      mediaAlt: row.media_alt ?? "",
    };
  });
}
