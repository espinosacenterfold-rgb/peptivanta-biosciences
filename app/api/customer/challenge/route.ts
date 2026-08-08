import { createHumanChallenge, enforceAuthRateLimit, noStoreJson } from "../../../../lib/customer-auth";

export async function GET(request: Request) {
  try {
    const limited = await enforceAuthRateLimit(request, "challenge", 40, 15);
    if (limited) return limited;
    return noStoreJson(await createHumanChallenge());
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Unable to create verification challenge." },
      { status: 503 },
    );
  }
}
