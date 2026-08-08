import { getCustomerSession, noStoreJson } from "../../../../../lib/customer-auth";

export async function GET(request: Request) {
  try {
    const account = await getCustomerSession(request);
    return noStoreJson({ account });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Unable to load the account." },
      { status: 503 },
    );
  }
}
