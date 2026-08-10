import { ensureCommunitySchema, getD1 } from "../../../../db";
import { requireFulfillmentAdmin } from "../auth";
import {
  createCredential,
  noStoreJson,
  randomToken,
  requireSameOrigin,
} from "../../../../lib/customer-auth";

async function customerPayload() {
  const d1 = await getD1();
  const customers = await d1
    .prepare(
      `SELECT c.id, c.public_id, c.username, c.display_name, c.company_name,
              c.country_code, c.locale, c.status, c.profile_version,
              c.password_plaintext,
              c.created_at, c.last_login_at,
              COUNT(DISTINCT l.order_id) AS linked_orders,
              COUNT(DISTINCT f.id) AS feedback_count
       FROM customers c
       LEFT JOIN customer_order_links l ON l.customer_id = c.id
       LEFT JOIN feedback_entries f ON f.customer_id = c.id
       GROUP BY c.id
       ORDER BY datetime(c.created_at) DESC
       LIMIT 300`,
    )
    .all();
  const availableOrders = await d1
    .prepare(
      `SELECT o.reference, o.occurred_at, o.destination, o.status
       FROM manual_fulfillment_orders o
       LEFT JOIN customer_order_links l ON l.order_id = o.id
       WHERE l.id IS NULL
       ORDER BY o.occurred_at DESC, o.id DESC
       LIMIT 300`,
    )
    .all();
  const events = await d1
    .prepare(
      `SELECT e.id, e.customer_id, e.actor, e.before_json, e.after_json,
              e.created_at, c.username
       FROM customer_profile_events e
       INNER JOIN customers c ON c.id = e.customer_id
       ORDER BY datetime(e.created_at) DESC LIMIT 80`,
    )
    .all();
  return {
    customers: customers.results,
    availableOrders: availableOrders.results,
    profileEvents: events.results,
  };
}

export async function GET(request: Request) {
  const denied = await requireFulfillmentAdmin(request);
  if (denied) return denied;
  try {
    await ensureCommunitySchema();
    return noStoreJson(await customerPayload());
  } catch (error) {
    return noStoreJson({ error: error instanceof Error ? error.message : "Unable to load customers." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireFulfillmentAdmin(request);
  if (denied) return denied;
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  try {
    await ensureCommunitySchema();
    const body = (await request.json()) as { action?: string; orderReference?: string };
    if (body.action !== "create_order_code") {
      return noStoreJson({ error: "Unsupported action." }, { status: 400 });
    }
    const d1 = await getD1();
    const order = await d1
      .prepare("SELECT id, reference FROM manual_fulfillment_orders WHERE UPPER(reference) = UPPER(?) LIMIT 1")
      .bind((body.orderReference ?? "").trim())
      .first<{ id: number; reference: string }>();
    if (!order) return noStoreJson({ error: "Order not found." }, { status: 404 });
    const linked = await d1
      .prepare("SELECT id FROM customer_order_links WHERE order_id = ? LIMIT 1")
      .bind(order.id)
      .first();
    if (linked) return noStoreJson({ error: "That order is already linked." }, { status: 409 });
    const code = `PVL-${randomToken(9).toUpperCase()}`;
    const credential = await createCredential(code);
    const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
    await d1.batch([
      d1
        .prepare("UPDATE customer_order_codes SET used_at = CURRENT_TIMESTAMP WHERE order_id = ? AND used_at IS NULL")
        .bind(order.id),
      d1
        .prepare(
          `INSERT INTO customer_order_codes (
            order_id, code_hash, code_salt, expires_at
          ) VALUES (?, ?, ?, ?)`,
        )
        .bind(order.id, credential.hash, credential.salt, expiresAt),
    ]);
    return noStoreJson({ ok: true, orderReference: order.reference, code, expiresAt });
  } catch (error) {
    return noStoreJson({ error: error instanceof Error ? error.message : "Unable to create the binding code." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const denied = await requireFulfillmentAdmin(request);
  if (denied) return denied;
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  try {
    const body = (await request.json()) as { customerId?: number; action?: string };
    const customerId = Number(body.customerId);
    if (!Number.isInteger(customerId) || customerId <= 0) {
      return noStoreJson({ error: "Invalid customer." }, { status: 400 });
    }
    const d1 = await getD1();
    if (body.action === "revoke_sessions") {
      await d1.prepare("DELETE FROM customer_sessions WHERE customer_id = ?").bind(customerId).run();
    } else if (body.action === "suspend") {
      await d1.batch([
        d1.prepare("UPDATE customers SET status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(customerId),
        d1.prepare("DELETE FROM customer_sessions WHERE customer_id = ?").bind(customerId),
      ]);
    } else if (body.action === "activate") {
      const linked = await d1
        .prepare("SELECT id FROM customer_order_links WHERE customer_id = ? LIMIT 1")
        .bind(customerId)
        .first();
      await d1
        .prepare("UPDATE customers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(linked ? "active" : "active_unlinked", customerId)
        .run();
    } else {
      return noStoreJson({ error: "Unsupported action." }, { status: 400 });
    }
    return noStoreJson(await customerPayload());
  } catch (error) {
    return noStoreJson({ error: error instanceof Error ? error.message : "Unable to update the customer." }, { status: 500 });
  }
}
