import { ensureCommunitySchema, getD1 } from "../db";
import { randomToken } from "./customer-auth";
import {
  normalizeCollectionKeywords,
  xiaohongshuSearchUrl,
} from "./community-rules";

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function calendarDaysBetween(left: string, right: string) {
  const start = Date.parse(`${left}T00:00:00.000Z`);
  const end = Date.parse(`${right}T00:00:00.000Z`);
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

/**
 * Creates a lightweight research reminder approximately every configured
 * interval. This deliberately does not fetch, parse, download, or republish a
 * third-party post. The administrator must select an owned/authorized source
 * and upload it through the existing media review flow.
 */
export async function maintainMediaCollectionTasks(
  now = new Date(),
  options: { force?: boolean } = {},
) {
  await ensureCommunitySchema();
  const d1 = await getD1();
  await d1
    .prepare(
      "DELETE FROM media_collection_tasks WHERE datetime(created_at) <= datetime(?, '-180 days')",
    )
    .bind(now.toISOString())
    .run();

  const settings = await d1
    .prepare(
      `SELECT enabled, interval_days, keywords_json
       FROM media_collection_settings WHERE id = 1`,
    )
    .first<{
      enabled: number;
      interval_days: number;
      keywords_json: string;
    }>();
  if (!Boolean(settings?.enabled ?? 1) && !options.force) {
    return { created: false, reason: "disabled" } as const;
  }

  const today = isoDate(now);
  const lastTask = await d1
    .prepare(
      `SELECT created_at FROM media_collection_tasks
       ORDER BY datetime(created_at) DESC, id DESC LIMIT 1`,
    )
    .first<{ created_at: string }>();
  const intervalDays = Math.max(
    1,
    Math.min(30, Number(settings?.interval_days ?? 3)),
  );
  if (
    !options.force &&
    lastTask?.created_at &&
    calendarDaysBetween(lastTask.created_at.slice(0, 10), today) < intervalDays
  ) {
    return { created: false, reason: "not_due" } as const;
  }

  let parsedKeywords: unknown = [];
  try {
    parsedKeywords = JSON.parse(settings?.keywords_json ?? "[]");
  } catch {
    parsedKeywords = [];
  }
  const keywords = normalizeCollectionKeywords(parsedKeywords);
  const count = await d1
    .prepare("SELECT COUNT(*) AS count FROM media_collection_tasks")
    .first<{ count: number }>();
  const keyword = keywords[Number(count?.count ?? 0) % keywords.length];
  const publicId = `collect_${randomToken(10)}`;
  const searchUrl = xiaohongshuSearchUrl(keyword);

  await d1
    .prepare(
      `INSERT INTO media_collection_tasks (
        public_id, platform, keyword, search_url, status, created_at
      ) VALUES (?, 'xiaohongshu', ?, ?, 'pending_review', ?)`,
    )
    .bind(publicId, keyword, searchUrl, now.toISOString())
    .run();

  return { created: true, publicId, keyword, searchUrl } as const;
}
