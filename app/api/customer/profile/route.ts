import { ensureCommunitySchema, getD1 } from "../../../../db";
import {
  noStoreJson,
  requireCustomer,
  requireSameOrigin,
} from "../../../../lib/customer-auth";

async function accountPayload(customerId: number) {
  const d1 = await getD1();
  const account = await d1
    .prepare(
      `SELECT public_id, username, display_name, company_name, country_code,
              locale, status, profile_version, created_at, last_login_at
       FROM customers WHERE id = ?`,
    )
    .bind(customerId)
    .first();
  const orders = await d1
    .prepare(
      `SELECT o.id, o.reference, o.occurred_at, o.destination, o.service,
              o.order_profile, o.status, o.product_name, o.specification,
              f.public_id AS feedback_id, f.status AS feedback_status,
              f.original_text AS feedback_text
       FROM customer_order_links l
       INNER JOIN manual_fulfillment_orders o ON o.id = l.order_id
       LEFT JOIN feedback_entries f ON f.manual_order_id = o.id
       WHERE l.customer_id = ?
       ORDER BY o.occurred_at DESC, o.id DESC`,
    )
    .bind(customerId)
    .all();
  return { account, orders: orders.results };
}

export async function GET(request: Request) {
  try {
    await ensureCommunitySchema();
    const auth = await requireCustomer(request);
    if (auth.response) return auth.response;
    return noStoreJson(await accountPayload(auth.customer.id));
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Unable to load the profile." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  try {
    await ensureCommunitySchema();
    const auth = await requireCustomer(request);
    if (auth.response) return auth.response;
    const body = (await request.json()) as {
      displayName?: string;
      companyName?: string;
      countryCode?: string;
      locale?: string;
    };
    const locales = new Set(["en", "pt", "es", "fr", "zh"]);
    const d1 = await getD1();
    const before = await d1
      .prepare(
        `SELECT display_name, company_name, country_code, locale, profile_version
         FROM customers WHERE id = ?`,
      )
      .bind(auth.customer.id)
      .first();
    if (!before) return noStoreJson({ error: "Account not found." }, { status: 404 });
    const after = {
      displayName: (body.displayName ?? auth.customer.displayName).trim().slice(0, 80),
      companyName: (body.companyName ?? auth.customer.companyName).trim().slice(0, 120),
      countryCode: (body.countryCode ?? auth.customer.countryCode).trim().slice(0, 8),
      locale: locales.has(body.locale ?? "") ? body.locale : auth.customer.locale,
      profileVersion: auth.customer.profileVersion + 1,
    };
    await d1.batch([
      d1
        .prepare(
          `UPDATE customers SET display_name = ?, company_name = ?,
             country_code = ?, locale = ?, profile_version = ?,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(
          after.displayName,
          after.companyName,
          after.countryCode,
          after.locale,
          after.profileVersion,
          auth.customer.id,
        ),
      d1
        .prepare(
          `INSERT INTO customer_profile_events (
            customer_id, actor, before_json, after_json
          ) VALUES (?, 'customer', ?, ?)`,
        )
        .bind(auth.customer.id, JSON.stringify(before), JSON.stringify(after)),
    ]);
    return noStoreJson(await accountPayload(auth.customer.id));
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Unable to update the profile." },
      { status: 500 },
    );
  }
}
