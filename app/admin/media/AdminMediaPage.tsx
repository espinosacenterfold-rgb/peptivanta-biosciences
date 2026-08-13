"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AdminHeader,
  AdminLogin,
  AdminPage,
  AdminSessionChecking,
} from "../_components/AdminChrome";
import { useAdminSession } from "../_components/useAdminSession";
import { downloadAdminCsv } from "../_components/admin-export";

type MediaAsset = {
  id: number;
  public_id: string;
  status: string;
  source_platform: string;
  source_url: string;
  preview_url: string;
  source_title: string;
  source_author: string;
  r2_key: string;
  mime_type: string;
  size_bytes: number;
  width: number;
  height: number;
  tags_json: string;
  available_from: string;
  expires_at: string;
  use_count: number;
  rights_basis: string;
  rights_confirmed_at: string;
};

type MediaCleanupEvent = {
  id: number;
  assetPublicId: string;
  sourceTitle: string;
  sizeBytes: number;
  reason: string;
  createdAt: string;
};

type MediaStorage = {
  settings: {
    hardLimitBytes: number;
    cleanupTargetBytes: number;
    retentionDays: number;
    protectCustomerMedia: boolean;
    updatedAt: string;
  };
  freeAllowanceBytes: number;
  usedBytes: number;
  remainingBytes: number;
  protectedBytes: number;
  objectCount: number;
  uploadingBytes: number;
  usagePercent: number;
  cleanupEvents: MediaCleanupEvent[];
};

type MediaCollectionSettings = {
  id: number;
  enabled: number;
  interval_days: number;
  keywords_json: string;
  auto_import_limit: number;
  updated_at: string;
};

type MediaCollectionTask = {
  id: number;
  public_id: string;
  platform: string;
  keyword: string;
  search_url: string;
  status: string;
  provider: string;
  result_count: number;
  asset_count: number;
  error_message: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  reviewed_at: string | null;
};

type MediaPayload = {
  assets: MediaAsset[];
  retentionDays: number;
  storage: MediaStorage;
  collectionSettings: MediaCollectionSettings;
  collectionTasks: MediaCollectionTask[];
  collectionProvider: {
    provider: string;
    configured: boolean;
  };
};

type ImportResult = {
  helperUrl: string;
  import: {
    requestedCount: number;
    imported: Array<{ publicId: string; title: string; status: string }>;
    skipped: string[];
    failed: Array<{ url: string; message: string }>;
  };
};

const DECIMAL_GB = 1_000_000_000;

function formatBytes(bytes: number) {
  if (bytes >= DECIMAL_GB) return `${(bytes / DECIMAL_GB).toFixed(2)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${Math.max(0, bytes)} B`;
}

function cleanupReason(reason: string) {
  const labels: Record<string, string> = {
    capacity_threshold: "容量回落",
    retention_expired: "到期清理",
    upload_interrupted: "中断上传",
    manual_delete: "手动删除",
  };
  return labels[reason] ?? reason;
}

function collectionStatus(status: string) {
  const labels: Record<string, string> = {
    queued: "等待执行",
    running: "采集中",
    completed: "已入待审核库",
    no_results: "未发现结果",
    no_assets: "未提取到图片",
    needs_configuration: "等待搜索密钥",
    failed: "执行失败",
    pending_review: "旧版待处理",
    skipped: "已跳过",
  };
  return labels[status] ?? status;
}

/**
 * Browser-side compression removes EXIF data and prevents an original phone
 * photo from consuming several megabytes. The server still validates the
 * optimized file independently before writing it to R2.
 */
async function optimizeImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("浏览器无法处理这张图片。");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.82),
  );
  if (!blob) throw new Error("图片压缩失败。");
  return {
    file: new File(
      [blob],
      `${file.name.replace(/\.[^.]+$/, "")}.webp`,
      { type: "image/webp" },
    ),
    width,
    height,
  };
}

export default function AdminMediaPage() {
  const auth = useAdminSession();
  const [data, setData] = useState<MediaPayload | null>(null);
  const [message, setMessage] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [assetQuery, setAssetQuery] = useState("");
  const [assetStatus, setAssetStatus] = useState("all");
  const [assetPlatform, setAssetPlatform] = useState("all");
  const [importPlatform, setImportPlatform] = useState("xiaohongshu");
  const [importSourceUrl, setImportSourceUrl] = useState("");
  const [tomorrow] = useState(() =>
    new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  );

  const visibleAssets = useMemo(() => {
    const needle = assetQuery.trim().toLocaleLowerCase();
    return (data?.assets ?? []).filter((asset) => {
      const searchable = [asset.public_id, asset.source_title, asset.source_author, asset.tags_json].join(" ").toLocaleLowerCase();
      return (
        (!needle || searchable.includes(needle)) &&
        (assetStatus === "all" || asset.status === assetStatus) &&
        (assetPlatform === "all" || asset.source_platform === assetPlatform)
      );
    });
  }, [assetPlatform, assetQuery, assetStatus, data?.assets]);

  function exportAssets() {
    downloadAdminCsv(`peptivanta-media-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["素材编号", "标题", "平台", "状态", "文件大小", "尺寸", "使用次数", "可用日期", "到期日期", "来源链接"],
      ...visibleAssets.map((asset) => [asset.public_id, asset.source_title, asset.source_platform, asset.status, asset.size_bytes, `${asset.width}x${asset.height}`, asset.use_count, asset.available_from, asset.expires_at, asset.source_url]),
    ]);
  }

  async function load() {
    setData(await auth.request<MediaPayload>("/api/admin/media"));
  }

  useEffect(() => {
    if (!auth.authenticated) return;
    const frame = window.requestAnimationFrame(() => {
      void load().catch((caught) =>
        auth.setError(caught instanceof Error ? caught.message : "加载失败。"),
      );
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.authenticated]);

  async function saveStorageSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    auth.setBusy(true);
    auth.setError("");
    try {
      const result = await auth.request<MediaPayload>("/api/admin/media", {
        method: "POST",
        body: JSON.stringify({
          action: "update_storage_settings",
          hardLimitBytes: Number(form.get("hardLimitGb")) * DECIMAL_GB,
          cleanupTargetBytes:
            Number(form.get("cleanupTargetGb")) * DECIMAL_GB,
          retentionDays: Number(form.get("retentionDays")),
          protectCustomerMedia: form.get("protectCustomerMedia") === "true",
        }),
      });
      setData(result);
      setMessage("R2 容量保护设置已保存并立即检查。硬上限不会允许超过 10 GB。");
    } catch (caught) {
      auth.setError(caught instanceof Error ? caught.message : "保存失败。");
    } finally {
      auth.setBusy(false);
    }
  }

  async function runStorageCleanup() {
    if (
      !window.confirm(
        "将按清理优先级永久删除最旧的低优先级图片，直到占用回落到设置值。继续吗？",
      )
    ) {
      return;
    }
    auth.setBusy(true);
    auth.setError("");
    try {
      const result = await auth.request<
        MediaPayload & { cleanup?: { deletedCount?: number; freedBytes?: number } }
      >("/api/admin/media", {
        method: "POST",
        body: JSON.stringify({ action: "cleanup_storage" }),
      });
      setData(result);
      setMessage(
        `容量检查完成：删除 ${result.cleanup?.deletedCount ?? 0} 张，释放 ${formatBytes(result.cleanup?.freedBytes ?? 0)}。`,
      );
    } catch (caught) {
      auth.setError(caught instanceof Error ? caught.message : "清理失败。");
    } finally {
      auth.setBusy(false);
    }
  }

  async function saveCollectionSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    auth.setBusy(true);
    auth.setError("");
    try {
      setData(
        await auth.request<MediaPayload>("/api/admin/media", {
          method: "POST",
          body: JSON.stringify({
            action: "update_collection_settings",
            collectionEnabled: form.get("collectionEnabled") === "true",
            collectionIntervalDays: Number(form.get("collectionIntervalDays")),
            collectionKeywords: String(form.get("collectionKeywords") ?? ""),
            collectionAutoImportLimit: Number(form.get("collectionAutoImportLimit")),
          }),
        }),
      );
      setMessage("自动采集设置已保存。到期后将搜索、去重并把图片写入 R2 待审核区。");
    } catch (caught) {
      auth.setError(caught instanceof Error ? caught.message : "保存失败。");
    } finally {
      auth.setBusy(false);
    }
  }

  async function createCollectionTaskNow() {
    auth.setBusy(true);
    auth.setError("");
    try {
      setData(
        await auth.request<MediaPayload>("/api/admin/media", {
          method: "POST",
          body: JSON.stringify({ action: "create_collection_task_now" }),
        }),
      );
      setMessage("已立即执行一轮小红书关键词自动采集，请查看任务结果。");
    } catch (caught) {
      auth.setError(caught instanceof Error ? caught.message : "生成任务失败。");
    } finally {
      auth.setBusy(false);
    }
  }

  async function updateCollectionTask(id: number, status: "completed" | "skipped") {
    auth.setBusy(true);
    auth.setError("");
    try {
      setData(
        await auth.request<MediaPayload>("/api/admin/media", {
          method: "POST",
          body: JSON.stringify({
            action: "update_collection_task",
            collectionTaskId: id,
            collectionTaskStatus: status,
          }),
        }),
      );
      setMessage(status === "completed" ? "采集任务已标记为已处理。" : "采集任务已跳过。");
    } catch (caught) {
      auth.setError(caught instanceof Error ? caught.message : "更新任务失败。");
    } finally {
      auth.setBusy(false);
    }
  }

  async function deleteCollectionTask(id: number) {
    if (!window.confirm("确定删除这条关键词任务吗？")) return;
    auth.setBusy(true);
    auth.setError("");
    try {
      setData(
        await auth.request<MediaPayload>("/api/admin/media", {
          method: "DELETE",
          body: JSON.stringify({
            action: "delete_collection_task",
            collectionTaskId: id,
          }),
        }),
      );
      setMessage("关键词任务已删除。");
    } catch (caught) {
      auth.setError(caught instanceof Error ? caught.message : "删除任务失败。");
    } finally {
      auth.setBusy(false);
    }
  }

  async function retryCollectionTask(id: number) {
    auth.setBusy(true);
    auth.setError("");
    try {
      setData(
        await auth.request<MediaPayload>("/api/admin/media", {
          method: "POST",
          body: JSON.stringify({
            action: "retry_collection_task",
            collectionTaskId: id,
          }),
        }),
      );
      setMessage("该关键词已重新执行自动搜索、提取和 R2 待审核入库。");
    } catch (caught) {
      auth.setError(caught instanceof Error ? caught.message : "重试任务失败。");
    } finally {
      auth.setBusy(false);
    }
  }

  async function importLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const platform = String(form.get("platform") ?? "xiaohongshu");
    const sourceUrl = String(form.get("sourceUrl") ?? "");
    const rightsConfirmed = form.get("rightsConfirmed") === "true";
    auth.setBusy(true);
    auth.setError("");
    setImportResult(null);
    try {
      const result = await auth.request<ImportResult & MediaPayload>("/api/admin/media", {
        method: "POST",
        body: JSON.stringify({
          action: "import_remote_media",
          platform,
          sourceUrl,
          sourceTitle: form.get("sourceTitle"),
          tags: form.get("tags"),
          availableFrom: form.get("availableFrom"),
          imageUrls: form.get("imageUrls"),
          rightsConfirmed,
        }),
      });
      setData(result);
      setImportResult(result);
      setMessage(
        `已写入 R2 ${result.import.imported.length} 张` +
          (result.import.skipped.length ? `，跳过重复 ${result.import.skipped.length} 张` : "") +
          (result.import.failed.length ? `，失败 ${result.import.failed.length} 张。` : "。"),
      );
    } catch (caught) {
      auth.setError(caught instanceof Error ? caught.message : "提取或保存失败。");
    } finally {
      auth.setBusy(false);
    }
  }

  async function refreshSourcePreview(assetId: number) {
    auth.setBusy(true);
    auth.setError("");
    try {
      const result = await auth.request<MediaPayload>("/api/admin/media", {
        method: "POST",
        body: JSON.stringify({ action: "refresh_source_preview", assetId }),
      });
      setData(result);
      setMessage("已重新读取来源页面并更新预览。");
    } catch (caught) {
      auth.setError(caught instanceof Error ? caught.message : "预览读取失败。");
    } finally {
      auth.setBusy(false);
    }
  }

  function openParser() {
    const helperUrl =
      importPlatform === "tiktok"
        ? "https://tiksave.io/zh-cn"
        : "https://dy.kukutool.com/xiaohongshu";
    if (importSourceUrl) {
      void navigator.clipboard.writeText(importSourceUrl).catch(() => undefined);
    }
    window.open(helperUrl, "_blank", "noopener,noreferrer");
    setMessage("已复制原始链接并打开解析助手；解析后复制图片链接，粘贴回图片地址框即可批量写入 R2。");
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const input = formElement.elements.namedItem("file") as HTMLInputElement;
    const raw = input.files?.[0];
    if (!raw) return;
    auth.setBusy(true);
    auth.setError("");
    try {
      const optimized = await optimizeImage(raw);
      form.set("file", optimized.file);
      form.set("width", String(optimized.width));
      form.set("height", String(optimized.height));
      const response = await fetch("/api/admin/media", {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.adminKey}` },
        body: form,
      });
      const result = (await response.json()) as MediaPayload & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "上传失败。");
      setData(result);
      setMessage(
        `素材已优化为 ${optimized.width}×${optimized.height} WebP，并排期进入素材库。`,
      );
      formElement.reset();
    } catch (caught) {
      auth.setError(caught instanceof Error ? caught.message : "上传失败。");
    } finally {
      auth.setBusy(false);
    }
  }

  async function updateAsset(
    event: FormEvent<HTMLFormElement>,
    id: number,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    auth.setBusy(true);
    try {
      setData(
        await auth.request<MediaPayload>("/api/admin/media", {
          method: "PATCH",
          body: JSON.stringify({
            assetId: id,
            status: form.get("status"),
            availableFrom: form.get("availableFrom"),
            tags: form.get("tags"),
            title: form.get("title"),
            rightsConfirmed: form.get("rightsConfirmed") === "true",
          }),
        }),
      );
      setMessage("素材信息已更新。");
    } catch (caught) {
      auth.setError(caught instanceof Error ? caught.message : "更新失败。");
    } finally {
      auth.setBusy(false);
    }
  }

  async function deleteAsset(id: number) {
    if (!window.confirm("确定删除该素材吗？已关联反馈将自动退化为纯文字。")) {
      return;
    }
    auth.setBusy(true);
    try {
      setData(
        await auth.request<MediaPayload>("/api/admin/media", {
          method: "DELETE",
          body: JSON.stringify({ assetId: id }),
        }),
      );
      setMessage("素材及其 R2 对象已删除，反馈文字记录仍保留。");
    } catch (caught) {
      auth.setError(caught instanceof Error ? caught.message : "删除失败。");
    } finally {
      auth.setBusy(false);
    }
  }

  if (auth.checking) return <AdminSessionChecking />;
  if (!auth.authenticated) return <AdminLogin {...auth} />;

  const storage = data?.storage;
  const settings = storage?.settings;
  const collectionSettings = data?.collectionSettings;
  const collectionProvider = data?.collectionProvider;
  const collectionKeywords = (() => {
    try {
      return (JSON.parse(collectionSettings?.keywords_json ?? "[]") as string[]).join("，");
    } catch {
      return "";
    }
  })();
  const collectionSchedule = (() => {
    if (collectionProvider && !collectionProvider.configured) {
      return {
        label: "自动搜索等待配置",
        next: "在 Cloudflare Secret 中配置 JINA_API_KEY 后即可真正自动运行",
      };
    }
    if (!collectionSettings?.enabled) {
      return { label: "自动采集已暂停", next: "保存启用后恢复每日检查" };
    }
    const latest = (data?.collectionTasks ?? []).reduce<string | null>(
      (value, task) =>
        !value || task.created_at > value ? task.created_at : value,
      null,
    );
    if (!latest) {
      return { label: "自动采集已启用", next: "下一次 Cloudflare 定时检查时执行首轮采集" };
    }
    const next = new Date(latest);
    next.setUTCDate(
      next.getUTCDate() + Math.max(1, collectionSettings.interval_days || 3),
    );
    return {
      label: "自动采集运行中",
      next: `下次预计 ${next.toLocaleDateString("zh-CN")} 搜索、提取并入 R2 待审核库`,
    };
  })();

  return (
    <AdminPage className="admin-media-page">
      <AdminHeader current="素材库" signOut={auth.signOut} />
      <section className="admin-orders-shell">
        <div className="admin-orders-intro">
          <div>
            <p className="section-tag">MEDIA LIBRARY</p>
            <h1>反馈素材库</h1>
            <p>
              图片压缩为轻量 WebP；默认保留180天。容量最多使用 R2
              免费额度10GB，触发上限后自动回落至9.5GB。
            </p>
          </div>
          <dl>
            <div>
              <dt>{storage ? formatBytes(storage.usedBytes) : "—"}</dt>
              <dd>当前占用</dd>
            </div>
            <div>
              <dt>{storage?.objectCount ?? 0}</dt>
              <dd>R2 图片</dd>
            </div>
            <div>
              <dt>{settings?.retentionDays ?? 180}</dt>
              <dd>保留天数</dd>
            </div>
          </dl>
        </div>

        {(message || auth.error) && (
          <div className={auth.error ? "admin-alert is-error" : "admin-alert"}>
            {auth.error || message}
          </div>
        )}

        {storage && settings && (
          <details className="admin-storage-panel admin-settings-disclosure">
            <summary>
              <div>
                <p className="section-tag">R2 CAPACITY GUARD</p>
                <h2>R2 容量保护</h2>
                <p>当前使用 {formatBytes(storage.usedBytes)}，系统会按预设自动清理。</p>
              </div>
              <span>高级设置</span>
            </summary>
            <div className="admin-settings-body">
            <div className="admin-storage-heading">
              <div>
                <p className="section-tag">R2 CAPACITY GUARD</p>
                <h2>10GB 免费额度保护</h2>
                <p>
                  上传前预留容量；超过硬上限前先清理到回落线。受保护的真实客户反馈素材不会自动删除，空间不足时改为拒绝上传。
                </p>
              </div>
              <strong>{storage.usagePercent.toFixed(2)}%</strong>
            </div>
            <div
              className="admin-storage-meter"
              aria-label={`R2 已使用 ${storage.usagePercent.toFixed(2)}%`}
            >
              <span style={{ width: `${Math.max(0.4, storage.usagePercent)}%` }} />
            </div>
            <div className="admin-storage-stats">
              <div><small>已使用</small><b>{formatBytes(storage.usedBytes)}</b></div>
              <div><small>硬上限</small><b>{formatBytes(settings.hardLimitBytes)}</b></div>
              <div><small>回落线</small><b>{formatBytes(settings.cleanupTargetBytes)}</b></div>
              <div><small>剩余空间</small><b>{formatBytes(storage.remainingBytes)}</b></div>
              <div><small>受保护素材</small><b>{formatBytes(storage.protectedBytes)}</b></div>
              <div><small>上传占位</small><b>{formatBytes(storage.uploadingBytes)}</b></div>
            </div>
            <form
              className="admin-storage-form"
              key={settings.updatedAt}
              onSubmit={saveStorageSettings}
            >
              <label>
                <span>容量硬上限（GB）</span>
                <input
                  name="hardLimitGb"
                  type="number"
                  min="0.5"
                  max="10"
                  step="0.1"
                  defaultValue={settings.hardLimitBytes / DECIMAL_GB}
                  required
                />
                <small>后台强制不允许超过10GB。</small>
              </label>
              <label>
                <span>自动回落线（GB）</span>
                <input
                  name="cleanupTargetGb"
                  type="number"
                  min="0.1"
                  max="9.9"
                  step="0.1"
                  defaultValue={settings.cleanupTargetBytes / DECIMAL_GB}
                  required
                />
                <small>默认9.5GB，留下0.5GB缓冲。</small>
              </label>
              <label>
                <span>最长保留天数</span>
                <input
                  name="retentionDays"
                  type="number"
                  min="1"
                  max="180"
                  step="1"
                  defaultValue={settings.retentionDays}
                  required
                />
                <small>Cloudflare生命周期最终不超过180天。</small>
              </label>
              <label className="admin-checkbox admin-storage-protect">
                <input
                  type="checkbox"
                  name="protectCustomerMedia"
                  value="true"
                  defaultChecked={settings.protectCustomerMedia}
                />
                <span>容量清理时保护真实客户反馈图片</span>
              </label>
              <div className="admin-storage-actions">
                <button className="admin-primary" type="submit" disabled={auth.busy}>
                  保存容量预设
                </button>
                <button
                  className="admin-secondary"
                  type="button"
                  disabled={auth.busy}
                  onClick={() => void runStorageCleanup()}
                >
                  立即检查并回落
                </button>
              </div>
            </form>

            <details className="admin-cleanup-log">
              <summary>最近清理记录（{storage.cleanupEvents.length}）</summary>
              {storage.cleanupEvents.length === 0 ? (
                <p>尚未发生容量或到期清理。</p>
              ) : (
                <ul>
                  {storage.cleanupEvents.map((event) => (
                    <li key={event.id}>
                      <span>{cleanupReason(event.reason)}</span>
                      <b>{event.sourceTitle || event.assetPublicId}</b>
                      <small>{formatBytes(event.sizeBytes)}</small>
                      <time>{new Date(event.createdAt).toLocaleString("zh-CN")}</time>
                    </li>
                  ))}
                </ul>
              )}
            </details>
            </div>
          </details>
        )}

        {collectionSettings && (
          <section className="admin-collection-panel">
            <div className="admin-storage-heading">
              <div>
                <p className="section-tag">SOURCE RESEARCH QUEUE</p>
                <h2>小红书关键词自动采集</h2>
                <p>
                  Cloudflare 到期后会自动搜索关键词、解析公开内容、去重，并把图片写入 R2 待审核区。
                  自动采集素材不会直接公开；确认商业展示授权并设为“可用”后，客户反馈页才会显示。
                </p>
              </div>
              <div className="admin-collection-status">
                <strong>{data?.assets.filter((asset) => asset.status === "pending" && asset.rights_basis === "pending_source_review").length ?? 0}</strong>
                <span>{collectionSchedule.label}</span>
                <small>{collectionSchedule.next}</small>
              </div>
            </div>
            <details className="admin-inline-disclosure">
              <summary>采集频率与关键词设置</summary>
              <form className="admin-collection-form" onSubmit={saveCollectionSettings}>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  name="collectionEnabled"
                  value="true"
                  defaultChecked={Boolean(collectionSettings.enabled)}
                />
                  <span>启用定时自动搜索与采集</span>
              </label>
              <label>
                <span>任务间隔（天）</span>
                <input
                  name="collectionIntervalDays"
                  type="number"
                  min="1"
                  max="30"
                  defaultValue={collectionSettings.interval_days || 3}
                  required
                />
              </label>
              <label className="admin-collection-keywords">
                <span>关键词（逗号或换行分隔，最多12个）</span>
                <textarea
                  name="collectionKeywords"
                  rows={3}
                  defaultValue={collectionKeywords}
                  required
                />
              </label>
              <label>
                <span>每轮最多写入 R2（张）</span>
                <input
                  name="collectionAutoImportLimit"
                  type="number"
                  min="1"
                  max="8"
                  defaultValue={collectionSettings.auto_import_limit || 3}
                  required
                />
              </label>
              <div className="admin-storage-actions">
                <button className="admin-primary" type="submit" disabled={auth.busy}>保存采集规则</button>
                <button className="admin-secondary" type="button" onClick={() => void createCollectionTaskNow()} disabled={auth.busy}>立即执行一轮</button>
              </div>
              </form>
            </details>
            <div className="admin-collection-tasks">
              {(data?.collectionTasks ?? []).length === 0 ? (
                <p>尚无采集记录。保存并启用规则后，定时任务会执行首轮自动采集。</p>
              ) : (
                data?.collectionTasks.slice(0, 12).map((task) => (
                  <article key={task.id}>
                    <div>
                      <span>{collectionStatus(task.status)}</span>
                      <strong>{task.keyword}</strong>
                      <time>{new Date(task.created_at).toLocaleString("zh-CN")}</time>
                      <small className="admin-collection-result">
                        发现 {task.result_count || 0} 条 · 写入 R2 {task.asset_count || 0} 张
                        {task.error_message ? ` · ${task.error_message}` : ""}
                      </small>
                    </div>
                    <div className="admin-feedback-controls">
                      <a href={task.search_url} target="_blank" rel="noopener noreferrer">打开小红书搜索 ↗</a>
                      {task.status !== "running" && task.status !== "queued" && <button type="button" onClick={() => void retryCollectionTask(task.id)} disabled={auth.busy}>重新执行</button>}
                      {task.status === "pending_review" && <button className="admin-delete" type="button" onClick={() => void updateCollectionTask(task.id, "skipped")} disabled={auth.busy}>跳过旧任务</button>}
                      <button className="admin-delete" type="button" onClick={() => void deleteCollectionTask(task.id)} disabled={auth.busy}>删除任务</button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}

        <div className="admin-media-tools">
          <section className="admin-create-panel">
            <div>
              <p className="section-tag">MANUAL UPLOAD</p>
              <h2>上传素材</h2>
            </div>
            <form onSubmit={upload}>
              <label><span>图片</span><input name="file" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
              <label><span>素材标题</span><input name="title" maxLength={180} required /></label>
              <label><span>标签（英文逗号分隔）</span><input name="tags" placeholder="packaging,catalogue,US" /></label>
              <label><span>开始使用日期</span><input name="availableFrom" type="date" min={tomorrow} defaultValue={tomorrow} required /></label>
              <label><span>来源链接（可选）</span><input name="sourceUrl" type="url" /></label>
              <label><span>来源平台</span><select name="sourcePlatform"><option value="manual">手动素材</option><option value="tiktok">TikTok</option><option value="xiaohongshu">小红书</option></select></label>
              <label><span>作者（可选）</span><input name="author" maxLength={100} /></label>
              <button className="admin-primary" type="submit" disabled={auth.busy}>压缩并上传</button>
            </form>
          </section>

          <section className="admin-create-panel admin-remote-import-panel">
            <div>
              <p className="section-tag">LINK ASSISTANT</p>
              <h2>外链提取并保存到 R2</h2>
              <p>
                先尝试读取 TikTok 或小红书的公开预览；如平台限制读取，可在 KuKuTool/TikSave 解析后，
                把“复制图片链接”的内容粘贴进来。系统会校验、去重并写入 R2 素材库，供审核后的反馈使用。
              </p>
            </div>
            <form onSubmit={importLink}>
              <label><span>平台</span><select name="platform" value={importPlatform} onChange={(event) => setImportPlatform(event.target.value)}><option value="tiktok">TikTok</option><option value="xiaohongshu">小红书</option></select></label>
              <label><span>原始内容链接</span><input name="sourceUrl" type="url" value={importSourceUrl} onChange={(event) => setImportSourceUrl(event.target.value)} required /></label>
              <label><span>素材标题（可选）</span><input name="sourceTitle" maxLength={180} placeholder="例如：发货包装实拍" /></label>
              <label><span>匹配标签</span><input name="tags" placeholder="packaging,catalogue,tirzepatide,US" /></label>
              <label><span>开始使用日期</span><input name="availableFrom" type="date" min={tomorrow} defaultValue={tomorrow} required /></label>
              <label className="admin-remote-image-links"><span>解析器图片地址（可选，每行一个，最多18张）</span><textarea name="imageUrls" rows={5} placeholder="留空会尝试读取原始页面预览；也可粘贴 KuKuTool 的“复制全部图片链接”结果。" /></label>
              <label className="admin-checkbox admin-remote-rights"><input type="checkbox" name="rightsConfirmed" value="true" required /><span>我确认这些图片为自有素材，或已获得商业展示授权</span></label>
              <div className="admin-storage-actions">
                <button className="admin-primary" type="submit" disabled={auth.busy}>提取并写入 R2</button>
                <button className="admin-secondary" type="button" onClick={openParser}>复制原链接并打开解析器</button>
              </div>
            </form>
            {importResult && (
              <div className="admin-import-result">
                <strong>本次已写入 R2 {importResult.import.imported.length} 张</strong>
                <p>
                  请求 {importResult.import.requestedCount} 张 · 跳过重复 {importResult.import.skipped.length} 张 ·
                  失败 {importResult.import.failed.length} 张
                </p>
                {importResult.import.failed.slice(0, 2).map((failure) => <small key={failure.url}>{failure.message}</small>)}
              </div>
            )}
          </section>
        </div>

        <section className="admin-order-list">
          <div className="admin-list-heading">
            <div><p className="section-tag">ASSET QUEUE</p><h2>素材记录</h2></div>
            <div className="admin-heading-actions"><button type="button" onClick={exportAssets} disabled={!visibleAssets.length}>导出当前结果</button><button type="button" onClick={() => void load()} disabled={auth.busy}>刷新</button></div>
          </div>
          <div className="admin-data-toolbar admin-media-toolbar">
            <label className="admin-search-control"><span>搜索素材</span><input value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} placeholder="标题、标签、作者或素材编号" /></label>
            <label><span>素材状态</span><select value={assetStatus} onChange={(event) => setAssetStatus(event.target.value)}><option value="all">全部状态</option><option value="approved">可用</option><option value="scheduled">排期</option><option value="pending">待处理</option><option value="source_only">仅来源链接</option><option value="uploading">上传中</option><option value="rejected">停用</option></select></label>
            <label><span>来源平台</span><select value={assetPlatform} onChange={(event) => setAssetPlatform(event.target.value)}><option value="all">全部平台</option><option value="manual">手动素材</option><option value="tiktok">TikTok</option><option value="xiaohongshu">小红书</option></select></label>
          </div>
          <div className="admin-result-summary"><p>显示 <b>{visibleAssets.length}</b> / {data?.assets.length ?? 0} 条素材</p>{(assetQuery || assetStatus !== "all" || assetPlatform !== "all") && <button type="button" onClick={() => { setAssetQuery(""); setAssetStatus("all"); setAssetPlatform("all"); }}>清除筛选</button>}</div>
          <div className="admin-media-grid">
            {visibleAssets.map((asset) => {
              const previewAllowed = asset.status === "approved";
              const previewAvailable = Boolean(asset.r2_key || asset.preview_url);
              return (
              <article key={asset.id}>
                {previewAllowed && previewAvailable ? (
                  <div className="admin-media-preview-shell">
                    <img
                      src={asset.r2_key ? `/api/media/${asset.public_id}` : asset.preview_url}
                      alt={asset.source_title || "素材预览"}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                        const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
                        if (fallback) fallback.hidden = false;
                      }}
                    />
                    <div className="admin-media-placeholder" hidden>PREVIEW<br />UNAVAILABLE</div>
                    {!asset.r2_key && <span>外链预览</span>}
                  </div>
                ) : (
                  <div className="admin-media-placeholder">
                    {asset.status === "uploading" ? "UPLOADING" : previewAllowed ? "PREVIEW" : "MEDIA"}<br />
                    {asset.status === "uploading" ? "RESERVED" : previewAllowed ? "UNAVAILABLE" : "LOCKED"}
                  </div>
                )}
                <form onSubmit={(event) => void updateAsset(event, asset.id)}>
                  <div className="admin-media-card-top"><span>{asset.source_platform}</span><b>{asset.status}</b></div>
                  <label><span>标题</span><input name="title" defaultValue={asset.source_title} /></label>
                  <label><span>标签</span><input name="tags" defaultValue={(() => { try { return (JSON.parse(asset.tags_json) as string[]).join(","); } catch { return ""; } })()} /></label>
                  <div className="customer-form-row">
                    <label><span>可用日期</span><input name="availableFrom" type="date" defaultValue={asset.available_from} /></label>
                    <label><span>状态</span><select name="status" defaultValue={asset.status === "source_only" || asset.status === "uploading" ? "pending" : asset.status}><option value="approved">可用</option><option value="scheduled">排期</option><option value="pending">待处理</option><option value="rejected">停用</option></select></label>
                  </div>
                  {asset.rights_basis === "pending_source_review" && !asset.rights_confirmed_at && (
                    <label className="admin-checkbox admin-media-rights-review">
                      <input type="checkbox" name="rightsConfirmed" value="true" />
                      <span>我已核对来源，并确认拥有商业展示授权</span>
                    </label>
                  )}
                  <small>{formatBytes(asset.size_bytes)} · 使用 {asset.use_count} 次 · 到期 {new Date(asset.expires_at).toLocaleDateString("zh-CN")}</small>
                  <div className="admin-feedback-controls">
                    {asset.source_url && <a href={asset.source_url} target="_blank" rel="noopener noreferrer">查看来源 ↗</a>}
                    {!asset.r2_key && asset.source_url && <button type="button" onClick={() => void refreshSourcePreview(asset.id)} disabled={auth.busy}>重新读取预览</button>}
                    <button type="submit" disabled={auth.busy}>保存</button>
                    <button className="admin-delete" type="button" onClick={() => void deleteAsset(asset.id)} disabled={auth.busy}>删除</button>
                  </div>
                </form>
              </article>
              );
            })}
            {!visibleAssets.length && <p className="admin-empty">没有符合当前条件的素材。</p>}
          </div>
        </section>
      </section>
    </AdminPage>
  );
}
