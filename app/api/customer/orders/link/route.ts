import { ensureCommunitySchema, getD1 } from "../../../../../db";
import {
  enforceAuthRateLimit,
  noStoreJson,
  requireCustomer,
  requireSameOrigin,
  verifyCredential,
} from "../../../../../lib/customer-auth";

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  try {
    const auth = await requireCustomer(request);
    if (auth.response) return auth.response;
    const body = (await request.json()) as { reference?: string; code?: string };
    const reference = (body.reference ?? "").trim().toUpperCase();
    const code = (body.code ?? "").trim().toUpperCase();
    const limited = await enforceAuthRateLimit(
      request,
      "order-link",
      8,
      30,
      `${auth.customer.id}:${reference}`,
    );
    if (limited) return limited;
    if (!reference || !code) {
      return noStoreJson({ error: "Enter the order reference and binding code." }, { status: 400 });
    }
    await ensureCommunitySchema();
    const d1 = await getD1();
    const order = await d1
      .prepare("SELECT id FROM manual_fulfillment_orders WHERE UPPER(reference) = ? LIMIT 1")
      .bind(reference)
      .first<{ id: number }>();
    if (!order) return noStoreJson({ error: "The order details could not be verified." }, { status: 400 });
    const existingLink = await d1
      .prepare("SELECT customer_id FROM customer_order_links WHERE order_id = ? LIMIT 1")
      .bind(order.id)
      .first<{ customer_id: number }>();
    if (existingLink?.customer_id === auth.customer.id) {
      return noStoreJson({ ok: true, alreadyLinked: true });
    }
    if (existingLink) {
      return noStoreJson({ error: "This order is already linked to another account." }, { status: 409 });
    }
    const codes = await d1
      .prepare(
        `SELECT id, code_hash, code_salt
         FROM customer_order_codes
         WHERE order_id = ? AND used_at IS NULL
           AND datetime(expires_at) > CURRENT_TIMESTAMP
         ORDER BY id DESC LIMIT 5`,
      )
      .bind(order.id)
      .all<{ id: number; code_hash: string; code_salt: string }>();
    let matchedId: number | null = null;
    for (const candidate of codes.results) {
      if (await verifyCredential(code, candidate.code_salt, candidate.code_hash)) {
        matchedId = candidate.id;
        break;
      }
    }
    if (!matchedId) {
      return noStoreJson({ error: "The order details could not be verified." }, { status: 400 });
    }
    await d1.batch([
      d1
        .prepare("INSERT INTO customer_order_links (customer_id, order_id) VALUES (?, ?)")
        .bind(auth.customer.id, order.id),
      d1
        .prepare("UPDATE customer_order_codes SET used_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(matchedId),
      d1
        .prepare("UPDATE customers SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(auth.customer.id),
    ]);
    return noStoreJson({ ok: true });
  } catch (error) {
    if (error instanceof Error && /unique|constraint/i.test(error.message)) {
      return noStoreJson(
        { error: "This order was linked by another request. Refresh and try again." },
        { status: 409 },
      );
    }
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Unable to link the order." },
      { status: 500 },
    );
  }
}
