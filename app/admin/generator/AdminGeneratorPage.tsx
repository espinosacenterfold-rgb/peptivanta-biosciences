"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { siteConfig } from "../../../site.config";

type Settings = {
  displayLimit: number;
  dailyMinimum: number;
  dailyMaximum: number;
  largeOrderRateBps: number;
  repeatOrderRateBps: number;
  multiProductRateBps: number;
  bulkGapDays: number;
  repeatMinimumDays: number;
  repeatMaximumDays: number;
  marketUsWeight: number;
  marketCaWeight: number;
  marketBrWeight: number;
  marketMxWeight: number;
  generationEnabled: boolean;
};

type Stats = {
  total: number;
  repeatTotal: number;
  largeTotal: number;
  multiProductTotal: number;
  todayTotal: number;
  publishedTotal: number;
  oldestDate: string | null;
  newestDate: string | null;
  serviceTotals: {
    catalogue: number;
    privateLabel: number;
    bulk: number;
    custom: number;
  };
  marketTotals: {
    us: number;
    ca: number;
    br: number;
    mx: number;
  };
};

type Payload = {
  settings?: Settings;
  retentionLimit?: number;
  updatedAt?: string | null;
  stats?: Stats;
  error?: string;
};

const SESSION_KEY = "peptivanta_fulfillment_admin_key";
const defaults: Settings = {
  displayLimit: 300,
  dailyMinimum: 10,
  dailyMaximum: 30,
  largeOrderRateBps: 1500,
  repeatOrderRateBps: 3500,
  multiProductRateBps: 5000,
  bulkGapDays: 20,
  repeatMinimumDays: 5,
  repeatMaximumDays: 14,
  marketUsWeight: 48,
  marketCaWeight: 25,
  marketBrWeight: 17,
  marketMxWeight: 10,
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
    if (!stored) return;
    // The two workspaces share one tab-scoped sign-in. Moving from real
    // orders to generator controls therefore never asks for the key again.
    void Promise.resolve().then(async () => {
      setAdminKey(stored);
      setBusy(true);
      try {
        await request("GET", undefined, stored);
        setAuthenticated(true);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "验证失败。");
      } finally {
        setBusy(false);
      }
    });
    // request is intentionally a component-local transport helper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function request(
    method: "GET" | "PATCH",
    body?: Settings,
    key = adminKey,
  ) {
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
    if (!response.ok) {
      if (response.status === 401) {
        setAuthenticated(false);
        window.sessionStorage.removeItem(SESSION_KEY);
      }
      throw new Error(result.error ?? "操作失败，请重试。");
    }
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

  async function synchronizeLedger() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/fulfillment-cases", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("订单数据同步失败，请稍后重试。");
      const refreshed = await request("GET");
      setMessage(
        `已同步今日账本并刷新统计，当前共有 ${refreshed.stats?.total ?? 0} 条模拟记录。`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "同步失败。");
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
      // Capacity changes append only missing history; previously generated
      // references, dates, amounts and product assemblies remain unchanged.
      const response = await fetch("/api/fulfillment-cases", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("设置已保存，但订单同步失败。");
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

  const marketWeightTotal = useMemo(
    () =>
      settings.marketUsWeight +
      settings.marketCaWeight +
      settings.marketBrWeight +
      settings.marketMxWeight,
    [settings],
  );
  const targetMarketPercent = (weight: number) =>
    marketWeightTotal > 0 ? `${((weight / marketWeightTotal) * 100).toFixed(0)}%` : "0%";

  if (!authenticated) {
    return (
      <main className="admin-login-page">
        <section className="admin-login-card">
          <div className="admin-brand">
            <img src="/logo-mark.svg" alt="" width={48} height={48} />
            <span>
              <strong>{siteConfig.brandName}</strong>
              <small>Unified Fulfillment Admin</small>
            </span>
          </div>
          <p className="section-tag">PRIVATE CONSOLE</p>
          <h1>统一履约后台</h1>
          <p>
            登录一次即可在真实订单和模拟订单之间切换。两类数据分别保存，互不覆盖。
          </p>
          <form onSubmit={signIn}>
            <label>
              <span>统一管理密钥</span>
              <input
                type="password"
                value={adminKey}
                onChange={(event) => setAdminKey(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error && <p className="admin-error">{error}</p>}
            <button type="submit" disabled={busy || !adminKey.trim()}>
              {busy ? "正在验证…" : "进入统一后台"}
            </button>
          </form>
          <Link href="/fulfillment">返回近期履约页面</Link>
        </section>
      </main>
    );
  }

  const stats = payload.stats;
  const percent = (value = 0, total = 0) =>
    total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0%";

  const serviceMix = [
    ["目录产品", stats?.serviceTotals.catalogue ?? 0],
    ["贴牌服务", stats?.serviceTotals.privateLabel ?? 0],
    ["大货供应", stats?.serviceTotals.bulk ?? 0],
    ["定制项目", stats?.serviceTotals.custom ?? 0],
  ] as const;
  const marketMix = [
    ["美国", stats?.marketTotals.us ?? 0],
    ["加拿大", stats?.marketTotals.ca ?? 0],
    ["巴西", stats?.marketTotals.br ?? 0],
    ["墨西哥", stats?.marketTotals.mx ?? 0],
  ] as const;

  return (
    <main className="admin-orders-page admin-generator-page">
      <header className="admin-orders-header">
        <div className="admin-brand">
          <img src="/logo-mark.svg" alt="" width={44} height={44} />
          <span>
            <strong>{siteConfig.brandName}</strong>
            <small>Unified Fulfillment Admin</small>
          </span>
        </div>
        <nav className="admin-console-tabs" aria-label="后台功能切换">
          <Link href="/admin/orders">真实订单</Link>
          <Link href="/admin/generator" aria-current="page">模拟订单</Link>
          <Link href="/fulfillment" target="_blank">查看公开页</Link>
          <button type="button" onClick={signOut}>退出后台</button>
        </nav>
      </header>

      <section className="admin-orders-shell">
        <div className="admin-orders-intro">
          <div>
            <p className="section-tag">ILLUSTRATIVE LEDGER ENGINE</p>
            <h1>模拟订单控制</h1>
            <p>
              控制每日新增量、业务结构、产品组合、复购节奏和市场分布。设置只影响以后新增或补齐的模拟订单，旧订单不会重新生成。
            </p>
          </div>
          <dl>
            <div><dt>{stats?.total ?? 0}</dt><dd>数据库模拟记录</dd></div>
            <div><dt>{stats?.todayTotal ?? 0}</dt><dd>今日新增记录</dd></div>
          </dl>
        </div>

        {(message || error) && (
          <div className={error ? "admin-alert is-error" : "admin-alert"}>
            {error || message}
          </div>
        )}

        <section className="admin-create-panel admin-generator-controls">
          <div>
            <p className="section-tag">GENERATION SETTINGS</p>
            <h2>生成与展示参数</h2>
          </div>
          <form onSubmit={save}>
            <fieldset className="admin-generator-group">
              <legend>展示与每日新增</legend>
              <label>
                <span>公开展示订单数</span>
                <input
                  type="number"
                  min="100"
                  max="500"
                  step="10"
                  value={settings.displayLimit}
                  onChange={(event) => setSettings({ ...settings, displayLimit: Number(event.target.value) })}
                />
                <small>默认 300；数据库最多保留 {payload.retentionLimit ?? 500} 条模拟记录。</small>
              </label>
              <label>
                <span>每日最少新增</span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={settings.dailyMinimum}
                  onChange={(event) => setSettings({ ...settings, dailyMinimum: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>每日最多新增</span>
                <input
                  type="number"
                  min={settings.dailyMinimum}
                  max="60"
                  value={settings.dailyMaximum}
                  onChange={(event) => setSettings({ ...settings, dailyMaximum: Number(event.target.value) })}
                />
              </label>
            </fieldset>

            <fieldset className="admin-generator-group">
              <legend>订单结构</legend>
              <label>
                <span>贴牌 + 大货目标占比</span>
                <input
                  type="range"
                  min="5"
                  max="25"
                  step="1"
                  value={settings.largeOrderRateBps / 100}
                  onChange={(event) => setSettings({ ...settings, largeOrderRateBps: Number(event.target.value) * 100 })}
                />
                <strong>{(settings.largeOrderRateBps / 100).toFixed(0)}%</strong>
                <small>大货还会受到单独的最短间隔限制，因此实际占比通常略低。</small>
              </label>
              <label>
                <span>复购订单目标占比</span>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="5"
                  value={settings.repeatOrderRateBps / 100}
                  onChange={(event) => setSettings({ ...settings, repeatOrderRateBps: Number(event.target.value) * 100 })}
                />
                <strong>{(settings.repeatOrderRateBps / 100).toFixed(0)}%</strong>
                <small>复购继承前单国家和产品组合，并保留关联订单编号。</small>
              </label>
              <label>
                <span>多产品组装目标占比</span>
                <input
                  type="range"
                  min="0"
                  max="90"
                  step="5"
                  value={settings.multiProductRateBps / 100}
                  onChange={(event) => setSettings({ ...settings, multiProductRateBps: Number(event.target.value) * 100 })}
                />
                <strong>{(settings.multiProductRateBps / 100).toFixed(0)}%</strong>
                <small>控制新订单中出现两到三个产品组合的概率。</small>
              </label>
            </fieldset>

            <fieldset className="admin-generator-group">
              <legend>业务节奏</legend>
              <label>
                <span>大宗订单最短间隔（天）</span>
                <input
                  type="number"
                  min="7"
                  max="60"
                  value={settings.bulkGapDays}
                  onChange={(event) => setSettings({ ...settings, bulkGapDays: Number(event.target.value) })}
                />
                <small>避免连续多天出现大宗项目，看起来更符合真实开发节奏。</small>
              </label>
              <label>
                <span>复购最短间隔（天）</span>
                <input
                  type="number"
                  min="2"
                  max="30"
                  value={settings.repeatMinimumDays}
                  onChange={(event) => setSettings({ ...settings, repeatMinimumDays: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>复购最长间隔（天）</span>
                <input
                  type="number"
                  min={settings.repeatMinimumDays}
                  max="60"
                  value={settings.repeatMaximumDays}
                  onChange={(event) => setSettings({ ...settings, repeatMaximumDays: Number(event.target.value) })}
                />
              </label>
            </fieldset>

            <fieldset className="admin-generator-group admin-market-controls">
              <legend>目标市场权重</legend>
              {[
                ["美国", "marketUsWeight", settings.marketUsWeight],
                ["加拿大", "marketCaWeight", settings.marketCaWeight],
                ["巴西", "marketBrWeight", settings.marketBrWeight],
                ["墨西哥", "marketMxWeight", settings.marketMxWeight],
              ].map(([label, key, value]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={value}
                    onChange={(event) => setSettings({ ...settings, [key]: Number(event.target.value) })}
                  />
                  <strong>{targetMarketPercent(Number(value))}</strong>
                </label>
              ))}
              <small className="admin-generator-group-note">
                这里填写相对权重，系统会自动换算百分比；复购订单仍沿用原客户国家。
              </small>
            </fieldset>

            <label className="admin-checkbox admin-generator-enabled">
              <input
                type="checkbox"
                checked={settings.generationEnabled}
                onChange={(event) => setSettings({ ...settings, generationEnabled: event.target.checked })}
              />
              <span>启用每日模拟订单生成</span>
            </label>
            <div className="admin-generator-actions">
              <button className="admin-primary" type="submit" disabled={busy}>
                {busy ? "正在处理…" : "保存全部设置"}
              </button>
              <button type="button" onClick={() => void synchronizeLedger()} disabled={busy}>
                同步今日记录并刷新统计
              </button>
            </div>
          </form>
        </section>

        <section className="admin-order-list admin-generator-stats">
          <div className="admin-list-heading">
            <div>
              <p className="section-tag">CURRENT MIX</p>
              <h2>当前数据库结构</h2>
            </div>
            <button type="button" onClick={() => void request("GET")} disabled={busy}>
              刷新统计
            </button>
          </div>
          <dl>
            <div><dt>公开记录</dt><dd>{stats?.publishedTotal ?? 0}<small>{percent(stats?.publishedTotal, stats?.total)}</small></dd></div>
            <div><dt>复购记录</dt><dd>{stats?.repeatTotal ?? 0}<small>{percent(stats?.repeatTotal, stats?.total)}</small></dd></div>
            <div><dt>多产品组合</dt><dd>{stats?.multiProductTotal ?? 0}<small>{percent(stats?.multiProductTotal, stats?.total)}</small></dd></div>
            <div><dt>贴牌与大货</dt><dd>{stats?.largeTotal ?? 0}<small>{percent(stats?.largeTotal, stats?.total)}</small></dd></div>
            <div><dt>最早记录</dt><dd>{stats?.oldestDate ?? "—"}</dd></div>
            <div><dt>最新记录</dt><dd>{stats?.newestDate ?? "—"}</dd></div>
          </dl>

          <div className="admin-mix-grid">
            <section>
              <h3>服务类型分布</h3>
              {serviceMix.map(([label, value]) => (
                <div className="admin-mix-row" key={label}>
                  <span>{label}</span>
                  <i><b style={{ width: percent(value, stats?.total) }} /></i>
                  <strong>{value} · {percent(value, stats?.total)}</strong>
                </div>
              ))}
            </section>
            <section>
              <h3>目标市场分布</h3>
              {marketMix.map(([label, value]) => (
                <div className="admin-mix-row" key={label}>
                  <span>{label}</span>
                  <i><b style={{ width: percent(value, stats?.total) }} /></i>
                  <strong>{value} · {percent(value, stats?.total)}</strong>
                </div>
              ))}
            </section>
          </div>
          <p>
            真实订单不计入以上统计，也不会被本面板新增、修改或删除。最近保存时间：{payload.updatedAt ? new Date(`${payload.updatedAt}Z`).toLocaleString("zh-CN") : "—"}
          </p>
        </section>
      </section>
    </main>
  );
}
