import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { ensureFulfillmentSchema, getD1, getDb } from "../../../db";
import {
  fulfillmentCases,
  manualFulfillmentOrderItems,
  manualFulfillmentOrders,
} from "../../../db/schema";
import {
  createBackfillRows,
  createDailyRows,
  createHistoricalRowsBefore,
  currentFulfillmentStatus,
  DEFAULT_GENERATOR_SETTINGS,
  LEDGER_VERSION,
  MAX_GENERATED_RETENTION,
  mergeFulfillmentRecords,
  normalizeGeneratorSettings,
  UPDATE_INTERVAL_DAYS,
  type FulfillmentMarket,
  type FulfillmentService,
  type GenerationContext,
  type GeneratedOrderItem,
  type GeneratedFulfillmentRow,
  type GeneratorSettings,
} from "./generator";
import { findCatalogVariantByDescription } from "../../../lib/product-catalog.ts";
import {
  calculateOrderPricing,
  volumeDiscountBps,
} from "../../../lib/order-pricing.ts";

const LAST_GENERATED_KEY = `${LEDGER_VERSION}:last-generated-date`;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date) {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function addUtcDays(date: Date, days: number) {
  const result = startOfUtcDay(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

async function getMeta(key: string) {
  const d1 = await getD1();
  const result = await d1
    .prepare("SELECT value FROM fulfillment_ledger_meta WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  return result?.value ?? null;
}

async function setMeta(key: string, value: string) {
  const d1 = await getD1();
  await d1
    .prepare(
      `INSERT INTO fulfillment_ledger_meta (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(key, value)
    .run();
}

async function generatorSettings(): Promise<GeneratorSettings> {
  const d1 = await getD1();
  const row = await d1
    .prepare(
      `SELECT display_limit, daily_minimum, daily_maximum,
              large_order_rate_bps, repeat_order_rate_bps,
              multi_product_rate_bps, bulk_gap_days,
              repeat_minimum_days, repeat_maximum_days,
              market_us_weight, market_ca_weight,
              market_br_weight, market_mx_weight,
              generation_enabled
       FROM fulfillment_generator_settings WHERE id = 1`,
    )
    .first<{
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
    }>();
  return normalizeGeneratorSettings(
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
}

async function insertRows(rows: GeneratedFulfillmentRow[]) {
  if (rows.length === 0) return;
  const d1 = await getD1();
  const insertSql = `
    INSERT INTO fulfillment_cases (
      reference, occurred_at, destination, service, order_profile,
      product_name, specification, quantity_units, unit_price_usd_cents,
      packaging_fee_usd_cents, testing_fee_usd_cents,
      logistics_fee_usd_cents, items_json, order_kind,
      repeat_of_reference, customer_key, amount_usd_cents, status,
      cycle_key, is_sample, is_published
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(reference) DO NOTHING
  `;

  // Each statement stays well below SQLite's parameter limit, while D1.batch
  // keeps a 200-row capacity expansion to only four database round trips.
  for (let index = 0; index < rows.length; index += 50) {
    const statements = rows.slice(index, index + 50).map((row) =>
      d1
        .prepare(insertSql)
        .bind(
          row.reference,
          row.occurredAt,
          row.destination,
          row.service,
          row.orderProfile,
          row.productName,
          row.specification,
          row.quantityUnits,
          row.unitPriceUsdCents,
          row.packagingFeeUsdCents,
          row.testingFeeUsdCents,
          row.logisticsFeeUsdCents,
          row.itemsJson,
          row.orderKind,
          row.repeatOfReference,
          row.customerKey,
          row.amountUsdCents,
          row.status,
          row.cycleKey,
          1,
          1,
        ),
    );
    await d1.batch(statements);
  }
}

async function generationContext(): Promise<GenerationContext> {
  const db = await getDb();
  const recentRows = await db
    .select({
      reference: fulfillmentCases.reference,
      occurredAt: fulfillmentCases.occurredAt,
      destination: fulfillmentCases.destination,
      service: fulfillmentCases.service,
      orderProfile: fulfillmentCases.orderProfile,
      productName: fulfillmentCases.productName,
      specification: fulfillmentCases.specification,
      quantityUnits: fulfillmentCases.quantityUnits,
      unitPriceUsdCents: fulfillmentCases.unitPriceUsdCents,
      itemsJson: fulfillmentCases.itemsJson,
      customerKey: fulfillmentCases.customerKey,
    })
    .from(fulfillmentCases)
    .where(eq(fulfillmentCases.isSample, true))
    .orderBy(desc(fulfillmentCases.occurredAt))
    .limit(MAX_GENERATED_RETENTION);

  const parseItems = (row: (typeof recentRows)[number]) => {
    try {
      const parsed = JSON.parse(row.itemsJson) as GeneratedOrderItem[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // Legacy rows intentionally fall back to their original single product.
    }
    const catalogItem = findCatalogVariantByDescription(
      row.productName,
      row.specification,
    );
    return [
      {
        sku: catalogItem?.sku ?? "LEGACY",
        productName: row.productName,
        specification: row.specification,
        quantityUnits: row.quantityUnits,
        retailUnitPriceUsdCents:
          catalogItem?.retailUsdCents ?? row.unitPriceUsdCents,
        discountedUnitPriceUsdCents: row.unitPriceUsdCents,
        lineAmountUsdCents: row.unitPriceUsdCents * row.quantityUnits,
      },
    ];
  };
  const recentBulk = recentRows.filter((row) => row.service === "bulk");

  return {
    lastBulkAt: recentBulk[0]?.occurredAt ?? null,
    lastMegaBulkAt:
      recentBulk.find((row) => row.orderProfile === "3,000+ kits")
        ?.occurredAt ?? null,
    repeatCandidates: recentRows
      .map((row) => ({
        reference: row.reference,
        occurredAt: row.occurredAt,
        destination: row.destination as FulfillmentMarket,
        service: row.service as FulfillmentService,
        items: parseItems(row),
        quantityUnits: row.quantityUnits,
        customerKey:
          row.customerKey ||
          `ACC-${row.reference.replaceAll("-", "").slice(-10)}`,
      }))
      .reverse(),
  };
}

async function advanceDailyLedger(now: Date, settings: GeneratorSettings) {
  const today = startOfUtcDay(now);
  const db = await getDb();
  const countResult = await db
    .select({ id: fulfillmentCases.id })
    .from(fulfillmentCases)
    .where(eq(fulfillmentCases.isSample, true))
    .limit(1);
  let lastGenerated = await getMeta(LAST_GENERATED_KEY);

  if (!settings.generationEnabled) {
    return lastGenerated ?? isoDate(today);
  }

  if (countResult.length === 0 || !lastGenerated) {
    await insertRows(createBackfillRows(settings.displayLimit, today, settings));
    lastGenerated = isoDate(today);
    await setMeta(LAST_GENERATED_KEY, lastGenerated);
    return lastGenerated;
  }

  let context = await generationContext();
  let cursor = addUtcDays(
    new Date(`${lastGenerated}T00:00:00.000Z`),
    1,
  );

  while (cursor.getTime() <= today.getTime()) {
    const result = createDailyRows(cursor, context, settings);
    await insertRows(result.rows);
    context = result.context;
    lastGenerated = isoDate(cursor);
    cursor = addUtcDays(cursor, 1);
  }

  await setMeta(LAST_GENERATED_KEY, lastGenerated);
  return lastGenerated;
}

async function ensureIllustrativeCapacity(
  now: Date,
  settings: GeneratorSettings,
) {
  if (!settings.generationEnabled) return;
  const d1 = await getD1();
  const summary = await d1
    .prepare(
      `SELECT COUNT(*) AS row_count, MIN(occurred_at) AS oldest_date
       FROM fulfillment_cases WHERE is_sample = 1`,
    )
    .first<{ row_count: number; oldest_date: string | null }>();
  const existingCount = Number(summary?.row_count ?? 0);
  const missing = settings.displayLimit - existingCount;
  if (missing <= 0) return;

  if (!summary?.oldest_date) {
    await insertRows(createBackfillRows(missing, now, settings));
    return;
  }

  await insertRows(
    createHistoricalRowsBefore(
      missing,
      new Date(`${summary.oldest_date}T00:00:00.000Z`),
      settings,
    ),
  );
}

/**
 * The database keeps a bounded 500-row simulated history. Changing the public
 * display between 100 and 500 never deletes the currently visible 300 rows;
 * only normal daily rollover eventually expires the oldest sample rows.
 */
async function pruneIllustrativeRows() {
  const d1 = await getD1();
  await d1
    .prepare(
      `DELETE FROM fulfillment_cases
       WHERE is_sample = 1
         AND id NOT IN (
           SELECT id
           FROM fulfillment_cases
           WHERE is_sample = 1
           ORDER BY occurred_at DESC, id DESC
           LIMIT ?
         )`,
    )
    .bind(MAX_GENERATED_RETENTION)
    .run();
}

export async function GET() {
  try {
    await ensureFulfillmentSchema();
    const settings = await generatorSettings();

    const now = new Date();
    const generatedAt = await advanceDailyLedger(now, settings);
    await ensureIllustrativeCapacity(now, settings);
    await pruneIllustrativeRows();

    const db = await getDb();
    const sampleRows = await db
      .select()
      .from(fulfillmentCases)
      .where(
        and(
          eq(fulfillmentCases.isSample, true),
          eq(fulfillmentCases.isPublished, true),
        ),
      )
      .orderBy(
        desc(fulfillmentCases.occurredAt),
        desc(fulfillmentCases.id),
      )
      .limit(settings.displayLimit);

    const manualRows = await db
      .select()
      .from(manualFulfillmentOrders)
      .where(eq(manualFulfillmentOrders.isPublished, true))
      .orderBy(
        desc(manualFulfillmentOrders.occurredAt),
        desc(manualFulfillmentOrders.createdAt),
        desc(manualFulfillmentOrders.id),
      )
      .limit(settings.displayLimit);

    const manualItemRows =
      manualRows.length === 0
        ? []
        : await db
            .select()
            .from(manualFulfillmentOrderItems)
            .where(
              inArray(
                manualFulfillmentOrderItems.orderId,
                manualRows.map((row) => row.id),
              ),
            )
            .orderBy(
              asc(manualFulfillmentOrderItems.orderId),
              asc(manualFulfillmentOrderItems.position),
              asc(manualFulfillmentOrderItems.id),
            );
    const manualItemsByOrder = new Map<
      number,
      typeof manualItemRows
    >();
    for (const item of manualItemRows) {
      const group = manualItemsByOrder.get(item.orderId) ?? [];
      group.push(item);
      manualItemsByOrder.set(item.orderId, group);
    }

    const sampleRecords = sampleRows.map((row) => {
      const { quantityUnits, customerKey, itemsJson, ...publicRow } = row;
      void customerKey;
      const catalogItem = findCatalogVariantByDescription(
        row.productName,
        row.specification,
      );
      let storedItems: GeneratedOrderItem[] = [];
      try {
        const parsed = JSON.parse(itemsJson) as GeneratedOrderItem[];
        if (Array.isArray(parsed)) storedItems = parsed;
      } catch {
        storedItems = [];
      }
      const firstStoredItem = storedItems[0];
      const discountBps =
        row.service === "custom" ? 0 : volumeDiscountBps(quantityUnits);
      const cataloguePricing =
        storedItems.length === 0 &&
        row.service === "catalogue" &&
        catalogItem
          ? calculateOrderPricing({
              retailUnitPriceUsdCents: catalogItem.retailUsdCents,
              quantityUnits,
              service: "catalogue",
            })
          : null;
      return {
        ...publicRow,
        id: `sample-${row.id}`,
        source: "sample" as const,
        items:
          storedItems.length > 0
            ? storedItems.map((item) => ({
                productName: item.productName,
                specification: item.specification,
              }))
            : [
                {
                  productName: row.productName,
                  specification: row.specification,
                },
              ],
        retailUnitPriceUsdCents:
          firstStoredItem?.retailUnitPriceUsdCents ??
          catalogItem?.retailUsdCents ??
          row.unitPriceUsdCents,
        discountBps,
        unitPriceUsdCents:
          firstStoredItem?.discountedUnitPriceUsdCents ??
          cataloguePricing?.discountedUnitPriceUsdCents ??
          row.unitPriceUsdCents,
        packagingFeeUsdCents:
          row.service === "catalogue" ? 0 : row.packagingFeeUsdCents,
        testingFeeUsdCents:
          row.service === "catalogue" ? 0 : row.testingFeeUsdCents,
        logisticsFeeUsdCents:
          row.service === "catalogue" ? 0 : row.logisticsFeeUsdCents,
        amountUsdCents:
          cataloguePricing?.amountUsdCents ?? row.amountUsdCents,
        status: currentFulfillmentStatus(
          {
            occurredAt: row.occurredAt,
            destination: row.destination as FulfillmentMarket,
            service: row.service as FulfillmentService,
            quantityUnits,
          },
          now,
        ),
      };
    });

    const manualRecords = manualRows.map((row) => {
      const storedItems = manualItemsByOrder.get(row.id) ?? [];
      const fallbackUnitPrice = Math.round(
        (row.retailUnitPriceUsdCents * (10_000 - row.discountBps)) / 10_000,
      );
      const items =
        storedItems.length > 0
          ? storedItems
          : [
              {
                productName: row.productName,
                specification: row.specification,
                lineAmountUsdCents: fallbackUnitPrice * row.quantityUnits,
                retailUnitPriceUsdCents: row.retailUnitPriceUsdCents,
                discountedUnitPriceUsdCents: fallbackUnitPrice,
              },
            ];
      const productTotal = items.reduce(
        (sum, item) => sum + item.lineAmountUsdCents,
        0,
      );
      const firstItem = items[0];
      return {
        id: `manual-${row.id}`,
        reference: row.reference,
        occurredAt: row.occurredAt,
        destination: row.destination,
        service: row.service,
        orderProfile: row.orderProfile,
        productName: firstItem.productName,
        specification: firstItem.specification,
        unitPriceUsdCents: firstItem.discountedUnitPriceUsdCents,
        retailUnitPriceUsdCents: firstItem.retailUnitPriceUsdCents,
        discountBps: row.discountBps,
        packagingFeeUsdCents: 0,
        testingFeeUsdCents: 0,
        logisticsFeeUsdCents: 0,
        amountUsdCents: Math.max(
          0,
          productTotal - row.deductionUsdCents,
        ),
        status: row.status,
        isSample: false,
        isPublished: row.isPublished,
        createdAt: row.createdAt,
        source: "manual" as const,
        orderKind: "new" as const,
        repeatOfReference: "",
        items: items.map((item) => ({
          productName: item.productName,
          specification: item.specification,
        })),
      };
    });

    // Reserve room for every published real order, then sort the mixed ledger
    // only by the business order date. Adding an older real order therefore
    // places it at its historical date instead of pinning it to the top.
    const records = mergeFulfillmentRecords(
      manualRecords,
      sampleRecords,
      settings.displayLimit,
    );
    const windowStart = records.at(-1)?.occurredAt ?? isoDate(now);
    const nextUpdateAt = addUtcDays(startOfUtcDay(now), 1);

    return Response.json(
      {
        records,
        count: records.length,
        limit: settings.displayLimit,
        windowStart,
        generatedAt: `${generatedAt}T00:00:00.000Z`,
        nextUpdateAt: nextUpdateAt.toISOString(),
        updateIntervalDays: UPDATE_INTERVAL_DAYS,
        realOrderCount: records.filter((record) => !record.isSample).length,
        dataMode: "mixed_workflow",
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "CDN-Cache-Control": "no-store",
          "Cloudflare-CDN-Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load fulfillment records.";
    return Response.json(
      { error: message },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
