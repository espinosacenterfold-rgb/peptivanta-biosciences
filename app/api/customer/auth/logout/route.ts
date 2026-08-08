import {
  clearSessionCookie,
  noStoreJson,
  requireSameOrigin,
  revokeCustomerSession,
} from "../../../../../lib/customer-auth";

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  try {
    await revokeCustomerSession(request);
  } catch {
    // Clearing the browser cookie remains useful even if the session expired.
  }
  const response = noStoreJson({ ok: true });
  response.headers.append("Set-Cookie", clearSessionCookie());
  return response;
}
