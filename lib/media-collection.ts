import {
  extractXiaohongshuSourceUrls,
  normalizeCollectionKeywords,
  xiaohongshuSearchUrl,
} from "./community-rules";
import {
  extractRemoteImageUrls,
  importDiscoveredMediaAssets,
  inspectMediaSource,
  validateRemoteImageUrl,
} from "./media-import";

const MAX_PROVIDER_RESPONSE_BYTES = 1_500_000;
const JINA_SEARCH_ENDPOINT = "https://s.jina.ai/";
const JINA_READER_ENDPOINT = "https://r.jina.ai/";

async function communityDatabase() {
  return import("../db");
}

async function ensureCommunitySchema() {
  return (await communityDatabase()).ensureCommunitySchema();
}

async function getD1() {
  return (await communityDatabase()).getD1();
}

function randomToken(byteLength = 10) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function calendarDaysBetween(left: string, right: string) {
  const start = Date.parse(`${left}T00:00:00.000Z`);
  const end = Date.parse(`${right}T00:00:00.000Z`);
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

async function jinaApiKey() {
  const { env } = await import("cloudflare:workers");
  const runtimeEnv = env as unknown as { JINA_API_KEY?: string };
  return runtimeEnv.JINA_API_KEY?.trim() ?? "";
}

export async function mediaCollectionProviderStatus() {
  return {
    provider: "Jina Search + Reader",
    configured: Boolean(await jinaApiKey()),
  };
}

async function limitedText(response: Response) {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_PROVIDER_RESPONSE_BYTES) {
    throw new Error("自动搜索服务返回内容过大。");
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_PROVIDER_RESPONSE_BYTES) {
    throw new Error("自动搜索服务返回内容过大。");
  }
  return new TextDecoder().decode(buffer);
}

async function discoverXiaohongshuSources(keyword: string, apiKey: string) {
  const query = `site:xiaohongshu.com/explore ${keyword}`;
  const response = await fetch(
    `${JINA_SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Retain-Images": "none",
      },
      signal: AbortSignal.timeout(20_000),
    },
  );
  const text = await limitedText(response);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("自动搜索密钥无效或没有 Search 权限。");
    }
    throw new Error(`自动搜索服务返回 ${response.status}。`);
  }
  let payload: unknown = text;
  try {
    payload = JSON.parse(text);
  } catch {
    // The provider can also return markdown; URL extraction supports both.
  }
  return extractXiaohongshuSourceUrls(payload);
}

function readerTarget(sourceUrl: string) {
  const source = new URL(sourceUrl);
  source.protocol = "http:";
  return `${JINA_READER_ENDPOINT}${source.toString()}`;
}

async function inspectSourceWithReader(sourceUrl: string, apiKey: string) {
  const response = await fetch(readerTarget(sourceUrl), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Retain-Images": "all",
    },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await limitedText(response);
  if (!response.ok) {
    throw new Error(`自动解析服务返回 ${response.status}。`);
  }
  let payload: unknown = text;
  let title = "";
  try {
    payload = JSON.parse(text);
    const object = payload as {
      data?: { title?: string; content?: string };
      title?: string;
      content?: string;
    };
    title = (object.data?.title || object.title || "").slice(0, 180);
  } catch {
    // Markdown is an expected response format as well.
  }
  const serialized =
    typeof payload === "string" ? payload : JSON.stringify(payload);
  const imageCandidates = [
    ...Array.from(
      serialized.matchAll(/!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/gi),
      (match) => match[1],
    ),
    ...(serialized.match(
      /https:\/\/[^\s"'<>]*(?:xhscdn|xiaohongshu)[^\s"'<>]*/gi,
    ) ?? []),
  ];
  const imageUrls: string[] = [];
  for (const candidate of imageCandidates) {
    try {
      const normalized = validateRemoteImageUrl(
        candidate.replace(/[),.;\]}]+$/, ""),
      );
      if (!imageUrls.includes(normalized)) imageUrls.push(normalized);
    } catch {
      // Ignore non-public reader assets.
    }
    if (imageUrls.length >= 18) break;
  }
  return {
    title,
    imageUrls:
      imageUrls.length > 0
        ? imageUrls
        : extractRemoteImageUrls(serialized).slice(0, 18),
  };
}

function automaticTags(keyword: string) {
  const tags = ["auto_collected", "xiaohongshu", keyword];
  if (/包装/.test(keyword)) tags.push("packaging");
  if (/发货|物流/.test(keyword)) tags.push("logistics");
  if (/coa|检测|报告/i.test(keyword)) tags.push("coa", "testing");
  if (/多肽|peptide/i.test(keyword)) tags.push("peptide");
  return tags;
}

async function updateTask(
  taskId: number,
  values: {
    status: string;
    resultCount?: number;
    assetCount?: number;
    errorMessage?: string;
    started?: boolean;
    finished?: boolean;
  },
) {
  const d1 = await getD1();
  await d1
    .prepare(
      `UPDATE media_collection_tasks
       SET status = ?, result_count = ?, asset_count = ?, error_message = ?,
           started_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE started_at END,
           finished_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE finished_at END
       WHERE id = ?`,
    )
    .bind(
      values.status,
      Math.max(0, values.resultCount ?? 0),
      Math.max(0, values.assetCount ?? 0),
      (values.errorMessage ?? "").slice(0, 500),
      values.started ? 1 : 0,
      values.finished ? 1 : 0,
      taskId,
    )
    .run();
}

async function runMediaCollectionTask(input: {
  taskId: number;
  keyword: string;
  now: Date;
  importLimit: number;
}) {
  await updateTask(input.taskId, { status: "running", started: true });
  const apiKey = await jinaApiKey();
  if (!apiKey) {
    const message = "尚未配置 JINA_API_KEY，自动关键词搜索无法启动。";
    await updateTask(input.taskId, {
      status: "needs_configuration",
      errorMessage: message,
      finished: true,
    });
    return { status: "needs_configuration", discovered: 0, imported: 0 };
  }

  try {
    const sources = await discoverXiaohongshuSources(input.keyword, apiKey);
    if (sources.length === 0) {
      await updateTask(input.taskId, {
        status: "no_results",
        errorMessage: "本轮搜索没有发现可解析的小红书内容链接。",
        finished: true,
      });
      return { status: "no_results", discovered: 0, imported: 0 };
    }

    let imported = 0;
    let skipped = 0;
    const failures: string[] = [];
    for (const sourceUrl of sources.slice(0, 8)) {
      if (imported >= input.importLimit) break;
      try {
        let title = "";
        let author = "";
        let imageUrls: string[] = [];
        try {
          const inspection = await inspectMediaSource(sourceUrl, "xiaohongshu");
          title = inspection.title;
          author = inspection.author;
          imageUrls = inspection.previewUrls;
        } catch {
          // Reader fallback below handles sites that reject a direct Worker fetch.
        }
        if (imageUrls.length === 0) {
          const reader = await inspectSourceWithReader(sourceUrl, apiKey);
          title ||= reader.title;
          imageUrls = reader.imageUrls;
        }
        if (imageUrls.length === 0) {
          failures.push("来源页没有可下载图片");
          continue;
        }
        const result = await importDiscoveredMediaAssets({
          sourceUrl,
          imageUrls,
          title,
          author,
          tags: automaticTags(input.keyword),
          availableFrom: isoDate(input.now),
          maximumImages: input.importLimit - imported,
        });
        imported += result.imported.length;
        skipped += result.skipped.length;
        failures.push(...result.failed.map((failure) => failure.message));
      } catch (error) {
        failures.push(error instanceof Error ? error.message : "来源采集失败");
      }
    }

    const status = imported > 0 || skipped > 0 ? "completed" : "no_assets";
    const message =
      imported > 0
        ? `已自动写入 ${imported} 张 R2 待审核素材。`
        : skipped > 0
          ? "候选素材已经存在，未重复写入。"
          : failures[0] ?? "没有可写入的图片素材。";
    await updateTask(input.taskId, {
      status,
      resultCount: sources.length,
      assetCount: imported,
      errorMessage: message,
      finished: true,
    });
    return { status, discovered: sources.length, imported, skipped };
  } catch (error) {
    const message = error instanceof Error ? error.message : "自动采集失败。";
    await updateTask(input.taskId, {
      status: "failed",
      errorMessage: message,
      finished: true,
    });
    return { status: "failed", discovered: 0, imported: 0, error: message };
  }
}

export async function retryMediaCollectionTask(taskId: number, now = new Date()) {
  await ensureCommunitySchema();
  const d1 = await getD1();
  const [task, settings] = await Promise.all([
    d1
      .prepare(
        "SELECT keyword, status FROM media_collection_tasks WHERE id = ? LIMIT 1",
      )
      .bind(taskId)
      .first<{ keyword: string; status: string }>(),
    d1
      .prepare(
        "SELECT auto_import_limit FROM media_collection_settings WHERE id = 1",
      )
      .first<{ auto_import_limit: number }>(),
  ]);
  if (!task) throw new Error("自动采集任务不存在。");
  if (task.status === "running") throw new Error("该任务正在运行，请稍后刷新。");
  await d1
    .prepare(
      `UPDATE media_collection_tasks
       SET status = 'queued', result_count = 0, asset_count = 0,
           error_message = '', started_at = NULL, finished_at = NULL,
           reviewed_at = NULL
       WHERE id = ?`,
    )
    .bind(taskId)
    .run();
  return runMediaCollectionTask({
    taskId,
    keyword: task.keyword,
    now,
    importLimit: Math.max(
      1,
      Math.min(8, Number(settings?.auto_import_limit ?? 3)),
    ),
  });
}

/**
 * Creates and executes one automated keyword collection run when due. Search
 * results are downloaded to R2 as pending assets; public use still requires
 * an explicit rights review in the media administrator.
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
      `SELECT enabled, interval_days, keywords_json, auto_import_limit
       FROM media_collection_settings WHERE id = 1`,
    )
    .first<{
      enabled: number;
      interval_days: number;
      keywords_json: string;
      auto_import_limit: number;
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
  const inserted = await d1
    .prepare(
      `INSERT INTO media_collection_tasks (
        public_id, platform, keyword, search_url, status, provider, created_at
      ) VALUES (?, 'xiaohongshu', ?, ?, 'queued', 'jina', ?)`,
    )
    .bind(publicId, keyword, searchUrl, now.toISOString())
    .run();
  const taskId = Number(inserted.meta.last_row_id ?? 0);
  if (!taskId) throw new Error("自动采集任务创建失败。");

  const run = await runMediaCollectionTask({
    taskId,
    keyword,
    now,
    importLimit: Math.max(1, Math.min(8, Number(settings?.auto_import_limit ?? 3))),
  });
  return { created: true, publicId, keyword, searchUrl, run } as const;
}
