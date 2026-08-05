import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

async function getD1Binding() {
  const { env } = await import("cloudflare:workers");

  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database.",
    );
  }

  return env.DB;
}

export async function getD1() {
  return getD1Binding();
}

export async function getDb() {
  return drizzle(await getD1Binding(), { schema });
}

const addedColumns = [
  {
    name: "amount_usd_cents",
    sql: "ALTER TABLE fulfillment_cases ADD COLUMN amount_usd_cents INTEGER DEFAULT 0 NOT NULL",
  },
  {
    name: "cycle_key",
    sql: "ALTER TABLE fulfillment_cases ADD COLUMN cycle_key TEXT DEFAULT 'legacy' NOT NULL",
  },
  {
    name: "product_name",
    sql: "ALTER TABLE fulfillment_cases ADD COLUMN product_name TEXT DEFAULT '' NOT NULL",
  },
  {
    name: "specification",
    sql: "ALTER TABLE fulfillment_cases ADD COLUMN specification TEXT DEFAULT '' NOT NULL",
  },
  {
    name: "quantity_units",
    sql: "ALTER TABLE fulfillment_cases ADD COLUMN quantity_units INTEGER DEFAULT 0 NOT NULL",
  },
  {
    name: "unit_price_usd_cents",
    sql: "ALTER TABLE fulfillment_cases ADD COLUMN unit_price_usd_cents INTEGER DEFAULT 0 NOT NULL",
  },
  {
    name: "packaging_fee_usd_cents",
    sql: "ALTER TABLE fulfillment_cases ADD COLUMN packaging_fee_usd_cents INTEGER DEFAULT 0 NOT NULL",
  },
  {
    name: "testing_fee_usd_cents",
    sql: "ALTER TABLE fulfillment_cases ADD COLUMN testing_fee_usd_cents INTEGER DEFAULT 0 NOT NULL",
  },
  {
    name: "logistics_fee_usd_cents",
    sql: "ALTER TABLE fulfillment_cases ADD COLUMN logistics_fee_usd_cents INTEGER DEFAULT 0 NOT NULL",
  },
] as const;

const manualOrderAddedColumns = [
  {
    name: "sku",
    sql: "ALTER TABLE manual_fulfillment_orders ADD COLUMN sku TEXT DEFAULT '' NOT NULL",
  },
  {
    name: "quantity_units",
    sql: "ALTER TABLE manual_fulfillment_orders ADD COLUMN quantity_units INTEGER DEFAULT 1 NOT NULL",
  },
  {
    name: "retail_unit_price_usd_cents",
    sql: "ALTER TABLE manual_fulfillment_orders ADD COLUMN retail_unit_price_usd_cents INTEGER DEFAULT 0 NOT NULL",
  },
  {
    name: "discount_bps",
    sql: "ALTER TABLE manual_fulfillment_orders ADD COLUMN discount_bps INTEGER DEFAULT 0 NOT NULL",
  },
  {
    name: "service_fee_usd_cents",
    sql: "ALTER TABLE manual_fulfillment_orders ADD COLUMN service_fee_usd_cents INTEGER DEFAULT 0 NOT NULL",
  },
  {
    name: "shipping_fee_usd_cents",
    sql: "ALTER TABLE manual_fulfillment_orders ADD COLUMN shipping_fee_usd_cents INTEGER DEFAULT 0 NOT NULL",
  },
  {
    name: "deduction_usd_cents",
    sql: "ALTER TABLE manual_fulfillment_orders ADD COLUMN deduction_usd_cents INTEGER DEFAULT 0 NOT NULL",
  },
] as const;

export async function ensureFulfillmentSchema() {
  const d1 = await getD1Binding();
  await d1.batch([
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS fulfillment_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        reference TEXT NOT NULL UNIQUE,
        occurred_at TEXT NOT NULL,
        destination TEXT NOT NULL,
        service TEXT NOT NULL,
        order_profile TEXT NOT NULL,
        product_name TEXT DEFAULT '' NOT NULL,
        specification TEXT DEFAULT '' NOT NULL,
        quantity_units INTEGER DEFAULT 0 NOT NULL,
        unit_price_usd_cents INTEGER DEFAULT 0 NOT NULL,
        packaging_fee_usd_cents INTEGER DEFAULT 0 NOT NULL,
        testing_fee_usd_cents INTEGER DEFAULT 0 NOT NULL,
        logistics_fee_usd_cents INTEGER DEFAULT 0 NOT NULL,
        amount_usd_cents INTEGER DEFAULT 0 NOT NULL,
        status TEXT NOT NULL,
        cycle_key TEXT DEFAULT 'legacy' NOT NULL,
        is_sample INTEGER DEFAULT 1 NOT NULL,
        is_published INTEGER DEFAULT 1 NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS fulfillment_ledger_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS manual_fulfillment_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        reference TEXT NOT NULL UNIQUE,
        occurred_at TEXT NOT NULL,
        destination TEXT NOT NULL,
        service TEXT NOT NULL,
        order_profile TEXT NOT NULL,
        sku TEXT DEFAULT '' NOT NULL,
        product_name TEXT NOT NULL,
        specification TEXT DEFAULT '' NOT NULL,
        quantity_units INTEGER DEFAULT 1 NOT NULL,
        retail_unit_price_usd_cents INTEGER DEFAULT 0 NOT NULL,
        discount_bps INTEGER DEFAULT 0 NOT NULL,
        service_fee_usd_cents INTEGER DEFAULT 0 NOT NULL,
        shipping_fee_usd_cents INTEGER DEFAULT 0 NOT NULL,
        deduction_usd_cents INTEGER DEFAULT 0 NOT NULL,
        amount_usd_cents INTEGER NOT NULL,
        status TEXT NOT NULL,
        is_published INTEGER DEFAULT 1 NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS manual_fulfillment_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        order_id INTEGER NOT NULL REFERENCES manual_fulfillment_orders(id) ON DELETE CASCADE,
        sku TEXT NOT NULL,
        product_name TEXT NOT NULL,
        specification TEXT NOT NULL,
        quantity_units INTEGER NOT NULL,
        retail_unit_price_usd_cents INTEGER NOT NULL,
        discounted_unit_price_usd_cents INTEGER NOT NULL,
        line_amount_usd_cents INTEGER NOT NULL,
        position INTEGER DEFAULT 0 NOT NULL
      )
    `),
    d1.prepare(
      "CREATE INDEX IF NOT EXISTS fulfillment_cases_occurred_at_idx ON fulfillment_cases (occurred_at)",
    ),
    d1.prepare(
      "CREATE INDEX IF NOT EXISTS fulfillment_cases_published_idx ON fulfillment_cases (is_published)",
    ),
    d1.prepare(
      "CREATE INDEX IF NOT EXISTS manual_fulfillment_orders_occurred_at_idx ON manual_fulfillment_orders (occurred_at)",
    ),
    d1.prepare(
      "CREATE INDEX IF NOT EXISTS manual_fulfillment_orders_published_idx ON manual_fulfillment_orders (is_published)",
    ),
    d1.prepare(
      "CREATE INDEX IF NOT EXISTS manual_fulfillment_order_items_order_id_idx ON manual_fulfillment_order_items (order_id)",
    ),
  ]);

  const tableInfo = await d1
    .prepare("PRAGMA table_info(fulfillment_cases)")
    .all<{ name: string }>();
  const columns = new Set(tableInfo.results.map((column) => column.name));

  for (const column of addedColumns) {
    if (!columns.has(column.name)) {
      await d1.prepare(column.sql).run();
    }
  }

  const manualTableInfo = await d1
    .prepare("PRAGMA table_info(manual_fulfillment_orders)")
    .all<{ name: string }>();
  const manualColumns = new Set(
    manualTableInfo.results.map((column) => column.name),
  );

  for (const column of manualOrderAddedColumns) {
    if (!manualColumns.has(column.name)) {
      await d1.prepare(column.sql).run();
    }
  }

  await d1.batch([
    d1.prepare(
      "CREATE INDEX IF NOT EXISTS fulfillment_cases_cycle_key_idx ON fulfillment_cases (cycle_key)",
    ),
    d1.prepare(
      "CREATE INDEX IF NOT EXISTS fulfillment_cases_service_occurred_at_idx ON fulfillment_cases (service, occurred_at)",
    ),
  ]);
}
