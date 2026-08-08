import { ensureCommunitySchema, getD1 } from "../../../../db";
import { requireFulfillmentAdmin } from "../auth";
import { maintainFeedbackLedger } from "../../../../lib/feedback-ledger";
import { noStoreJson, requireSameOrigin } from "../../../../lib/customer-auth";
import { feedbackRiskFlags } from "../../../../lib/feedback";

async function feedbackPayload() {
  const d1 = await getD1();
  const feedback = await d1
    .prepare(
      `SELECT f.*, c.username, c.company_name,
              o.reference AS manual_reference,
              m.public_id AS media_public_id, m.source_title AS media_title
       FROM feedback_entries f
       LEFT JOIN customers c ON c.id = f.customer_id
       LEFT JOIN manual_fulfillment_orders o ON o.id = f.manual_order_id
       LEFT JOIN media_library_assets m ON m.id = f.media_asset_id
       WHERE datetime(f.expires_at) > CURRENT_TIMESTAMP
       ORDER BY CASE WHEN f.status = 'pending_review' THEN 0 ELSE 1 END,
                datetime(f.submitted_at) DESC, f.id DESC
       LIMIT 300`,
    )
    .all();
  const settings = await d1
    .prepare("SELECT * FROM feedback_generator_settings WHERE id = 1")
    .first();
  const media = await d1
    .prepare(
      `SELECT id, public_id, source_title, tags_json
       FROM media_library_assets
       WHERE status = 'approved' AND r2_key <> ''
         AND datetime(expires_at) > CURRENT_TIMESTAMP
       ORDER BY use_count ASC, id DESC LIMIT 200`,
    )
    .all();
  return { feedback: feedback.results, settings, media: media.results };
}

export async function GET(request: Request) {
  const denied = await requireFulfillmentAdmin(request);
  if (denied) return denied;
  try {
    await maintainFeedbackLedger();
    return noStoreJson(await feedbackPayload());
  } catch (error) {
    return noStoreJson({ error: error instanceof Error ? error.message : "Unable to load feedback." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const denied = await requireFulfillmentAdmin(request);
  if (denied) return denied;
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  try {
    await ensureCommunitySchema();
    const body = (await request.json()) as {
      action?: string;
      feedbackId?: number;
      publicText?: string;
      note?: string;
      mediaAssetId?: number | null;
      generationEnabled?: boolean;
      dailyMaximum?: number;
      generationIntervalDays?: number;
      publicLimit?: number;
    };
    const d1 = await getD1();
    if (body.action === "generate_now") {
      const generation = await maintainFeedbackLedger(new Date(), { force: true });
      return noStoreJson({ ...(await feedbackPayload()), generation });
    }
    if (body.action === "update_settings") {
      const dailyMaximum = Math.max(0, Math.min(2, Number(body.dailyMaximum) || 0));
      const intervalDays = Math.max(
        1,
        Math.min(30, Number(body.generationIntervalDays) || 3),
      );
      const publicLimit = Math.max(6, Math.min(100, Number(body.publicLimit) || 48));
      await d1
        .prepare(
          `UPDATE feedback_generator_settings SET generation_enabled = ?,
             daily_maximum = ?, generation_interval_days = ?, public_limit = ?,
             updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
        )
        .bind(
          body.generationEnabled ? 1 : 0,
          dailyMaximum,
          intervalDays,
          publicLimit,
        )
        .run();
      return noStoreJson(await feedbackPayload());
    }
    const feedbackId = Number(body.feedbackId);
    if (!Number.isInteger(feedbackId) || feedbackId <= 0) {
      return noStoreJson({ error: "Invalid feedback record." }, { status: 400 });
    }
    const before = await d1
      .prepare("SELECT * FROM feedback_entries WHERE id = ? LIMIT 1")
      .bind(feedbackId)
      .first<Record<string, unknown>>();
    if (!before) return noStoreJson({ error: "Feedback not found." }, { status: 404 });

    let afterStatus = String(before.status);
    let publicText = String(before.public_text ?? "");
    let publishedAt = before.published_at ? String(before.published_at) : null;
    let mediaAssetId = before.media_asset_id == null ? null : Number(before.media_asset_id);
    let riskFlags = (() => {
      try {
        return JSON.parse(String(before.risk_flags_json ?? "[]")) as string[];
      } catch {
        return [];
      }
    })();
    if (body.action === "approve") {
      afterStatus = "approved";
      publicText = (body.publicText ?? String(before.original_text ?? "")).trim().slice(0, 1200);
      if (String(before.source_type) === "customer_submitted" && publicText.length < 20) {
        return noStoreJson({ error: "Approved customer feedback needs a public text." }, { status: 400 });
      }
      riskFlags = feedbackRiskFlags(publicText);
      if (riskFlags.length > 0) {
        return noStoreJson(
          { error: "Remove medical, efficacy, dosing, or unsupported purity claims before publishing.", riskFlags },
          { status: 422 },
        );
      }
      publishedAt = new Date().toISOString();
    } else if (body.action === "reject") {
      afterStatus = "rejected";
      publishedAt = null;
    } else if (body.action === "unpublish") {
      afterStatus = "unpublished";
      publishedAt = null;
    } else if (body.action === "set_media") {
      mediaAssetId = body.mediaAssetId ? Number(body.mediaAssetId) : null;
    } else {
      return noStoreJson({ error: "Unsupported action." }, { status: 400 });
    }
    const after = { status: afterStatus, publicText, publishedAt, mediaAssetId, riskFlags };
    await d1.batch([
      d1
        .prepare(
          `UPDATE feedback_entries SET status = ?, public_text = ?,
             published_at = ?, reviewed_at = CURRENT_TIMESTAMP,
             media_asset_id = ?, risk_flags_json = ?,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(
          afterStatus,
          publicText,
          publishedAt,
          mediaAssetId,
          JSON.stringify(riskFlags),
          feedbackId,
        ),
      d1
        .prepare(
          `INSERT INTO feedback_moderation_actions (
            feedback_id, actor, action, note, before_json, after_json
          ) VALUES (?, 'admin', ?, ?, ?, ?)`,
        )
        .bind(
          feedbackId,
          body.action,
          (body.note ?? "").slice(0, 500),
          JSON.stringify(before),
          JSON.stringify(after),
        ),
    ]);
    return noStoreJson(await feedbackPayload());
  } catch (error) {
    return noStoreJson({ error: error instanceof Error ? error.message : "Unable to update feedback." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await requireFulfillmentAdmin(request);
  if (denied) return denied;
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  try {
    const body = (await request.json()) as { feedbackId?: number };
    const id = Number(body.feedbackId);
    if (!Number.isInteger(id) || id <= 0) return noStoreJson({ error: "Invalid feedback record." }, { status: 400 });
    const d1 = await getD1();
    await d1.prepare("DELETE FROM feedback_entries WHERE id = ?").bind(id).run();
    return noStoreJson(await feedbackPayload());
  } catch (error) {
    return noStoreJson({ error: error instanceof Error ? error.message : "Unable to delete feedback." }, { status: 500 });
  }
}
