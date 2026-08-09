"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminHeader, AdminLogin, AdminPage } from "../_components/AdminChrome";
import { useAdminSession } from "../_components/useAdminSession";

type Stats = {
  real_orders: number;
  published_real_orders: number;
  open_real_orders: number;
  delivered_real_orders: number;
  unpublished_real_orders: number;
  month_real_orders: number;
  real_order_value_usd_cents: number;
  month_order_value_usd_cents: number;
  sample_orders: number;
  pending_feedback: number;
  approved_feedback: number;
  customers: number;
  unlinked_customers: number;
  suspended_customers: number;
  media_assets: number;
  expiring_media: number;
  media_bytes: number;
  pending_media_tasks: number;
  generator_enabled: number;
};

type PipelineRow = { status: string; count: number; amount_usd_cents: number };
type MarketRow = { destination: string; count: number; amount_usd_cents: number };
type ActivityRow = { kind: "order" | "feedback" | "customer" | "media"; title: string; detail: string; event_at: string };
type DashboardPayload = { stats: Stats; pipeline: PipelineRow[]; markets: MarketRow[]; activity: ActivityRow[] };

const modules = [
  { title: "真实订单", description: "登记、筛选、批量更新与导出订单", href: "/admin/orders", mark: "01" },
  { title: "模拟订单", description: "快捷启停、预设方案与结构统计", href: "/admin/generator", mark: "02" },
  { title: "反馈审核", description: "检索、审核和管理公开反馈", href: "/admin/feedback", mark: "03" },
  { title: "客户账号", description: "筛选客户、生成绑定码与导出资料", href: "/admin/customers", mark: "04" },
  { title: "素材库", description: "筛选素材、容量保护与采集任务", href: "/admin/media", mark: "05" },
] as const;

const statusLabels: Record<string, string> = {
  confirmed: "订单确认",
  documentation_review: "文件审核",
  in_production: "生产中",
  quality_control: "质量检测",
  packaging: "包装中",
  dispatched: "已发运",
  delivered: "已送达",
};

const marketLabels: Record<string, string> = {
  "United States": "美国",
  Canada: "加拿大",
  Brazil: "巴西",
  Mexico: "墨西哥",
};

const activityMeta = {
  order: { label: "订单", mark: "单", href: "/admin/orders" },
  feedback: { label: "反馈", mark: "评", href: "/admin/feedback" },
  customer: { label: "客户", mark: "客", href: "/admin/customers" },
  media: { label: "素材", mark: "图", href: "/admin/media" },
} as const;

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const numberValue = (value: unknown) => Number(value) || 0;
const usdValue = (cents: unknown) => usd.format(numberValue(cents) / 100);

function compactBytes(bytes: unknown) {
  const value = numberValue(bytes);
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} GB`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(value / 1_000)} KB`;
}

export default function AdminWorkspacePage() {
  const auth = useAdminSession();
  const [data, setData] = useState<DashboardPayload | null>(null);

  useEffect(() => {
    if (!auth.authenticated) return;
    const frame = window.requestAnimationFrame(() => {
      void auth
        .request<DashboardPayload>("/api/admin/dashboard")
        .then(setData)
        .catch((caught) => auth.setError(caught instanceof Error ? caught.message : "加载失败。"));
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.authenticated]);

  const stats = data?.stats;
  const pendingCount = numberValue(stats?.pending_feedback) + numberValue(stats?.pending_media_tasks);
  const alertCount = pendingCount + numberValue(stats?.unlinked_customers) + numberValue(stats?.expiring_media);
  const maximumPipeline = useMemo(
    () => Math.max(1, ...(data?.pipeline ?? []).map((row) => numberValue(row.count))),
    [data?.pipeline],
  );

  if (!auth.authenticated) return <AdminLogin {...auth} />;

  const metrics = [
    { label: "本月真实订单", value: numberValue(stats?.month_real_orders), detail: usdValue(stats?.month_order_value_usd_cents) },
    { label: "正在履约", value: numberValue(stats?.open_real_orders), detail: `${numberValue(stats?.delivered_real_orders)} 条已送达` },
    { label: "当前待办", value: pendingCount, detail: pendingCount ? "建议优先处理" : "目前没有待办" },
    { label: "客户账号", value: numberValue(stats?.customers), detail: `${numberValue(stats?.unlinked_customers)} 个尚未绑定订单` },
  ] as const;

  const alerts = [
    { label: "客户反馈待审核", value: numberValue(stats?.pending_feedback), href: "/admin/feedback" },
    { label: "素材采集待处理", value: numberValue(stats?.pending_media_tasks), href: "/admin/media" },
    { label: "客户尚未绑定订单", value: numberValue(stats?.unlinked_customers), href: "/admin/customers" },
    { label: "14天内到期素材", value: numberValue(stats?.expiring_media), href: "/admin/media" },
    { label: "后台保留订单", value: numberValue(stats?.unpublished_real_orders), href: "/admin/orders" },
  ];

  return (
    <AdminPage className="admin-workspace-page">
      <AdminHeader current="workspace" signOut={auth.signOut} />
      <section className="admin-orders-shell admin-workspace-shell">
        <div className="admin-workspace-welcome">
          <div>
            <p className="section-tag">CONTROL CENTER</p>
            <h1>管理中心</h1>
            <p>从订单、客户、反馈和素材四个角度掌握当前业务。</p>
          </div>
          <span className="admin-system-state"><i />{stats?.generator_enabled ? "系统与自动任务正常" : "系统正常 · 模拟器已暂停"}</span>
        </div>

        {auth.error && <div className="admin-alert is-error">{auth.error}</div>}

        <div className="admin-workspace-metrics">
          {metrics.map((metric) => (
            <article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></article>
          ))}
        </div>

        <div className="admin-workspace-main-grid">
          <section className="admin-simple-panel admin-quick-actions">
            <header><div><p className="section-tag">QUICK ACTIONS</p><h2>常用操作</h2></div></header>
            <div>
              <Link className="is-primary" href="/admin/orders"><span>＋</span><b>登记真实订单</b><small>新增客户订单并设置产品组合</small></Link>
              <Link href="/admin/feedback"><span>评</span><b>处理反馈</b><small>{numberValue(stats?.pending_feedback)} 条等待审核</small></Link>
              <Link href="/admin/customers"><span>码</span><b>生成绑定码</b><small>{numberValue(stats?.unlinked_customers)} 个账号尚未绑定</small></Link>
              <Link href="/admin/media"><span>图</span><b>上传素材</b><small>{compactBytes(stats?.media_bytes)} 已使用</small></Link>
            </div>
          </section>

          <section className="admin-simple-panel admin-alert-panel">
            <header><div><p className="section-tag">ATTENTION</p><h2>提醒中心</h2></div><strong>{alertCount}</strong></header>
            <div>
              {alerts.map((alert) => (
                <Link className={alert.value ? "is-active" : ""} href={alert.href} key={alert.label}>
                  <span>{alert.label}</span><b>{alert.value}</b><i>→</i>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="admin-analytics-grid">
          <section className="admin-simple-panel admin-pipeline-panel">
            <header><div><p className="section-tag">ORDER PIPELINE</p><h2>真实订单管线</h2></div><small>累计 {usdValue(stats?.real_order_value_usd_cents)}</small></header>
            <div className="admin-pipeline-list">
              {(data?.pipeline ?? []).map((row) => (
                <div key={row.status}>
                  <span>{statusLabels[row.status] ?? row.status}</span>
                  <i><b style={{ width: `${Math.max(5, (numberValue(row.count) / maximumPipeline) * 100)}%` }} /></i>
                  <strong>{numberValue(row.count)}</strong>
                  <small>{usdValue(row.amount_usd_cents)}</small>
                </div>
              ))}
              {!data?.pipeline.length && <p className="admin-compact-empty">登记真实订单后，这里会显示各履约阶段。</p>}
            </div>
          </section>

          <section className="admin-simple-panel admin-market-panel">
            <header><div><p className="section-tag">MARKETS</p><h2>市场分布</h2></div></header>
            <div>
              {(data?.markets ?? []).map((row) => (
                <article key={row.destination}>
                  <span>{marketLabels[row.destination] ?? row.destination}</span>
                  <b>{numberValue(row.count)} 单</b>
                  <small>{usdValue(row.amount_usd_cents)}</small>
                </article>
              ))}
              {!data?.markets.length && <p className="admin-compact-empty">暂无市场数据。</p>}
            </div>
          </section>
        </div>

        <section className="admin-simple-panel admin-activity-panel">
          <header><div><p className="section-tag">RECENT ACTIVITY</p><h2>近期动态</h2></div><small>订单、反馈、客户与素材统一查看</small></header>
          <div>
            {(data?.activity ?? []).map((event, index) => {
              const meta = activityMeta[event.kind] ?? activityMeta.order;
              return (
                <Link href={meta.href} key={`${event.kind}-${event.title}-${event.event_at}-${index}`}>
                  <span>{meta.mark}</span>
                  <div><b>{event.title}</b><small>{meta.label} · {event.detail}</small></div>
                  <time>{new Date(event.event_at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
                  <i>→</i>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="admin-simple-panel admin-module-list">
          <header><div><p className="section-tag">MODULES</p><h2>全部功能</h2></div></header>
          <div>
            {modules.map((module) => (
              <Link href={module.href} key={module.href}><span>{module.mark}</span><div><b>{module.title}</b><small>{module.description}</small></div><i aria-hidden="true">→</i></Link>
            ))}
          </div>
        </section>
      </section>
    </AdminPage>
  );
}
