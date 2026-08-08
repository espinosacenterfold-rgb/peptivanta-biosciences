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

export async function getMediaStore() {
  const { env } = await import("cloudflare:workers");
  const runtimeEnv = env as unknown as { MEDIA?: R2Bucket };
  if (!runtimeEnv.MEDIA) {
    throw new Error(
      "Cloudflare R2 binding `MEDIA` is unavailable. Configure the logical R2 binding before uploading feedback media.",
    );
  }
  return runtimeEnv.MEDIA;
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
  {
    name: "items_json",
    sql: "ALTER TABLE fulfillment_cases ADD COLUMN items_json TEXT DEFAULT '[]' NOT NULL",
  },
  {
    name: "order_kind",
    sql: "ALTER TABLE fulfillment_cases ADD COLUMN order_kind TEXT DEFAULT 'new' NOT NULL",
  },
  {
    name: "repeat_of_reference",
    sql: "ALTER TABLE fulfillment_cases ADD COLUMN repeat_of_reference TEXT DEFAULT '' NOT NULL",
  },
  {
    name: "customer_key",
    sql: "ALTER TABLE fulfillment_cases ADD COLUMN customer_key TEXT DEFAULT '' NOT NULL",
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

const generatorSettingAddedColumns = [
  {
    name: "multi_product_rate_bps",
    sql: "ALTER TABLE fulfillment_generator_settings ADD COLUMN multi_product_rate_bps INTEGER DEFAULT 5000 NOT NULL",
  },
  {
    name: "bulk_gap_days",
    sql: "ALTER TABLE fulfillment_generator_settings ADD COLUMN bulk_gap_days INTEGER DEFAULT 20 NOT NULL",
  },
  {
    name: "repeat_minimum_days",
    sql: "ALTER TABLE fulfillment_generator_settings ADD COLUMN repeat_minimum_days INTEGER DEFAULT 5 NOT NULL",
  },
  {
    name: "repeat_maximum_days",
    sql: "ALTER TABLE fulfillment_generator_settings ADD COLUMN repeat_maximum_days INTEGER DEFAULT 14 NOT NULL",
  },
  {
    name: "market_us_weight",
    sql: "ALTER TABLE fulfillment_generator_settings ADD COLUMN market_us_weight INTEGER DEFAULT 48 NOT NULL",
  },
  {
    name: "market_ca_weight",
    sql: "ALTER TABLE fulfillment_generator_settings ADD COLUMN market_ca_weight INTEGER DEFAULT 25 NOT NULL",
  },
  {
    name: "market_br_weight",
    sql: "ALTER TABLE fulfillment_generator_settings ADD COLUMN market_br_weight INTEGER DEFAULT 17 NOT NULL",
  },
  {
    name: "market_mx_weight",
    sql: "ALTER TABLE fulfillment_generator_settings ADD COLUMN market_mx_weight INTEGER DEFAULT 10 NOT NULL",
  },
] as const;

let fulfillmentSchemaPromise: Promise<void> | null = null;
let communitySchemaPromise: Promise<void> | null = null;

export function ensureFulfillmentSchema() {
  if (!fulfillmentSchemaPromise) {
    fulfillmentSchemaPromise = initializeFulfillmentSchema().catch((error) => {
      fulfillmentSchemaPromise = null;
      throw error;
    });
  }
  return fulfillmentSchemaPromise;
}

async function initializeFulfillmentSchema() {
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
        items_json TEXT DEFAULT '[]' NOT NULL,
        order_kind TEXT DEFAULT 'new' NOT NULL,
        repeat_of_reference TEXT DEFAULT '' NOT NULL,
        customer_key TEXT DEFAULT '' NOT NULL,
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
      CREATE TABLE IF NOT EXISTS fulfillment_generator_settings (
        id INTEGER PRIMARY KEY DEFAULT 1 NOT NULL,
        display_limit INTEGER DEFAULT 300 NOT NULL,
        daily_minimum INTEGER DEFAULT 10 NOT NULL,
        daily_maximum INTEGER DEFAULT 30 NOT NULL,
        large_order_rate_bps INTEGER DEFAULT 1500 NOT NULL,
        repeat_order_rate_bps INTEGER DEFAULT 3500 NOT NULL,
        multi_product_rate_bps INTEGER DEFAULT 5000 NOT NULL,
        bulk_gap_days INTEGER DEFAULT 20 NOT NULL,
        repeat_minimum_days INTEGER DEFAULT 5 NOT NULL,
        repeat_maximum_days INTEGER DEFAULT 14 NOT NULL,
        market_us_weight INTEGER DEFAULT 48 NOT NULL,
        market_ca_weight INTEGER DEFAULT 25 NOT NULL,
        market_br_weight INTEGER DEFAULT 17 NOT NULL,
        market_mx_weight INTEGER DEFAULT 10 NOT NULL,
        generation_enabled INTEGER DEFAULT 1 NOT NULL,
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

  const generatorTableInfo = await d1
    .prepare("PRAGMA table_info(fulfillment_generator_settings)")
    .all<{ name: string }>();
  const generatorColumns = new Set(
    generatorTableInfo.results.map((column) => column.name),
  );

  for (const column of generatorSettingAddedColumns) {
    if (!generatorColumns.has(column.name)) {
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
    d1.prepare(`
      INSERT INTO fulfillment_generator_settings (
        id, display_limit, daily_minimum, daily_maximum,
        large_order_rate_bps, repeat_order_rate_bps, generation_enabled
      ) VALUES (1, 300, 10, 30, 1500, 3500, 1)
      ON CONFLICT(id) DO NOTHING
    `),
  ]);
}

/**
 * Additive community schema. It intentionally calls the existing fulfillment
 * initializer first because customer order links and feedback rows reference
 * the two established order tables.
 */
export function ensureCommunitySchema() {
  if (!communitySchemaPromise) {
    communitySchemaPromise = initializeCommunitySchema().catch((error) => {
      communitySchemaPromise = null;
      throw error;
    });
  }
  return communitySchemaPromise;
}

async function initializeCommunitySchema() {
  await ensureFulfillmentSchema();
  const d1 = await getD1Binding();

  await d1.batch([
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        username_normalized TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        recovery_hash TEXT NOT NULL,
        recovery_salt TEXT NOT NULL,
        display_name TEXT DEFAULT '' NOT NULL,
        company_name TEXT DEFAULT '' NOT NULL,
        country_code TEXT DEFAULT '' NOT NULL,
        locale TEXT DEFAULT 'en' NOT NULL,
        status TEXT DEFAULT 'active_unlinked' NOT NULL,
        profile_version INTEGER DEFAULT 1 NOT NULL,
        privacy_consent_at TEXT NOT NULL,
        last_login_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS customer_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS customer_order_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        order_id INTEGER NOT NULL REFERENCES manual_fulfillment_orders(id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL,
        code_salt TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS customer_order_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        order_id INTEGER NOT NULL UNIQUE REFERENCES manual_fulfillment_orders(id) ON DELETE CASCADE,
        linked_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS customer_profile_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        actor TEXT NOT NULL,
        before_json TEXT NOT NULL,
        after_json TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS auth_rate_limits (
        key TEXT PRIMARY KEY NOT NULL,
        action TEXT NOT NULL,
        attempt_count INTEGER DEFAULT 1 NOT NULL,
        expires_at TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS media_library_assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id TEXT NOT NULL UNIQUE,
        status TEXT DEFAULT 'pending' NOT NULL,
        source_platform TEXT DEFAULT 'manual' NOT NULL,
        source_url TEXT DEFAULT '' NOT NULL,
        source_title TEXT DEFAULT '' NOT NULL,
        source_author TEXT DEFAULT '' NOT NULL,
        rights_basis TEXT DEFAULT 'owned_or_authorized' NOT NULL,
        rights_confirmed_at TEXT NOT NULL,
        original_filename TEXT DEFAULT '' NOT NULL,
        r2_key TEXT DEFAULT '' NOT NULL,
        mime_type TEXT DEFAULT '' NOT NULL,
        size_bytes INTEGER DEFAULT 0 NOT NULL,
        width INTEGER DEFAULT 0 NOT NULL,
        height INTEGER DEFAULT 0 NOT NULL,
        tags_json TEXT DEFAULT '[]' NOT NULL,
        available_from TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        use_count INTEGER DEFAULT 0 NOT NULL,
        last_used_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS feedback_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        public_id TEXT NOT NULL UNIQUE,
        source_type TEXT NOT NULL,
        manual_order_id INTEGER UNIQUE REFERENCES manual_fulfillment_orders(id) ON DELETE SET NULL,
        sample_case_id INTEGER UNIQUE REFERENCES fulfillment_cases(id) ON DELETE SET NULL,
        customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        media_asset_id INTEGER REFERENCES media_library_assets(id) ON DELETE SET NULL,
        country_code TEXT DEFAULT '' NOT NULL,
        service TEXT DEFAULT '' NOT NULL,
        order_kind TEXT DEFAULT 'new' NOT NULL,
        order_snapshot_json TEXT DEFAULT '{}' NOT NULL,
        locale TEXT DEFAULT 'en' NOT NULL,
        content_json TEXT DEFAULT '{}' NOT NULL,
        original_text TEXT DEFAULT '' NOT NULL,
        public_text TEXT DEFAULT '' NOT NULL,
        status TEXT DEFAULT 'pending_review' NOT NULL,
        risk_flags_json TEXT DEFAULT '[]' NOT NULL,
        template_version TEXT DEFAULT '' NOT NULL,
        submitted_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        reviewed_at TEXT,
        published_at TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS feedback_moderation_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        feedback_id INTEGER NOT NULL REFERENCES feedback_entries(id) ON DELETE CASCADE,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        note TEXT DEFAULT '' NOT NULL,
        before_json TEXT DEFAULT '{}' NOT NULL,
        after_json TEXT DEFAULT '{}' NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS feedback_generator_settings (
        id INTEGER PRIMARY KEY DEFAULT 1 NOT NULL,
        generation_enabled INTEGER DEFAULT 1 NOT NULL,
        daily_maximum INTEGER DEFAULT 1 NOT NULL,
        generation_rate_bps INTEGER DEFAULT 3500 NOT NULL,
        public_limit INTEGER DEFAULT 48 NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS feedback_generator_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `),
  ]);

  await d1.batch([
    d1.prepare("CREATE INDEX IF NOT EXISTS customers_status_idx ON customers (status)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS customer_sessions_customer_id_idx ON customer_sessions (customer_id)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS customer_sessions_expires_at_idx ON customer_sessions (expires_at)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS customer_order_codes_order_id_idx ON customer_order_codes (order_id)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS customer_order_codes_expires_at_idx ON customer_order_codes (expires_at)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS customer_order_links_customer_id_idx ON customer_order_links (customer_id)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS customer_profile_events_customer_id_idx ON customer_profile_events (customer_id)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS media_library_assets_status_available_idx ON media_library_assets (status, available_from)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS media_library_assets_expires_at_idx ON media_library_assets (expires_at)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS feedback_entries_status_published_idx ON feedback_entries (status, published_at)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS feedback_entries_source_submitted_idx ON feedback_entries (source_type, submitted_at)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS feedback_entries_expires_at_idx ON feedback_entries (expires_at)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS feedback_actions_feedback_id_idx ON feedback_moderation_actions (feedback_id)"),
    d1.prepare(`
      INSERT INTO feedback_generator_settings (
        id, generation_enabled, daily_maximum, generation_rate_bps, public_limit
      ) VALUES (1, 1, 1, 3500, 48)
      ON CONFLICT(id) DO NOTHING
    `),
    d1.prepare("PRAGMA optimize"),
  ]);
}
