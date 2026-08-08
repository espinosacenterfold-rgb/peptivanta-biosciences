"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  htmlLang,
  isSiteLocale,
  LANGUAGE_OPTIONS,
  LOCALE_STORAGE_KEY,
  type SiteLocale,
} from "../../i18n";
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

const copy: Record<SiteLocale, Record<string, string> & {
  countries: Record<"US" | "CA" | "BR" | "MX", string>;
}> = {
  en: { publicFeedback: "Public feedback", signOut: "Sign out", language: "Language", loading: "Loading customer area…", account: "ACCOUNT", welcome: "Welcome", heading: "Link delivered orders, submit service feedback, and keep your company profile current.", saved: "Saved successfully.", retry: "Please try again.", linkTag: "LINK AN ORDER", linkTitle: "Use your one-time binding code", reference: "Order reference", code: "Binding code", linkButton: "Link order", profileTag: "PROFILE", profileTitle: "Account information", displayName: "Display name", company: "Company", country: "Country", accountLanguage: "Account language", saveProfile: "Save profile", ordersTag: "LINKED ORDERS", ordersTitle: "Feedback workspace", noOrders: "No order is linked yet.", serviceFeedback: "Service feedback", placeholder: "Share feedback about communication, documents, packaging, order accuracy, or fulfillment updates.", moderation: "Medical, dosing, and efficacy claims are not published. Every customer submission is reviewed.", resubmit: "Resubmit for review", submit: "Submit for review", currentStatus: "Current status", waitDelivery: "Feedback opens when this order is marked delivered.", countries: { US: "United States", CA: "Canada", BR: "Brazil", MX: "Mexico" } },
  pt: { publicFeedback: "Avaliações públicas", signOut: "Sair", language: "Idioma", loading: "Carregando a área do cliente…", account: "CONTA", welcome: "Olá", heading: "Vincule pedidos entregues, envie avaliações de serviço e mantenha os dados da empresa atualizados.", saved: "Salvo com sucesso.", retry: "Tente novamente.", linkTag: "VINCULAR PEDIDO", linkTitle: "Use o código único de vinculação", reference: "Referência do pedido", code: "Código de vinculação", linkButton: "Vincular pedido", profileTag: "PERFIL", profileTitle: "Informações da conta", displayName: "Nome de exibição", company: "Empresa", country: "País", accountLanguage: "Idioma da conta", saveProfile: "Salvar perfil", ordersTag: "PEDIDOS VINCULADOS", ordersTitle: "Área de avaliações", noOrders: "Nenhum pedido foi vinculado.", serviceFeedback: "Avaliação do serviço", placeholder: "Comente sobre comunicação, documentos, embalagem, precisão do pedido ou atualizações de entrega.", moderation: "Não publicamos alegações médicas, de dosagem ou eficácia. Toda avaliação é revisada.", resubmit: "Reenviar para revisão", submit: "Enviar para revisão", currentStatus: "Status atual", waitDelivery: "A avaliação ficará disponível quando o pedido for marcado como entregue.", countries: { US: "Estados Unidos", CA: "Canadá", BR: "Brasil", MX: "México" } },
  es: { publicFeedback: "Comentarios públicos", signOut: "Salir", language: "Idioma", loading: "Cargando el área de clientes…", account: "CUENTA", welcome: "Bienvenido", heading: "Vincule pedidos entregados, envíe comentarios de servicio y mantenga actualizado el perfil de su empresa.", saved: "Guardado correctamente.", retry: "Inténtelo de nuevo.", linkTag: "VINCULAR UN PEDIDO", linkTitle: "Use su código único de vinculación", reference: "Referencia del pedido", code: "Código de vinculación", linkButton: "Vincular pedido", profileTag: "PERFIL", profileTitle: "Información de la cuenta", displayName: "Nombre visible", company: "Empresa", country: "País", accountLanguage: "Idioma de la cuenta", saveProfile: "Guardar perfil", ordersTag: "PEDIDOS VINCULADOS", ordersTitle: "Área de comentarios", noOrders: "Aún no hay pedidos vinculados.", serviceFeedback: "Comentarios del servicio", placeholder: "Comente sobre comunicación, documentos, embalaje, exactitud del pedido o actualizaciones de entrega.", moderation: "No se publican afirmaciones médicas, de dosificación o eficacia. Cada envío se revisa.", resubmit: "Reenviar para revisión", submit: "Enviar para revisión", currentStatus: "Estado actual", waitDelivery: "Los comentarios se habilitan cuando el pedido se marca como entregado.", countries: { US: "Estados Unidos", CA: "Canadá", BR: "Brasil", MX: "México" } },
  fr: { publicFeedback: "Avis publics", signOut: "Déconnexion", language: "Langue", loading: "Chargement de l’espace client…", account: "COMPTE", welcome: "Bienvenue", heading: "Associez les commandes livrées, envoyez un avis de service et tenez à jour le profil de votre entreprise.", saved: "Enregistré avec succès.", retry: "Veuillez réessayer.", linkTag: "ASSOCIER UNE COMMANDE", linkTitle: "Utilisez votre code d’association unique", reference: "Référence de commande", code: "Code d’association", linkButton: "Associer la commande", profileTag: "PROFIL", profileTitle: "Informations du compte", displayName: "Nom affiché", company: "Entreprise", country: "Pays", accountLanguage: "Langue du compte", saveProfile: "Enregistrer le profil", ordersTag: "COMMANDES ASSOCIÉES", ordersTitle: "Espace d’avis", noOrders: "Aucune commande n’est encore associée.", serviceFeedback: "Avis sur le service", placeholder: "Partagez votre avis sur la communication, les documents, l’emballage, l’exactitude de la commande ou le suivi.", moderation: "Aucune allégation médicale, de dosage ou d’efficacité n’est publiée. Chaque avis est vérifié.", resubmit: "Renvoyer pour examen", submit: "Envoyer pour examen", currentStatus: "Statut actuel", waitDelivery: "L’avis sera disponible lorsque la commande sera marquée comme livrée.", countries: { US: "États-Unis", CA: "Canada", BR: "Brésil", MX: "Mexique" } },
  zh: { publicFeedback: "公开反馈", signOut: "退出", language: "语言", loading: "正在加载客户中心…", account: "客户账号", welcome: "欢迎", heading: "关联已交付订单、提交服务反馈，并维护你的公司资料。", saved: "已保存。", retry: "请重试。", linkTag: "关联订单", linkTitle: "使用一次性订单绑定码", reference: "订单编号", code: "绑定码", linkButton: "关联订单", profileTag: "账号资料", profileTitle: "账号信息", displayName: "显示名称", company: "公司", country: "国家", accountLanguage: "账号语言", saveProfile: "保存资料", ordersTag: "已关联订单", ordersTitle: "反馈工作区", noOrders: "尚未关联订单。", serviceFeedback: "服务反馈", placeholder: "可评价沟通、文件、包装、订单准确性或履约进度。", moderation: "不公开医疗、剂量和功效相关表述。每条客户反馈都需要人工审核。", resubmit: "重新提交审核", submit: "提交审核", currentStatus: "当前状态", waitDelivery: "订单标记为已交付后即可提交反馈。", countries: { US: "美国", CA: "加拿大", BR: "巴西", MX: "墨西哥" } },
};

export default function CustomerFeedbackPage() {
  const [data, setData] = useState<AccountPayload | null>(null);
  const [locale, setLocale] = useState<SiteLocale>("en");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const t = copy[locale];

  async function load() {
    const response = await fetch("/api/customer/profile", { cache: "no-store" });
    if (response.status === 401) {
      window.location.assign("/customer/access");
      return;
    }
    const payload = (await response.json()) as AccountPayload;
    if (!response.ok) throw new Error(payload.error ?? t.retry);
    setData(payload);
    if (isSiteLocale(payload.account?.locale ?? null)) setLocale(payload.account!.locale as SiteLocale);
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isSiteLocale(stored)) setLocale(stored);
      void load().catch((caught) => setError(caught instanceof Error ? caught.message : copy.en.retry));
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = htmlLang(locale);
  }, [locale]);

  async function postJson(url: string, body: unknown, method = "POST") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? t.retry);
      setMessage(t.saved);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.retry);
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
    await postJson("/api/customer/profile", { displayName: form.get("displayName"), companyName: form.get("companyName"), countryCode: form.get("countryCode"), locale }, "PATCH");
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>, reference: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await postJson("/api/customer/feedback", { reference, text: form.get("text"), locale });
  }

  async function signOut() {
    await fetch("/api/customer/auth/logout", { method: "POST" });
    window.location.assign("/customer/access");
  }

  if (!data?.account) {
    return <main className="customer-portal-page"><p className="customer-loading">{error || t.loading}</p></main>;
  }

  const name = data.account.display_name || data.account.username;
  return (
    <main className="customer-portal-page">
      <header className="customer-simple-header">
        <Link className="brand" href="/"><img src="/logo-mark.svg" alt="" width={44} height={44} /><span><strong>{siteConfig.brandName}</strong><small>Customer Area</small></span></Link>
        <div className="customer-header-actions">
          <label className="customer-language-switcher"><span>{t.language}</span><select value={locale} onChange={(event) => setLocale(event.target.value as SiteLocale)} aria-label={t.language}>{LANGUAGE_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label>
          <Link href="/feedback">{t.publicFeedback}</Link><button type="button" onClick={() => void signOut()}>{t.signOut}</button>
        </div>
      </header>
      <section className="customer-portal-shell">
        <div className="customer-portal-heading"><p className="section-tag">{t.account}</p><h1>{t.welcome}, {name}.</h1><p>{t.heading}</p></div>
        {(message || error) && <p className={error ? "customer-notice is-error" : "customer-notice"}>{error || message}</p>}
        <div className="customer-portal-grid">
          <section className="customer-panel">
            <p className="section-tag">{t.linkTag}</p><h2>{t.linkTitle}</h2>
            <form onSubmit={linkOrder}><label><span>{t.reference}</span><input name="reference" required /></label><label><span>{t.code}</span><input name="code" required /></label><button type="submit" disabled={busy}>{t.linkButton}</button></form>
          </section>
          <section className="customer-panel">
            <p className="section-tag">{t.profileTag}</p><h2>{t.profileTitle}</h2>
            <form onSubmit={updateProfile}><label><span>{t.displayName}</span><input name="displayName" defaultValue={data.account.display_name} /></label><label><span>{t.company}</span><input name="companyName" defaultValue={data.account.company_name} /></label><div className="customer-form-row"><label><span>{t.country}</span><select name="countryCode" defaultValue={data.account.country_code}>{(["US", "CA", "BR", "MX"] as const).map((code) => <option value={code} key={code}>{t.countries[code]}</option>)}</select></label><label><span>{t.accountLanguage}</span><select name="locale" value={locale} onChange={(event) => setLocale(event.target.value as SiteLocale)}>{LANGUAGE_OPTIONS.map((option) => <option value={option.code} key={option.code}>{option.label}</option>)}</select></label></div><button type="submit" disabled={busy}>{t.saveProfile}</button></form>
          </section>
        </div>
        <section className="customer-orders-panel">
          <div><p className="section-tag">{t.ordersTag}</p><h2>{t.ordersTitle}</h2></div>
          {!data.orders?.length ? <p className="customer-empty">{t.noOrders}</p> : <div className="customer-order-list">{data.orders.map((order) => <article key={order.reference}><header><div><code>{order.reference}</code><h3>{order.product_name}</h3><p>{order.specification} · {order.destination}</p></div><span>{order.status}</span></header>{order.status === "delivered" ? <form onSubmit={(event) => void submitFeedback(event, order.reference)}><label><span>{t.serviceFeedback}</span><textarea name="text" minLength={20} maxLength={1200} defaultValue={order.feedback_text ?? ""} placeholder={t.placeholder} required /></label><small>{t.moderation}</small><button type="submit" disabled={busy}>{order.feedback_status ? t.resubmit : t.submit}</button>{order.feedback_status && <b>{t.currentStatus}: {order.feedback_status}</b>}</form> : <p className="customer-order-wait">{t.waitDelivery}</p>}</article>)}</div>}
        </section>
      </section>
    </main>
  );
}
