"use client";

import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { siteConfig } from "../../../site.config";

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

export function AdminHeader({ current, signOut }: { current: string; signOut: () => void }) {
  return (
    <header className="admin-orders-header">
      <Link className="admin-brand" href="/admin/workspace"><img src="/logo-mark.svg" alt="" width={44} height={44} /><span><strong>{siteConfig.brandName}</strong><small>Operations Console</small></span></Link>
      <nav className="admin-console-tabs" aria-label="后台功能切换">
        <Link href="/admin/workspace" aria-current={current === "workspace" ? "page" : undefined}>控制台</Link>
        {current !== "workspace" && <span className="admin-current-module">{current}</span>}
        <Link href="/fulfillment" target="_blank">查看公开页</Link>
        <button type="button" onClick={signOut}>退出后台</button>
      </nav>
    </header>
  );
}

export function AdminPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`admin-orders-page ${className}`.trim()}>{children}</main>;
}
