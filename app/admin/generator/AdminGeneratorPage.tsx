"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminHeader, AdminLogin, AdminPage, AdminSessionChecking } from "../_components/AdminChrome";
import { useAdminSession } from "../_components/useAdminSession";

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
  historyProtection?: {
    enabled: boolean;
    mode: "append_only";
  };
  stats?: Stats;
  error?: string;
};

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

const presets: Array<{ name: string; description: string; settings: Partial<Settings> }> = [
  {
    name: "稳健增长",
    description: "小单为主，适合日常展示",
    settings: { dailyMinimum: 10, dailyMaximum: 22, largeOrderRateBps: 1200, repeatOrderRateBps: 3200, multiProductRateBps: 4500, bulkGapDays: 24 },
  },
  {
    name: "B2B 拓展",
    description: "提高组合单、复购与适量大单",
    settings: { dailyMinimum: 15, dailyMaximum: 30, largeOrderRateBps: 1800, repeatOrderRateBps: 4200, multiProductRateBps: 6000, bulkGapDays: 18 },
  },
  {
    name: "目录优先",
    description: "更多标准产品和首单，节奏更轻",
    settings: { dailyMinimum: 10, dailyMaximum: 20, largeOrderRateBps: 800, repeatOrderRateBps: 2500, multiProductRateBps: 3500, bulkGapDays: 30 },
  },
];

export default function AdminGeneratorPage() {
  const auth = useAdminSession();
  const [settings, setSettings] = useState(defaults);
  const [payload, setPayload] = useState<Payload>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth.authenticated) return;
    const frame = window.requestAnimationFrame(() => {
      void request("GET").catch((caught) => {
        setError(caught instanceof Error ? caught.message : "模拟订单设置加载失败。");
      });
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.authenticated]);

  async function request(
    method: "GET" | "PATCH",
    body?: Settings,
  ) {
    const result = await auth.request<Payload>("/api/admin/generator", {
      method,
      body: body ? JSON.stringify(body) : undefined,
    });
    setPayload(result);
    if (result.settings) setSettings(result.settings);
    return result;
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

  async function persistSettings(nextSettings: Settings, successMessage: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request("PATCH", nextSettings);
      // Capacity changes append only missing history; previously generated
      // references, dates, amounts and product assemblies remain unchanged.
      const response = await fetch("/api/fulfillment-cases", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("设置已保存，但订单同步失败。");
      const refreshed = await request("GET");
      setMessage(`${successMessage} 旧订单保持不变；当前保留 ${refreshed.stats?.total ?? 0} 条模拟记录。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存失败。");
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    await persistSettings(settings, "生成设置已保存。");
  }

  async function toggleGenerator() {
    const next = { ...settings, generationEnabled: !settings.generationEnabled };
    setSettings(next);
    await persistSettings(next, next.generationEnabled ? "每日生成已恢复。" : "每日生成已暂停。");
  }

  async function applyPreset(name: string, presetSettings: Partial<Settings>) {
    const next = { ...settings, ...presetSettings, generationEnabled: true };
    setSettings(next);
    await persistSettings(next, `已应用“${name}”方案。`);
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

  if (auth.checking) return <AdminSessionChecking />;
  if (!auth.authenticated) return <AdminLogin {...auth} />;

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
    <AdminPage className="admin-generator-page">
      <AdminHeader current="模拟订单" signOut={() => { setPayload({}); auth.signOut(); }} />

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

        {(message || error || auth.error) && (
          <div className={error || auth.error ? "admin-alert is-error" : "admin-alert"}>
            {error || auth.error || message}
          </div>
        )}

        <section className="admin-generator-overview">
          <div className="admin-generator-status-card">
            <header>
              <div><p className="section-tag">AUTOMATION</p><h2>自动生成状态</h2></div>
              <span className={settings.generationEnabled ? "is-running" : "is-paused"}>{settings.generationEnabled ? "运行中" : "已暂停"}</span>
            </header>
            <dl>
              <div><dt>每日新增</dt><dd>{settings.dailyMinimum}–{settings.dailyMaximum} 条</dd></div>
              <div><dt>复购目标</dt><dd>{settings.repeatOrderRateBps / 100}%</dd></div>
              <div><dt>贴牌与大货</dt><dd>{settings.largeOrderRateBps / 100}%</dd></div>
              <div><dt>多产品组合</dt><dd>{settings.multiProductRateBps / 100}%</dd></div>
              <div className="is-protected"><dt>历史订单保护</dt><dd>{payload.historyProtection?.enabled ? "已锁定" : "检查中"}</dd></div>
            </dl>
            <div className="admin-generator-quick-actions">
              <button className={settings.generationEnabled ? "is-pause" : "is-start"} type="button" onClick={() => void toggleGenerator()} disabled={busy}>{settings.generationEnabled ? "暂停每日生成" : "恢复每日生成"}</button>
              <button type="button" onClick={() => void synchronizeLedger()} disabled={busy}>立即同步一次</button>
            </div>
          </div>

          <div className="admin-generator-presets">
            <header><div><p className="section-tag">PRESETS</p><h2>一键业务方案</h2></div><small>只影响之后的新记录</small></header>
            <div>
              {presets.map((preset) => (
                <button type="button" key={preset.name} onClick={() => void applyPreset(preset.name, preset.settings)} disabled={busy}>
                  <b>{preset.name}</b><small>{preset.description}</small><span>应用并保存 →</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <details className="admin-create-panel admin-generator-controls admin-settings-disclosure">
          <summary>
            <div>
              <p className="section-tag">GENERATION SETTINGS</p>
              <h2>生成规则</h2>
              <p>每日新增、订单结构和市场权重均已按当前设置自动运行。</p>
            </div>
            <span>高级设置</span>
          </summary>
          <div className="admin-settings-body">
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
          </div>
        </details>

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
    </AdminPage>
  );
}
