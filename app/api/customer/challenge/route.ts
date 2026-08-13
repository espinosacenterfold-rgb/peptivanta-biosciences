import { createHumanChallenge, enforceAuthRateLimit, noStoreJson } from "../../../../lib/customer-auth";
import { unexpectedErrorResponse } from "../../../../lib/server-error";

export async function GET(request: Request) {
  try {
    const limited = await enforceAuthRateLimit(request, "challenge", 40, 15);
    if (limited) return limited;
    return noStoreJson(await createHumanChallenge());
  } catch (error) {
    return unexpectedErrorResponse("customer-challenge:get", error, 503);
  }
}
