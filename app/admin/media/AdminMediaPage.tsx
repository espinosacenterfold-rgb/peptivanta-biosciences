"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AdminHeader,
  AdminLogin,
  AdminPage,
} from "../_components/AdminChrome";
import { useAdminSession } from "../_components/useAdminSession";

type MediaAsset = {
  id: number;
  public_id: string;
  status: string;
  source_platform: string;
  source_url: string;
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

type MediaPayload = {
  assets: MediaAsset[];
  retentionDays: number;
  storage: MediaStorage;
};

type ImportResult = {
  helperUrl: string;
  publicId: string;
  message: string;
  source: {
    platform: string;
    url: string;
    title: string;
    author: string;
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
  const [tomorrow] = useState(() =>
    new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  );

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

  async function importLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    auth.setBusy(true);
    auth.setError("");
    setImportResult(null);
    try {
      const result = await auth.request<ImportResult>("/api/admin/media", {
        method: "POST",
        body: JSON.stringify({
          action: "import_link",
          platform: form.get("platform"),
          sourceUrl: form.get("sourceUrl"),
        }),
      });
      setImportResult(result);
      setMessage(
        "来源链接已保存。请在外部助手完成解析后，只上传有权商业展示的素材。",
      );
      await load();
    } catch (caught) {
      auth.setError(caught instanceof Error ? caught.message : "链接处理失败。");
    } finally {
      auth.setBusy(false);
    }
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

  if (!auth.authenticated) return <AdminLogin {...auth} />;

  const storage = data?.storage;
  const settings = storage?.settings;

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
          <section className="admin-storage-panel">
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
          </section>
        )}

        <div className="admin-media-tools">
          <section className="admin-create-panel">
            <div>
              <p className="section-tag">MANUAL UPLOAD</p>
              <h2>上传授权素材</h2>
            </div>
            <form onSubmit={upload}>
              <label><span>图片</span><input name="file" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
              <label><span>素材标题</span><input name="title" maxLength={180} required /></label>
              <label><span>标签（英文逗号分隔）</span><input name="tags" placeholder="packaging,catalogue,US" /></label>
              <label><span>开始使用日期</span><input name="availableFrom" type="date" min={tomorrow} defaultValue={tomorrow} required /></label>
              <label><span>来源链接（可选）</span><input name="sourceUrl" type="url" /></label>
              <label><span>来源平台</span><select name="sourcePlatform"><option value="manual">手动素材</option><option value="tiktok">TikTok</option><option value="xiaohongshu">小红书</option></select></label>
              <label><span>作者（可选）</span><input name="author" maxLength={100} /></label>
              <label className="admin-checkbox"><input type="checkbox" name="rightsConfirmed" value="true" required /><span>确认拥有或已取得商业展示授权</span></label>
              <button className="admin-primary" type="submit" disabled={auth.busy}>压缩并上传</button>
            </form>
          </section>

          <section className="admin-create-panel">
            <div>
              <p className="section-tag">LINK ASSISTANT</p>
              <h2>外部链接解析辅助</h2>
              <p>系统记录来源；TikTok同时读取官方oEmbed信息。两家工具没有可稳定商用的公开API，因此不会在服务器模拟其私有接口。</p>
            </div>
            <form onSubmit={importLink}>
              <label><span>平台</span><select name="platform"><option value="tiktok">TikTok</option><option value="xiaohongshu">小红书</option></select></label>
              <label><span>原始内容链接</span><input name="sourceUrl" type="url" required /></label>
              <button className="admin-primary" type="submit" disabled={auth.busy}>保存来源并生成助手入口</button>
            </form>
            {importResult && (
              <div className="admin-import-result">
                <strong>{importResult.source.title || importResult.source.url}</strong>
                <p>{importResult.message}</p>
                <a href={importResult.helperUrl} target="_blank" rel="noopener noreferrer">
                  在 {importResult.source.platform === "tiktok" ? "TikSave" : "KuKuTool"} 打开 <span>↗</span>
                </a>
              </div>
            )}
          </section>
        </div>

        <section className="admin-order-list">
          <div className="admin-list-heading">
            <div><p className="section-tag">ASSET QUEUE</p><h2>素材记录</h2></div>
          </div>
          <div className="admin-media-grid">
            {data?.assets.map((asset) => (
              <article key={asset.id}>
                {asset.r2_key && asset.status !== "uploading" ? (
                  <img src={`/api/media/${asset.public_id}`} alt={asset.source_title} loading="lazy" />
                ) : (
                  <div className="admin-media-placeholder">
                    {asset.status === "uploading" ? "UPLOADING" : "SOURCE"}<br />
                    {asset.status === "uploading" ? "RESERVED" : "LINK"}
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
                  <small>{formatBytes(asset.size_bytes)} · 使用 {asset.use_count} 次 · 到期 {new Date(asset.expires_at).toLocaleDateString("zh-CN")}</small>
                  <div className="admin-feedback-controls">
                    <button type="submit" disabled={auth.busy}>保存</button>
                    <button className="admin-delete" type="button" onClick={() => void deleteAsset(asset.id)} disabled={auth.busy}>删除</button>
                  </div>
                </form>
              </article>
            ))}
          </div>
        </section>
      </section>
    </AdminPage>
  );
}
