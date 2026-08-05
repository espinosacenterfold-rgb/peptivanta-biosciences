import { ensureFulfillmentSchema, getD1 } from "../../../../db";
import {
  DEFAULT_GENERATOR_SETTINGS,
  MAX_GENERATED_RETENTION,
  normalizeGeneratorSettings,
  type GeneratorSettings,
} from "../../fulfillment-cases/generator";
import { requireFulfillmentAdmin } from "../auth";

type SettingsRow = {
  display_limit: number;
  daily_minimum: number;
  daily_maximum: number;
  large_order_rate_bps: number;
  repeat_order_rate_bps: number;
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
          generationEnabled: Boolean(row.generation_enabled),
        }
      : DEFAULT_GENERATOR_SETTINGS,
  );
  const stats = await d1
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN order_kind = 'repeat' THEN 1 ELSE 0 END) AS repeat_total,
              SUM(CASE WHEN service IN ('private_label', 'bulk') THEN 1 ELSE 0 END) AS large_total,
              MIN(occurred_at) AS oldest_date,
              MAX(occurred_at) AS newest_date
       FROM fulfillment_cases WHERE is_sample = 1`,
    )
    .first<{
      total: number;
      repeat_total: number;
      large_total: number;
      oldest_date: string | null;
      newest_date: string | null;
    }>();
  return {
    settings,
    updatedAt: row?.updated_at ?? null,
    retentionLimit: MAX_GENERATED_RETENTION,
    stats: {
      total: Number(stats?.total ?? 0),
      repeatTotal: Number(stats?.repeat_total ?? 0),
      largeTotal: Number(stats?.large_total ?? 0),
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
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load settings." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
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
    await d1
      .prepare(
        `UPDATE fulfillment_generator_settings SET
           display_limit = ?, daily_minimum = ?, daily_maximum = ?,
           large_order_rate_bps = ?, repeat_order_rate_bps = ?,
           generation_enabled = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = 1`,
      )
      .bind(
        settings.displayLimit,
        settings.dailyMinimum,
        settings.dailyMaximum,
        settings.largeOrderRateBps,
        settings.repeatOrderRateBps,
        settings.generationEnabled ? 1 : 0,
      )
      .run();
    return Response.json(await readSettings(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to save settings." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
