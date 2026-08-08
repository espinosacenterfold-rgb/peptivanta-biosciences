"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminHeader, AdminLogin, AdminPage } from "../_components/AdminChrome";
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
type MediaPayload = { assets: MediaAsset[]; retentionDays: number };
type ImportResult = { helperUrl: string; publicId: string; message: string; source: { platform: string; url: string; title: string; author: string } };

async function optimizeImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("浏览器无法处理这张图片。");
  context.drawImage(bitmap, 0, 0, width, height); bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob) throw new Error("图片压缩失败。");
  return { file: new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" }), width, height };
}

export default function AdminMediaPage() {
  const auth = useAdminSession(); const [data, setData] = useState<MediaPayload | null>(null); const [message, setMessage] = useState(""); const [importResult, setImportResult] = useState<ImportResult | null>(null); const [tomorrow] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  async function load() { setData(await auth.request<MediaPayload>("/api/admin/media")); }
  useEffect(() => { if (!auth.authenticated) return; const frame = window.requestAnimationFrame(() => { void load().catch((caught) => auth.setError(caught instanceof Error ? caught.message : "加载失败。")); }); return () => window.cancelAnimationFrame(frame); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [auth.authenticated]);
  async function importLink(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); auth.setBusy(true); auth.setError(""); setImportResult(null); try { const result = await auth.request<ImportResult>("/api/admin/media", { method: "POST", body: JSON.stringify({ action: "import_link", platform: form.get("platform"), sourceUrl: form.get("sourceUrl") }) }); setImportResult(result); setMessage("来源链接已保存。请在外部助手完成解析后，只上传有权商业展示的素材。"); await load(); } catch (caught) { auth.setError(caught instanceof Error ? caught.message : "链接处理失败。"); } finally { auth.setBusy(false); } }
  async function upload(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); const input = formElement.elements.namedItem("file") as HTMLInputElement; const raw = input.files?.[0]; if (!raw) return; auth.setBusy(true); auth.setError(""); try { const optimized = await optimizeImage(raw); form.set("file", optimized.file); form.set("width", String(optimized.width)); form.set("height", String(optimized.height)); const response = await fetch("/api/admin/media", { method: "POST", headers: { Authorization: `Bearer ${auth.adminKey}` }, body: form }); const result = (await response.json()) as MediaPayload & { error?: string }; if (!response.ok) throw new Error(result.error ?? "上传失败。"); setData(result); setMessage(`素材已优化为 ${optimized.width}×${optimized.height} WebP，并排期进入素材库。`); formElement.reset(); } catch (caught) { auth.setError(caught instanceof Error ? caught.message : "上传失败。"); } finally { auth.setBusy(false); } }
  async function updateAsset(event: FormEvent<HTMLFormElement>, id: number) { event.preventDefault(); const form = new FormData(event.currentTarget); auth.setBusy(true); try { setData(await auth.request<MediaPayload>("/api/admin/media", { method: "PATCH", body: JSON.stringify({ assetId: id, status: form.get("status"), availableFrom: form.get("availableFrom"), tags: form.get("tags"), title: form.get("title") }) })); setMessage("素材信息已更新。"); } catch (caught) { auth.setError(caught instanceof Error ? caught.message : "更新失败。"); } finally { auth.setBusy(false); } }
  async function deleteAsset(id: number) { if (!window.confirm("确定删除该素材吗？已关联反馈将自动退化为纯文字。")) return; auth.setBusy(true); try { setData(await auth.request<MediaPayload>("/api/admin/media", { method: "DELETE", body: JSON.stringify({ assetId: id }) })); } catch (caught) { auth.setError(caught instanceof Error ? caught.message : "删除失败。"); } finally { auth.setBusy(false); } }
  if (!auth.authenticated) return <AdminLogin {...auth} />;
  return <AdminPage className="admin-media-page"><AdminHeader current="素材库" signOut={auth.signOut} /><section className="admin-orders-shell"><div className="admin-orders-intro"><div><p className="section-tag">MEDIA LIBRARY</p><h1>反馈素材库</h1><p>手动上传为主，链接解析为辅助。图片压缩为轻量 WebP，新素材默认第二天参与匹配，180天后自动清理。</p></div><dl><div><dt>{data?.assets.filter((asset) => asset.r2_key).length ?? 0}</dt><dd>可用图片</dd></div><div><dt>180</dt><dd>保留天数</dd></div></dl></div>{(message || auth.error) && <div className={auth.error ? "admin-alert is-error" : "admin-alert"}>{auth.error || message}</div>}<div className="admin-media-tools"><section className="admin-create-panel"><div><p className="section-tag">MANUAL UPLOAD</p><h2>上传授权素材</h2></div><form onSubmit={upload}><label><span>图片</span><input name="file" type="file" accept="image/jpeg,image/png,image/webp" required /></label><label><span>素材标题</span><input name="title" maxLength={180} required /></label><label><span>标签（英文逗号分隔）</span><input name="tags" placeholder="packaging,catalogue,US" /></label><label><span>开始使用日期</span><input name="availableFrom" type="date" min={tomorrow} defaultValue={tomorrow} required /></label><label><span>来源链接（可选）</span><input name="sourceUrl" type="url" /></label><label><span>来源平台</span><select name="sourcePlatform"><option value="manual">手动素材</option><option value="tiktok">TikTok</option><option value="xiaohongshu">小红书</option></select></label><label><span>作者（可选）</span><input name="author" maxLength={100} /></label><label className="admin-checkbox"><input type="checkbox" name="rightsConfirmed" value="true" required /><span>确认拥有或已取得商业展示授权</span></label><button className="admin-primary" type="submit" disabled={auth.busy}>压缩并上传</button></form></section><section className="admin-create-panel"><div><p className="section-tag">LINK ASSISTANT</p><h2>外部链接解析辅助</h2><p>系统记录来源；TikTok 同时读取官方 oEmbed 信息。两家工具没有可稳定商用的公开 API，因此不会在服务器模拟其私有接口。</p></div><form onSubmit={importLink}><label><span>平台</span><select name="platform"><option value="tiktok">TikTok</option><option value="xiaohongshu">小红书</option></select></label><label><span>原始内容链接</span><input name="sourceUrl" type="url" required /></label><button className="admin-primary" type="submit" disabled={auth.busy}>保存来源并生成助手入口</button></form>{importResult && <div className="admin-import-result"><strong>{importResult.source.title || importResult.source.url}</strong><p>{importResult.message}</p><a href={importResult.helperUrl} target="_blank" rel="noopener noreferrer">在 {importResult.source.platform === "tiktok" ? "TikSave" : "KuKuTool"} 打开 <span>↗</span></a></div>}</section></div><section className="admin-order-list"><div className="admin-list-heading"><div><p className="section-tag">ASSET QUEUE</p><h2>素材记录</h2></div></div><div className="admin-media-grid">{data?.assets.map((asset) => <article key={asset.id}>{asset.r2_key ? <img src={`/api/media/${asset.public_id}`} alt={asset.source_title} loading="lazy" /> : <div className="admin-media-placeholder">SOURCE<br />LINK</div>}<form onSubmit={(event) => void updateAsset(event, asset.id)}><div className="admin-media-card-top"><span>{asset.source_platform}</span><b>{asset.status}</b></div><label><span>标题</span><input name="title" defaultValue={asset.source_title} /></label><label><span>标签</span><input name="tags" defaultValue={(() => { try { return (JSON.parse(asset.tags_json) as string[]).join(","); } catch { return ""; } })()} /></label><div className="customer-form-row"><label><span>可用日期</span><input name="availableFrom" type="date" defaultValue={asset.available_from} /></label><label><span>状态</span><select name="status" defaultValue={asset.status === "source_only" ? "pending" : asset.status}><option value="approved">可用</option><option value="scheduled">排期</option><option value="pending">待处理</option><option value="rejected">停用</option></select></label></div><small>使用 {asset.use_count} 次 · 到期 {new Date(asset.expires_at).toLocaleDateString("zh-CN")}</small><div className="admin-feedback-controls"><button type="submit" disabled={auth.busy}>保存</button><button className="admin-delete" type="button" onClick={() => void deleteAsset(asset.id)} disabled={auth.busy}>删除</button></div></form></article>)}</div></section></section></AdminPage>;
}
