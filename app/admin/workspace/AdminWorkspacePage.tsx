"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminHeader, AdminLogin, AdminPage } from "../_components/AdminChrome";
import { useAdminSession } from "../_components/useAdminSession";

type Stats = { real_orders: number; sample_orders: number; pending_feedback: number; customers: number; media_assets: number };

export default function AdminWorkspacePage() {
  const auth = useAdminSession();
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    if (!auth.authenticated) return;
    void auth.request<{ stats: Stats }>("/api/admin/dashboard").then((data) => setStats(data.stats)).catch((caught) => auth.setError(caught instanceof Error ? caught.message : "加载失败。"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.authenticated]);
  if (!auth.authenticated) return <AdminLogin {...auth} />;
  const cards = [
    ["真实订单", "登记与推进真实客户订单", "/admin/orders", stats?.real_orders ?? "—", "REAL ORDERS"],
    ["模拟订单", "控制每日订单结构和市场分布", "/admin/generator", stats?.sample_orders ?? "—", "ILLUSTRATIVE LEDGER"],
    ["反馈审核", "审核真实反馈并管理示例反馈", "/admin/feedback", stats?.pending_feedback ?? "—", "PENDING REVIEW"],
    ["客户账号", "订单绑定码、客户状态与资料留痕", "/admin/customers", stats?.customers ?? "—", "CUSTOMERS"],
    ["素材库", "上传、排期、链接辅助与180天清理", "/admin/media", stats?.media_assets ?? "—", "MEDIA ASSETS"],
  ] as const;
  return <AdminPage className="admin-workspace-page"><AdminHeader current="workspace" signOut={auth.signOut} /><section className="admin-orders-shell"><div className="admin-orders-intro"><div><p className="section-tag">OPERATIONS WORKSPACE</p><h1>站点控制台</h1><p>保留原后台结构，只在这里集中进入各个独立模块并查看待办数量。</p></div></div>{auth.error && <div className="admin-alert is-error">{auth.error}</div>}<div className="admin-workspace-grid">{cards.map(([title, description, href, count, label], index) => <Link href={href} className={`admin-workspace-card card-${index + 1}`} key={href}><small>{label}</small><strong>{count}</strong><h2>{title}</h2><p>{description}</p><span aria-hidden="true">↗</span></Link>)}</div></section></AdminPage>;
}
