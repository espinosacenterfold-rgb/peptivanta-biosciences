/**
 * Lightweight anti-scraping controls that run before the application router.
 *
 * These rules intentionally do not block normal search engines such as
 * Googlebot and Bingbot. They target self-identifying bulk/training crawlers
 * and cross-site embedding of Peptivanta's factory and COA media.
 *
 * User-Agent checks are only one layer: a determined scraper can spoof a
 * browser. Cloudflare Bot Fight Mode and AI Crawl Control should remain enabled
 * on the production domain for network-level detection and challenges.
 */

const BLOCKED_CRAWLER_TOKENS = [
  "amazonbot",
  "anthropic-ai",
  "bytespider",
  "ccbot",
  "claude-web",
  "claudebot",
  "cohere-ai",
  "diffbot",
  "facebookbot",
  "gptbot",
  "imagesiftbot",
  "meta-externalagent",
  "omgili",
  "omgilibot",
  "petalbot",
] as const;

const PROTECTED_ASSET_PREFIXES = [
  "/coa/reports/",
  "/media/",
] as const;

export function isKnownTrainingCrawler(request: Request) {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/robots.txt") return false;

  const userAgent = request.headers.get("user-agent")?.toLowerCase() ?? "";
  return BLOCKED_CRAWLER_TOKENS.some((token) => userAgent.includes(token));
}

export function isProtectedAssetPath(pathname: string) {
  return PROTECTED_ASSET_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
}

/**
 * Prevent other websites from embedding the factory videos or COA reports.
 * Direct visits and same-origin requests remain available, so customers can
 * still view every document normally on Peptivanta.
 */
export function isCrossSiteAssetRequest(request: Request) {
  const url = new URL(request.url);
  if (!isProtectedAssetPath(url.pathname)) return false;

  if (request.headers.get("sec-fetch-site") === "cross-site") return true;

  const referer = request.headers.get("referer");
  if (!referer) return false;

  try {
    return new URL(referer).origin !== url.origin;
  } catch {
    return true;
  }
}

export function crawlerBlockedResponse() {
  return new Response("Automated bulk collection is not permitted.", {
    status: 403,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "Retry-After": "86400",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export function hotlinkBlockedResponse() {
  return new Response("Cross-site media embedding is not permitted.", {
    status: 403,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

/**
 * Add browser-enforced anti-embedding controls without changing the response
 * body or interfering with React streaming. Raw COA/factory assets are kept
 * out of image indexes while their normal website pages remain indexable.
 */
export function applyAntiScrapingHeaders(
  response: Response,
  pathname: string,
) {
  const headers = new Headers(response.headers);

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  headers.set("X-Frame-Options", "DENY");

  if (!headers.has("Content-Security-Policy")) {
    headers.set(
      "Content-Security-Policy",
      "base-uri 'self'; object-src 'none'; frame-ancestors 'none'",
    );
  }

  if (isProtectedAssetPath(pathname)) {
    headers.set("Cross-Origin-Resource-Policy", "same-origin");
    headers.set("X-Robots-Tag", "noindex, noimageindex, noarchive");
  } else if (
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin/")
  ) {
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  } else if (!headers.has("X-Robots-Tag")) {
    // Discourage search-engine snapshots while keeping public pages indexable.
    headers.set("X-Robots-Tag", "noarchive");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
