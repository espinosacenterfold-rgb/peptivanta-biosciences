"use client";

import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { siteConfig } from "../../../site.config";

const adminNavigation = [
  { current: "workspace", href: "/admin/workspace", label: "总览", short: "总" },
  { current: "真实订单", href: "/admin/orders", label: "真实订单", short: "单" },
  { current: "模拟订单", href: "/admin/generator", label: "模拟订单", short: "模" },
  { current: "反馈审核", href: "/admin/feedback", label: "反馈审核", short: "评" },
  { current: "客户账号", href: "/admin/customers", label: "客户账号", short: "客" },
  { current: "素材库", href: "/admin/media", label: "素材库", short: "材" },
] as const;

export function AdminLogin({
  adminKey,
  setAdminKey,
  busy,
  error,
  signIn,
}: {
  adminKey: string;
  setAdminKey: (value: string) => void;
  busy: boolean;
  error: string;
  signIn: (event: FormEvent) => void;
}) {
  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <div className="admin-brand"><img src="/logo-mark.svg" alt="" width={48} height={48} /><span><strong>{siteConfig.brandName}</strong><small>Private Operations</small></span></div>
        <p className="section-tag">CONTROL PANEL</p>
        <h1>内部管理面板</h1>
        <p>使用统一管理密钥进入订单、反馈、客户和素材管理。</p>
        <form onSubmit={signIn}><label><span>统一管理密钥</span><input type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} autoComplete="current-password" required /></label>{error && <p className="admin-error">{error}</p>}<button type="submit" disabled={busy || !adminKey.trim()}>{busy ? "正在验证…" : "进入控制台"}</button></form>
        <Link href="/fulfillment">返回公开履约页</Link>
      </section>
    </main>
  );
}

export function AdminSessionChecking() {
  return (
    <main className="admin-login-page">
      <section className="admin-login-card admin-session-checking" aria-live="polite">
        <div className="admin-brand"><img src="/logo-mark.svg" alt="" width={48} height={48} /><span><strong>{siteConfig.brandName}</strong><small>Secure Operations</small></span></div>
        <span className="admin-session-spinner" aria-hidden="true" />
        <h1>正在打开管理中心</h1>
        <p>正在验证此标签页的安全会话，验证完成后将自动进入。</p>
      </section>
    </main>
  );
}

export function AdminHeader({ current, signOut }: { current: string; signOut: () => void }) {
  return (
    <header className="admin-orders-header">
      <Link className="admin-brand" href="/admin/workspace"><img src="/logo-mark.svg" alt="" width={42} height={42} /><span><strong>{siteConfig.brandName}</strong><small>管理中心</small></span></Link>
      <nav className="admin-console-tabs" aria-label="后台功能切换">
        <div className="admin-nav-primary">
          {adminNavigation.map((item) => (
            <Link
              href={item.href}
              key={item.href}
              aria-current={current === item.current ? "page" : undefined}
            >
              <span aria-hidden="true">{item.short}</span>
              <b>{item.label}</b>
            </Link>
          ))}
        </div>
        <div className="admin-nav-secondary">
          <Link href="/fulfillment" target="_blank">查看网站 <span aria-hidden="true">↗</span></Link>
          <button type="button" onClick={signOut}>退出</button>
        </div>
      </nav>
    </header>
  );
}

export function AdminPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`admin-orders-page ${className}`.trim()}>{children}</main>;
}
