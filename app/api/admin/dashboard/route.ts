import { ensureCommunitySchema, getD1 } from "../../../../db";
import { requireFulfillmentAdmin } from "../auth";
import { noStoreJson } from "../../../../lib/customer-auth";

export async function GET(request: Request) {
  const denied = await requireFulfillmentAdmin(request);
  if (denied) return denied;
  try {
    await ensureCommunitySchema();
    const d1 = await getD1();
    const row = await d1
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM manual_fulfillment_orders) AS real_orders,
          (SELECT COUNT(*) FROM fulfillment_cases WHERE is_sample = 1) AS sample_orders,
          (SELECT COUNT(*) FROM feedback_entries WHERE status = 'pending_review') AS pending_feedback,
          (SELECT COUNT(*) FROM customers WHERE status IN ('active_unlinked', 'active')) AS customers,
          (SELECT COUNT(*) FROM media_library_assets WHERE status IN ('approved', 'scheduled', 'source_only')) AS media_assets`,
      )
      .first();
    return noStoreJson({ stats: row });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Unable to load the control panel." },
      { status: 500 },
    );
  }
}
