import { ensureCommunitySchema, getD1 } from "../db";

export const CUSTOMER_SESSION_COOKIE = "__Host-pv_customer_session";
const SESSION_DAYS = 30;

type RuntimeAuthEnv = {
  CUSTOMER_AUTH_SECRET?: string;
};

export type CustomerSession = {
  id: number;
  publicId: string;
  username: string;
  displayName: string;
  companyName: string;
  countryCode: string;
  locale: string;
  status: string;
  profileVersion: number;
};

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlToText(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(`${normalized}${padding}`);
}

export function randomToken(bytes = 24) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return bytesToBase64Url(values);
}

async function authSecret() {
  const { env } = await import("cloudflare:workers");
  const value = (env as unknown as RuntimeAuthEnv).CUSTOMER_AUTH_SECRET?.trim();
  if (!value || value.length < 24) {
    throw new Error("Customer account security has not been configured.");
  }
  return value;
}

async function hmacHex(value: string) {
  const secret = await authSecret();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function hashIdentifier(value: string) {
  return hmacHex(`identifier:${value}`);
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

/**
 * A keyed one-way digest is deliberately used instead of encryption. It is
 * extremely light for Workers while a leaked D1 database still does not reveal
 * passwords, recovery codes, order-link codes, or session tokens.
 */
export async function createCredential(value: string) {
  const salt = randomToken(16);
  return { salt, hash: await hmacHex(`credential:${salt}:${value}`) };
}

export async function verifyCredential(
  value: string,
  salt: string,
  expectedHash: string,
) {
  const actual = await hmacHex(`credential:${salt}:${value}`);
  return constantTimeEqual(actual, expectedHash);
}

export function normalizeUsername(value: string) {
  return value.trim().normalize("NFKC").toLocaleLowerCase("en-US");
}

export function validUsername(value: string) {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}$/.test(value);
}

export function validPassword(value: string) {
  return value.length >= 10 && value.length <= 72;
}

export function sessionCookie(token: string) {
  return `${CUSTOMER_SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86_400}`;
}

export function clearSessionCookie() {
  return `${CUSTOMER_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function readCookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const item of cookies.split(";")) {
    const [key, ...parts] = item.trim().split("=");
    if (key === name) return parts.join("=");
  }
  return "";
}

export async function createCustomerSession(customerId: number) {
  await ensureCommunitySchema();
  const d1 = await getD1();
  const token = randomToken(32);
  const tokenHash = await hmacHex(`session:${token}`);
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 86_400_000,
  ).toISOString();
  await d1.batch([
    d1
      .prepare(
        `INSERT INTO customer_sessions (
          customer_id, token_hash, expires_at
        ) VALUES (?, ?, ?)`,
      )
      .bind(customerId, tokenHash, expiresAt),
    d1.prepare("DELETE FROM customer_sessions WHERE datetime(expires_at) <= CURRENT_TIMESTAMP"),
  ]);
  return { token, expiresAt };
}

export async function revokeCustomerSession(request: Request) {
  const token = readCookie(request, CUSTOMER_SESSION_COOKIE);
  if (!token) return;
  await ensureCommunitySchema();
  const d1 = await getD1();
  const tokenHash = await hmacHex(`session:${token}`);
  await d1
    .prepare("DELETE FROM customer_sessions WHERE token_hash = ?")
    .bind(tokenHash)
    .run();
}

/**
 * Small scheduled cleanup keeps short-lived authentication records bounded.
 * Customer profiles and their explicit change history are not removed here.
 */
export async function cleanupExpiredCustomerAuth() {
  await ensureCommunitySchema();
  const d1 = await getD1();
  await d1.batch([
    d1.prepare(
      "DELETE FROM customer_sessions WHERE datetime(expires_at) <= CURRENT_TIMESTAMP",
    ),
    d1.prepare(
      "DELETE FROM auth_rate_limits WHERE datetime(expires_at) <= CURRENT_TIMESTAMP",
    ),
    d1.prepare(
      `DELETE FROM customer_order_codes
       WHERE datetime(expires_at) <= datetime('now', '-30 days')
          OR (used_at IS NOT NULL AND datetime(used_at) <= datetime('now', '-30 days'))`,
    ),
  ]);
}

export async function getCustomerSession(
  request: Request,
): Promise<CustomerSession | null> {
  const token = readCookie(request, CUSTOMER_SESSION_COOKIE);
  if (!token) return null;
  await ensureCommunitySchema();
  const d1 = await getD1();
  const tokenHash = await hmacHex(`session:${token}`);
  const customer = await d1
    .prepare(
      `SELECT c.id, c.public_id, c.username, c.display_name,
              c.company_name, c.country_code, c.locale, c.status,
              c.profile_version
       FROM customer_sessions s
       INNER JOIN customers c ON c.id = s.customer_id
       WHERE s.token_hash = ?
         AND datetime(s.expires_at) > CURRENT_TIMESTAMP
         AND c.status IN ('active_unlinked', 'active')
       LIMIT 1`,
    )
    .bind(tokenHash)
    .first<{
      id: number;
      public_id: string;
      username: string;
      display_name: string;
      company_name: string;
      country_code: string;
      locale: string;
      status: string;
      profile_version: number;
    }>();
  if (!customer) return null;
  await d1
    .prepare(
      `UPDATE customer_sessions SET last_seen_at = CURRENT_TIMESTAMP
       WHERE token_hash = ?
         AND last_seen_at < datetime('now', '-1 hour')`,
    )
    .bind(tokenHash)
    .run();
  return {
    id: customer.id,
    publicId: customer.public_id,
    username: customer.username,
    displayName: customer.display_name,
    companyName: customer.company_name,
    countryCode: customer.country_code,
    locale: customer.locale,
    status: customer.status,
    profileVersion: customer.profile_version,
  };
}

export async function enforceAuthRateLimit(
  request: Request,
  action: string,
  maximum: number,
  windowMinutes = 15,
  identifier = "",
) {
  await ensureCommunitySchema();
  const d1 = await getD1();
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const bucket = Math.floor(Date.now() / (windowMinutes * 60_000));
  const keys = [await hmacHex(`rate:${action}:ip:${ip}:${bucket}`)];
  if (identifier) {
    keys.push(
      await hmacHex(`rate:${action}:identity:${identifier}:${bucket}`),
    );
  }
  const expiresAt = new Date(
    (bucket + 1) * windowMinutes * 60_000 + 60_000,
  ).toISOString();
  await d1.batch(
    keys.map((key) =>
      d1.prepare(
      `INSERT INTO auth_rate_limits (
        key, action, attempt_count, expires_at, updated_at
      ) VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        attempt_count = attempt_count + 1,
        updated_at = CURRENT_TIMESTAMP`,
      ).bind(key, action, expiresAt),
    ),
  );
  const placeholders = keys.map(() => "?").join(", ");
  const row = await d1
    .prepare(
      `SELECT MAX(attempt_count) AS attempt_count
       FROM auth_rate_limits WHERE key IN (${placeholders})`,
    )
    .bind(...keys)
    .first<{ attempt_count: number }>();
  if (Number(row?.attempt_count ?? 0) > maximum) {
    return Response.json(
      { error: "Too many attempts. Please wait and try again." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(windowMinutes * 60) } },
    );
  }
  if (Math.random() < 0.02) {
    await d1.prepare("DELETE FROM auth_rate_limits WHERE datetime(expires_at) <= CURRENT_TIMESTAMP").run();
  }
  return null;
}

export async function requireCustomer(request: Request) {
  const customer = await getCustomerSession(request);
  if (!customer) {
    return {
      customer: null,
      response: Response.json(
        { error: "Please sign in to continue." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
  return { customer, response: null };
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const expected = new URL(request.url).origin;
  if (origin !== expected) {
    return Response.json(
      { error: "Cross-site requests are not accepted." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  return null;
}

type ChallengePayload = {
  a: number;
  b: number;
  expiresAt: number;
  nonce: string;
};

export async function createHumanChallenge() {
  const values = new Uint8Array(2);
  crypto.getRandomValues(values);
  const payload: ChallengePayload = {
    a: 2 + (values[0] % 8),
    b: 2 + (values[1] % 8),
    expiresAt: Date.now() + 10 * 60_000,
    nonce: randomToken(8),
  };
  const encoded = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = await hmacHex(`challenge:${encoded}`);
  return {
    question: `${payload.a} + ${payload.b}`,
    token: `${encoded}.${signature}`,
  };
}

export async function verifyHumanChallenge(token: string, answer: string) {
  const [encoded, suppliedSignature] = token.split(".");
  if (!encoded || !suppliedSignature) return false;
  const expectedSignature = await hmacHex(`challenge:${encoded}`);
  if (!constantTimeEqual(expectedSignature, suppliedSignature)) return false;
  try {
    const payload = JSON.parse(base64UrlToText(encoded)) as ChallengePayload;
    return (
      payload.expiresAt > Date.now() &&
      Number(answer) === payload.a + payload.b
    );
  } catch {
    return false;
  }
}

export function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return Response.json(body, { ...init, headers });
}
