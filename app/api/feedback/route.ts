import { publicFeedback } from "../../../lib/feedback-ledger";
import { unexpectedErrorResponse } from "../../../lib/server-error";

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
    return Response.json(
      { records, count: records.length, limit, offset },
      {
        headers: {
          "Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    return unexpectedErrorResponse("public-feedback:get", error);
  }
}
