import { ensureCommunitySchema, getD1 } from "../../../../../db";
import {
  createCredential,
  createCustomerSession,
  enforceAuthRateLimit,
  noStoreJson,
  normalizeUsername,
  randomToken,
  requireSameOrigin,
  sessionCookie,
  validPassword,
  verifyCredential,
  verifyHumanChallenge,
} from "../../../../../lib/customer-auth";

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  try {
    const body = (await request.json()) as {
      username?: string;
      recoveryCode?: string;
      newPassword?: string;
      challengeToken?: string;
      challengeAnswer?: string;
    };
    const normalizedUsername = normalizeUsername(body.username ?? "");
    const limited = await enforceAuthRateLimit(
      request,
      "recover",
      5,
      30,
      normalizedUsername,
    );
    if (limited) return limited;
    if (!validPassword(body.newPassword ?? "")) {
      return noStoreJson({ error: "Use a password between 10 and 72 characters." }, { status: 400 });
    }
    if (!(await verifyHumanChallenge(body.challengeToken ?? "", body.challengeAnswer ?? ""))) {
      return noStoreJson({ error: "The verification answer is incorrect or expired." }, { status: 400 });
    }
    await ensureCommunitySchema();
    const d1 = await getD1();
    const customer = await d1
      .prepare(
        `SELECT id, recovery_hash, recovery_salt, status
         FROM customers WHERE username_normalized = ? LIMIT 1`,
      )
      .bind(normalizedUsername)
      .first<{ id: number; recovery_hash: string; recovery_salt: string; status: string }>();
    const valid = customer
      ? await verifyCredential(
          (body.recoveryCode ?? "").trim().toUpperCase(),
          customer.recovery_salt,
          customer.recovery_hash,
        )
      : false;
    if (!customer || !valid || !["active_unlinked", "active"].includes(customer.status)) {
      return noStoreJson({ error: "The recovery details are incorrect." }, { status: 401 });
    }
    const passwordCredential = await createCredential(body.newPassword ?? "");
    const recoveryCode = `PV-${randomToken(15).toUpperCase()}`;
    const recoveryCredential = await createCredential(recoveryCode);
    await d1.batch([
      d1
        .prepare(
          `UPDATE customers SET password_hash = ?, password_salt = ?,
            recovery_hash = ?, recovery_salt = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(
          passwordCredential.hash,
          passwordCredential.salt,
          recoveryCredential.hash,
          recoveryCredential.salt,
          customer.id,
        ),
      d1.prepare("DELETE FROM customer_sessions WHERE customer_id = ?").bind(customer.id),
    ]);
    const session = await createCustomerSession(customer.id);
    const response = noStoreJson({ ok: true, recoveryCode });
    response.headers.append("Set-Cookie", sessionCookie(session.token));
    return response;
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Account recovery failed." },
      { status: 500 },
    );
  }
}
