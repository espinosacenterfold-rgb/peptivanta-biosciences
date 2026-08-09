"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminHeader, AdminLogin, AdminPage } from "../_components/AdminChrome";
import { useAdminSession } from "../_components/useAdminSession";

type Stats = {
  real_orders: number;
  published_real_orders: number;
  sample_orders: number;
  pending_feedback: number;
  approved_feedback: number;
  customers: number;
  media_assets: number;
  pending_media_tasks: number;
  generator_enabled: number;
};

const modules = [
  { title: "真实订单", description: "登记订单、更新进度与公开状态", href: "/admin/orders", mark: "01" },
  { title: "模拟订单", description: "查看统计；需要时再调整生成规则", href: "/admin/generator", mark: "02" },
  { title: "反馈审核", description: "处理真实反馈和示例服务反馈", href: "/admin/feedback", mark: "03" },
  { title: "客户账号", description: "生成绑定码并管理客户账号", href: "/admin/customers", mark: "04" },
  { title: "素材库", description: "上传图片与处理关键词采集任务", href: "/admin/media", mark: "05" },
] as const;

export default function AdminWorkspacePage() {
  const auth = useAdminSession();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!auth.authenticated) return;
    const frame = window.requestAnimationFrame(() => {
      void auth
        .request<{ stats: Stats }>("/api/admin/dashboard")
        .then((data) => setStats(data.stats))
        .catch((caught) =>
          auth.setError(caught instanceof Error ? caught.message : "加载失败。"),
        );
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.authenticated]);

  if (!auth.authenticated) return <AdminLogin {...auth} />;

  const pendingCount =
    Number(stats?.pending_feedback ?? 0) +
    Number(stats?.pending_media_tasks ?? 0);
  const metrics = [
    { label: "真实订单", value: stats?.real_orders ?? "—", detail: `${stats?.published_real_orders ?? 0} 条公开` },
    { label: "待处理", value: pendingCount, detail: pendingCount ? "建议优先处理" : "目前没有待办" },
    { label: "客户账号", value: stats?.customers ?? "—", detail: "有效账号" },
    { label: "反馈素材", value: stats?.media_assets ?? "—", detail: "可用与排期中" },
  ] as const;

  return (
    <AdminPage className="admin-workspace-page">
      <AdminHeader current="workspace" signOut={auth.signOut} />
      <section className="admin-orders-shell admin-workspace-shell">
        <div className="admin-workspace-welcome">
          <div>
            <p className="section-tag">CONTROL CENTER</p>
            <h1>管理中心</h1>
            <p>常用操作放在前面，复杂参数需要时再打开。</p>
          </div>
          <span className="admin-system-state"><i />系统运行正常</span>
        </div>

        {auth.error && <div className="admin-alert is-error">{auth.error}</div>}

        <div className="admin-workspace-metrics">
          {metrics.map((metric) => (
            <article key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </article>
          ))}
        </div>

        <div className="admin-workspace-main-grid">
          <section className="admin-simple-panel admin-quick-actions">
            <header>
              <div><p className="section-tag">QUICK ACTIONS</p><h2>常用操作</h2></div>
            </header>
            <div>
              <Link className="is-primary" href="/admin/orders"><span>＋</span><b>登记真实订单</b><small>新增客户订单并设置产品</small></Link>
              <Link href="/admin/feedback"><span>评</span><b>处理反馈</b><small>{stats?.pending_feedback ?? 0} 条等待审核</small></Link>
              <Link href="/admin/media"><span>图</span><b>上传素材</b><small>压缩后进入反馈素材库</small></Link>
            </div>
          </section>

          <section className="admin-simple-panel admin-todo-panel">
            <header>
              <div><p className="section-tag">TODAY</p><h2>当前待办</h2></div>
              <strong>{pendingCount}</strong>
            </header>
            <ul>
              <li className={stats?.pending_feedback ? "is-pending" : ""}><span>客户反馈审核</span><b>{stats?.pending_feedback ?? 0}</b></li>
              <li className={stats?.pending_media_tasks ? "is-pending" : ""}><span>素材采集任务</span><b>{stats?.pending_media_tasks ?? 0}</b></li>
              <li><span>模拟订单生成</span><b>{stats?.generator_enabled ? "运行中" : "已暂停"}</b></li>
            </ul>
            {pendingCount === 0 && <p>没有需要立即处理的项目。</p>}
          </section>
        </div>

        <section className="admin-simple-panel admin-module-list">
          <header><div><p className="section-tag">MODULES</p><h2>全部功能</h2></div></header>
          <div>
            {modules.map((module) => (
              <Link href={module.href} key={module.href}>
                <span>{module.mark}</span>
                <div><b>{module.title}</b><small>{module.description}</small></div>
                <i aria-hidden="true">→</i>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </AdminPage>
  );
}
