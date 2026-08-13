"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminHeader, AdminLogin, AdminPage, AdminSessionChecking } from "../_components/AdminChrome";
import { downloadAdminCsv } from "../_components/admin-export";
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
  media_public_id?: string | null;
  media_title?: string | null;
};
type FeedbackPayload = {
  feedback: FeedbackRow[];
  settings: { generation_enabled: number; daily_maximum: number; generation_interval_days: number; public_limit: number };
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

function displayRiskFlags(value: string | null | undefined) {
  if (!value || value === "null") return "无";
  try {
    const flags = JSON.parse(value) as unknown;
    const labels: Record<string, string> = {
      medical_or_effect_claim: "医疗、药效或用法表述",
      unsupported_purity_claim: "未经支持的绝对纯度表述",
    };
    return Array.isArray(flags) && flags.length > 0
      ? flags.map((flag) => labels[String(flag)] ?? String(flag)).join("、")
      : "无";
  } catch {
    return value;
  }
}

export default function AdminFeedbackPage() {
  const auth = useAdminSession();
  const [data, setData] = useState<FeedbackPayload | null>(null);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [query, setQuery] = useState("");
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
    try { setData(await auth.request<FeedbackPayload>("/api/admin/feedback", { method: "PATCH", body: JSON.stringify({ action: "update_settings", generationEnabled: form.get("enabled") === "on", dailyMaximum: Number(form.get("dailyMaximum")), generationIntervalDays: Number(form.get("generationIntervalDays")), publicLimit: Number(form.get("publicLimit")) }) })); setMessage("生成规则已保存。"); }
    catch (caught) { auth.setError(caught instanceof Error ? caught.message : "保存失败。"); }
    finally { auth.setBusy(false); }
  }
  async function generateNow() {
    auth.setBusy(true); auth.setError(""); setMessage("");
    try {
      const result = await auth.request<FeedbackPayload & { generation?: { created?: number; mediaAttached?: number } }>("/api/admin/feedback", { method: "PATCH", body: JSON.stringify({ action: "generate_now" }) });
      setData(result);
      setMessage(
        result.generation?.created
          ? result.generation.mediaAttached
            ? "已补充 1 条示例服务反馈，并从素材库自动匹配图片。"
            : "已补充 1 条示例服务反馈；素材库暂无今天可用的匹配图片。"
          : "当前没有新的已交付模拟订单可生成反馈。",
      );
    } catch (caught) { auth.setError(caught instanceof Error ? caught.message : "生成失败。"); }
    finally { auth.setBusy(false); }
  }
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return (data?.feedback ?? []).filter((row) => {
      const searchable = [row.manual_reference, row.public_id, row.username, row.company_name, row.country_code, row.service, displayText(row)].join(" ").toLocaleLowerCase();
      return (
        (filter === "all" || row.status === filter) &&
        (sourceFilter === "all" || row.source_type === sourceFilter) &&
        (!needle || searchable.includes(needle))
      );
    });
  }, [data, filter, query, sourceFilter]);

  function exportFeedback() {
    downloadAdminCsv(`peptivanta-feedback-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["反馈编号", "订单编号", "来源", "国家", "服务", "客户", "状态", "公开文案", "提交时间", "到期时间"],
      ...visible.map((row) => [row.public_id, row.manual_reference, row.source_type === "illustrative" ? "示例服务反馈" : "真实客户提交", row.country_code, row.service, row.username || row.company_name || "模拟订单", row.status, displayText(row), row.submitted_at, row.expires_at]),
    ]);
  }
  if (auth.checking) return <AdminSessionChecking />;
  if (!auth.authenticated) return <AdminLogin {...auth} />;
  return (
    <AdminPage className="admin-feedback-page">
      <AdminHeader current="反馈审核" signOut={auth.signOut} />
      <section className="admin-orders-shell">
        <div className="admin-orders-intro">
          <div>
            <p className="section-tag">FEEDBACK MODERATION</p>
            <h1>反馈审核</h1>
            <p>优先处理真实客户提交；示例反馈会带固定标签。所有公开反馈仅保留 180 天。</p>
          </div>
          <dl>
            <div><dt>{data?.feedback.filter((row) => row.status === "pending_review").length ?? 0}</dt><dd>待审核</dd></div>
            <div><dt>{data?.feedback.length ?? 0}</dt><dd>180 天内</dd></div>
          </dl>
        </div>

        {(message || auth.error) && (
          <div className={auth.error ? "admin-alert is-error" : "admin-alert"}>{auth.error || message}</div>
        )}

        <details className="admin-create-panel admin-feedback-settings admin-settings-disclosure">
          <summary>
            <div>
              <p className="section-tag">GENERATOR CONTROL</p>
              <h2>示例反馈规则</h2>
              <p>自动生成已按固定间隔运行，只有需要调整数量或频率时才需要打开。</p>
            </div>
            <span>高级设置</span>
          </summary>
          <div className="admin-settings-body">
            {data?.settings && (
              <form onSubmit={saveSettings}>
                <label className="admin-checkbox"><input type="checkbox" name="enabled" defaultChecked={Boolean(data.settings.generation_enabled)} /><span>启用自动示例反馈</span></label>
                <label><span>每次最多</span><input name="dailyMaximum" type="number" min="0" max="2" defaultValue={data.settings.daily_maximum} /></label>
                <label><span>生成间隔（天）</span><input name="generationIntervalDays" type="number" min="1" max="30" defaultValue={data.settings.generation_interval_days || 3} /></label>
                <label><span>公开查询上限</span><input name="publicLimit" type="number" min="6" max="100" defaultValue={data.settings.public_limit} /></label>
                <button className="admin-primary" type="submit" disabled={auth.busy}>保存规则</button>
                <button className="admin-secondary" type="button" onClick={() => void generateNow()} disabled={auth.busy}>立即补充 1 条</button>
              </form>
            )}
          </div>
        </details>

        <section className="admin-order-list">
          <div className="admin-list-heading">
            <div><p className="section-tag">REVIEW QUEUE</p><h2>反馈记录</h2></div>
            <div className="admin-heading-actions"><button type="button" onClick={exportFeedback} disabled={!visible.length}>导出当前结果</button></div>
          </div>
          <div className="admin-data-toolbar admin-feedback-toolbar">
            <label className="admin-search-control"><span>搜索反馈</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="订单号、客户、国家或反馈内容" /></label>
            <label><span>审核状态</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">全部状态</option><option value="pending_review">待审核</option><option value="approved">已公开</option><option value="unpublished">已撤下</option><option value="rejected">已拒绝</option></select></label>
            <label><span>反馈来源</span><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="all">全部来源</option><option value="customer_submitted">真实客户提交</option><option value="illustrative">示例服务反馈</option></select></label>
          </div>
          <div className="admin-result-summary"><p>显示 <b>{visible.length}</b> / {data?.feedback.length ?? 0} 条反馈</p>{(query || filter !== "all" || sourceFilter !== "all") && <button type="button" onClick={() => { setQuery(""); setFilter("all"); setSourceFilter("all"); }}>清除筛选</button>}</div>
          <div className="admin-feedback-list">
            {visible.map((row) => (
              <article key={row.id}>
                <header>
                  <div>
                    <span className={row.source_type === "illustrative" ? "is-illustrative" : "is-customer"}>{row.source_type === "illustrative" ? "示例服务反馈" : "真实客户提交"}</span>
                    <code>{row.manual_reference || row.public_id}</code>
                  </div>
                  <b className={`feedback-admin-status is-${row.status}`}>{row.status}</b>
                </header>
                {row.media_public_id ? (
                  <figure className="admin-feedback-media-preview">
                    <img
                      src={`/api/media/${encodeURIComponent(row.media_public_id)}`}
                      alt={row.media_title || "反馈匹配素材"}
                      loading="lazy"
                    />
                    <figcaption>{row.media_title || "已匹配素材库图片"}</figcaption>
                  </figure>
                ) : (
                  <div className="admin-feedback-media-empty">暂未匹配图片</div>
                )}
                <textarea defaultValue={displayText(row)} id={`feedback-text-${row.id}`} aria-label="公开反馈文案" />
                <dl>
                  <div><dt>市场 / 服务</dt><dd>{row.country_code} · {row.service}</dd></div>
                  <div><dt>客户</dt><dd>{row.username || "模拟订单"} {row.company_name || ""}</dd></div>
                  <div><dt>风险标记</dt><dd>{displayRiskFlags(row.risk_flags_json)}</dd></div>
                  <div><dt>到期</dt><dd>{new Date(row.expires_at).toLocaleDateString("zh-CN")}</dd></div>
                </dl>
                <div className="admin-feedback-controls">
                  <select value={row.media_asset_id ?? ""} onChange={(event) => void action(row.id, "set_media", { mediaAssetId: event.target.value ? Number(event.target.value) : null })}>
                    <option value="">不使用图片</option>
                    {data?.media.map((asset) => <option value={asset.id} key={asset.id}>{asset.source_title || asset.public_id}</option>)}
                  </select>
                  <button type="button" onClick={() => void action(row.id, "auto_match_media")} disabled={auth.busy}>自动匹配图片</button>
                  {row.source_type === "customer_submitted" && <button type="button" onClick={() => void action(row.id, "approve", { publicText: (document.getElementById(`feedback-text-${row.id}`) as HTMLTextAreaElement)?.value })} disabled={auth.busy}>审核并公开</button>}
                  {row.status === "approved" && <button type="button" onClick={() => void action(row.id, "unpublish")} disabled={auth.busy}>撤下</button>}
                  <button type="button" onClick={() => void action(row.id, "reject")} disabled={auth.busy}>拒绝</button>
                  <button className="admin-delete" type="button" onClick={() => void deleteFeedback(row.id)} disabled={auth.busy}>删除</button>
                </div>
              </article>
            ))}
            {!visible.length && <p className="admin-empty">没有符合当前条件的反馈。</p>}
          </div>
        </section>
      </section>
    </AdminPage>
  );
}
