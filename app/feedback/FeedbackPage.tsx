"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { siteConfig } from "../../site.config";
import {
  htmlLang,
  isSiteLocale,
  LANGUAGE_OPTIONS,
  LOCALE_STORAGE_KEY,
  type SiteLocale,
} from "../i18n";
import FeedbackCard, { type PublicFeedbackRecord } from "./FeedbackCard";

const pageCopy = {
  en: { back: "Back to website", language: "Language", tag: "Service feedback", title: "A clearer view of the buying experience.", text: "Reviewed customer submissions and clearly labelled example service feedback are displayed. No medical or efficacy claims are published.", all: "All", countries: ["United States", "Canada", "Brazil", "Mexico"], load: "Load more", empty: "No matching feedback is available.", account: "Customer access" },
  pt: { back: "Voltar ao site", language: "Idioma", tag: "Feedback de serviço", title: "Uma visão mais clara da experiência de compra.", text: "Exibimos opiniões revisadas e exemplos de feedback claramente identificados. Não publicamos alegações médicas ou de eficácia.", all: "Todos", countries: ["Estados Unidos", "Canadá", "Brasil", "México"], load: "Carregar mais", empty: "Não há feedback correspondente.", account: "Acesso do cliente" },
  es: { back: "Volver al sitio", language: "Idioma", tag: "Comentarios del servicio", title: "Una visión más clara de la experiencia de compra.", text: "Mostramos comentarios revisados y ejemplos de servicio claramente identificados. No publicamos afirmaciones médicas o de eficacia.", all: "Todos", countries: ["Estados Unidos", "Canadá", "Brasil", "México"], load: "Cargar más", empty: "No hay comentarios coincidentes.", account: "Acceso de clientes" },
  fr: { back: "Retour au site", language: "Langue", tag: "Retours sur le service", title: "Une vision plus claire de l’expérience d’achat.", text: "Nous affichons des retours vérifiés et des exemples de service clairement identifiés. Aucune allégation médicale ou d’efficacité n’est publiée.", all: "Tous", countries: ["États-Unis", "Canada", "Brésil", "Mexique"], load: "Afficher plus", empty: "Aucun retour correspondant.", account: "Accès client" },
  zh: { back: "返回网站", language: "语言", tag: "服务反馈", title: "更清晰地了解采购体验。", text: "展示经审核的客户提交内容，以及明确标注的示例服务反馈；不发布医疗或药效类表述。", all: "全部", countries: ["美国", "加拿大", "巴西", "墨西哥"], load: "加载更多", empty: "暂时没有符合条件的反馈。", account: "客户登录" },
} as const;

const countryCodes = ["", "US", "CA", "BR", "MX"];

export default function FeedbackPage() {
  const [locale, setLocale] = useState<SiteLocale>("en");
  const [country, setCountry] = useState("");
  const [records, setRecords] = useState<PublicFeedbackRecord[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const t = pageCopy[locale];

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (!isSiteLocale(stored)) return;
    const frame = window.requestAnimationFrame(() => setLocale(stored));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    document.documentElement.lang = htmlLang(locale);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  async function load(reset: boolean) {
    setLoading(true);
    const nextOffset = reset ? 0 : offset;
    try {
      const params = new URLSearchParams({ locale, limit: "18", offset: String(nextOffset) });
      if (country) params.set("country", country);
      const response = await fetch(`/api/feedback?${params}`, { cache: "no-store" });
      const data = (await response.json()) as { records?: PublicFeedbackRecord[] };
      const incoming = data.records ?? [];
      setRecords((current) => (reset ? incoming : [...current, ...incoming]));
      setOffset(nextOffset + incoming.length);
      setHasMore(incoming.length === 18);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load(true));
    return () => window.cancelAnimationFrame(frame);
    // Reset when the language or market changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, country]);

  const filters = useMemo(() => [t.all, ...t.countries], [t]);

  return (
    <main className={`feedback-page lang-${locale}`}>
      <header className="fulfillment-page-header">
        <Link className="brand" href="/" aria-label="Peptivanta home">
          <img src="/logo-mark.svg" alt="" width={44} height={44} />
          <span><strong>{siteConfig.brandName}</strong><small>Biosciences</small></span>
        </Link>
        <div className="fulfillment-page-actions">
          <Link className="customer-access-link" href="/customer/access">{t.account}</Link>
          <Link className="fulfillment-back" href="/"><span aria-hidden="true">←</span>{t.back}</Link>
          <label className="language-select"><span>{t.language}</span><select value={locale} onChange={(event) => setLocale(event.target.value as SiteLocale)} aria-label={t.language}>{LANGUAGE_OPTIONS.map((option) => <option value={option.code} key={option.code}>{option.label}</option>)}</select></label>
        </div>
      </header>
      <section className="feedback-hero section-shell">
        <p className="section-tag">{t.tag}</p>
        <h1>{t.title}</h1>
        <p>{t.text}</p>
      </section>
      <section className="feedback-library section-shell">
        <div className="feedback-filters" role="group" aria-label="Markets">
          {filters.map((label, index) => (
            <button type="button" className={country === countryCodes[index] ? "active" : ""} onClick={() => setCountry(countryCodes[index])} key={countryCodes[index]}>{label}</button>
          ))}
        </div>
        {records.length > 0 ? <div className="feedback-grid">{records.map((record) => <FeedbackCard record={record} locale={locale} key={record.id} />)}</div> : !loading && <p className="feedback-empty">{t.empty}</p>}
        {hasMore && <button className="feedback-load-more" type="button" onClick={() => void load(false)} disabled={loading}>{loading ? "…" : t.load}</button>}
      </section>
    </main>
  );
}
