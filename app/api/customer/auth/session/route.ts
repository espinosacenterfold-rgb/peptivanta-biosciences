import { getCustomerSession, noStoreJson } from "../../../../../lib/customer-auth";
import { unexpectedErrorResponse } from "../../../../../lib/server-error";

export async function GET(request: Request) {
  try {
    const account = await getCustomerSession(request);
    return noStoreJson({ account });
  } catch (error) {
    return unexpectedErrorResponse("customer-session:get", error, 503);
  }
}
