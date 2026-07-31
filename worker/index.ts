/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  applyAntiScrapingHeaders,
  crawlerBlockedResponse,
  hotlinkBlockedResponse,
  isCrossSiteAssetRequest,
  isKnownTrainingCrawler,
} from "./anti-scraping";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Reject self-identifying bulk/training crawlers before they reach the
    // application or consume D1 reads. Search crawlers are intentionally not
    // included in the blocked list so the public site remains discoverable.
    if (isKnownTrainingCrawler(request)) {
      return applyAntiScrapingHeaders(
        crawlerBlockedResponse(),
        url.pathname,
      );
    }

    // Stop third-party sites from embedding Peptivanta's factory and report
    // media. Same-origin viewing and direct customer access continue to work.
    if (isCrossSiteAssetRequest(request)) {
      return applyAntiScrapingHeaders(
        hotlinkBlockedResponse(),
        url.pathname,
      );
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const response = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return applyAntiScrapingHeaders(response, url.pathname);
    }

    const response = await handler.fetch(request, env, ctx);
    return applyAntiScrapingHeaders(response, url.pathname);
  },
};

export default worker;
