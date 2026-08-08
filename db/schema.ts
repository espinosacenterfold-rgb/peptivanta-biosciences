import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

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

/**
 * Customer accounts are deliberately small and independent from simulated
 * buyer keys. Credentials are keyed hashes, never reversible plaintext.
 */
export const customers = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull().unique(),
    username: text("username").notNull(),
    usernameNormalized: text("username_normalized").notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    recoveryHash: text("recovery_hash").notNull(),
    recoverySalt: text("recovery_salt").notNull(),
    displayName: text("display_name").notNull().default(""),
    companyName: text("company_name").notNull().default(""),
    countryCode: text("country_code").notNull().default(""),
    locale: text("locale").notNull().default("en"),
    status: text("status").notNull().default("active_unlinked"),
    profileVersion: integer("profile_version").notNull().default(1),
    privacyConsentAt: text("privacy_consent_at").notNull(),
    lastLoginAt: text("last_login_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("customers_status_idx").on(table.status),
    uniqueIndex("customers_username_normalized_idx").on(
      table.usernameNormalized,
    ),
  ],
);

export const customerSessions = sqliteTable(
  "customer_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("customer_sessions_customer_id_idx").on(table.customerId),
    index("customer_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const customerOrderCodes = sqliteTable(
  "customer_order_codes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => manualFulfillmentOrders.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    codeSalt: text("code_salt").notNull(),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("customer_order_codes_order_id_idx").on(table.orderId),
    index("customer_order_codes_expires_at_idx").on(table.expiresAt),
  ],
);

export const customerOrderLinks = sqliteTable(
  "customer_order_links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    orderId: integer("order_id")
      .notNull()
      .references(() => manualFulfillmentOrders.id, { onDelete: "cascade" }),
    linkedAt: text("linked_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("customer_order_links_order_id_idx").on(table.orderId),
    index("customer_order_links_customer_id_idx").on(table.customerId),
  ],
);

export const customerProfileEvents = sqliteTable(
  "customer_profile_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    actor: text("actor").notNull(),
    beforeJson: text("before_json").notNull(),
    afterJson: text("after_json").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("customer_profile_events_customer_id_idx").on(table.customerId),
  ],
);

export const authRateLimits = sqliteTable("auth_rate_limits", {
  key: text("key").primaryKey(),
  action: text("action").notNull(),
  attemptCount: integer("attempt_count").notNull().default(1),
  expiresAt: text("expires_at").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * R2 stores the bytes; this table keeps only searchable metadata and expiry.
 * Link-only rows are allowed so an administrator can use an external helper,
 * then attach an authorized local upload to the same source record.
 */
export const mediaLibraryAssets = sqliteTable(
  "media_library_assets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull().unique(),
    status: text("status").notNull().default("pending"),
    sourcePlatform: text("source_platform").notNull().default("manual"),
    sourceUrl: text("source_url").notNull().default(""),
    sourceTitle: text("source_title").notNull().default(""),
    sourceAuthor: text("source_author").notNull().default(""),
    rightsBasis: text("rights_basis").notNull().default("owned_or_authorized"),
    rightsConfirmedAt: text("rights_confirmed_at").notNull(),
    originalFilename: text("original_filename").notNull().default(""),
    r2Key: text("r2_key").notNull().default(""),
    mimeType: text("mime_type").notNull().default(""),
    sizeBytes: integer("size_bytes").notNull().default(0),
    width: integer("width").notNull().default(0),
    height: integer("height").notNull().default(0),
    tagsJson: text("tags_json").notNull().default("[]"),
    availableFrom: text("available_from").notNull(),
    expiresAt: text("expires_at").notNull(),
    useCount: integer("use_count").notNull().default(0),
    lastUsedAt: text("last_used_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("media_library_assets_status_available_idx").on(
      table.status,
      table.availableFrom,
    ),
    index("media_library_assets_expires_at_idx").on(table.expiresAt),
  ],
);

/**
 * Capacity guardrails for the private R2 feedback-media bucket.
 *
 * The defaults intentionally use the whole 10 GB Standard-storage free tier,
 * while the 9.5 GB cleanup target leaves a 0.5 GB safety buffer after a
 * capacity cleanup. The hard limit is also capped in the API, so an
 * administrator cannot accidentally configure this site above the free tier.
 */
export const mediaStorageSettings = sqliteTable("media_storage_settings", {
  id: integer("id").primaryKey().default(1),
  hardLimitBytes: integer("hard_limit_bytes")
    .notNull()
    .default(10_000_000_000),
  cleanupTargetBytes: integer("cleanup_target_bytes")
    .notNull()
    .default(9_500_000_000),
  retentionDays: integer("retention_days").notNull().default(180),
  protectCustomerMedia: integer("protect_customer_media", { mode: "boolean" })
    .notNull()
    .default(true),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * A small audit trail for automatic, retention, failed-upload, and manual
 * object removals. It preserves enough information to explain a cleanup
 * without keeping the deleted image itself.
 */
export const mediaCleanupEvents = sqliteTable(
  "media_cleanup_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    assetPublicId: text("asset_public_id").notNull().default(""),
    sourceTitle: text("source_title").notNull().default(""),
    r2Key: text("r2_key").notNull().default(""),
    sizeBytes: integer("size_bytes").notNull().default(0),
    reason: text("reason").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("media_cleanup_events_created_at_idx").on(table.createdAt),
  ],
);

/**
 * A scheduled research queue for the media administrator. It creates only a
 * Xiaohongshu keyword/search task: no third-party post is copied, downloaded,
 * or published automatically. A selected source still has to pass the normal
 * ownership/authorization confirmation before its file can enter R2.
 */
export const mediaCollectionSettings = sqliteTable(
  "media_collection_settings",
  {
    id: integer("id").primaryKey().default(1),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    intervalDays: integer("interval_days").notNull().default(3),
    keywordsJson: text("keywords_json")
      .notNull()
      .default('["多肽包装","实验室产品包装","外贸发货包装","COA检测报告"]'),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
);

export const mediaCollectionTasks = sqliteTable(
  "media_collection_tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull().unique(),
    platform: text("platform").notNull().default("xiaohongshu"),
    keyword: text("keyword").notNull(),
    searchUrl: text("search_url").notNull(),
    status: text("status").notNull().default("pending_review"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    reviewedAt: text("reviewed_at"),
  },
  (table) => [
    index("media_collection_tasks_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);

export const feedbackEntries = sqliteTable(
  "feedback_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull().unique(),
    sourceType: text("source_type").notNull(),
    manualOrderId: integer("manual_order_id").references(
      () => manualFulfillmentOrders.id,
      { onDelete: "set null" },
    ),
    sampleCaseId: integer("sample_case_id").references(
      () => fulfillmentCases.id,
      { onDelete: "set null" },
    ),
    customerId: integer("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    mediaAssetId: integer("media_asset_id").references(
      () => mediaLibraryAssets.id,
      { onDelete: "set null" },
    ),
    countryCode: text("country_code").notNull().default(""),
    service: text("service").notNull().default(""),
    orderKind: text("order_kind").notNull().default("new"),
    orderSnapshotJson: text("order_snapshot_json").notNull().default("{}"),
    locale: text("locale").notNull().default("en"),
    contentJson: text("content_json").notNull().default("{}"),
    originalText: text("original_text").notNull().default(""),
    publicText: text("public_text").notNull().default(""),
    status: text("status").notNull().default("pending_review"),
    riskFlagsJson: text("risk_flags_json").notNull().default("[]"),
    templateVersion: text("template_version").notNull().default(""),
    submittedAt: text("submitted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    reviewedAt: text("reviewed_at"),
    publishedAt: text("published_at"),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("feedback_entries_status_published_idx").on(
      table.status,
      table.publishedAt,
    ),
    index("feedback_entries_source_submitted_idx").on(
      table.sourceType,
      table.submittedAt,
    ),
    index("feedback_entries_expires_at_idx").on(table.expiresAt),
    uniqueIndex("feedback_entries_manual_order_idx").on(table.manualOrderId),
    uniqueIndex("feedback_entries_sample_case_idx").on(table.sampleCaseId),
  ],
);

export const feedbackModerationActions = sqliteTable(
  "feedback_moderation_actions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    feedbackId: integer("feedback_id")
      .notNull()
      .references(() => feedbackEntries.id, { onDelete: "cascade" }),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    note: text("note").notNull().default(""),
    beforeJson: text("before_json").notNull().default("{}"),
    afterJson: text("after_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("feedback_actions_feedback_id_idx").on(table.feedbackId),
  ],
);

export const feedbackGeneratorSettings = sqliteTable(
  "feedback_generator_settings",
  {
    id: integer("id").primaryKey().default(1),
    generationEnabled: integer("generation_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    dailyMaximum: integer("daily_maximum").notNull().default(1),
    generationRateBps: integer("generation_rate_bps").notNull().default(3500),
    generationIntervalDays: integer("generation_interval_days")
      .notNull()
      .default(3),
    publicLimit: integer("public_limit").notNull().default(48),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
);

export const feedbackGeneratorMeta = sqliteTable(
  "feedback_generator_meta",
  {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
);
