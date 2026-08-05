"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createWhatsAppUrl, siteConfig } from "../../site.config";
import {
  htmlLang,
  isSiteLocale,
  LANGUAGE_OPTIONS,
  LOCALE_STORAGE_KEY,
  type SiteLocale,
} from "../i18n";
import {
  coaDocuments,
  coaProductOptions,
  type CoaDocument,
} from "./coa-documents.generated";

const pageCopy = {
  en: {
    back: "Back to website",
    language: "Language",
    eyebrow: "Analytical report library",
    titleA: "Reports, organised",
    titleB: "by product name.",
    intro:
      "Browse the analytical reports currently on file. Every report is displayed directly on this page and grouped by product, so professional buyers can review the available document coverage before requesting a batch-matched file.",
    filesLabel: "reports displayed",
    productsLabel: "product groups",
    filterTitle: "Choose a product",
    filterHint: "Select a product name to show its reports. Choosing another product replaces the previous selection.",
    all: "All reports",
    search: "Search a product or strength",
    searchLabel: "Search analytical reports",
    selected: "selected",
    clear: "Clear selection",
    report: "report",
    reports: "reports",
    imageReport: "Image report",
    pdfReport: "PDF report preview",
    view: "View full report",
    close: "Close report",
    empty: "No reports match the current selection.",
    notice:
      "These are sample- or batch-specific analytical reports. A report shown here must not be treated as proof for every lot. Ask us to confirm the product, specification, current batch, and matching document before procurement.",
    ctaTitle: "Need the report for a current batch?",
    ctaText:
      "Send the product name, specification, destination, and intended professional use. We will check the current supply against the applicable report.",
    cta: "Check on WhatsApp",
  },
  pt: {
    back: "Voltar ao site",
    language: "Idioma",
    eyebrow: "Biblioteca de relatórios analíticos",
    titleA: "Relatórios organizados",
    titleB: "por nome do produto.",
    intro:
      "Consulte os relatórios analíticos atualmente arquivados. Cada relatório aparece diretamente nesta página e é agrupado por produto para facilitar a revisão antes de solicitar o documento correspondente ao lote.",
    filesLabel: "relatórios exibidos",
    productsLabel: "grupos de produtos",
    filterTitle: "Escolha um produto",
    filterHint: "Selecione um produto para ver os relatórios. Uma nova escolha substitui a anterior.",
    all: "Todos os relatórios",
    search: "Buscar produto ou concentração",
    searchLabel: "Buscar relatórios analíticos",
    selected: "selecionados",
    clear: "Limpar seleção",
    report: "relatório",
    reports: "relatórios",
    imageReport: "Relatório em imagem",
    pdfReport: "Prévia do relatório PDF",
    view: "Ver relatório completo",
    close: "Fechar relatório",
    empty: "Nenhum relatório corresponde à seleção atual.",
    notice:
      "Estes relatórios são específicos de amostra ou lote. Um documento exibido aqui não comprova todos os lotes. Confirme conosco produto, especificação, lote atual e documento correspondente antes da compra.",
    ctaTitle: "Precisa do relatório do lote atual?",
    ctaText:
      "Envie o produto, a especificação, o destino e o uso profissional pretendido. Verificaremos o fornecimento atual e o relatório aplicável.",
    cta: "Verificar no WhatsApp",
  },
  es: {
    back: "Volver al sitio",
    language: "Idioma",
    eyebrow: "Biblioteca de informes analíticos",
    titleA: "Informes organizados",
    titleB: "por nombre de producto.",
    intro:
      "Consulte los informes analíticos archivados actualmente. Cada informe se muestra directamente en esta página y está agrupado por producto para facilitar la revisión antes de solicitar el documento del lote.",
    filesLabel: "informes mostrados",
    productsLabel: "grupos de productos",
    filterTitle: "Elija un producto",
    filterHint: "Seleccione un producto para ver sus informes. Una nueva elección sustituye la anterior.",
    all: "Todos los informes",
    search: "Buscar producto o concentración",
    searchLabel: "Buscar informes analíticos",
    selected: "seleccionados",
    clear: "Borrar selección",
    report: "informe",
    reports: "informes",
    imageReport: "Informe en imagen",
    pdfReport: "Vista previa del informe PDF",
    view: "Ver informe completo",
    close: "Cerrar informe",
    empty: "Ningún informe coincide con la selección actual.",
    notice:
      "Estos informes son específicos de una muestra o un lote. Un documento mostrado aquí no demuestra todos los lotes. Confirme producto, especificación, lote actual y documento correspondiente antes de comprar.",
    ctaTitle: "¿Necesita el informe de un lote actual?",
    ctaText:
      "Envíe el producto, la especificación, el destino y el uso profesional previsto. Comprobaremos el suministro actual y el informe aplicable.",
    cta: "Comprobar por WhatsApp",
  },
  fr: {
    back: "Retour au site",
    language: "Langue",
    eyebrow: "Bibliothèque de rapports analytiques",
    titleA: "Rapports classés",
    titleB: "par nom de produit.",
    intro:
      "Consultez les rapports analytiques actuellement archivés. Chaque rapport est affiché directement sur cette page et regroupé par produit afin de faciliter l’examen avant de demander le document correspondant au lot.",
    filesLabel: "rapports affichés",
    productsLabel: "groupes de produits",
    filterTitle: "Choisissez un produit",
    filterHint: "Sélectionnez un produit pour afficher ses rapports. Un nouveau choix remplace le précédent.",
    all: "Tous les rapports",
    search: "Rechercher un produit ou un dosage",
    searchLabel: "Rechercher des rapports analytiques",
    selected: "sélectionnés",
    clear: "Effacer la sélection",
    report: "rapport",
    reports: "rapports",
    imageReport: "Rapport image",
    pdfReport: "Aperçu du rapport PDF",
    view: "Voir le rapport complet",
    close: "Fermer le rapport",
    empty: "Aucun rapport ne correspond à la sélection actuelle.",
    notice:
      "Ces rapports sont propres à un échantillon ou à un lot. Un document affiché ici ne prouve pas tous les lots. Confirmez le produit, la spécification, le lot actuel et le document correspondant avant achat.",
    ctaTitle: "Besoin du rapport d’un lot actuel ?",
    ctaText:
      "Envoyez le produit, la spécification, la destination et l’usage professionnel prévu. Nous vérifierons l’offre actuelle et le rapport applicable.",
    cta: "Vérifier sur WhatsApp",
  },
  zh: {
    back: "返回网站",
    language: "语言",
    eyebrow: "检测报告库",
    titleA: "检测报告按",
    titleB: "产品名称分类。",
    intro:
      "这里直接展示目前已整理的检测报告，并按照产品名称分组。专业采购客户可以先查看现有文件覆盖情况，再联系我们核对当前批次所对应的报告。",
    filesLabel: "份检测报告",
    productsLabel: "个产品分类",
    filterTitle: "选择一个产品",
    filterHint: "点击产品名称后只显示该产品报告；点击另一个产品时会自动替换原来的选择。",
    all: "全部报告",
    search: "搜索产品或规格",
    searchLabel: "搜索检测报告",
    selected: "项已选择",
    clear: "清除选择",
    report: "份报告",
    reports: "份报告",
    imageReport: "图片检测报告",
    pdfReport: "PDF 检测报告预览",
    view: "查看完整报告",
    close: "关闭报告",
    empty: "当前筛选条件下没有检测报告。",
    notice:
      "页面中的报告仅对应特定样品或批次，不能代表所有批次。采购前请联系我们核对产品名称、规格、当前批次及其对应检测文件。",
    ctaTitle: "需要核对当前批次的检测报告？",
    ctaText:
      "请发送产品名称、规格、目的国家或地区以及预期专业用途，我们会核对当前供应批次及适用报告。",
    cta: "通过 WhatsApp 核对",
  },
} as const;

function reportMessage(locale: SiteLocale, product: string) {
  if (locale === "zh") {
    return `您好，我想核对 ${product} 当前供应批次的检测报告，请确认可供规格、批次及对应文件。`;
  }
  if (locale === "pt") {
    return `Olá, gostaria de verificar o relatório analítico do lote atual de ${product}. Confirme a especificação, o lote e o documento correspondente.`;
  }
  if (locale === "es") {
    return `Hola, quisiera verificar el informe analítico del lote actual de ${product}. Confirme la especificación, el lote y el documento correspondiente.`;
  }
  if (locale === "fr") {
    return `Bonjour, je souhaite vérifier le rapport analytique du lot actuel de ${product}. Merci de confirmer la spécification, le lot et le document correspondant.`;
  }
  return `Hello, I would like to verify the analytical report for the current ${product} batch. Please confirm the specification, batch, and matching document.`;
}

function ReportCard({
  document,
  reportNumber,
  locale,
  onOpen,
}: {
  document: CoaDocument;
  reportNumber: number;
  locale: SiteLocale;
  onOpen: (document: CoaDocument) => void;
}) {
  const t = pageCopy[locale];

  return (
    <article className="coa-report-card">
      <header>
        <div>
          <span className="coa-report-number">
            {String(reportNumber).padStart(2, "0")}
          </span>
          <div>
            <h3>{document.product}</h3>
            <p>{document.strength}</p>
          </div>
        </div>
        <span className="coa-report-format">
          {document.format === "pdf" ? t.pdfReport : t.imageReport}
        </span>
      </header>
      <button
        className="coa-report-preview"
        type="button"
        onClick={() => onOpen(document)}
        aria-label={`${t.view}: ${document.product} ${document.strength}`}
      >
        <img
          src={document.previewHref}
          alt={`${document.product} ${document.strength} analytical report`}
          loading="lazy"
          decoding="async"
        />
        <span>{t.view}</span>
      </button>
      <footer>
        <button
          type="button"
          onClick={() => onOpen(document)}
        >
          {t.view}<span aria-hidden="true">↗</span>
        </button>
      </footer>
    </article>
  );
}

export default function CoaLibraryPage() {
  const [locale, setLocale] = useState<SiteLocale>("en");
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [activeDocument, setActiveDocument] = useState<CoaDocument | null>(null);
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

  useEffect(() => {
    if (!activeDocument) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveDocument(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [activeDocument]);

  const filteredDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return coaDocuments.filter((document) => {
      const productMatch =
        selectedProduct === null ||
        selectedProduct === document.product;
      const queryMatch =
        !normalized ||
        document.product.toLowerCase().includes(normalized) ||
        document.strength.toLowerCase().includes(normalized);
      return productMatch && queryMatch;
    });
  }, [query, selectedProduct]);

  const groupedDocuments = useMemo(() => {
    return coaProductOptions
      .map(({ product }) => ({
        product,
        reports: filteredDocuments.filter((document) => document.product === product),
      }))
      .filter((group) => group.reports.length > 0);
  }, [filteredDocuments]);

  function toggleProduct(product: string) {
    setSelectedProduct((current) => current === product ? null : product);
  }

  return (
    <main className={`coa-page lang-${locale}`}>
      <header className="fulfillment-page-header">
        <Link className="brand" href="/" aria-label="Peptivanta home">
          <img src="/logo-mark.svg" alt="" width={44} height={44} />
          <span>
            <strong>{siteConfig.brandName}</strong>
            <small>Biosciences</small>
          </span>
        </Link>

        <div className="fulfillment-page-actions">
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

      <section className="coa-hero section-shell">
        <div className="coa-hero-copy">
          <p className="section-tag">{t.eyebrow}</p>
          <h1>{t.titleA}<em>{t.titleB}</em></h1>
          <p>{t.intro}</p>
        </div>
        <dl className="coa-metrics">
          <div><dt>{coaDocuments.length}</dt><dd>{t.filesLabel}</dd></div>
          <div><dt>{coaProductOptions.length}</dt><dd>{t.productsLabel}</dd></div>
        </dl>
      </section>

      <section className="coa-filter-section section-shell" aria-labelledby="coa-filter-title">
        <div className="coa-filter-heading">
          <div>
            <p className="section-tag">PRODUCT FILTER</p>
            <h2 id="coa-filter-title">{t.filterTitle}</h2>
            <p>{t.filterHint}</p>
          </div>
          <label className="coa-search">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">{t.searchLabel}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.search}
              aria-label={t.searchLabel}
            />
          </label>
        </div>

        <div className="coa-product-filters" aria-label={t.filterTitle}>
          <button
            type="button"
            className={selectedProduct === null ? "is-active" : ""}
            aria-pressed={selectedProduct === null}
            onClick={() => setSelectedProduct(null)}
          >
            {t.all}<span>{coaDocuments.length}</span>
          </button>
          {coaProductOptions.map(({ product, count }) => {
            const active = selectedProduct === product;
            return (
              <button
                type="button"
                className={active ? "is-active" : ""}
                aria-pressed={active}
                onClick={() => toggleProduct(product)}
                key={product}
              >
                {product}<span>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="coa-filter-summary" aria-live="polite">
          <strong>{filteredDocuments.length}</strong>
          <span>{filteredDocuments.length === 1 ? t.report : t.reports}</span>
          {selectedProduct !== null && (
            <>
              <span className="coa-summary-divider">·</span>
              <span>{selectedProduct}</span>
              <button type="button" onClick={() => setSelectedProduct(null)}>
                {t.clear}
              </button>
            </>
          )}
        </div>
      </section>

      <section className="coa-gallery section-shell" aria-label={t.eyebrow}>
        {groupedDocuments.map((group) => (
          <section className="coa-product-group" key={group.product}>
            <header className="coa-product-heading">
              <div>
                <span>{group.product.slice(0, 1)}</span>
                <h2>{group.product}</h2>
              </div>
              <p>
                {group.reports.length}{" "}
                {group.reports.length === 1 ? t.report : t.reports}
              </p>
            </header>
            <div className="coa-report-grid">
              {group.reports.map((document, index) => (
                <ReportCard
                  document={document}
                  reportNumber={index + 1}
                  locale={locale}
                  onOpen={setActiveDocument}
                  key={document.id}
                />
              ))}
            </div>
          </section>
        ))}

        {groupedDocuments.length === 0 && (
          <div className="coa-empty">
            <p>{t.empty}</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSelectedProduct(null);
              }}
            >
              {t.clear}
            </button>
          </div>
        )}
      </section>

      <section className="coa-library-notice section-shell">
        <span aria-hidden="true">i</span>
        <p>{t.notice}</p>
      </section>

      <section className="coa-cta section-shell">
        <div>
          <p className="section-tag">BATCH DOCUMENT CHECK</p>
          <h2>{t.ctaTitle}</h2>
          <p>{t.ctaText}</p>
        </div>
        <a
          className="button"
          href={createWhatsAppUrl(t.ctaText)}
          target={siteConfig.whatsappNumber ? "_blank" : undefined}
          rel="noreferrer"
        >
          {t.cta}<span aria-hidden="true">→</span>
        </a>
      </section>

      {activeDocument && (
        <div
          className="coa-report-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="coa-report-modal-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveDocument(null);
          }}
        >
          <div className="coa-report-modal-panel">
            <header>
              <div>
                <p>{activeDocument.format === "pdf" ? t.pdfReport : t.imageReport}</p>
                <h2 id="coa-report-modal-title">{activeDocument.product}</h2>
                <span>{activeDocument.strength}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveDocument(null)}
                aria-label={t.close}
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>
            <div className="coa-report-modal-viewer">
              <img
                src={activeDocument.previewHref}
                alt={`${activeDocument.product} ${activeDocument.strength} analytical report`}
              />
            </div>
            <footer>
              <p>{t.notice}</p>
              <a
                href={createWhatsAppUrl(reportMessage(locale, activeDocument.product))}
                target={siteConfig.whatsappNumber ? "_blank" : undefined}
                rel="noreferrer"
              >
                {t.cta}<span aria-hidden="true">→</span>
              </a>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}
