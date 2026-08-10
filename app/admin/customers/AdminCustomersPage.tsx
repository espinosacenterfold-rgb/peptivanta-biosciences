"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminHeader, AdminLogin, AdminPage, AdminSessionChecking } from "../_components/AdminChrome";
import { downloadAdminCsv } from "../_components/admin-export";
import { useAdminSession } from "../_components/useAdminSession";

type CustomerRow = {
  id: number;
  public_id: string;
  username: string;
  password_plaintext: string;
  display_name: string;
  company_name: string;
  country_code: string;
  locale: string;
  status: string;
  profile_version: number;
  created_at: string;
  last_login_at: string | null;
  linked_orders: number;
  feedback_count: number;
};
type AvailableOrder = { reference: string; occurred_at: string; destination: string; status: string };
type ProfileEvent = { id: number; username: string; actor: string; before_json: string; after_json: string; created_at: string };
type CustomerPayload = { customers: CustomerRow[]; availableOrders: AvailableOrder[]; profileEvents: ProfileEvent[] };

const statusLabels: Record<string, string> = {
  active: "正常 · 已绑定",
  active_unlinked: "正常 · 未绑定",
  suspended: "已暂停",
};

export default function AdminCustomersPage() {
  const auth = useAdminSession();
  const [data, setData] = useState<CustomerPayload | null>(null);
  const [message, setMessage] = useState("");
  const [issuedCode, setIssuedCode] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [visiblePasswords, setVisiblePasswords] = useState<Set<number>>(new Set());

  function togglePassword(id: number) {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function load() {
    setData(await auth.request<CustomerPayload>("/api/admin/customers"));
  }

  useEffect(() => {
    if (!auth.authenticated) return;
    const frame = window.requestAnimationFrame(() => {
      void load().catch((caught) => auth.setError(caught instanceof Error ? caught.message : "加载失败。"));
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.authenticated]);

  const visibleCustomers = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return [...(data?.customers ?? [])]
      .filter((customer) => {
        const searchable = [customer.public_id, customer.username, customer.display_name, customer.company_name, customer.country_code].join(" ").toLocaleLowerCase();
        return (!needle || searchable.includes(needle)) && (statusFilter === "all" || customer.status === statusFilter);
      })
      .sort((left, right) => {
        if (sortBy === "name") return (left.display_name || left.username).localeCompare(right.display_name || right.username, "zh-CN");
        if (sortBy === "orders") return Number(right.linked_orders) - Number(left.linked_orders);
        if (sortBy === "login") return String(right.last_login_at ?? "").localeCompare(String(left.last_login_at ?? ""));
        return String(right.created_at).localeCompare(String(left.created_at));
      });
  }, [data?.customers, query, sortBy, statusFilter]);

  async function createCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    auth.setBusy(true);
    auth.setError("");
    setIssuedCode("");
    try {
      const result = await auth.request<{ code: string; orderReference: string; expiresAt: string }>("/api/admin/customers", {
        method: "POST",
        body: JSON.stringify({ action: "create_order_code", orderReference: form.get("orderReference") }),
      });
      setIssuedCode(`${result.orderReference} · ${result.code}`);
      setMessage(`绑定码有效至 ${new Date(result.expiresAt).toLocaleDateString("zh-CN")}，只在本页显示。`);
      await load();
    } catch (caught) {
      auth.setError(caught instanceof Error ? caught.message : "生成失败。");
    } finally {
      auth.setBusy(false);
    }
  }

  async function update(customerId: number, action: string) {
    auth.setBusy(true);
    auth.setError("");
    try {
      setData(await auth.request<CustomerPayload>("/api/admin/customers", { method: "PATCH", body: JSON.stringify({ customerId, action }) }));
      setMessage("客户状态已更新。");
    } catch (caught) {
      auth.setError(caught instanceof Error ? caught.message : "操作失败。");
    } finally {
      auth.setBusy(false);
    }
  }

  function exportCustomers() {
    downloadAdminCsv(`peptivanta-customers-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["客户编号", "用户名", "密码", "显示名称", "公司", "国家", "语言", "状态", "关联订单", "反馈数", "注册时间", "最后登录"],
      ...visibleCustomers.map((customer) => [customer.public_id, customer.username, customer.password_plaintext, customer.display_name, customer.company_name, customer.country_code, customer.locale, statusLabels[customer.status] ?? customer.status, customer.linked_orders, customer.feedback_count, customer.created_at, customer.last_login_at]),
    ]);
  }

  if (auth.checking) return <AdminSessionChecking />;
  if (!auth.authenticated) return <AdminLogin {...auth} />;

  const activeCount = data?.customers.filter((customer) => customer.status !== "suspended").length ?? 0;
  const unlinkedCount = data?.customers.filter((customer) => customer.status === "active_unlinked").length ?? 0;

  return (
    <AdminPage className="admin-customers-page">
      <style>{`.admin-password-field button { margin-left: 8px; font-size: 0.8em; } .admin-password-field { display: flex; align-items: center; gap: 4px; }`}</style>
      <AdminHeader current="客户账号" signOut={auth.signOut} />
      <section className="admin-orders-shell">
        <div className="admin-orders-intro">
          <div><p className="section-tag">CUSTOMER ACCOUNTS</p><h1>客户管理</h1><p>检索客户、关联真实订单、控制登录状态并查看资料修改记录。</p></div>
          <dl><div><dt>{activeCount}</dt><dd>有效客户</dd></div><div><dt>{unlinkedCount}</dt><dd>尚未绑定</dd></div></dl>
        </div>

        {(message || auth.error) && <div className={auth.error ? "admin-alert is-error" : "admin-alert"}>{auth.error || message}</div>}

        <section className="admin-create-panel">
          <div><p className="section-tag">ORDER LINK CODE</p><h2>生成一次性绑定码</h2><p>选择尚未关联客户的真实订单，绑定码有效期为 30 天。</p></div>
          <form onSubmit={createCode}>
            <label><span>尚未绑定的真实订单</span><select name="orderReference" required>{data?.availableOrders.map((order) => <option value={order.reference} key={order.reference}>{order.reference} · {order.destination} · {order.occurred_at}</option>)}</select></label>
            <button className="admin-primary" type="submit" disabled={auth.busy || !data?.availableOrders.length}>生成绑定码</button>
            {issuedCode && <div className="admin-issued-code"><small>一次性显示</small><code>{issuedCode}</code><button type="button" onClick={() => void navigator.clipboard.writeText(issuedCode)}>复制绑定信息</button></div>}
          </form>
        </section>

        <section className="admin-order-list">
          <div className="admin-list-heading">
            <div><p className="section-tag">ACCOUNT REVIEW</p><h2>客户账号</h2></div>
            <div className="admin-heading-actions"><button type="button" onClick={exportCustomers} disabled={!visibleCustomers.length}>导出当前结果</button><button type="button" onClick={() => void load()} disabled={auth.busy}>刷新</button></div>
          </div>
          <div className="admin-data-toolbar admin-customer-toolbar">
            <label className="admin-search-control"><span>搜索客户</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="用户名、公司、国家或客户编号" /></label>
            <label><span>账号状态</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">全部状态</option><option value="active">正常 · 已绑定</option><option value="active_unlinked">正常 · 未绑定</option><option value="suspended">已暂停</option></select></label>
            <label><span>排序方式</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="newest">最近注册</option><option value="login">最近登录</option><option value="orders">关联订单最多</option><option value="name">名称排序</option></select></label>
          </div>
          <div className="admin-result-summary"><p>显示 <b>{visibleCustomers.length}</b> / {data?.customers.length ?? 0} 个客户</p>{(query || statusFilter !== "all") && <button type="button" onClick={() => { setQuery(""); setStatusFilter("all"); }}>清除筛选</button>}</div>

          <div className="admin-customer-list">
            {visibleCustomers.map((customer) => (
              <article key={customer.id}>
                <header><div><code>{customer.public_id}</code><h3>{customer.display_name || customer.username}</h3><p>{customer.company_name || "未填写公司"} · {customer.country_code || "—"}</p></div><b className={`admin-account-status is-${customer.status}`}>{statusLabels[customer.status] ?? customer.status}</b></header>
                <dl>
                  <div><dt>用户名</dt><dd>{customer.username}</dd></div>
                  <div><dt>密码</dt><dd className="admin-password-field">{visiblePasswords.has(customer.id) && customer.password_plaintext ? customer.password_plaintext : "••••••••"}{customer.password_plaintext && <button type="button" onClick={() => togglePassword(customer.id)}>{visiblePasswords.has(customer.id) ? "隐藏" : "显示"}</button>}</dd></div>
                  <div><dt>关联订单</dt><dd>{customer.linked_orders}</dd></div>
                  <div><dt>反馈</dt><dd>{customer.feedback_count}</dd></div>
                  <div><dt>资料版本</dt><dd>v{customer.profile_version}</dd></div>
                  <div><dt>注册时间</dt><dd>{new Date(customer.created_at).toLocaleDateString("zh-CN")}</dd></div>
                  <div><dt>最后登录</dt><dd>{customer.last_login_at ? new Date(customer.last_login_at).toLocaleString("zh-CN") : "尚未登录"}</dd></div>
                </dl>
                <div className="admin-feedback-controls"><button type="button" onClick={() => void update(customer.id, "revoke_sessions")}>撤销所有登录</button>{customer.status === "suspended" ? <button type="button" onClick={() => void update(customer.id, "activate")}>恢复账号</button> : <button className="admin-delete" type="button" onClick={() => void update(customer.id, "suspend")}>暂停账号</button>}</div>
              </article>
            ))}
            {!visibleCustomers.length && <p className="admin-empty">没有符合当前条件的客户。</p>}
          </div>
        </section>

        <details className="admin-order-list admin-settings-disclosure">
          <summary><div><p className="section-tag">AUDIT TRAIL</p><h2>资料修改留痕</h2><p>需要核对客户资料变化时再展开。</p></div><span>查看记录</span></summary>
          <div className="admin-settings-body admin-audit-list">
            {data?.profileEvents.map((event) => <details key={event.id}><summary>{event.username} · {new Date(event.created_at).toLocaleString("zh-CN")} · {event.actor}</summary><pre>{JSON.stringify({ before: JSON.parse(event.before_json), after: JSON.parse(event.after_json) }, null, 2)}</pre></details>)}
          </div>
        </details>
      </section>
    </AdminPage>
  );
}
