"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminHeader, AdminLogin, AdminPage } from "../_components/AdminChrome";
import { useAdminSession } from "../_components/useAdminSession";

type FeedbackRow = {
  id: number;
  public_id: string;
  source_type: string;
  country_code: string;
  service: string;
  content_json: string;
  original_text: string;
  public_text: string;
  status: string;
  risk_flags_json: string;
  submitted_at: string;
  expires_at: string;
  username?: string;
  company_name?: string;
  manual_reference?: string;
  media_asset_id?: number | null;
};
type FeedbackPayload = {
  feedback: FeedbackRow[];
  settings: { generation_enabled: number; daily_maximum: number; generation_rate_bps: number; public_limit: number };
  media: Array<{ id: number; public_id: string; source_title: string; tags_json: string }>;
};

function displayText(row: FeedbackRow) {
  if (row.source_type === "customer_submitted") return row.public_text || row.original_text;
  try {
    const content = JSON.parse(row.content_json) as { zh?: string; en?: string };
    return content.zh || content.en || "";
  } catch {
    return "";
  }
}

export default function AdminFeedbackPage() {
  const auth = useAdminSession();
  const [data, setData] = useState<FeedbackPayload | null>(null);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");
  async function load() {
    const result = await auth.request<FeedbackPayload>("/api/admin/feedback");
    setData(result);
  }
  useEffect(() => { if (!auth.authenticated) return; const frame = window.requestAnimationFrame(() => { void load().catch((caught) => auth.setError(caught instanceof Error ? caught.message : "加载失败。")); }); return () => window.cancelAnimationFrame(frame); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [auth.authenticated]);
  async function action(feedbackId: number, actionName: string, extra: Record<string, unknown> = {}) {
    auth.setBusy(true); auth.setError(""); setMessage("");
    try { const result = await auth.request<FeedbackPayload>("/api/admin/feedback", { method: "PATCH", body: JSON.stringify({ feedbackId, action: actionName, ...extra }) }); setData(result); setMessage("反馈状态已更新。"); }
    catch (caught) { auth.setError(caught instanceof Error ? caught.message : "操作失败。"); }
    finally { auth.setBusy(false); }
  }
  async function deleteFeedback(id: number) {
    if (!window.confirm("确定删除这条反馈吗？")) return;
    auth.setBusy(true);
    try { setData(await auth.request<FeedbackPayload>("/api/admin/feedback", { method: "DELETE", body: JSON.stringify({ feedbackId: id }) })); }
    catch (caught) { auth.setError(caught instanceof Error ? caught.message : "删除失败。"); }
    finally { auth.setBusy(false); }
  }
  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); auth.setBusy(true);
    try { setData(await auth.request<FeedbackPayload>("/api/admin/feedback", { method: "PATCH", body: JSON.stringify({ action: "update_settings", generationEnabled: form.get("enabled") === "on", dailyMaximum: Number(form.get("dailyMaximum")), generationRateBps: Number(form.get("generationRateBps")), publicLimit: Number(form.get("publicLimit")) }) })); setMessage("生成规则已保存。"); }
    catch (caught) { auth.setError(caught instanceof Error ? caught.message : "保存失败。"); }
    finally { auth.setBusy(false); }
  }
  const visible = useMemo(() => (data?.feedback ?? []).filter((row) => filter === "all" || row.status === filter || row.source_type === filter), [data, filter]);
  if (!auth.authenticated) return <AdminLogin {...auth} />;
  return <AdminPage className="admin-feedback-page"><AdminHeader current="反馈审核" signOut={auth.signOut} /><section className="admin-orders-shell"><div className="admin-orders-intro"><div><p className="section-tag">FEEDBACK MODERATION</p><h1>独立反馈后台</h1><p>真实客户提交默认进入待审核；示例反馈带固定标签并控制生成数量。所有公开反馈只保留180天。</p></div><dl><div><dt>{data?.feedback.filter((row) => row.status === "pending_review").length ?? 0}</dt><dd>待审核</dd></div><div><dt>{data?.feedback.length ?? 0}</dt><dd>180天内</dd></div></dl></div>{(message || auth.error) && <div className={auth.error ? "admin-alert is-error" : "admin-alert"}>{auth.error || message}</div>}<section className="admin-create-panel admin-feedback-settings"><div><p className="section-tag">GENERATOR CONTROL</p><h2>示例反馈生成控制</h2></div>{data?.settings && <form onSubmit={saveSettings}><label className="admin-checkbox"><input type="checkbox" name="enabled" defaultChecked={Boolean(data.settings.generation_enabled)} /><span>启用自动示例反馈</span></label><label><span>单日最多</span><input name="dailyMaximum" type="number" min="0" max="2" defaultValue={data.settings.daily_maximum} /></label><label><span>生成概率（万分比）</span><input name="generationRateBps" type="number" min="0" max="10000" defaultValue={data.settings.generation_rate_bps} /></label><label><span>公开查询上限</span><input name="publicLimit" type="number" min="6" max="100" defaultValue={data.settings.public_limit} /></label><button className="admin-primary" type="submit" disabled={auth.busy}>保存规则</button></form>}</section><section className="admin-order-list"><div className="admin-list-heading"><div><p className="section-tag">REVIEW QUEUE</p><h2>反馈记录</h2></div><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">全部</option><option value="pending_review">待审核</option><option value="approved">已公开</option><option value="illustrative">示例反馈</option><option value="customer_submitted">真实反馈</option><option value="unpublished">已撤下</option></select></div><div className="admin-feedback-list">{visible.map((row) => <article key={row.id}><header><div><span className={row.source_type === "illustrative" ? "is-illustrative" : "is-customer"}>{row.source_type === "illustrative" ? "示例服务反馈" : "真实客户提交"}</span><code>{row.manual_reference || row.public_id}</code></div><b className={`feedback-admin-status is-${row.status}`}>{row.status}</b></header><textarea defaultValue={displayText(row)} id={`feedback-text-${row.id}`} aria-label="公开反馈文案" /><dl><div><dt>市场 / 服务</dt><dd>{row.country_code} · {row.service}</dd></div><div><dt>客户</dt><dd>{row.username || "模拟订单"} {row.company_name || ""}</dd></div><div><dt>风险标记</dt><dd>{row.risk_flags_json === "[]" ? "无" : row.risk_flags_json}</dd></div><div><dt>到期</dt><dd>{new Date(row.expires_at).toLocaleDateString("zh-CN")}</dd></div></dl><div className="admin-feedback-controls"><select defaultValue={row.media_asset_id ?? ""} onChange={(event) => void action(row.id, "set_media", { mediaAssetId: event.target.value ? Number(event.target.value) : null })}><option value="">不使用图片</option>{data?.media.map((asset) => <option value={asset.id} key={asset.id}>{asset.source_title || asset.public_id}</option>)}</select>{row.source_type === "customer_submitted" && <button type="button" onClick={() => void action(row.id, "approve", { publicText: (document.getElementById(`feedback-text-${row.id}`) as HTMLTextAreaElement)?.value })} disabled={auth.busy}>审核并公开</button>}{row.status === "approved" && <button type="button" onClick={() => void action(row.id, "unpublish")} disabled={auth.busy}>撤下</button>}<button type="button" onClick={() => void action(row.id, "reject")} disabled={auth.busy}>拒绝</button><button className="admin-delete" type="button" onClick={() => void deleteFeedback(row.id)} disabled={auth.busy}>删除</button></div></article>)}</div></section></section></AdminPage>;
}
