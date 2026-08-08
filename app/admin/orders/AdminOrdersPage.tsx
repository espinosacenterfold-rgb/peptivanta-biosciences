"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  PRODUCT_CATALOG,
  PRODUCT_CATEGORY_LABELS,
} from "../../../lib/product-catalog.ts";
import {
  calculateMultiItemOrderPricing,
  orderProfileForQuantity,
} from "../../../lib/order-pricing.ts";
import { siteConfig } from "../../../site.config";

type Market = "United States" | "Canada" | "Brazil" | "Mexico";
type Service = "catalogue" | "private_label" | "bulk" | "custom";
type Status =
  | "confirmed"
  | "documentation_review"
  | "in_production"
  | "quality_control"
  | "packaging"
  | "dispatched"
  | "delivered";

type ManualOrder = {
  id: number;
  reference: string;
  occurredAt: string;
  destination: Market;
  service: Service;
  orderProfile: string;
  sku: string;
  productName: string;
  specification: string;
  quantityUnits: number;
  retailUnitPriceUsdCents: number;
  discountBps: number;
  deductionUsdCents: number;
  amountUsdCents: number;
  status: Status;
  isPublished: boolean | number;
  createdAt: string;
  updatedAt: string;
  items: ManualOrderItem[];
};

type ManualOrderItem = {
  id?: number;
  sku: string;
  productName: string;
  specification: string;
  quantityUnits: number;
  retailUnitPriceUsdCents: number;
  discountedUnitPriceUsdCents: number;
  lineAmountUsdCents: number;
};

type DraftItem = {
  key: string;
  sku: string;
  productName: string;
  quantityUnits: string;
};

type OrderResponse = {
  orders?: ManualOrder[];
  error?: string;
};

const SESSION_KEY = "peptivanta_fulfillment_admin_key";
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const markets: { value: Market; label: string }[] = [
  { value: "United States", label: "美国" },
  { value: "Canada", label: "加拿大" },
  { value: "Brazil", label: "巴西" },
  { value: "Mexico", label: "墨西哥" },
];

const services: { value: Service; label: string }[] = [
  { value: "catalogue", label: "目录产品供应" },
  { value: "private_label", label: "贴牌服务" },
  { value: "custom", label: "定制项目" },
  { value: "bulk", label: "大货供应" },
];

const statuses: { value: Status; label: string }[] = [
  { value: "confirmed", label: "订单已确认" },
  { value: "documentation_review", label: "文件审核中" },
  { value: "in_production", label: "生产中" },
  { value: "quality_control", label: "质量检测" },
  { value: "packaging", label: "包装中" },
  { value: "dispatched", label: "已发运" },
  { value: "delivered", label: "已送达" },
];

const firstCatalogItem = PRODUCT_CATALOG[0];
const productNames = Array.from(
  new Set(PRODUCT_CATALOG.map((item) => item.productName)),
).sort((left, right) => left.localeCompare(right, "en"));

function newDraftItem(key = "line-1"): DraftItem {
  return {
    key,
    sku: firstCatalogItem.sku,
    productName: firstCatalogItem.productName,
    quantityUnits: "1",
  };
}

const emptyDraft = () => ({
  reference: "",
  occurredAt: new Date().toISOString().slice(0, 10),
  destination: "United States" as Market,
  service: "catalogue" as Service,
  items: [newDraftItem()],
  deductionUsd: "0",
  status: "confirmed" as Status,
  isPublished: true,
});

function usdToCents(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

export default function AdminOrdersPage() {
  const [adminKey, setAdminKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [orders, setOrders] = useState<ManualOrder[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = window.sessionStorage.getItem(SESSION_KEY);
    if (!stored) return;
    // Both admin workspaces share this one tab-scoped sign-in. Returning from
    // generator controls therefore opens the real-order workspace directly.
    void Promise.resolve().then(async () => {
      setAdminKey(stored);
      setBusy(true);
      try {
        await adminRequest("GET", undefined, stored);
        setAuthenticated(true);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "验证失败。");
      } finally {
        setBusy(false);
      }
    });
    // adminRequest is intentionally a component-local transport helper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publishedCount = useMemo(
    () => orders.filter((order) => Boolean(order.isPublished)).length,
    [orders],
  );
  const selectedDraftProducts = useMemo(
    () =>
      draft.items.map(
        (draftItem) =>
          PRODUCT_CATALOG.find(
            (catalogItem) =>
              catalogItem.sku === draftItem.sku &&
              catalogItem.productName === draftItem.productName,
          ) ?? firstCatalogItem,
      ),
    [draft.items],
  );
  const draftPricing = useMemo(
    () =>
      calculateMultiItemOrderPricing({
        items: selectedDraftProducts.map((item, index) => ({
          sku: item.sku,
          productName: item.productName,
          specification: item.specification,
          retailUnitPriceUsdCents: item.retailUsdCents,
          quantityUnits: Number(draft.items[index]?.quantityUnits) || 1,
        })),
        service: draft.service,
        deductionUsdCents: usdToCents(draft.deductionUsd),
      }),
    [
      draft.deductionUsd,
      draft.items,
      draft.service,
      selectedDraftProducts,
    ],
  );

  async function adminRequest(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    body?: unknown,
    key = adminKey,
  ) {
    const response = await fetch("/api/admin/orders", {
      method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = (await response.json()) as OrderResponse;
    if (!response.ok) {
      if (response.status === 401) {
        setAuthenticated(false);
        window.sessionStorage.removeItem(SESSION_KEY);
      }
      throw new Error(result.error ?? "操作失败，请重试。");
    }
    setOrders(
      (result.orders ?? []).map((order) => ({
        ...order,
        isPublished: Boolean(order.isPublished),
      })),
    );
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await adminRequest("GET", undefined, adminKey);
      window.sessionStorage.setItem(SESSION_KEY, adminKey);
      setAuthenticated(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "验证失败。");
    } finally {
      setBusy(false);
    }
  }

  async function createOrder(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await adminRequest("POST", {
        ...draft,
        items: selectedDraftProducts.map((item, index) => ({
          sku: item.sku,
          productName: item.productName,
          specification: item.specification,
          quantityUnits: Number(draft.items[index]?.quantityUnits),
        })),
        deductionUsdCents: usdToCents(draft.deductionUsd),
      });
      setDraft(emptyDraft());
      setMessage("真实订单已保存，并已按照公开状态加入近期履约页面。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "订单保存失败。");
    } finally {
      setBusy(false);
    }
  }

  function updateDraftItem(key: string, changes: Partial<DraftItem>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.key === key ? { ...item, ...changes } : item,
      ),
    }));
  }

  function addDraftItem() {
    setDraft((current) => ({
      ...current,
      items: [
        ...current.items,
        newDraftItem(`line-${Date.now()}-${current.items.length + 1}`),
      ],
    }));
  }

  function removeDraftItem(key: string) {
    setDraft((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? current.items
          : current.items.filter((item) => item.key !== key),
    }));
  }

  function updateLocalOrder(id: number, changes: Partial<ManualOrder>) {
    setOrders((current) =>
      current.map((order) =>
        order.id === id ? { ...order, ...changes } : order,
      ),
    );
  }

  async function saveOrder(order: ManualOrder, nextStatus?: Status) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await adminRequest("PATCH", {
        ...order,
        status: nextStatus ?? order.status,
        isPublished: Boolean(order.isPublished),
      });
      setMessage(`${order.reference} 已实时更新。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "订单更新失败。");
    } finally {
      setBusy(false);
    }
  }

  function advanceOrder(order: ManualOrder) {
    const currentIndex = statuses.findIndex(
      (option) => option.value === order.status,
    );
    const next = statuses[Math.min(currentIndex + 1, statuses.length - 1)];
    if (next.value === order.status) {
      setMessage(`${order.reference} 已经是最终状态。`);
      return;
    }
    updateLocalOrder(order.id, { status: next.value });
    void saveOrder(order, next.value);
  }

  async function deleteOrder(order: ManualOrder) {
    const confirmed = window.confirm(
      `确定永久删除订单 ${order.reference} 吗？\n\n删除后无法恢复，并会立即从公开履约页面移除。`,
    );
    if (!confirmed) return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      await adminRequest("DELETE", { id: order.id });
      setMessage(`${order.reference} 已永久删除。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "订单删除失败。");
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    window.sessionStorage.removeItem(SESSION_KEY);
    setAdminKey("");
    setAuthenticated(false);
    setOrders([]);
  }

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

  return (
    <main className="admin-orders-page">
      <header className="admin-orders-header">
        <div className="admin-brand">
          <img src="/logo-mark.svg" alt="" width={44} height={44} />
          <span>
            <strong>{siteConfig.brandName}</strong>
            <small>Unified Fulfillment Admin</small>
          </span>
        </div>
        <nav className="admin-console-tabs" aria-label="后台功能切换">
          <Link href="/admin/workspace">控制台</Link>
          <Link href="/admin/orders" aria-current="page">真实订单</Link>
          <Link href="/admin/generator">模拟订单</Link>
          <Link href="/fulfillment" target="_blank">查看公开页</Link>
          <button type="button" onClick={signOut}>退出后台</button>
        </nav>
      </header>

      <section className="admin-orders-shell">
        <div className="admin-orders-intro">
          <div>
            <p className="section-tag">REAL ORDER WORKFLOW</p>
            <h1>真实订单管理</h1>
            <p>
              新增订单后可按与模拟订单相同的履约阶段手动推进。取消公开只会隐藏记录，不会删除数据。
            </p>
          </div>
          <dl>
            <div><dt>{orders.length}</dt><dd>真实订单</dd></div>
            <div><dt>{publishedCount}</dt><dd>公开展示</dd></div>
          </dl>
        </div>

        {(message || error) && (
          <div className={error ? "admin-alert is-error" : "admin-alert"}>
            {error || message}
          </div>
        )}

        <section className="admin-create-panel">
          <div>
            <p className="section-tag">ADD ORDER</p>
            <h2>登记一个真实订单</h2>
          </div>
          <form onSubmit={createOrder}>
            <label>
              <span>订单日期</span>
              <input
                type="date"
                value={draft.occurredAt}
                onChange={(event) =>
                  setDraft({ ...draft, occurredAt: event.target.value })
                }
                required
              />
            </label>
            <label>
              <span>目的国家</span>
              <select
                value={draft.destination}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    destination: event.target.value as Market,
                  })
                }
              >
                {markets.map((market) => (
                  <option value={market.value} key={market.value}>
                    {market.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>服务类型</span>
              <select
                value={draft.service}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    service: event.target.value as Service,
                  })
                }
              >
                {services.map((service) => (
                  <option value={service.value} key={service.value}>
                    {service.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>订单编号（可留空）</span>
              <input
                value={draft.reference}
                onChange={(event) =>
                  setDraft({ ...draft, reference: event.target.value })
                }
                placeholder="系统自动生成"
              />
            </label>
            <fieldset className="admin-product-lines">
              <legend>
                <span>订单产品与规格</span>
                <small>同一个订单可以加入多个产品，价格自动同步报价表。</small>
              </legend>
              {draft.items.map((draftItem, index) => {
                const variants = PRODUCT_CATALOG.filter(
                  (item) => item.productName === draftItem.productName,
                );
                const selected = selectedDraftProducts[index];
                return (
                  <div className="admin-product-line" key={draftItem.key}>
                    <span className="admin-product-line-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <label>
                      <span>产品名称</span>
                      <select
                        value={draftItem.productName}
                        onChange={(event) => {
                          const productName = event.target.value;
                          const firstVariant = PRODUCT_CATALOG.find(
                            (item) => item.productName === productName,
                          );
                          if (firstVariant) {
                            updateDraftItem(draftItem.key, {
                              productName,
                              sku: firstVariant.sku,
                            });
                          }
                        }}
                      >
                        {productNames.map((productName) => {
                          const item = PRODUCT_CATALOG.find(
                            (entry) => entry.productName === productName,
                          );
                          return (
                            <option value={productName} key={productName}>
                              {productName}
                              {item
                                ? ` · ${PRODUCT_CATEGORY_LABELS[item.category]}`
                                : ""}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                    <label>
                      <span>报价单规格与零售价</span>
                      <select
                        value={selected.sku}
                        onChange={(event) =>
                          updateDraftItem(draftItem.key, {
                            sku: event.target.value,
                          })
                        }
                      >
                        {variants.map((item) => (
                          <option
                            value={item.sku}
                            key={`${item.sku}-${item.specification}`}
                          >
                            {item.specification} · {item.sku} ·{" "}
                            {usdFormatter.format(item.retailUsdCents / 100)}/盒
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>数量（盒，每盒10瓶）</span>
                      <input
                        type="number"
                        min="1"
                        max="100000"
                        step="1"
                        value={draftItem.quantityUnits}
                        onChange={(event) =>
                          updateDraftItem(draftItem.key, {
                            quantityUnits: event.target.value,
                          })
                        }
                        required
                      />
                    </label>
                    <button
                      type="button"
                      className="admin-remove-product"
                      onClick={() => removeDraftItem(draftItem.key)}
                      disabled={draft.items.length === 1}
                      aria-label={`删除第 ${index + 1} 个产品`}
                    >
                      删除
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                className="admin-add-product"
                onClick={addDraftItem}
                disabled={draft.items.length >= 20}
              >
                ＋ 添加另一个产品
              </button>
            </fieldset>
            <label>
              <span>额外减免（USD，可选）</span>
              <input
                type="number"
                min="0"
                max="10000000"
                step="0.01"
                value={draft.deductionUsd}
                onChange={(event) =>
                  setDraft({ ...draft, deductionUsd: event.target.value })
                }
              />
            </label>
            <label>
              <span>当前状态</span>
              <select
                value={draft.status}
                onChange={(event) =>
                  setDraft({ ...draft, status: event.target.value as Status })
                }
              >
                {statuses.map((status) => (
                  <option value={status.value} key={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="admin-pricing-preview">
              <div>
                <span>零售价小计</span>
                <strong>
                  {usdFormatter.format(
                    draftPricing.retailSubtotalUsdCents / 100,
                  )}
                </strong>
              </div>
              <div>
                <span>数量阶梯折扣</span>
                <strong>{(draftPricing.discountBps / 100).toFixed(0)}%</strong>
              </div>
              <div>
                <span>订单规模</span>
                <strong>
                  {orderProfileForQuantity(draftPricing.quantityUnits)}
                </strong>
              </div>
              <div className="is-total">
                <span>自动计算总额</span>
                <strong>
                  {usdFormatter.format(draftPricing.amountUsdCents / 100)}
                </strong>
              </div>
              <small>
                此处仅计算报价表产品金额、总盒数阶梯折扣与额外减免，其他费用不计入订单展示。
              </small>
            </div>
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={draft.isPublished}
                onChange={(event) =>
                  setDraft({ ...draft, isPublished: event.target.checked })
                }
              />
              <span>立即在近期履约页面公开</span>
            </label>
            <button className="admin-primary" type="submit" disabled={busy}>
              {busy ? "正在保存…" : "保存真实订单"}
            </button>
          </form>
        </section>

        <section className="admin-order-list">
          <div className="admin-list-heading">
            <div>
              <p className="section-tag">MANUAL RECORDS</p>
              <h2>已登记真实订单</h2>
            </div>
            <button type="button" onClick={() => void adminRequest("GET")} disabled={busy}>
              刷新列表
            </button>
          </div>

          {orders.length === 0 ? (
            <p className="admin-empty">暂时没有真实订单。</p>
          ) : (
            <div className="admin-order-cards">
              {orders.map((order) => (
                <article key={order.id}>
                  <header>
                    <div>
                      <code>{order.reference}</code>
                      <h3>
                        {order.items.length > 1
                          ? `${order.items.length} 个产品`
                          : order.items[0]?.productName ?? order.productName}
                      </h3>
                      <div className="admin-order-item-summary">
                        {order.items.map((item) => (
                          <p key={`${order.id}-${item.sku}-${item.specification}`}>
                            <strong>{item.productName}</strong> · {item.specification} ·{" "}
                            {item.quantityUnits.toLocaleString()} 盒 · SKU {item.sku}
                          </p>
                        ))}
                      </div>
                    </div>
                    <strong>{usdFormatter.format(order.amountUsdCents / 100)}</strong>
                  </header>
                  <dl>
                    <div><dt>订单日期</dt><dd>{order.occurredAt}</dd></div>
                    <div>
                      <dt>目的地</dt>
                      <dd>{markets.find((item) => item.value === order.destination)?.label}</dd>
                    </div>
                    <div>
                      <dt>数量与规模</dt>
                      <dd>{order.quantityUnits.toLocaleString()} 盒 · {order.orderProfile}</dd>
                    </div>
                    <div>
                      <dt>报价单零售价</dt>
                      <dd>{usdFormatter.format(order.retailUnitPriceUsdCents / 100)}/盒</dd>
                    </div>
                    <div>
                      <dt>数量折扣</dt>
                      <dd>{(order.discountBps / 100).toFixed(0)}%</dd>
                    </div>
                    {order.deductionUsdCents > 0 && (
                      <div>
                        <dt>额外减免</dt>
                        <dd>
                          {usdFormatter.format(order.deductionUsdCents / 100)}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt>公开状态</dt>
                      <dd>{order.isPublished ? "公开展示" : "后台保留"}</dd>
                    </div>
                  </dl>
                  <div className="admin-order-controls">
                    <label>
                      <span>履约阶段</span>
                      <select
                        value={order.status}
                        onChange={(event) =>
                          updateLocalOrder(order.id, {
                            status: event.target.value as Status,
                          })
                        }
                      >
                        {statuses.map((status) => (
                          <option value={status.value} key={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="admin-checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean(order.isPublished)}
                        onChange={(event) =>
                          updateLocalOrder(order.id, {
                            isPublished: event.target.checked,
                          })
                        }
                      />
                      <span>公开展示</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => void saveOrder(order)}
                      disabled={busy}
                    >
                      保存修改
                    </button>
                    <button
                      className="admin-advance"
                      type="button"
                      onClick={() => advanceOrder(order)}
                      disabled={busy || order.status === "delivered"}
                    >
                      推进下一阶段
                    </button>
                    <button
                      className="admin-delete"
                      type="button"
                      onClick={() => void deleteOrder(order)}
                      disabled={busy}
                    >
                      删除订单
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
