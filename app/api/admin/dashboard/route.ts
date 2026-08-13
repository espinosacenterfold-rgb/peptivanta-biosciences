import { ensureCommunitySchema, getD1 } from "../../../../db";
import { requireFulfillmentAdmin } from "../auth";
import { noStoreJson } from "../../../../lib/customer-auth";
import { unexpectedErrorResponse } from "../../../../lib/server-error";

export async function GET(request: Request) {
  const denied = await requireFulfillmentAdmin(request);
  if (denied) return denied;
  try {
    await ensureCommunitySchema();
    const d1 = await getD1();
    const [stats, pipeline, markets, activity] = await Promise.all([
      d1
        .prepare(
          `SELECT
            (SELECT COUNT(*) FROM manual_fulfillment_orders) AS real_orders,
            (SELECT COUNT(*) FROM manual_fulfillment_orders WHERE is_published = 1) AS published_real_orders,
            (SELECT COUNT(*) FROM manual_fulfillment_orders WHERE status <> 'delivered') AS open_real_orders,
            (SELECT COUNT(*) FROM manual_fulfillment_orders WHERE status = 'delivered') AS delivered_real_orders,
            (SELECT COUNT(*) FROM manual_fulfillment_orders WHERE is_published = 0) AS unpublished_real_orders,
            (SELECT COUNT(*) FROM manual_fulfillment_orders WHERE occurred_at >= date('now', 'start of month')) AS month_real_orders,
            COALESCE((SELECT SUM(amount_usd_cents) FROM manual_fulfillment_orders), 0) AS real_order_value_usd_cents,
            COALESCE((SELECT SUM(amount_usd_cents) FROM manual_fulfillment_orders WHERE occurred_at >= date('now', 'start of month')), 0) AS month_order_value_usd_cents,
            (SELECT COUNT(*) FROM fulfillment_cases WHERE is_sample = 1) AS sample_orders,
            (SELECT COUNT(*) FROM feedback_entries WHERE status = 'pending_review') AS pending_feedback,
            (SELECT COUNT(*) FROM feedback_entries WHERE status = 'approved') AS approved_feedback,
            (SELECT COUNT(*) FROM customers WHERE status IN ('active_unlinked', 'active')) AS customers,
            (SELECT COUNT(*) FROM customers WHERE status = 'active_unlinked') AS unlinked_customers,
            (SELECT COUNT(*) FROM customers WHERE status = 'suspended') AS suspended_customers,
            (SELECT COUNT(*) FROM media_library_assets WHERE status IN ('approved', 'scheduled', 'source_only')) AS media_assets,
            (SELECT COUNT(*) FROM media_library_assets WHERE r2_key <> '' AND datetime(expires_at) <= datetime('now', '+14 days')) AS expiring_media,
            COALESCE((SELECT SUM(size_bytes) FROM media_library_assets WHERE r2_key <> ''), 0) AS media_bytes,
            (SELECT COUNT(*) FROM media_collection_tasks WHERE status = 'pending_review') AS pending_media_tasks,
            COALESCE((SELECT generation_enabled FROM fulfillment_generator_settings WHERE id = 1), 1) AS generator_enabled`,
        )
        .first(),
      d1
        .prepare(
          `SELECT status, COUNT(*) AS count,
                  COALESCE(SUM(amount_usd_cents), 0) AS amount_usd_cents
           FROM manual_fulfillment_orders
           GROUP BY status
           ORDER BY CASE status
             WHEN 'confirmed' THEN 1
             WHEN 'documentation_review' THEN 2
             WHEN 'in_production' THEN 3
             WHEN 'quality_control' THEN 4
             WHEN 'packaging' THEN 5
             WHEN 'dispatched' THEN 6
             WHEN 'delivered' THEN 7
             ELSE 8 END`,
        )
        .all(),
      d1
        .prepare(
          `SELECT destination, COUNT(*) AS count,
                  COALESCE(SUM(amount_usd_cents), 0) AS amount_usd_cents
           FROM manual_fulfillment_orders
           GROUP BY destination
           ORDER BY count DESC, destination ASC`,
        )
        .all(),
      d1
        .prepare(
          `SELECT kind, title, detail, event_at FROM (
             SELECT 'order' AS kind, reference AS title,
                    destination || ' · ' || status AS detail,
                    updated_at AS event_at
             FROM manual_fulfillment_orders
             UNION ALL
             SELECT 'feedback' AS kind, public_id AS title,
                    source_type || ' · ' || status AS detail,
                    updated_at AS event_at
             FROM feedback_entries
             UNION ALL
             SELECT 'customer' AS kind, username AS title,
                    COALESCE(NULLIF(company_name, ''), country_code, 'customer') || ' · ' || status AS detail,
                    updated_at AS event_at
             FROM customers
             UNION ALL
             SELECT 'media' AS kind, COALESCE(NULLIF(source_title, ''), public_id) AS title,
                    source_platform || ' · ' || status AS detail,
                    updated_at AS event_at
             FROM media_library_assets
           )
           ORDER BY datetime(event_at) DESC
           LIMIT 12`,
        )
        .all(),
    ]);
    return noStoreJson({
      stats,
      pipeline: pipeline.results,
      markets: markets.results,
      activity: activity.results,
    });
  } catch (error) {
    return unexpectedErrorResponse("admin-dashboard:get", error);
  }
}
