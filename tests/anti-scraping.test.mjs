import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  applyAntiScrapingHeaders,
  crawlerBlockedResponse,
  isCrossSiteAssetRequest,
  isKnownTrainingCrawler,
  isProtectedStaticAssetPath,
} from "../worker/anti-scraping.ts";

test("blocks self-identifying training crawlers but keeps search traffic", () => {
  assert.equal(
    isKnownTrainingCrawler(
      new Request("https://peptivanta.com/coa", {
        headers: { "user-agent": "Mozilla/5.0 (compatible; GPTBot/1.2)" },
      }),
    ),
    true,
  );
  assert.equal(
    isKnownTrainingCrawler(
      new Request("https://peptivanta.com/", {
        headers: { "user-agent": "Googlebot/2.1" },
      }),
    ),
    false,
  );
  assert.equal(
    isKnownTrainingCrawler(
      new Request("https://peptivanta.com/", {
        headers: { "user-agent": "ChatGPT-User/1.0" },
      }),
    ),
    false,
  );
});

test("keeps robots.txt visible to blocked crawlers", () => {
  assert.equal(
    isKnownTrainingCrawler(
      new Request("https://peptivanta.com/robots.txt", {
        headers: { "user-agent": "CCBot/2.0" },
      }),
    ),
    false,
  );
});

test("blocks cross-site report embedding without blocking direct viewing", () => {
  assert.equal(
    isCrossSiteAssetRequest(
      new Request(
        "https://peptivanta.com/coa/reports/tirzepatide/report-01.webp",
        {
          headers: {
            referer: "https://copy.example/products",
            "sec-fetch-site": "cross-site",
          },
        },
      ),
    ),
    true,
  );
  assert.equal(
    isCrossSiteAssetRequest(
      new Request(
        "https://peptivanta.com/coa/reports/tirzepatide/report-01.webp",
        { headers: { referer: "https://peptivanta.com/coa" } },
      ),
    ),
    false,
  );
  assert.equal(
    isCrossSiteAssetRequest(
      new Request(
        "https://peptivanta.com/coa/reports/tirzepatide/report-01.webp",
      ),
    ),
    false,
  );
});

test("protects dynamic feedback media without routing it to static assets", () => {
  const request = new Request(
    "https://peptivanta.com/api/media/media_example",
    {
      headers: {
        referer: "https://copy.example/reviews",
        "sec-fetch-site": "cross-site",
      },
    },
  );

  assert.equal(isCrossSiteAssetRequest(request), true);
  assert.equal(isProtectedStaticAssetPath("/api/media/media_example"), false);
  assert.equal(isProtectedStaticAssetPath("/coa/reports/example.webp"), true);
});

test("adds anti-embedding and raw-report indexing headers", () => {
  const response = applyAntiScrapingHeaders(
    new Response("image", {
      headers: { "content-type": "image/webp" },
    }),
    "/coa/reports/tirzepatide/report-01.webp",
  );

  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(
    response.headers.get("cross-origin-resource-policy"),
    "same-origin",
  );
  assert.match(
    response.headers.get("x-robots-tag") ?? "",
    /noimageindex/,
  );
  assert.match(
    response.headers.get("content-security-policy") ?? "",
    /frame-ancestors 'none'/,
  );
});

test("keeps the stronger noindex policy on crawler block responses", () => {
  const response = applyAntiScrapingHeaders(
    crawlerBlockedResponse(),
    "/coa",
  );

  assert.equal(response.status, 403);
  assert.equal(
    response.headers.get("x-robots-tag"),
    "noindex, nofollow, noarchive",
  );
});

test("routes only protected static media through the Worker first", async () => {
  const wrangler = await readFile(
    new URL("../wrangler.jsonc", import.meta.url),
    "utf8",
  );

  assert.match(wrangler, /"run_worker_first"/);
  assert.match(wrangler, /"\/coa\/reports\/\*"/);
  assert.match(wrangler, /"\/media\/\*"/);
});
