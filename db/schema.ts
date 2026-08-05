import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const fulfillmentCases = sqliteTable(
  "fulfillment_cases",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reference: text("reference").notNull().unique(),
    occurredAt: text("occurred_at").notNull(),
    destination: text("destination").notNull(),
    service: text("service").notNull(),
    orderProfile: text("order_profile").notNull(),
    productName: text("product_name").notNull().default(""),
    specification: text("specification").notNull().default(""),
    quantityUnits: integer("quantity_units").notNull().default(0),
    unitPriceUsdCents: integer("unit_price_usd_cents").notNull().default(0),
    packagingFeeUsdCents: integer("packaging_fee_usd_cents")
      .notNull()
      .default(0),
    testingFeeUsdCents: integer("testing_fee_usd_cents")
      .notNull()
      .default(0),
    logisticsFeeUsdCents: integer("logistics_fee_usd_cents")
      .notNull()
      .default(0),
    /**
     * JSON product lines are additive: legacy rows keep their original single
     * product columns, while newer generated orders can show a real assembly
     * of two or three catalogue products.
     */
    itemsJson: text("items_json").notNull().default("[]"),
    orderKind: text("order_kind").notNull().default("new"),
    repeatOfReference: text("repeat_of_reference").notNull().default(""),
    customerKey: text("customer_key").notNull().default(""),
    amountUsdCents: integer("amount_usd_cents").notNull().default(0),
    status: text("status").notNull(),
    cycleKey: text("cycle_key").notNull().default("legacy"),
    isSample: integer("is_sample", { mode: "boolean" })
      .notNull()
      .default(true),
    isPublished: integer("is_published", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("fulfillment_cases_occurred_at_idx").on(table.occurredAt),
    index("fulfillment_cases_cycle_key_idx").on(table.cycleKey),
    index("fulfillment_cases_published_idx").on(table.isPublished),
    index("fulfillment_cases_service_occurred_at_idx").on(
      table.service,
      table.occurredAt,
    ),
  ],
);

export const fulfillmentLedgerMeta = sqliteTable(
  "fulfillment_ledger_meta",
  {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
);

/**
 * Isolated controls for the illustrative-order generator. These settings do
 * not share a table or mutation endpoint with genuine customer orders.
 */
export const fulfillmentGeneratorSettings = sqliteTable(
  "fulfillment_generator_settings",
  {
    id: integer("id").primaryKey().default(1),
    displayLimit: integer("display_limit").notNull().default(300),
    dailyMinimum: integer("daily_minimum").notNull().default(10),
    dailyMaximum: integer("daily_maximum").notNull().default(30),
    largeOrderRateBps: integer("large_order_rate_bps")
      .notNull()
      .default(1500),
    repeatOrderRateBps: integer("repeat_order_rate_bps")
      .notNull()
      .default(3500),
    multiProductRateBps: integer("multi_product_rate_bps")
      .notNull()
      .default(5000),
    bulkGapDays: integer("bulk_gap_days").notNull().default(20),
    repeatMinimumDays: integer("repeat_minimum_days").notNull().default(5),
    repeatMaximumDays: integer("repeat_maximum_days").notNull().default(14),
    marketUsWeight: integer("market_us_weight").notNull().default(48),
    marketCaWeight: integer("market_ca_weight").notNull().default(25),
    marketBrWeight: integer("market_br_weight").notNull().default(17),
    marketMxWeight: integer("market_mx_weight").notNull().default(10),
    generationEnabled: integer("generation_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
);

/**
 * Real orders are intentionally stored separately from generated sample rows.
 * The simulator never inserts, updates, expires, or deletes records in this
 * table. Public routes may merge published rows from both tables for display.
 */
export const manualFulfillmentOrders = sqliteTable(
  "manual_fulfillment_orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reference: text("reference").notNull().unique(),
    occurredAt: text("occurred_at").notNull(),
    destination: text("destination").notNull(),
    service: text("service").notNull(),
    orderProfile: text("order_profile").notNull(),
    sku: text("sku").notNull().default(""),
    productName: text("product_name").notNull(),
    specification: text("specification").notNull().default(""),
    quantityUnits: integer("quantity_units").notNull().default(1),
    retailUnitPriceUsdCents: integer("retail_unit_price_usd_cents")
      .notNull()
      .default(0),
    discountBps: integer("discount_bps").notNull().default(0),
    serviceFeeUsdCents: integer("service_fee_usd_cents")
      .notNull()
      .default(0),
    shippingFeeUsdCents: integer("shipping_fee_usd_cents")
      .notNull()
      .default(0),
    deductionUsdCents: integer("deduction_usd_cents")
      .notNull()
      .default(0),
    amountUsdCents: integer("amount_usd_cents").notNull(),
    status: text("status").notNull(),
    isPublished: integer("is_published", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("manual_fulfillment_orders_occurred_at_idx").on(table.occurredAt),
    index("manual_fulfillment_orders_published_idx").on(table.isPublished),
  ],
);

/**
 * Product lines belonging to a real order. Keeping lines in a child table
 * allows one customer order to contain several catalogue products and
 * specifications without flattening them into an ambiguous text field.
 */
export const manualFulfillmentOrderItems = sqliteTable(
  "manual_fulfillment_order_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => manualFulfillmentOrders.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    productName: text("product_name").notNull(),
    specification: text("specification").notNull(),
    quantityUnits: integer("quantity_units").notNull(),
    retailUnitPriceUsdCents: integer("retail_unit_price_usd_cents").notNull(),
    discountedUnitPriceUsdCents: integer("discounted_unit_price_usd_cents")
      .notNull(),
    lineAmountUsdCents: integer("line_amount_usd_cents").notNull(),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    index("manual_fulfillment_order_items_order_id_idx").on(table.orderId),
  ],
);
