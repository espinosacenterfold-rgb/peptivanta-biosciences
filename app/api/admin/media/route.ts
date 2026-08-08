import { ensureCommunitySchema, getD1, getMediaStore } from "../../../../db";
import { requireFulfillmentAdmin } from "../auth";
import {
  noStoreJson,
  randomToken,
  requireSameOrigin,
} from "../../../../lib/customer-auth";
import { cleanupExpiredMedia } from "../../../../lib/feedback-ledger";
import {
  deleteMediaAssetManually,
  enforceMediaStorageLimit,
  getMediaStorageSettings,
  getMediaStorageSnapshot,
  mediaExpiryIso,
  saveMediaStorageSettings,
} from "../../../../lib/media-storage";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 2_500_000;

function tomorrowIso() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function scheduledDate(input: string, earliest = tomorrowIso()) {
  const value = /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : earliest;
  return value < earliest ? earliest : value;
}

function extensionForMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function safeTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => /^[a-z0-9_-]{1,30}$/.test(tag)),
    ),
  ).slice(0, 16);
}

function validateSourceUrl(input: string, requestedPlatform?: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Enter a valid TikTok or Xiaohongshu URL.");
  }
  if (url.protocol !== "https:") throw new Error("Only HTTPS source links are accepted.");
  const host = url.hostname.toLowerCase();
  const tiktokHosts = new Set(["tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"]);
  const xhsHosts = new Set(["xiaohongshu.com", "www.xiaohongshu.com", "xhslink.com"]);
  const platform = tiktokHosts.has(host)
    ? "tiktok"
    : xhsHosts.has(host)
      ? "xiaohongshu"
      : "";
  if (!platform || (requestedPlatform && requestedPlatform !== platform)) {
    throw new Error("Only approved TikTok or Xiaohongshu domains are accepted.");
  }
  url.hash = "";
  return { platform, url: url.toString() };
}

async function mediaPayload() {
  const d1 = await getD1();
  const [rows, storage] = await Promise.all([
    d1
      .prepare(
        `SELECT * FROM media_library_assets
         ORDER BY CASE status
           WHEN 'uploading' THEN 0 WHEN 'pending' THEN 1
           WHEN 'source_only' THEN 2 WHEN 'approved' THEN 3 ELSE 4 END,
           datetime(created_at) DESC
         LIMIT 400`,
      )
      .all(),
    getMediaStorageSnapshot(),
  ]);
  return {
    assets: rows.results,
    retentionDays: storage.settings.retentionDays,
    storage,
  };
}

export async function GET(request: Request) {
  const denied = await requireFulfillmentAdmin(request);
  if (denied) return denied;
  try {
    await ensureCommunitySchema();
    await cleanupExpiredMedia();
    return noStoreJson(await mediaPayload());
  } catch (error) {
    return noStoreJson({ error: error instanceof Error ? error.message : "Unable to load media." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireFulfillmentAdmin(request);
  if (denied) return denied;
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  try {
    await ensureCommunitySchema();
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        action?: string;
        sourceUrl?: string;
        platform?: string;
        hardLimitBytes?: number;
        cleanupTargetBytes?: number;
        retentionDays?: number;
        protectCustomerMedia?: boolean;
      };
      if (body.action === "update_storage_settings") {
        await saveMediaStorageSettings({
          hardLimitBytes: body.hardLimitBytes,
          cleanupTargetBytes: body.cleanupTargetBytes,
          retentionDays: body.retentionDays,
          protectCustomerMedia: body.protectCustomerMedia,
        });
        // If an administrator lowers a threshold below current usage, apply
        // the new policy immediately instead of waiting for the nightly job.
        await enforceMediaStorageLimit();
        return noStoreJson({ ok: true, ...(await mediaPayload()) });
      }
      if (body.action === "cleanup_storage") {
        const cleanup = await enforceMediaStorageLimit({ forceToTarget: true });
        return noStoreJson({
          ok: true,
          cleanup,
          ...(await mediaPayload()),
        });
      }
      if (body.action !== "import_link") {
        return noStoreJson({ error: "Unsupported action." }, { status: 400 });
      }
      const source = validateSourceUrl(body.sourceUrl ?? "", body.platform);
      let title = "";
      let author = "";
      if (source.platform === "tiktok") {
        try {
          const response = await fetch(
            `https://www.tiktok.com/oembed?url=${encodeURIComponent(source.url)}`,
            {
              headers: { Accept: "application/json" },
              signal: AbortSignal.timeout(4_000),
            },
          );
          if (response.ok) {
            const data = (await response.json()) as { title?: string; author_name?: string };
            title = (data.title ?? "").slice(0, 180);
            author = (data.author_name ?? "").slice(0, 100);
          }
        } catch {
          // The source record remains useful even when oEmbed is unavailable.
        }
      }
      const publicId = `media_${randomToken(12)}`;
      const d1 = await getD1();
      const storageSettings = await getMediaStorageSettings();
      await d1
        .prepare(
          `INSERT INTO media_library_assets (
            public_id, status, source_platform, source_url, source_title,
            source_author, rights_basis, rights_confirmed_at,
            available_from, expires_at
          ) VALUES (?, 'source_only', ?, ?, ?, ?, 'unconfirmed_source',
                    '', ?, ?)`,
        )
        .bind(
          publicId,
          source.platform,
          source.url,
          title,
          author,
          tomorrowIso(),
          mediaExpiryIso(storageSettings.retentionDays),
        )
        .run();
      return noStoreJson({
        ok: true,
        publicId,
        source: { ...source, title, author },
        helperUrl:
          source.platform === "tiktok"
            ? "https://tiksave.io/zh-cn"
            : "https://dy.kukutool.com/xiaohongshu",
        message: "Source saved. Open the helper, then upload only media you own or are authorized to display.",
      });
    }

    if (!contentType.includes("multipart/form-data")) {
      return noStoreJson({ error: "Upload a supported image file." }, { status: 415 });
    }
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_UPLOAD_BYTES + 300_000) {
      return noStoreJson({ error: "The upload is larger than the 2.5 MB limit." }, { status: 413 });
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return noStoreJson({ error: "Choose an image to upload." }, { status: 400 });
    }
    if (!ALLOWED_MIME.has(file.type) || file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      return noStoreJson({ error: "Use a JPG, PNG, or WebP image no larger than 2.5 MB." }, { status: 400 });
    }
    if (form.get("rightsConfirmed") !== "true") {
      return noStoreJson({ error: "Confirm that the image is owned or authorized for commercial display." }, { status: 400 });
    }
    const sourceUrlInput = String(form.get("sourceUrl") ?? "").trim();
    const sourcePlatformInput = String(form.get("sourcePlatform") ?? "manual");
    let sourceUrl = sourceUrlInput;
    let sourcePlatform = sourcePlatformInput;
    if (sourceUrlInput) {
      const validated = validateSourceUrl(sourceUrlInput, sourcePlatformInput === "manual" ? undefined : sourcePlatformInput);
      sourceUrl = validated.url;
      sourcePlatform = validated.platform;
    } else {
      sourcePlatform = "manual";
    }
    const publicId = `media_${randomToken(12)}`;
    const r2Key = `feedback-media/${new Date().toISOString().slice(0, 7)}/${publicId}.${extensionForMime(file.type)}`;
    const tags = safeTags(String(form.get("tags") ?? ""));
    const width = Math.max(0, Math.min(10_000, Number(form.get("width")) || 0));
    const height = Math.max(0, Math.min(10_000, Number(form.get("height")) || 0));
    const availableFrom = scheduledDate(String(form.get("availableFrom") ?? ""));
    const title = String(form.get("title") ?? file.name).trim().slice(0, 180);
    const author = String(form.get("author") ?? "").trim().slice(0, 100);
    const d1 = await getD1();

    // Check capacity before sending any bytes to R2. Crossing 10 GB triggers
    // deletion of the oldest eligible assets until the projected total falls
    // to the configured 9.5 GB return point.
    const capacity = await enforceMediaStorageLimit({ incomingBytes: file.size });
    if (!capacity.canAccept) {
      return noStoreJson(
        {
          error:
            "R2 素材已接近 10 GB，且受保护的真实反馈图片无法自动删除。本次上传已被阻止，未产生超额存储。",
        },
        { status: 507 },
      );
    }

    const storageSettings = await getMediaStorageSettings();
    // The uploading row reserves this file's exact byte size. The conditional
    // INSERT is atomic in D1, preventing concurrent uploads from jointly
    // crossing the hard limit after each passed an earlier read.
    const reservation = await d1
      .prepare(
        `INSERT INTO media_library_assets (
          public_id, status, source_platform, source_url, source_title,
          source_author, rights_basis, rights_confirmed_at,
          original_filename, r2_key, mime_type, size_bytes, width, height,
          tags_json, available_from, expires_at
        )
        SELECT ?, 'uploading', ?, ?, ?, ?, 'owned_or_authorized',
               CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE COALESCE((
          SELECT SUM(size_bytes) FROM media_library_assets WHERE r2_key <> ''
        ), 0) + ? <= COALESCE((
          SELECT hard_limit_bytes FROM media_storage_settings WHERE id = 1
        ), 10000000000)`,
      )
      .bind(
        publicId,
        sourcePlatform,
        sourceUrl,
        title,
        author,
        file.name.slice(0, 180),
        r2Key,
        file.type,
        file.size,
        width,
        height,
        JSON.stringify(tags),
        availableFrom,
        mediaExpiryIso(storageSettings.retentionDays),
        file.size,
      )
      .run();
    if (Number(reservation.meta.changes ?? 0) !== 1) {
      return noStoreJson(
        {
          error:
            "另一项上传刚刚占用了可用空间。本次上传未写入 R2，请刷新容量后重试。",
        },
        { status: 409 },
      );
    }

    const media = await getMediaStore();
    try {
      await media.put(r2Key, await file.arrayBuffer(), {
        httpMetadata: {
          contentType: file.type,
          cacheControl: "public, max-age=86400",
        },
        customMetadata: { publicId, sourcePlatform },
      });
      await d1
        .prepare(
          `UPDATE media_library_assets
           SET status = 'approved', updated_at = CURRENT_TIMESTAMP
           WHERE public_id = ? AND status = 'uploading'`,
        )
        .bind(publicId)
        .run();
    } catch (uploadError) {
      let r2Removed = false;
      try {
        await media.delete(r2Key);
        r2Removed = true;
      } catch {
        // Keep the uploading reservation when R2 deletion is unavailable.
        // The scheduled stale-upload cleanup can then find the exact key,
        // retry deletion, and the byte counter continues to include it.
      }
      if (r2Removed) {
        await d1
          .prepare(
            "DELETE FROM media_library_assets WHERE public_id = ? AND status = 'uploading'",
          )
          .bind(publicId)
          .run();
      }
      throw uploadError;
    }
    return noStoreJson({ ok: true, publicId, ...(await mediaPayload()) });
  } catch (error) {
    return noStoreJson({ error: error instanceof Error ? error.message : "Unable to save media." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const denied = await requireFulfillmentAdmin(request);
  if (denied) return denied;
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  try {
    const body = (await request.json()) as {
      assetId?: number;
      status?: string;
      availableFrom?: string;
      tags?: string;
      title?: string;
    };
    const id = Number(body.assetId);
    if (!Number.isInteger(id) || id <= 0) return noStoreJson({ error: "Invalid media asset." }, { status: 400 });
    const statuses = new Set(["approved", "pending", "rejected", "scheduled"]);
    const status = statuses.has(body.status ?? "") ? body.status : "approved";
    const tags = safeTags(body.tags ?? "");
    const d1 = await getD1();
    await d1
      .prepare(
        `UPDATE media_library_assets SET status = ?, available_from = ?,
           tags_json = ?, source_title = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(
        status,
        scheduledDate(body.availableFrom ?? "", new Date().toISOString().slice(0, 10)),
        JSON.stringify(tags),
        (body.title ?? "").trim().slice(0, 180),
        id,
      )
      .run();
    return noStoreJson(await mediaPayload());
  } catch (error) {
    return noStoreJson({ error: error instanceof Error ? error.message : "Unable to update media." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await requireFulfillmentAdmin(request);
  if (denied) return denied;
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  try {
    const body = (await request.json()) as { assetId?: number };
    const id = Number(body.assetId);
    if (!Number.isInteger(id) || id <= 0) return noStoreJson({ error: "Invalid media asset." }, { status: 400 });
    await deleteMediaAssetManually(id);
    return noStoreJson(await mediaPayload());
  } catch (error) {
    return noStoreJson({ error: error instanceof Error ? error.message : "Unable to delete media." }, { status: 500 });
  }
}
