"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { siteConfig } from "../../../site.config";

type Settings = {
  displayLimit: number;
  dailyMinimum: number;
  dailyMaximum: number;
  largeOrderRateBps: number;
  repeatOrderRateBps: number;
  generationEnabled: boolean;
};

type Payload = {
  settings?: Settings;
  retentionLimit?: number;
  updatedAt?: string | null;
  stats?: {
    total: number;
    repeatTotal: number;
    largeTotal: number;
    oldestDate: string | null;
    newestDate: string | null;
  };
  error?: string;
};

const SESSION_KEY = "peptivanta_fulfillment_admin_key";
const defaults: Settings = {
  displayLimit: 300,
  dailyMinimum: 10,
  dailyMaximum: 30,
  largeOrderRateBps: 1500,
  repeatOrderRateBps: 3500,
  generationEnabled: true,
};

export default function AdminGeneratorPage() {
  const [adminKey, setAdminKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [settings, setSettings] = useState(defaults);
  const [payload, setPayload] = useState<Payload>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = window.sessionStorage.getItem(SESSION_KEY);
    // Hydrate the tab-scoped credential only after the client is available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setAdminKey(stored);
  }, []);

  async function request(method: "GET" | "PATCH", body?: Settings, key = adminKey) {
    const response = await fetch("/api/admin/generator", {
      method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = (await response.json()) as Payload;
    if (!response.ok) throw new Error(result.error ?? "操作失败，请重试。");
    setPayload(result);
    if (result.settings) setSettings(result.settings);
    return result;
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("GET", undefined, adminKey);
      window.sessionStorage.setItem(SESSION_KEY, adminKey);
      setAuthenticated(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "验证失败。");
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request("PATCH", settings);
      // A public refresh applies capacity changes without rewriting rows that
      // already exist. This call never mutates the genuine-order table.
      await fetch("/api/fulfillment-cases", { cache: "no-store" });
      const refreshed = await request("GET");
      setMessage(
        `生成设置已保存。当前保留 ${refreshed.stats?.total ?? 0} 条模拟记录。`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存失败。");
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    window.sessionStorage.removeItem(SESSION_KEY);
    setAdminKey("");
    setAuthenticated(false);
    setPayload({});
  }

  if (!authenticated) {
    return (
      <main className="admin-login-page">
        <section className="admin-login-card">
          <div className="admin-brand">
            <img src="/logo-mark.svg" alt="" width={48} height={48} />
            <span><strong>{siteConfig.brandName}</strong><small>Generator Admin</small></span>
          </div>
          <p className="section-tag">ISOLATED CONSOLE</p>
          <h1>模拟订单控制台</h1>
          <p>此面板只控制模拟订单生成器，与真实订单后台完全隔离。</p>
          <form onSubmit={signIn}>
            <label>
              <span>管理密钥</span>
              <input type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} required />
            </label>
            {error && <p className="admin-error">{error}</p>}
            <button type="submit" disabled={busy || !adminKey.trim()}>{busy ? "正在验证…" : "进入控制台"}</button>
          </form>
          <Link href="/fulfillment">返回近期履约页面</Link>
        </section>
      </main>
    );
  }

  const stats = payload.stats;
  const percent = (value = 0, total = 0) =>
    total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0%";

  return (
    <main className="admin-orders-page admin-generator-page">
      <header className="admin-orders-header">
        <div className="admin-brand">
          <img src="/logo-mark.svg" alt="" width={44} height={44} />
          <span><strong>{siteConfig.brandName}</strong><small>Generator Admin</small></span>
        </div>
        <nav>
          <Link href="/admin/orders">真实订单后台</Link>
          <Link href="/fulfillment" target="_blank">查看公开页面</Link>
          <button type="button" onClick={signOut}>退出后台</button>
        </nav>
      </header>

      <section className="admin-orders-shell">
        <div className="admin-orders-intro">
          <div>
            <p className="section-tag">ILLUSTRATIVE LEDGER ENGINE</p>
            <h1>模拟订单生成控制</h1>
            <p>设置只作用于今后新增或补齐的模拟订单。已经生成的编号、日期、金额和状态依据不会被重新抽取。</p>
          </div>
          <dl>
            <div><dt>{stats?.total ?? 0}</dt><dd>数据库模拟记录</dd></div>
            <div><dt>{settings.displayLimit}</dt><dd>公开展示上限</dd></div>
          </dl>
        </div>

        {(message || error) && <div className={error ? "admin-alert is-error" : "admin-alert"}>{error || message}</div>}

        <section className="admin-create-panel admin-generator-controls">
          <div><p className="section-tag">GENERATION SETTINGS</p><h2>新增订单参数</h2></div>
          <form onSubmit={save}>
            <label>
              <span>公开展示订单数</span>
              <input type="number" min="100" max="500" step="10" value={settings.displayLimit} onChange={(event) => setSettings({ ...settings, displayLimit: Number(event.target.value) })} />
              <small>默认 300；数据库最多保留 {payload.retentionLimit ?? 500} 条模拟记录。</small>
            </label>
            <label>
              <span>每日最少新增</span>
              <input type="number" min="1" max="50" value={settings.dailyMinimum} onChange={(event) => setSettings({ ...settings, dailyMinimum: Number(event.target.value) })} />
            </label>
            <label>
              <span>每日最多新增</span>
              <input type="number" min={settings.dailyMinimum} max="60" value={settings.dailyMaximum} onChange={(event) => setSettings({ ...settings, dailyMaximum: Number(event.target.value) })} />
            </label>
            <label>
              <span>贴牌 + 大货目标占比</span>
              <input type="range" min="5" max="25" step="1" value={settings.largeOrderRateBps / 100} onChange={(event) => setSettings({ ...settings, largeOrderRateBps: Number(event.target.value) * 100 })} />
              <strong>{(settings.largeOrderRateBps / 100).toFixed(0)}%</strong>
              <small>大货仍受 20 天间隔限制，因此实际占比会略低。</small>
            </label>
            <label>
              <span>复购订单目标占比</span>
              <input type="range" min="0" max="60" step="5" value={settings.repeatOrderRateBps / 100} onChange={(event) => setSettings({ ...settings, repeatOrderRateBps: Number(event.target.value) * 100 })} />
              <strong>{(settings.repeatOrderRateBps / 100).toFixed(0)}%</strong>
              <small>复购会继承前单国家与产品组合，并标注对应订单。</small>
            </label>
            <label className="admin-checkbox">
              <input type="checkbox" checked={settings.generationEnabled} onChange={(event) => setSettings({ ...settings, generationEnabled: event.target.checked })} />
              <span>启用每日模拟订单生成</span>
            </label>
            <button className="admin-primary" type="submit" disabled={busy}>{busy ? "正在保存…" : "保存生成设置"}</button>
          </form>
        </section>

        <section className="admin-order-list admin-generator-stats">
          <div className="admin-list-heading"><div><p className="section-tag">CURRENT MIX</p><h2>当前数据库结构</h2></div></div>
          <dl>
            <div><dt>复购记录</dt><dd>{stats?.repeatTotal ?? 0}<small>{percent(stats?.repeatTotal, stats?.total)}</small></dd></div>
            <div><dt>贴牌与大货</dt><dd>{stats?.largeTotal ?? 0}<small>{percent(stats?.largeTotal, stats?.total)}</small></dd></div>
            <div><dt>最早记录</dt><dd>{stats?.oldestDate ?? "—"}</dd></div>
            <div><dt>最新记录</dt><dd>{stats?.newestDate ?? "—"}</dd></div>
          </dl>
          <p>真实订单不计入以上统计，也不会被本面板新增、修改或删除。</p>
        </section>
      </section>
    </main>
  );
}
