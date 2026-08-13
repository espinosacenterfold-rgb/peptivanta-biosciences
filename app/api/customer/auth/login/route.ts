import { ensureCommunitySchema, getD1 } from "../../../../../db";
import {
  createCustomerSession,
  enforceAuthRateLimit,
  noStoreJson,
  normalizeUsername,
  requireSameOrigin,
  sessionCookie,
  verifyCredential,
  verifyHumanChallenge,
} from "../../../../../lib/customer-auth";
import { unexpectedErrorResponse } from "../../../../../lib/server-error";

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      challengeToken?: string;
      challengeAnswer?: string;
    };
    const normalizedUsername = normalizeUsername(body.username ?? "");
    const limited = await enforceAuthRateLimit(
      request,
      "login",
      12,
      15,
      normalizedUsername,
    );
    if (limited) return limited;
    if (!(await verifyHumanChallenge(body.challengeToken ?? "", body.challengeAnswer ?? ""))) {
      return noStoreJson({ error: "The verification answer is incorrect or expired." }, { status: 400 });
    }
    await ensureCommunitySchema();
    const d1 = await getD1();
    const customer = await d1
      .prepare(
        `SELECT id, public_id, username, password_hash, password_salt, status
         FROM customers WHERE username_normalized = ? LIMIT 1`,
      )
      .bind(normalizedUsername)
      .first<{
        id: number;
        public_id: string;
        username: string;
        password_hash: string;
        password_salt: string;
        status: string;
      }>();
    const valid = customer
      ? await verifyCredential(body.password ?? "", customer.password_salt, customer.password_hash)
      : false;
    if (!customer || !valid || !["active_unlinked", "active"].includes(customer.status)) {
      return noStoreJson({ error: "The username or password is incorrect." }, { status: 401 });
    }
    const session = await createCustomerSession(customer.id);
    await d1
      .prepare("UPDATE customers SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(customer.id)
      .run();
    const response = noStoreJson({
      ok: true,
      account: { publicId: customer.public_id, username: customer.username, status: customer.status },
    });
    response.headers.append("Set-Cookie", sessionCookie(session.token));
    return response;
  } catch (error) {
    return unexpectedErrorResponse("customer-login:post", error);
  }
}
