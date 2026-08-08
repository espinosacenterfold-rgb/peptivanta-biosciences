import { ensureCommunitySchema, getD1 } from "../../../../db";
import {
  enforceAuthRateLimit,
  noStoreJson,
  randomToken,
  requireCustomer,
  requireSameOrigin,
} from "../../../../lib/customer-auth";
import { destinationCode, feedbackRiskFlags } from "../../../../lib/feedback";

export async function GET(request: Request) {
  try {
    const auth = await requireCustomer(request);
    if (auth.response) return auth.response;
    const d1 = await getD1();
    const rows = await d1
      .prepare(
        `SELECT f.public_id, o.reference, f.original_text, f.public_text,
                f.status, f.risk_flags_json, f.submitted_at, f.reviewed_at,
                f.published_at, f.expires_at
         FROM feedback_entries f
         INNER JOIN manual_fulfillment_orders o ON o.id = f.manual_order_id
         WHERE f.customer_id = ?
         ORDER BY datetime(f.submitted_at) DESC`,
      )
      .bind(auth.customer.id)
      .all();
    return noStoreJson({ feedback: rows.results });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Unable to load feedback." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  try {
    await ensureCommunitySchema();
    const auth = await requireCustomer(request);
    if (auth.response) return auth.response;
    const limited = await enforceAuthRateLimit(
      request,
      "feedback-submit",
      8,
      60,
      String(auth.customer.id),
    );
    if (limited) return limited;
    const body = (await request.json()) as { reference?: string; text?: string; locale?: string };
    const text = (body.text ?? "").trim();
    if (text.length < 20 || text.length > 1200) {
      return noStoreJson({ error: "Feedback must be between 20 and 1,200 characters." }, { status: 400 });
    }
    const d1 = await getD1();
    const order = await d1
      .prepare(
        `SELECT o.id, o.reference, o.occurred_at, o.destination, o.service,
                o.order_profile, o.product_name, o.specification, o.status
         FROM customer_order_links l
         INNER JOIN manual_fulfillment_orders o ON o.id = l.order_id
         WHERE l.customer_id = ? AND UPPER(o.reference) = UPPER(?) LIMIT 1`,
      )
      .bind(auth.customer.id, (body.reference ?? "").trim())
      .first<{
        id: number;
        reference: string;
        occurred_at: string;
        destination: string;
        service: string;
        order_profile: string;
        product_name: string;
        specification: string;
        status: string;
      }>();
    if (!order) return noStoreJson({ error: "That order is not linked to this account." }, { status: 403 });
    if (order.status !== "delivered") {
      return noStoreJson({ error: "Feedback can be submitted after the order is marked delivered." }, { status: 409 });
    }
    const existing = await d1
      .prepare("SELECT * FROM feedback_entries WHERE manual_order_id = ? LIMIT 1")
      .bind(order.id)
      .first<Record<string, unknown>>();
    const riskFlags = feedbackRiskFlags(text);
    const expiresAt = new Date(Date.now() + 180 * 86_400_000).toISOString();
    const snapshot = JSON.stringify({
      reference: order.reference,
      occurredAt: order.occurred_at,
      destination: order.destination,
      service: order.service,
      orderProfile: order.order_profile,
      productName: order.product_name,
      specification: order.specification,
    });
    if (existing) {
      await d1.batch([
        d1
          .prepare(
            `UPDATE feedback_entries SET original_text = ?, public_text = '',
               locale = ?, status = 'pending_review', risk_flags_json = ?,
               submitted_at = CURRENT_TIMESTAMP, reviewed_at = NULL,
               published_at = NULL, expires_at = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND customer_id = ?`,
          )
          .bind(
            text,
            body.locale ?? auth.customer.locale,
            JSON.stringify(riskFlags),
            expiresAt,
            Number(existing.id),
            auth.customer.id,
          ),
        d1
          .prepare(
            `INSERT INTO feedback_moderation_actions (
              feedback_id, actor, action, before_json, after_json
            ) VALUES (?, 'customer', 'resubmitted', ?, ?)`,
          )
          .bind(Number(existing.id), JSON.stringify(existing), JSON.stringify({ text, riskFlags })),
      ]);
    } else {
      const publicId = `fb_${randomToken(12)}`;
      const inserted = await d1
        .prepare(
          `INSERT INTO feedback_entries (
            public_id, source_type, manual_order_id, customer_id,
            country_code, service, order_kind, order_snapshot_json,
            locale, content_json, original_text, public_text, status,
            risk_flags_json, template_version, submitted_at, expires_at
          ) VALUES (?, 'customer_submitted', ?, ?, ?, ?, 'new', ?, ?, '{}',
                    ?, '', 'pending_review', ?, '', CURRENT_TIMESTAMP, ?)`,
        )
        .bind(
          publicId,
          order.id,
          auth.customer.id,
          destinationCode(order.destination),
          order.service,
          snapshot,
          body.locale ?? auth.customer.locale,
          text,
          JSON.stringify(riskFlags),
          expiresAt,
        )
        .run();
      await d1
        .prepare(
          `INSERT INTO feedback_moderation_actions (
            feedback_id, actor, action, after_json
          ) VALUES (?, 'customer', 'submitted', ?)`,
        )
        .bind(Number(inserted.meta.last_row_id), JSON.stringify({ text, riskFlags }))
        .run();
    }
    return noStoreJson({ ok: true, status: "pending_review", riskFlags });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Unable to submit feedback." },
      { status: 500 },
    );
  }
}
