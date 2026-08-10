"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminHeader, AdminLogin, AdminPage, AdminSessionChecking } from "../_components/AdminChrome";
import { downloadAdminCsv } from "../_components/admin-export";
import { useAdminSession } from "../_components/useAdminSession";
import {
  PRODUCT_CATALOG,
  PRODUCT_CATEGORY_LABELS,
} from "../../../lib/product-catalog.ts";
import {
  calculateMultiItemOrderPricing,
  orderProfileForQuantity,
} from "../../../lib/order-pricing.ts";

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
  const auth = useAdminSession();
  const [orders, setOrders] = useState<ManualOrder[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [marketFilter, setMarketFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<Status>("confirmed");

  useEffect(() => {
    if (!auth.authenticated) return;
    const frame = window.requestAnimationFrame(() => {
      void adminRequest("GET").catch((caught) => {
        setError(caught instanceof Error ? caught.message : "订单加载失败。");
      });
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.authenticated]);

  const publishedCount = useMemo(
    () => orders.filter((order) => Boolean(order.isPublished)).length,
    [orders],
  );
  const filteredOrders = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return orders.filter((order) => {
      const searchable = [
        order.reference,
        order.destination,
        order.orderProfile,
        ...order.items.flatMap((item) => [item.productName, item.specification, item.sku]),
      ].join(" ").toLocaleLowerCase();
      return (
        (!needle || searchable.includes(needle)) &&
        (statusFilter === "all" || order.status === statusFilter) &&
        (serviceFilter === "all" || order.service === serviceFilter) &&
        (marketFilter === "all" || order.destination === marketFilter) &&
        (visibilityFilter === "all" ||
          (visibilityFilter === "published" ? Boolean(order.isPublished) : !order.isPublished))
      );
    });
  }, [marketFilter, orders, query, serviceFilter, statusFilter, visibilityFilter]);
  const filteredAmount = useMemo(
    () => filteredOrders.reduce((sum, order) => sum + order.amountUsdCents, 0),
    [filteredOrders],
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
  ) {
    const result = await auth.request<OrderResponse>("/api/admin/orders", {
      method,
      body: body ? JSON.stringify(body) : undefined,
    });
    setOrders(
      (result.orders ?? []).map((order) => ({
        ...order,
        isPublished: Boolean(order.isPublished),
      })),
    );
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

  function toggleSelected(id: number) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function selectVisible() {
    const visibleIds = filteredOrders.map((order) => order.id);
    const everyVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((current) =>
      everyVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    );
  }

  async function updateSelected(action: "bulk_visibility" | "bulk_status", value: boolean | Status) {
    if (!selectedIds.length) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await adminRequest("PATCH", {
        action,
        ids: selectedIds,
        ...(action === "bulk_visibility" ? { isPublished: value } : { status: value }),
      });
      setMessage(`已更新 ${selectedIds.length} 条订单。`);
      setSelectedIds([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "批量更新失败。");
    } finally {
      setBusy(false);
    }
  }

  function exportOrders() {
    downloadAdminCsv(`peptivanta-orders-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["订单编号", "日期", "国家", "服务", "产品组合", "总盒数", "金额USD", "履约阶段", "公开状态"],
      ...filteredOrders.map((order) => [
        order.reference,
        order.occurredAt,
        markets.find((item) => item.value === order.destination)?.label ?? order.destination,
        services.find((item) => item.value === order.service)?.label ?? order.service,
        order.items.map((item) => `${item.productName} ${item.specification} × ${item.quantityUnits}`).join(" | "),
        order.quantityUnits,
        (order.amountUsdCents / 100).toFixed(2),
        statuses.find((item) => item.value === order.status)?.label ?? order.status,
        order.isPublished ? "公开" : "后台保留",
      ]),
    ]);
  }

  if (auth.checking) return <AdminSessionChecking />;
  if (!auth.authenticated) return <AdminLogin {...auth} />;

  return (
    <AdminPage>
      <AdminHeader current="真实订单" signOut={() => { setOrders([]); auth.signOut(); }} />

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

        {(message || error || auth.error) && (
          <div className={error || auth.error ? "admin-alert is-error" : "admin-alert"}>
            {error || auth.error || message}
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
            <div className="admin-heading-actions">
              <button type="button" onClick={exportOrders} disabled={!filteredOrders.length}>导出当前结果</button>
              <button type="button" onClick={() => void adminRequest("GET")} disabled={busy}>刷新列表</button>
            </div>
          </div>

          <div className="admin-data-toolbar">
            <label className="admin-search-control">
              <span>搜索</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="订单号、产品、规格或 SKU" />
            </label>
            <label><span>履约阶段</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">全部阶段</option>{statuses.map((status) => <option value={status.value} key={status.value}>{status.label}</option>)}</select></label>
            <label><span>服务类型</span><select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}><option value="all">全部服务</option>{services.map((service) => <option value={service.value} key={service.value}>{service.label}</option>)}</select></label>
            <label><span>目的国家</span><select value={marketFilter} onChange={(event) => setMarketFilter(event.target.value)}><option value="all">全部市场</option>{markets.map((market) => <option value={market.value} key={market.value}>{market.label}</option>)}</select></label>
            <label><span>公开状态</span><select value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value)}><option value="all">全部状态</option><option value="published">公开展示</option><option value="hidden">后台保留</option></select></label>
          </div>

          <div className="admin-result-summary">
            <button type="button" onClick={selectVisible} disabled={!filteredOrders.length}>
              {filteredOrders.length > 0 && filteredOrders.every((order) => selectedIds.includes(order.id)) ? "取消选择当前结果" : "选择当前结果"}
            </button>
            <p>显示 <b>{filteredOrders.length}</b> / {orders.length} 条 · 合计 <strong>{usdFormatter.format(filteredAmount / 100)}</strong></p>
            {(query || statusFilter !== "all" || serviceFilter !== "all" || marketFilter !== "all" || visibilityFilter !== "all") && (
              <button type="button" onClick={() => { setQuery(""); setStatusFilter("all"); setServiceFilter("all"); setMarketFilter("all"); setVisibilityFilter("all"); }}>清除筛选</button>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="admin-bulk-bar">
              <strong>已选择 {selectedIds.length} 条</strong>
              <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as Status)}>{statuses.map((status) => <option value={status.value} key={status.value}>{status.label}</option>)}</select>
              <button type="button" onClick={() => void updateSelected("bulk_status", bulkStatus)} disabled={busy}>批量更新阶段</button>
              <button type="button" onClick={() => void updateSelected("bulk_visibility", true)} disabled={busy}>批量公开</button>
              <button type="button" onClick={() => void updateSelected("bulk_visibility", false)} disabled={busy}>批量隐藏</button>
              <button type="button" onClick={() => setSelectedIds([])}>取消选择</button>
            </div>
          )}

          {filteredOrders.length === 0 ? (
            <p className="admin-empty">没有符合当前条件的真实订单。</p>
          ) : (
            <div className="admin-order-cards">
              {filteredOrders.map((order) => (
                <article className={selectedIds.includes(order.id) ? "is-selected" : ""} key={order.id}>
                  <header>
                    <div>
                      <label className="admin-card-select"><input type="checkbox" checked={selectedIds.includes(order.id)} onChange={() => toggleSelected(order.id)} /><span>选择订单</span></label>
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
    </AdminPage>
  );
}
