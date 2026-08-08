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
  validUsername,
  verifyHumanChallenge,
} from "../../../../../lib/customer-auth";

type RegisterBody = {
  username?: string;
  password?: string;
  displayName?: string;
  companyName?: string;
  countryCode?: string;
  locale?: string;
  privacyConsent?: boolean;
  challengeToken?: string;
  challengeAnswer?: string;
};

const locales = new Set(["en", "pt", "es", "fr", "zh"]);

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  try {
    const body = (await request.json()) as RegisterBody;
    const username = body.username?.trim() ?? "";
    const normalized = normalizeUsername(username);
    const limited = await enforceAuthRateLimit(
      request,
      "register",
      6,
      30,
      normalized,
    );
    if (limited) return limited;
    const password = body.password ?? "";
    if (!validUsername(username)) {
      return noStoreJson(
        { error: "Use 3–32 letters, numbers, dots, dashes, or underscores for the username." },
        { status: 400 },
      );
    }
    if (!validPassword(password)) {
      return noStoreJson(
        { error: "Use a password between 10 and 72 characters." },
        { status: 400 },
      );
    }
    if (!body.privacyConsent) {
      return noStoreJson(
        { error: "Privacy consent is required to create an account." },
        { status: 400 },
      );
    }
    if (!(await verifyHumanChallenge(body.challengeToken ?? "", body.challengeAnswer ?? ""))) {
      return noStoreJson(
        { error: "The verification answer is incorrect or expired." },
        { status: 400 },
      );
    }

    await ensureCommunitySchema();
    const d1 = await getD1();
    const existing = await d1
      .prepare("SELECT id FROM customers WHERE username_normalized = ? LIMIT 1")
      .bind(normalized)
      .first();
    if (existing) {
      return noStoreJson({ error: "That username is already in use." }, { status: 409 });
    }

    const passwordCredential = await createCredential(password);
    const recoveryCode = `PV-${randomToken(15).toUpperCase()}`;
    const recoveryCredential = await createCredential(recoveryCode);
    const publicId = `cust_${randomToken(12)}`;
    const now = new Date().toISOString();
    const result = await d1
      .prepare(
        `INSERT INTO customers (
          public_id, username, username_normalized,
          password_hash, password_salt, recovery_hash, recovery_salt,
          display_name, company_name, country_code, locale, status,
          privacy_consent_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active_unlinked', ?)`
      )
      .bind(
        publicId,
        username,
        normalized,
        passwordCredential.hash,
        passwordCredential.salt,
        recoveryCredential.hash,
        recoveryCredential.salt,
        (body.displayName ?? "").trim().slice(0, 80),
        (body.companyName ?? "").trim().slice(0, 120),
        (body.countryCode ?? "").trim().slice(0, 8),
        locales.has(body.locale ?? "") ? body.locale : "en",
        now,
      )
      .run();
    const customerId = Number(result.meta.last_row_id);
    const session = await createCustomerSession(customerId);
    const response = noStoreJson({
      ok: true,
      recoveryCode,
      account: { publicId, username, status: "active_unlinked" },
    });
    response.headers.append("Set-Cookie", sessionCookie(session.token));
    return response;
  } catch (error) {
    if (error instanceof Error && /unique|constraint/i.test(error.message)) {
      return noStoreJson(
        { error: "That username is already in use." },
        { status: 409 },
      );
    }
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Account registration failed." },
      { status: 500 },
    );
  }
}
