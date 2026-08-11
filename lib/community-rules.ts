const DEFAULT_COLLECTION_KEYWORDS = [
  "多肽包装",
  "实验室产品包装",
  "外贸发货包装",
  "COA检测报告",
];

export function feedbackGenerationDue(
  lastSuccessfulDate: string | null,
  today: string,
  intervalDays: number,
) {
  if (!lastSuccessfulDate) return true;
  const start = Date.parse(`${lastSuccessfulDate.slice(0, 10)}T00:00:00.000Z`);
  const end = Date.parse(`${today.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return true;
  const elapsed = Math.max(0, Math.floor((end - start) / 86_400_000));
  return elapsed >= Math.max(1, Math.min(30, intervalDays));
}

export function normalizeCollectionKeywords(input: unknown) {
  const values = Array.isArray(input)
    ? input
    : String(input ?? "").split(/[，,\n]/);
  const keywords = Array.from(
    new Set(
      values
        .map((value) => String(value).trim())
        .filter((value) => value.length >= 2 && value.length <= 40),
    ),
  ).slice(0, 12);
  return keywords.length > 0 ? keywords : DEFAULT_COLLECTION_KEYWORDS;
}

export function xiaohongshuSearchUrl(keyword: string) {
  return `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keyword)}&source=web_explore_feed`;
}

/** Extracts unique public Xiaohongshu note URLs from search API JSON or text. */
export function extractXiaohongshuSourceUrls(input: unknown) {
  const text = (typeof input === "string" ? input : JSON.stringify(input ?? {}))
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/");
  const matches =
    text.match(
      /https?:\/\/(?:www\.)?xiaohongshu\.com\/(?:explore|discovery\/item)\/[A-Za-z0-9]+[^\s"'<>]*/gi,
    ) ?? [];
  const urls: string[] = [];
  for (const value of matches) {
    try {
      const parsed = new URL(value.replace(/[),.;\]}]+$/, ""));
      if (
        !["xiaohongshu.com", "www.xiaohongshu.com"].includes(
          parsed.hostname.toLowerCase(),
        )
      ) {
        continue;
      }
      parsed.protocol = "https:";
      parsed.hash = "";
      const normalized = parsed.toString();
      if (!urls.includes(normalized)) urls.push(normalized);
    } catch {
      // Ignore malformed search snippets.
    }
    if (urls.length >= 20) break;
  }
  return urls;
}
