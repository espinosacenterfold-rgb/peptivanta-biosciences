import { ensureCommunitySchema, getD1, getMediaStore } from "../db";

/** Cloudflare R2 Standard includes 10 GB-month of storage in the free tier. */
export const R2_FREE_STORAGE_BYTES = 10_000_000_000;

/** Default cleanup leaves 0.5 GB free before another upload is accepted. */
export const DEFAULT_MEDIA_CLEANUP_TARGET_BYTES = 9_500_000_000;
export const DEFAULT_MEDIA_RETENTION_DAYS = 180;

const MIN_HARD_LIMIT_BYTES = 500_000_000;
const MIN_CLEANUP_BUFFER_BYTES = 100_000_000;
const MAX_CLEANUP_LOGS = 500;

type StorageSettingsRow = {
  hard_limit_bytes: number;
  cleanup_target_bytes: number;
  retention_days: number;
  protect_customer_media: number;
  updated_at: string;
};

type CleanupCandidate = {
  id: number;
  public_id: string;
  source_title: string;
  r2_key: string;
  size_bytes: number;
};

export type MediaStorageSettings = {
  hardLimitBytes: number;
  cleanupTargetBytes: number;
  retentionDays: number;
  protectCustomerMedia: boolean;
  updatedAt: string;
};

export type MediaCleanupEvent = {
  id: number;
  assetPublicId: string;
  sourceTitle: string;
  sizeBytes: number;
  reason: string;
  createdAt: string;
};

export type MediaStorageSnapshot = {
  settings: MediaStorageSettings;
  freeAllowanceBytes: number;
  usedBytes: number;
  remainingBytes: number;
  protectedBytes: number;
  objectCount: number;
  uploadingBytes: number;
  usagePercent: number;
  cleanupEvents: MediaCleanupEvent[];
};

function finiteInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function settingsFromRow(row: StorageSettingsRow | null): MediaStorageSettings {
  const hardLimitBytes = Math.max(
    MIN_HARD_LIMIT_BYTES,
    Math.min(
      R2_FREE_STORAGE_BYTES,
      finiteInteger(row?.hard_limit_bytes, R2_FREE_STORAGE_BYTES),
    ),
  );
  const cleanupTargetBytes = Math.max(
    100_000_000,
    Math.min(
      hardLimitBytes - MIN_CLEANUP_BUFFER_BYTES,
      finiteInteger(
        row?.cleanup_target_bytes,
        DEFAULT_MEDIA_CLEANUP_TARGET_BYTES,
      ),
    ),
  );
  return {
    hardLimitBytes,
    cleanupTargetBytes,
    retentionDays: Math.max(
      1,
      Math.min(
        DEFAULT_MEDIA_RETENTION_DAYS,
        finiteInteger(row?.retention_days, DEFAULT_MEDIA_RETENTION_DAYS),
      ),
    ),
    protectCustomerMedia: Boolean(row?.protect_customer_media ?? 1),
    updatedAt: row?.updated_at ?? new Date().toISOString(),
  };
}

async function readSettings(d1: D1Database) {
  const row = await d1
    .prepare("SELECT * FROM media_storage_settings WHERE id = 1")
    .first<StorageSettingsRow>();
  return settingsFromRow(row);
}

export async function getMediaStorageSettings() {
  await ensureCommunitySchema();
  return readSettings(await getD1());
}

export function mediaExpiryIso(retentionDays: number, now = new Date()) {
  return new Date(
    now.getTime() +
      Math.max(1, Math.min(DEFAULT_MEDIA_RETENTION_DAYS, retentionDays)) *
        86_400_000,
  ).toISOString();
}

export async function saveMediaStorageSettings(input: {
  hardLimitBytes?: number;
  cleanupTargetBytes?: number;
  retentionDays?: number;
  protectCustomerMedia?: boolean;
}) {
  await ensureCommunitySchema();
  const d1 = await getD1();
  const current = await readSettings(d1);
  const hardLimitBytes = finiteInteger(
    input.hardLimitBytes,
    current.hardLimitBytes,
  );
  const cleanupTargetBytes = finiteInteger(
    input.cleanupTargetBytes,
    current.cleanupTargetBytes,
  );
  const retentionDays = finiteInteger(input.retentionDays, current.retentionDays);

  if (
    hardLimitBytes < MIN_HARD_LIMIT_BYTES ||
    hardLimitBytes > R2_FREE_STORAGE_BYTES
  ) {
    throw new Error("容量硬上限必须在 0.5 GB 至 10 GB 之间。");
  }
  if (
    cleanupTargetBytes < 100_000_000 ||
    cleanupTargetBytes > hardLimitBytes - MIN_CLEANUP_BUFFER_BYTES
  ) {
    throw new Error("回落线必须至少比硬上限低 0.1 GB。");
  }
  if (retentionDays < 1 || retentionDays > DEFAULT_MEDIA_RETENTION_DAYS) {
    throw new Error("素材保留期限必须在 1 至 180 天之间。");
  }

  await d1.batch([
    d1
      .prepare(
        `UPDATE media_storage_settings
         SET hard_limit_bytes = ?, cleanup_target_bytes = ?,
             retention_days = ?, protect_customer_media = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = 1`,
      )
      .bind(
        hardLimitBytes,
        cleanupTargetBytes,
        retentionDays,
        (input.protectCustomerMedia ?? current.protectCustomerMedia) ? 1 : 0,
      ),
    // Apply a changed retention preset to existing live media as well as new
    // uploads. The R2 bucket also has a 180-day lifecycle as a final backstop.
    d1
      .prepare(
        `UPDATE media_library_assets
         SET expires_at = datetime(created_at, '+' || ? || ' days'),
             updated_at = CURRENT_TIMESTAMP
         WHERE r2_key <> '' AND status <> 'uploading'`,
      )
      .bind(retentionDays),
  ]);

  return readSettings(d1);
}

async function storageUsage(d1: D1Database) {
  const row = await d1
    .prepare(
      `SELECT
         COUNT(*) AS object_count,
         COALESCE(SUM(m.size_bytes), 0) AS used_bytes,
         COALESCE(SUM(CASE WHEN m.status = 'uploading'
                           THEN m.size_bytes ELSE 0 END), 0) AS uploading_bytes,
         COALESCE(SUM(CASE WHEN EXISTS (
           SELECT 1 FROM feedback_entries f
           WHERE f.media_asset_id = m.id
             AND f.source_type <> 'illustrative'
             AND f.status NOT IN ('rejected', 'expired')
             AND datetime(f.expires_at) > CURRENT_TIMESTAMP
         ) THEN m.size_bytes ELSE 0 END), 0) AS protected_bytes
       FROM media_library_assets m
       WHERE m.r2_key <> ''`,
    )
    .first<{
      object_count: number;
      used_bytes: number;
      uploading_bytes: number;
      protected_bytes: number;
    }>();
  return {
    objectCount: finiteInteger(row?.object_count, 0),
    usedBytes: finiteInteger(row?.used_bytes, 0),
    uploadingBytes: finiteInteger(row?.uploading_bytes, 0),
    protectedBytes: finiteInteger(row?.protected_bytes, 0),
  };
}

export async function getMediaStorageSnapshot(): Promise<MediaStorageSnapshot> {
  await ensureCommunitySchema();
  const d1 = await getD1();
  const [settings, usage, cleanupRows] = await Promise.all([
    readSettings(d1),
    storageUsage(d1),
    d1
      .prepare(
        `SELECT id, asset_public_id, source_title, size_bytes, reason, created_at
         FROM media_cleanup_events
         ORDER BY datetime(created_at) DESC, id DESC
         LIMIT 30`,
      )
      .all<{
        id: number;
        asset_public_id: string;
        source_title: string;
        size_bytes: number;
        reason: string;
        created_at: string;
      }>(),
  ]);
  return {
    settings,
    freeAllowanceBytes: R2_FREE_STORAGE_BYTES,
    ...usage,
    remainingBytes: Math.max(0, settings.hardLimitBytes - usage.usedBytes),
    usagePercent:
      settings.hardLimitBytes > 0
        ? Math.min(100, (usage.usedBytes / settings.hardLimitBytes) * 100)
        : 0,
    cleanupEvents: cleanupRows.results.map((row) => ({
      id: row.id,
      assetPublicId: row.asset_public_id,
      sourceTitle: row.source_title,
      sizeBytes: row.size_bytes,
      reason: row.reason,
      createdAt: row.created_at,
    })),
  };
}

async function recordCleanup(
  d1: D1Database,
  row: CleanupCandidate,
  reason: string,
) {
  await d1
    .prepare(
      `INSERT INTO media_cleanup_events (
         asset_public_id, source_title, r2_key, size_bytes, reason
       ) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      row.public_id,
      row.source_title,
      row.r2_key,
      row.size_bytes,
      reason,
    )
    .run();
}

async function markObjectRemoved(
  d1: D1Database,
  media: R2Bucket,
  row: CleanupCandidate,
  status: string,
  reason: string,
) {
  // R2 deletion happens first. The database is changed only after Cloudflare
  // confirms the object operation, so the local byte counter never reports
  // space as free while the object still exists.
  if (row.r2_key) await media.delete(row.r2_key);
  await d1.batch([
    d1
      .prepare(
        `UPDATE media_library_assets
         SET status = ?, r2_key = '', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(status, row.id),
    d1
      .prepare(
        `INSERT INTO media_cleanup_events (
           asset_public_id, source_title, r2_key, size_bytes, reason
         ) VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(
        row.public_id,
        row.source_title,
        row.r2_key,
        row.size_bytes,
        reason,
      ),
  ]);
}

async function pruneCleanupLog(d1: D1Database) {
  await d1
    .prepare(
      `DELETE FROM media_cleanup_events
       WHERE id NOT IN (
         SELECT id FROM media_cleanup_events
         ORDER BY datetime(created_at) DESC, id DESC
         LIMIT ?
       )`,
    )
    .bind(MAX_CLEANUP_LOGS)
    .run();
}

export async function enforceMediaStorageLimit(options: {
  incomingBytes?: number;
  forceToTarget?: boolean;
} = {}) {
  await ensureCommunitySchema();
  const d1 = await getD1();
  const settings = await readSettings(d1);
  const incomingBytes = Math.max(0, finiteInteger(options.incomingBytes, 0));
  const initialUsage = await storageUsage(d1);
  const thresholdCrossed =
    initialUsage.usedBytes + incomingBytes > settings.hardLimitBytes;
  const triggered = Boolean(options.forceToTarget) || thresholdCrossed;

  if (!triggered) {
    return {
      triggered: false,
      deletedCount: 0,
      freedBytes: 0,
      canAccept: true,
      projectedBytes: initialUsage.usedBytes + incomingBytes,
      settings,
    };
  }

  const targetExistingBytes = Math.max(
    0,
    settings.cleanupTargetBytes - incomingBytes,
  );
  const candidates = await d1
    .prepare(
      `SELECT m.id, m.public_id, m.source_title, m.r2_key, m.size_bytes
       FROM media_library_assets m
       WHERE m.r2_key <> ''
         AND m.status <> 'uploading'
         AND (
           ? = 0 OR NOT EXISTS (
             SELECT 1 FROM feedback_entries protected
             WHERE protected.media_asset_id = m.id
               AND protected.source_type <> 'illustrative'
               AND protected.status NOT IN ('rejected', 'expired')
               AND datetime(protected.expires_at) > CURRENT_TIMESTAMP
           )
         )
       ORDER BY
         CASE
           WHEN m.status IN ('expired', 'rejected', 'pending') THEN 0
           WHEN NOT EXISTS (
             SELECT 1 FROM feedback_entries linked
             WHERE linked.media_asset_id = m.id
               AND linked.status NOT IN ('rejected', 'expired')
               AND datetime(linked.expires_at) > CURRENT_TIMESTAMP
           ) THEN 1
           WHEN NOT EXISTS (
             SELECT 1 FROM feedback_entries genuine
             WHERE genuine.media_asset_id = m.id
               AND genuine.source_type <> 'illustrative'
               AND genuine.status NOT IN ('rejected', 'expired')
               AND datetime(genuine.expires_at) > CURRENT_TIMESTAMP
           ) THEN 2
           ELSE 3
         END,
         datetime(COALESCE(m.last_used_at, m.created_at)) ASC,
         m.id ASC
       LIMIT 1000`,
    )
    .bind(settings.protectCustomerMedia ? 1 : 0)
    .all<CleanupCandidate>();

  let currentBytes = initialUsage.usedBytes;
  let deletedCount = 0;
  let freedBytes = 0;
  const media = await getMediaStore();
  for (const row of candidates.results) {
    if (currentBytes <= targetExistingBytes) break;
    await markObjectRemoved(
      d1,
      media,
      row,
      "capacity_expired",
      "capacity_threshold",
    );
    const removedBytes = Math.max(0, finiteInteger(row.size_bytes, 0));
    currentBytes = Math.max(0, currentBytes - removedBytes);
    freedBytes += removedBytes;
    deletedCount += 1;
  }
  await pruneCleanupLog(d1);

  const projectedBytes = currentBytes + incomingBytes;
  // Once a threshold cleanup starts, the new upload is accepted only if the
  // requested 9.5 GB return point was reached. This avoids hovering at 10 GB.
  const canAccept = thresholdCrossed
    ? projectedBytes <= settings.cleanupTargetBytes
    : projectedBytes <= settings.hardLimitBytes;
  return {
    triggered,
    deletedCount,
    freedBytes,
    canAccept,
    projectedBytes,
    settings,
  };
}

export async function cleanupExpiredAndInterruptedMedia() {
  await ensureCommunitySchema();
  const d1 = await getD1();
  const rows = await d1
    .prepare(
      `SELECT id, public_id, source_title, r2_key, size_bytes,
              CASE WHEN status = 'uploading' THEN 'upload_interrupted'
                   ELSE 'retention_expired' END AS cleanup_reason
       FROM media_library_assets
       WHERE r2_key <> '' AND (
         (status <> 'uploading' AND datetime(expires_at) <= CURRENT_TIMESTAMP)
         OR (status = 'uploading'
             AND datetime(created_at) <= datetime('now', '-1 hour'))
       )
       ORDER BY datetime(created_at) ASC
       LIMIT 200`,
    )
    .all<CleanupCandidate & { cleanup_reason: string }>();
  if (rows.results.length === 0) {
    await enforceMediaStorageLimit();
    return 0;
  }

  const media = await getMediaStore();
  for (const row of rows.results) {
    await markObjectRemoved(
      d1,
      media,
      row,
      row.cleanup_reason === "upload_interrupted"
        ? "upload_failed"
        : "expired",
      row.cleanup_reason,
    );
  }
  await pruneCleanupLog(d1);
  await enforceMediaStorageLimit();
  return rows.results.length;
}

export async function deleteMediaAssetManually(assetId: number) {
  await ensureCommunitySchema();
  const d1 = await getD1();
  const row = await d1
    .prepare(
      `SELECT id, public_id, source_title, r2_key, size_bytes
       FROM media_library_assets WHERE id = ?`,
    )
    .bind(assetId)
    .first<CleanupCandidate>();
  if (!row) return false;
  if (row.r2_key) {
    const media = await getMediaStore();
    await media.delete(row.r2_key);
    await recordCleanup(d1, row, "manual_delete");
  }
  await d1.prepare("DELETE FROM media_library_assets WHERE id = ?").bind(assetId).run();
  await pruneCleanupLog(d1);
  return true;
}
