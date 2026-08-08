"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createWhatsAppUrl, siteConfig } from "../../site.config";
import FulfillmentCases from "../FulfillmentCases";
import FeedbackPreview from "../feedback/FeedbackPreview";
import {
  htmlLang,
  isSiteLocale,
  LANGUAGE_OPTIONS,
  LOCALE_STORAGE_KEY,
  type SiteLocale,
} from "../i18n";

const pageCopy = {
  en: {
    back: "Back to website",
    language: "Language",
    quote: "Request a quote",
    inquiry: "Discuss a product, quantity, destination, and documentation requirement with our team.",
    account: "Customer access",
  },
  pt: {
    back: "Voltar ao site",
    language: "Idioma",
    quote: "Solicitar cotação",
    inquiry: "Fale com nossa equipe sobre produto, quantidade, destino e documentação necessária.",
    account: "Acesso do cliente",
  },
  es: {
    back: "Volver al sitio",
    language: "Idioma",
    quote: "Solicitar cotización",
    inquiry: "Consulte a nuestro equipo sobre producto, cantidad, destino y documentación requerida.",
    account: "Acceso de clientes",
  },
  fr: {
    back: "Retour au site",
    language: "Langue",
    quote: "Demander un devis",
    inquiry: "Échangez avec notre équipe sur le produit, la quantité, la destination et les documents requis.",
    account: "Accès client",
  },
  zh: {
    back: "返回网站",
    language: "语言",
    quote: "获取报价",
    inquiry: "向我们说明产品、数量、目的地和文件要求，获取进一步回复。",
    account: "客户登录",
  },
} as const;

export default function FulfillmentLedgerPage() {
  const [locale, setLocale] = useState<SiteLocale>("en");
  const t = pageCopy[locale];

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    // Hydrate the saved preference only after the browser is available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isSiteLocale(storedLocale)) setLocale(storedLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = htmlLang(locale);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  return (
    <main className={`fulfillment-page lang-${locale}`}>
      <header className="fulfillment-page-header">
        <Link className="brand" href="/" aria-label="Peptivanta home">
          <img src="/logo-mark.svg" alt="" width={44} height={44} />
          <span>
            <strong>{siteConfig.brandName}</strong>
            <small>Biosciences</small>
          </span>
        </Link>

        <div className="fulfillment-page-actions">
          <Link className="customer-access-link" href="/customer/access">
            {t.account}
          </Link>
          <Link className="fulfillment-back" href="/">
            <span aria-hidden="true">←</span>{t.back}
          </Link>
          <label className="language-select">
            <span>{t.language}</span>
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value as SiteLocale)}
              aria-label={t.language}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option value={option.code} key={option.code}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <FulfillmentCases locale={locale} />

      <FeedbackPreview locale={locale} />

      <section className="fulfillment-page-cta section-shell">
        <p>{t.inquiry}</p>
        <a
          className="button"
          href={createWhatsAppUrl(t.inquiry)}
          target={siteConfig.whatsappNumber ? "_blank" : undefined}
          rel="noreferrer"
        >
          {t.quote}<span aria-hidden="true">↗</span>
        </a>
      </section>
    </main>
  );
}
