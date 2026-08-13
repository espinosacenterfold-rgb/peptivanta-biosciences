import { ensureFulfillmentSchema, getD1 } from "../../../../db";
import {
  DEFAULT_GENERATOR_SETTINGS,
  MAX_GENERATED_RETENTION,
  normalizeGeneratorSettings,
  type GeneratorSettings,
} from "../../fulfillment-cases/generator";
import { requireFulfillmentAdmin } from "../auth";
import { unexpectedErrorResponse } from "../../../../lib/server-error";

type SettingsRow = {
  display_limit: number;
  daily_minimum: number;
  daily_maximum: number;
  large_order_rate_bps: number;
  repeat_order_rate_bps: number;
  multi_product_rate_bps: number;
  bulk_gap_days: number;
  repeat_minimum_days: number;
  repeat_maximum_days: number;
  market_us_weight: number;
  market_ca_weight: number;
  market_br_weight: number;
  market_mx_weight: number;
  generation_enabled: number;
  updated_at: string;
};

async function readSettings() {
  const d1 = await getD1();
  const row = await d1
    .prepare("SELECT * FROM fulfillment_generator_settings WHERE id = 1")
    .first<SettingsRow>();
  const settings = normalizeGeneratorSettings(
    row
      ? {
          displayLimit: row.display_limit,
          dailyMinimum: row.daily_minimum,
          dailyMaximum: row.daily_maximum,
          largeOrderRateBps: row.large_order_rate_bps,
          repeatOrderRateBps: row.repeat_order_rate_bps,
          multiProductRateBps: row.multi_product_rate_bps,
          bulkGapDays: row.bulk_gap_days,
          repeatMinimumDays: row.repeat_minimum_days,
          repeatMaximumDays: row.repeat_maximum_days,
          marketUsWeight: row.market_us_weight,
          marketCaWeight: row.market_ca_weight,
          marketBrWeight: row.market_br_weight,
          marketMxWeight: row.market_mx_weight,
          generationEnabled: Boolean(row.generation_enabled),
        }
      : DEFAULT_GENERATOR_SETTINGS,
  );
  const stats = await d1
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN order_kind = 'repeat' THEN 1 ELSE 0 END) AS repeat_total,
              SUM(CASE WHEN service IN ('private_label', 'bulk') THEN 1 ELSE 0 END) AS large_total,
              SUM(CASE WHEN service = 'catalogue' THEN 1 ELSE 0 END) AS catalogue_total,
              SUM(CASE WHEN service = 'private_label' THEN 1 ELSE 0 END) AS private_label_total,
              SUM(CASE WHEN service = 'bulk' THEN 1 ELSE 0 END) AS bulk_total,
              SUM(CASE WHEN service = 'custom' THEN 1 ELSE 0 END) AS custom_total,
              SUM(CASE WHEN destination = 'United States' THEN 1 ELSE 0 END) AS us_total,
              SUM(CASE WHEN destination = 'Canada' THEN 1 ELSE 0 END) AS ca_total,
              SUM(CASE WHEN destination = 'Brazil' THEN 1 ELSE 0 END) AS br_total,
              SUM(CASE WHEN destination = 'Mexico' THEN 1 ELSE 0 END) AS mx_total,
              SUM(CASE WHEN occurred_at = date('now') THEN 1 ELSE 0 END) AS today_total,
              SUM(CASE WHEN is_published = 1 THEN 1 ELSE 0 END) AS published_total,
              MIN(occurred_at) AS oldest_date,
              MAX(occurred_at) AS newest_date
       FROM fulfillment_cases WHERE is_sample = 1`,
    )
    .first<{
      total: number;
      repeat_total: number;
      large_total: number;
      catalogue_total: number;
      private_label_total: number;
      bulk_total: number;
      custom_total: number;
      us_total: number;
      ca_total: number;
      br_total: number;
      mx_total: number;
      today_total: number;
      published_total: number;
      oldest_date: string | null;
      newest_date: string | null;
    }>();
  const itemRows = await d1
    .prepare(
      `SELECT items_json AS itemsJson
       FROM fulfillment_cases
       WHERE is_sample = 1
       ORDER BY occurred_at DESC, id DESC
       LIMIT ?`,
    )
    .bind(MAX_GENERATED_RETENTION)
    .all<{ itemsJson: string }>();
  const multiProductTotal = itemRows.results.reduce((total, row) => {
    try {
      const items = JSON.parse(row.itemsJson) as unknown[];
      return total + (Array.isArray(items) && items.length > 1 ? 1 : 0);
    } catch {
      return total;
    }
  }, 0);

  return {
    settings,
    updatedAt: row?.updated_at ?? null,
    retentionLimit: MAX_GENERATED_RETENTION,
    historyProtection: {
      enabled: true,
      mode: "append_only" as const,
    },
    stats: {
      total: Number(stats?.total ?? 0),
      repeatTotal: Number(stats?.repeat_total ?? 0),
      largeTotal: Number(stats?.large_total ?? 0),
      multiProductTotal,
      todayTotal: Number(stats?.today_total ?? 0),
      publishedTotal: Number(stats?.published_total ?? 0),
      serviceTotals: {
        catalogue: Number(stats?.catalogue_total ?? 0),
        privateLabel: Number(stats?.private_label_total ?? 0),
        bulk: Number(stats?.bulk_total ?? 0),
        custom: Number(stats?.custom_total ?? 0),
      },
      marketTotals: {
        us: Number(stats?.us_total ?? 0),
        ca: Number(stats?.ca_total ?? 0),
        br: Number(stats?.br_total ?? 0),
        mx: Number(stats?.mx_total ?? 0),
      },
      oldestDate: stats?.oldest_date ?? null,
      newestDate: stats?.newest_date ?? null,
    },
  };
}

export async function GET(request: Request) {
  const denied = await requireFulfillmentAdmin(request);
  if (denied) return denied;
  try {
    await ensureFulfillmentSchema();
    return Response.json(await readSettings(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return unexpectedErrorResponse("admin-generator:get", error);
  }
}

export async function PATCH(request: Request) {
  const denied = await requireFulfillmentAdmin(request);
  if (denied) return denied;
  try {
    await ensureFulfillmentSchema();
    const input = (await request.json()) as Partial<GeneratorSettings>;
    const settings = normalizeGeneratorSettings(input);
    const d1 = await getD1();
    // Generator controls live in their own singleton row. Saving thresholds
    // must never update, regenerate, or delete an existing fulfillment case.
    await d1
      .prepare(
        `UPDATE fulfillment_generator_settings SET
           display_limit = ?, daily_minimum = ?, daily_maximum = ?,
           large_order_rate_bps = ?, repeat_order_rate_bps = ?,
           multi_product_rate_bps = ?, bulk_gap_days = ?,
           repeat_minimum_days = ?, repeat_maximum_days = ?,
           market_us_weight = ?, market_ca_weight = ?,
           market_br_weight = ?, market_mx_weight = ?,
           generation_enabled = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = 1`,
      )
      .bind(
        settings.displayLimit,
        settings.dailyMinimum,
        settings.dailyMaximum,
        settings.largeOrderRateBps,
        settings.repeatOrderRateBps,
        settings.multiProductRateBps,
        settings.bulkGapDays,
        settings.repeatMinimumDays,
        settings.repeatMaximumDays,
        settings.marketUsWeight,
        settings.marketCaWeight,
        settings.marketBrWeight,
        settings.marketMxWeight,
        settings.generationEnabled ? 1 : 0,
      )
      .run();
    return Response.json(await readSettings(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return unexpectedErrorResponse("admin-generator:patch", error);
  }
}
