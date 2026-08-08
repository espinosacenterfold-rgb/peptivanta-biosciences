import { publicFeedback } from "../../../lib/feedback-ledger";
import { noStoreJson } from "../../../lib/customer-auth";

const allowedCountries = new Set(["US", "CA", "BR", "MX"]);
const allowedServices = new Set(["catalogue", "private_label", "bulk", "custom"]);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const locale = url.searchParams.get("locale") ?? "en";
    const countryInput = url.searchParams.get("country") ?? "";
    const serviceInput = url.searchParams.get("service") ?? "";
    const limit = Math.max(1, Math.min(48, Number(url.searchParams.get("limit")) || 18));
    const offset = Math.max(0, Math.min(500, Number(url.searchParams.get("offset")) || 0));
    const records = await publicFeedback({
      locale,
      limit,
      offset,
      country: allowedCountries.has(countryInput) ? countryInput : undefined,
      service: allowedServices.has(serviceInput) ? serviceInput : undefined,
    });
    return noStoreJson({ records, count: records.length, limit, offset });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Feedback is temporarily unavailable." },
      { status: 500 },
    );
  }
}
