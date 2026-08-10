import { getD1, getMediaStore } from "../db";
import {
  enforceMediaStorageLimit,
  getMediaStorageSettings,
  mediaExpiryIso,
} from "./media-storage";

export type MediaSourcePlatform = "tiktok" | "xiaohongshu";

export type SourceInspection = {
  platform: MediaSourcePlatform;
  url: string;
  title: string;
  author: string;
  previewUrls: string[];
};

const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_REMOTE_IMAGE_BYTES = 2_500_000;
const MAX_REMOTE_IMAGES = 18;
const MAX_SOURCE_HTML_BYTES = 2_000_000;

function decodeHtml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function normalizeEscapedUrl(value: string) {
  return decodeHtml(value)
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/")
    .trim();
}

function sourcePlatformForHost(host: string): MediaSourcePlatform | null {
  const tiktokHosts = new Set([
    "tiktok.com",
    "www.tiktok.com",
    "vm.tiktok.com",
    "vt.tiktok.com",
  ]);
  const xhsHosts = new Set([
    "xiaohongshu.com",
    "www.xiaohongshu.com",
    "xhslink.com",
  ]);
  if (tiktokHosts.has(host)) return "tiktok";
  if (xhsHosts.has(host)) return "xiaohongshu";
  return null;
}

export function validateMediaSourceUrl(
  input: string,
  requestedPlatform?: string,
) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("请输入有效的 TikTok 或小红书内容链接。");
  }
  if (url.protocol !== "https:") {
    throw new Error("来源链接必须使用 HTTPS。");
  }
  const platform = sourcePlatformForHost(url.hostname.toLowerCase());
  if (!platform || (requestedPlatform && requestedPlatform !== platform)) {
    throw new Error("目前只接受 TikTok 或小红书官方域名链接。");
  }
  url.hash = "";
  return { platform, url: url.toString() };
}

function isBlockedRemoteHost(host: string) {
  const lower = host.toLowerCase();
  return (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(lower) ||
    lower.includes(":")
  );
}

export function validateRemoteImageUrl(input: string) {
  let url: URL;
  try {
    url = new URL(normalizeEscapedUrl(input));
  } catch {
    throw new Error("素材地址不是有效链接。");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    isBlockedRemoteHost(url.hostname)
  ) {
    throw new Error("素材地址必须是公开的 HTTPS 图片链接。");
  }
  url.hash = "";
  return url.toString();
}

export function extractRemoteImageUrls(input: unknown) {
  const text = Array.isArray(input) ? input.join("\n") : String(input ?? "");
  const normalized = normalizeEscapedUrl(text);
  const candidates = normalized.match(/https:\/\/[^\s<>"']+/gi) ?? [];
  const result: string[] = [];
  for (const candidate of candidates) {
    try {
      const url = validateRemoteImageUrl(candidate.replace(/[),;\]]+$/, ""));
      if (!result.includes(url)) result.push(url);
    } catch {
      // Ignore non-image or malformed fragments copied with parser output.
    }
    if (result.length >= MAX_REMOTE_IMAGES) break;
  }
  return result;
}

async function readLimitedBytes(response: Response, limit: number) {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > limit) throw new Error("远程文件超过允许大小。");
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > limit) throw new Error("远程文件超过允许大小。");
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error("远程文件超过允许大小。");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

function imageMime(bytes: Uint8Array) {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return "";
}

function extensionForMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

async function downloadRemoteImage(input: string, sourceUrl: string) {
  const url = validateRemoteImageUrl(input);
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      Accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5",
      Referer: sourceUrl,
      "User-Agent":
        "Mozilla/5.0 (compatible; PeptivantaMediaImport/1.0; +https://peptivanta.com)",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`远程图片返回 ${response.status}。`);
  validateRemoteImageUrl(response.url || url);
  const bytes = await readLimitedBytes(response, MAX_REMOTE_IMAGE_BYTES);
  const mime = imageMime(bytes);
  if (!ALLOWED_IMAGE_MIME.has(mime)) {
    throw new Error("远程地址返回的不是 JPG、PNG 或 WebP 图片。");
  }
  return { bytes, mime, finalUrl: response.url || url };
}

function metaValues(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      "gi",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
      "gi",
    ),
  ];
  const values: string[] = [];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const value = normalizeEscapedUrl(match[1] ?? "");
      if (value && !values.includes(value)) values.push(value);
    }
  }
  return values;
}

async function inspectXiaohongshu(url: string): Promise<SourceInspection> {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.7",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136 Safari/537.36",
    },
    signal: AbortSignal.timeout(7_000),
  });
  if (!response.ok) throw new Error(`小红书页面返回 ${response.status}。`);
  validateMediaSourceUrl(response.url || url, "xiaohongshu");
  const html = new TextDecoder().decode(
    await readLimitedBytes(response, MAX_SOURCE_HTML_BYTES),
  );
  const expanded = html
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/");
  const previewUrls = [
    ...metaValues(html, "og:image"),
    ...metaValues(html, "twitter:image"),
    ...(expanded.match(/https:\/\/[^\s<>"']+\.(?:jpe?g|png|webp)(?:\?[^\s<>"']*)?/gi) ?? []),
  ];
  const safePreviewUrls: string[] = [];
  for (const candidate of previewUrls) {
    try {
      const safe = validateRemoteImageUrl(candidate);
      if (!safePreviewUrls.includes(safe)) safePreviewUrls.push(safe);
    } catch {
      // Ignore non-public page assets.
    }
    if (safePreviewUrls.length >= MAX_REMOTE_IMAGES) break;
  }
  return {
    platform: "xiaohongshu",
    url: response.url || url,
    title: metaValues(html, "og:title")[0]?.slice(0, 180) ?? "",
    author: metaValues(html, "author")[0]?.slice(0, 100) ?? "",
    previewUrls: safePreviewUrls,
  };
}

async function inspectTikTok(url: string): Promise<SourceInspection> {
  const response = await fetch(
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6_000),
    },
  );
  if (!response.ok) throw new Error(`TikTok 元数据返回 ${response.status}。`);
  const data = (await response.json()) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };
  const previewUrls: string[] = [];
  if (data.thumbnail_url) {
    previewUrls.push(validateRemoteImageUrl(data.thumbnail_url));
  }
  return {
    platform: "tiktok",
    url,
    title: (data.title ?? "").slice(0, 180),
    author: (data.author_name ?? "").slice(0, 100),
    previewUrls,
  };
}

export async function inspectMediaSource(
  input: string,
  requestedPlatform?: string,
) {
  const source = validateMediaSourceUrl(input, requestedPlatform);
  return source.platform === "tiktok"
    ? inspectTikTok(source.url)
    : inspectXiaohongshu(source.url);
}

function normalizedTags(input: unknown, platform: MediaSourcePlatform) {
  const source = Array.isArray(input)
    ? input
    : String(input ?? "").split(/[，,\n]/);
  return Array.from(
    new Set(
      [platform, ...source]
        .map((tag) => String(tag).trim().toLowerCase())
        .filter((tag) => /^[a-z0-9_+-]{1,40}$/.test(tag)),
    ),
  ).slice(0, 20);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function fingerprintInput(value: string) {
  const url = new URL(value);
  return `${url.origin}${url.pathname}`;
}

export async function importRemoteMediaAssets(input: {
  platform: MediaSourcePlatform;
  sourceUrl: string;
  title?: string;
  author?: string;
  tags?: unknown;
  availableFrom: string;
  imageUrls?: unknown;
  rightsConfirmed: boolean;
}) {
  if (!input.rightsConfirmed) {
    throw new Error("请先确认这些图片为自有素材或已获商业展示授权。");
  }
  const source = validateMediaSourceUrl(input.sourceUrl, input.platform);
  let inspection: SourceInspection | null = null;
  let imageUrls = extractRemoteImageUrls(input.imageUrls);
  if (imageUrls.length === 0) {
    inspection = await inspectMediaSource(source.url, source.platform);
    imageUrls = inspection.previewUrls;
  }
  if (imageUrls.length === 0) {
    throw new Error(
      "未从原始链接读取到公开图片。请在 KuKuTool 或 TikSave 完成解析后，把“复制图片链接”的内容粘贴到图片地址框。",
    );
  }

  const d1 = await getD1();
  const media = await getMediaStore();
  const storageSettings = await getMediaStorageSettings();
  const tags = normalizedTags(input.tags, source.platform);
  const imported: Array<{ publicId: string; title: string }> = [];
  const skipped: string[] = [];
  const failed: Array<{ url: string; message: string }> = [];

  for (const [index, remoteUrl] of imageUrls.slice(0, MAX_REMOTE_IMAGES).entries()) {
    try {
      const fingerprint = await sha256(fingerprintInput(remoteUrl));
      const publicId = `media_remote_${fingerprint.slice(0, 24)}`;
      const existing = await d1
        .prepare("SELECT public_id FROM media_library_assets WHERE public_id = ?")
        .bind(publicId)
        .first<{ public_id: string }>();
      if (existing) {
        skipped.push(publicId);
        continue;
      }
      const downloaded = await downloadRemoteImage(remoteUrl, source.url);
      const capacity = await enforceMediaStorageLimit({
        incomingBytes: downloaded.bytes.byteLength,
      });
      if (!capacity.canAccept) {
        throw new Error("R2 容量保护已阻止本次导入。");
      }
      const extension = extensionForMime(downloaded.mime);
      const r2Key = `feedback-media/${new Date().toISOString().slice(0, 7)}/${publicId}.${extension}`;
      const title = (
        input.title ||
        inspection?.title ||
        `${source.platform === "tiktok" ? "TikTok" : "小红书"} 素材`
      ).slice(0, 160) + (imageUrls.length > 1 ? ` · ${index + 1}` : "");
      const reservation = await d1
        .prepare(
          `INSERT INTO media_library_assets (
            public_id, status, source_platform, source_url, preview_url,
            source_title, source_author, rights_basis, rights_confirmed_at,
            original_filename, r2_key, mime_type, size_bytes, width, height,
            tags_json, available_from, expires_at
          )
          SELECT ?, 'uploading', ?, ?, ?, ?, ?, 'owned_or_authorized',
                 CURRENT_TIMESTAMP, ?, ?, ?, ?, 0, 0, ?, ?, ?
          WHERE COALESCE((
            SELECT SUM(size_bytes) FROM media_library_assets WHERE r2_key <> ''
          ), 0) + ? <= COALESCE((
            SELECT hard_limit_bytes FROM media_storage_settings WHERE id = 1
          ), 10000000000)
          ON CONFLICT(public_id) DO NOTHING`,
        )
        .bind(
          publicId,
          source.platform,
          source.url,
          downloaded.finalUrl,
          title,
          (input.author || inspection?.author || "").slice(0, 100),
          `remote-${index + 1}.${extension}`,
          r2Key,
          downloaded.mime,
          downloaded.bytes.byteLength,
          JSON.stringify(tags),
          input.availableFrom,
          mediaExpiryIso(storageSettings.retentionDays),
          downloaded.bytes.byteLength,
        )
        .run();
      if (Number(reservation.meta.changes ?? 0) !== 1) {
        skipped.push(publicId);
        continue;
      }
      try {
        await media.put(r2Key, downloaded.bytes, {
          httpMetadata: {
            contentType: downloaded.mime,
            cacheControl: "public, max-age=86400",
          },
          customMetadata: {
            publicId,
            sourcePlatform: source.platform,
            importMode: "authorized-remote",
          },
        });
        await d1
          .prepare(
            `UPDATE media_library_assets
             SET status = 'approved', updated_at = CURRENT_TIMESTAMP
             WHERE public_id = ? AND status = 'uploading'`,
          )
          .bind(publicId)
          .run();
        imported.push({ publicId, title });
      } catch (error) {
        await media.delete(r2Key).catch(() => undefined);
        await d1
          .prepare(
            "DELETE FROM media_library_assets WHERE public_id = ? AND status = 'uploading'",
          )
          .bind(publicId)
          .run();
        throw error;
      }
    } catch (error) {
      failed.push({
        url: remoteUrl,
        message: error instanceof Error ? error.message : "导入失败。",
      });
    }
  }

  if (imported.length === 0 && skipped.length === 0) {
    throw new Error(failed[0]?.message ?? "没有可保存的图片素材。");
  }
  return {
    source,
    inspection,
    imported,
    skipped,
    failed,
    requestedCount: imageUrls.length,
  };
}
