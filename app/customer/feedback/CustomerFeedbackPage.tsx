"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { siteConfig } from "../../../site.config";

type AccountPayload = {
  account?: {
    username: string;
    display_name: string;
    company_name: string;
    country_code: string;
    locale: string;
    status: string;
    profile_version: number;
  };
  orders?: Array<{
    id: number;
    reference: string;
    occurred_at: string;
    destination: string;
    service: string;
    status: string;
    product_name: string;
    specification: string;
    feedback_status: string | null;
    feedback_text: string | null;
  }>;
  error?: string;
};

export default function CustomerFeedbackPage() {
  const [data, setData] = useState<AccountPayload | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/customer/profile", { cache: "no-store" });
    if (response.status === 401) {
      window.location.assign("/customer/access");
      return;
    }
    const payload = (await response.json()) as AccountPayload;
    if (!response.ok) throw new Error(payload.error ?? "Unable to load the account.");
    setData(payload);
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load the account."));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function postJson(url: string, body: unknown, method = "POST") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Please try again.");
      setMessage("Saved successfully.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function linkOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await postJson("/api/customer/orders/link", { reference: form.get("reference"), code: form.get("code") });
    event.currentTarget.reset();
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await postJson("/api/customer/profile", { displayName: form.get("displayName"), companyName: form.get("companyName"), countryCode: form.get("countryCode"), locale: form.get("locale") }, "PATCH");
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>, reference: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await postJson("/api/customer/feedback", { reference, text: form.get("text"), locale: data?.account?.locale ?? "en" });
  }

  async function signOut() {
    await fetch("/api/customer/auth/logout", { method: "POST" });
    window.location.assign("/customer/access");
  }

  if (!data?.account) {
    return <main className="customer-portal-page"><p className="customer-loading">{error || "Loading customer area…"}</p></main>;
  }

  return (
    <main className="customer-portal-page">
      <header className="customer-simple-header">
        <Link className="brand" href="/"><img src="/logo-mark.svg" alt="" width={44} height={44} /><span><strong>{siteConfig.brandName}</strong><small>Customer Area</small></span></Link>
        <div><Link href="/feedback">Public feedback</Link><button type="button" onClick={() => void signOut()}>Sign out</button></div>
      </header>
      <section className="customer-portal-shell">
        <div className="customer-portal-heading"><p className="section-tag">ACCOUNT</p><h1>Welcome, {data.account.display_name || data.account.username}.</h1><p>Link delivered orders, submit service feedback, and keep your company profile current.</p></div>
        {(message || error) && <p className={error ? "customer-notice is-error" : "customer-notice"}>{error || message}</p>}
        <div className="customer-portal-grid">
          <section className="customer-panel">
            <p className="section-tag">LINK AN ORDER</p><h2>Use your one-time binding code</h2>
            <form onSubmit={linkOrder}><label><span>Order reference</span><input name="reference" required /></label><label><span>Binding code</span><input name="code" required /></label><button type="submit" disabled={busy}>Link order</button></form>
          </section>
          <section className="customer-panel">
            <p className="section-tag">PROFILE</p><h2>Account information</h2>
            <form onSubmit={updateProfile}><label><span>Display name</span><input name="displayName" defaultValue={data.account.display_name} /></label><label><span>Company</span><input name="companyName" defaultValue={data.account.company_name} /></label><div className="customer-form-row"><label><span>Country</span><select name="countryCode" defaultValue={data.account.country_code}><option value="US">United States</option><option value="CA">Canada</option><option value="BR">Brazil</option><option value="MX">Mexico</option></select></label><label><span>Language</span><select name="locale" defaultValue={data.account.locale}><option value="en">English</option><option value="pt">Português</option><option value="es">Español</option><option value="fr">Français</option><option value="zh">中文</option></select></label></div><button type="submit" disabled={busy}>Save profile</button></form>
          </section>
        </div>
        <section className="customer-orders-panel">
          <div><p className="section-tag">LINKED ORDERS</p><h2>Feedback workspace</h2></div>
          {!data.orders?.length ? <p className="customer-empty">No order is linked yet.</p> : <div className="customer-order-list">{data.orders.map((order) => <article key={order.reference}><header><div><code>{order.reference}</code><h3>{order.product_name}</h3><p>{order.specification} · {order.destination}</p></div><span>{order.status}</span></header>{order.status === "delivered" ? <form onSubmit={(event) => void submitFeedback(event, order.reference)}><label><span>Service feedback</span><textarea name="text" minLength={20} maxLength={1200} defaultValue={order.feedback_text ?? ""} placeholder="Share feedback about communication, documents, packaging, order accuracy, or fulfillment updates." required /></label><small>Medical, dosing, and efficacy claims are not published. Every customer submission is reviewed.</small><button type="submit" disabled={busy}>{order.feedback_status ? "Resubmit for review" : "Submit for review"}</button>{order.feedback_status && <b>Current status: {order.feedback_status}</b>}</form> : <p className="customer-order-wait">Feedback opens when this order is marked delivered.</p>}</article>)}</div>}
        </section>
      </section>
    </main>
  );
}
