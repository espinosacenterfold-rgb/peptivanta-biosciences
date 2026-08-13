"use client";

import { useEffect, useMemo, useState } from "react";
import type { SiteLocale as Locale } from "./i18n";

type Market = "United States" | "Canada" | "Brazil" | "Mexico";

type FulfillmentRecord = {
  id: string;
  reference: string;
  occurredAt: string;
  destination: Market;
  service: "catalogue" | "private_label" | "bulk" | "custom" | string;
  orderProfile: string;
  productName: string;
  specification: string;
  unitPriceUsdCents: number;
  retailUnitPriceUsdCents: number;
  discountBps: number;
  packagingFeeUsdCents: number;
  testingFeeUsdCents: number;
  logisticsFeeUsdCents: number;
  amountUsdCents: number;
  status:
    | "confirmed"
    | "documentation_review"
    | "in_production"
    | "quality_control"
    | "packaging"
    | "dispatched"
    | "delivered"
    | string;
  isSample: boolean;
  source: "sample" | "manual";
  orderKind?: "new" | "repeat";
  repeatOfReference?: string;
  items?: Array<{
    productName: string;
    specification: string;
  }>;
};

type ApiResponse = {
  records: FulfillmentRecord[];
  count: number;
  limit: number;
  windowStart: string;
  generatedAt: string;
  nextUpdateAt: string;
  updateIntervalDays: number;
  realOrderCount: number;
  dataMode: "mixed_workflow";
};

const localeCodes: Record<Locale, string> = {
  en: "en-US",
  pt: "pt-BR",
  es: "es",
  fr: "fr",
  zh: "zh-CN",
};

const profiles = {
  en: {
    "1–2 kits": "1–2 kits",
    "3–5 kits": "3–5 kits",
    "3–10 kits": "3–10 kits",
    "6–10 kits": "6–10 kits",
    "Pilot order": "Pilot order",
    "10–50 kits": "10–50 kits",
    "50–100 kits": "50–100 kits",
    "100–300 kits": "100–300 kits",
    "300–500 kits": "300–500 kits",
    "500–1,000 kits": "500–1,000 kits",
    "1,000–3,000 kits": "1,000–3,000 kits",
    "3,000+ kits": "3,000+ kits",
  },
  pt: {
    "1–2 kits": "1–2 kits",
    "3–5 kits": "3–5 kits",
    "3–10 kits": "3–10 kits",
    "6–10 kits": "6–10 kits",
    "Pilot order": "Pedido piloto",
    "10–50 kits": "10–50 kits",
    "50–100 kits": "50–100 kits",
    "100–300 kits": "100–300 kits",
    "300–500 kits": "300–500 kits",
    "500–1,000 kits": "500–1.000 kits",
    "1,000–3,000 kits": "1.000–3.000 kits",
    "3,000+ kits": "Mais de 3.000 kits",
  },
  es: {
    "1–2 kits": "1–2 kits",
    "3–5 kits": "3–5 kits",
    "3–10 kits": "3–10 kits",
    "6–10 kits": "6–10 kits",
    "Pilot order": "Pedido piloto",
    "10–50 kits": "10–50 kits",
    "50–100 kits": "50–100 kits",
    "100–300 kits": "100–300 kits",
    "300–500 kits": "300–500 kits",
    "500–1,000 kits": "500–1.000 kits",
    "1,000–3,000 kits": "1.000–3.000 kits",
    "3,000+ kits": "Más de 3.000 kits",
  },
  fr: {
    "1–2 kits": "1–2 kits",
    "3–5 kits": "3–5 kits",
    "3–10 kits": "3–10 kits",
    "6–10 kits": "6–10 kits",
    "Pilot order": "Commande pilote",
    "10–50 kits": "10–50 kits",
    "50–100 kits": "50–100 kits",
    "100–300 kits": "100–300 kits",
    "300–500 kits": "300–500 kits",
    "500–1,000 kits": "500–1 000 kits",
    "1,000–3,000 kits": "1 000–3 000 kits",
    "3,000+ kits": "Plus de 3 000 kits",
  },
  zh: {
    "1–2 kits": "1–2 盒",
    "3–5 kits": "3–5 盒",
    "3–10 kits": "3–10 盒",
    "6–10 kits": "6–10 盒",
    "Pilot order": "小批量试单",
    "10–50 kits": "10–50 盒",
    "50–100 kits": "50–100 盒",
    "100–300 kits": "100–300 盒",
    "300–500 kits": "300–500 盒",
    "500–1,000 kits": "500–1,000 盒",
    "1,000–3,000 kits": "1,000–3,000 盒",
    "3,000+ kits": "3,000 盒以上",
  },
} as const;

const content = {
  en: {
    tag: "Fulfillment ledger",
    title: "Recent workflow activity.",
    text: "A privacy-conscious model of how B2B orders progress through documentation, production, quality review, packaging, dispatch, and delivery.",
    count: "records",
    window: "latest order limit",
    marketsLabel: "target markets",
    refresh: "Refresh records",
    updated: "Ledger date",
    nextUpdate: "Next daily update",
    notice: "Illustrative workflow data, showing the latest {count} new orders.",
    loading: "Loading recent records…",
    error: "Recent records are temporarily unavailable.",
    empty: "No published records are available for this period.",
    headers: [
      "Date",
      "Reference",
      "Destination",
      "Product configuration / specification",
      "Service",
      "Order size",
      "Amount (USD)",
      "Status",
    ],
    allMarkets: "All markets",
    markets: {
      "United States": "United States",
      Canada: "Canada",
      Brazil: "Brazil",
      Mexico: "Mexico",
    },
    services: {
      catalogue: "Catalogue supply",
      private_label: "Private label",
      bulk: "Bulk supply",
      custom: "Custom project",
    },
    statuses: {
      confirmed: "Order confirmed",
      documentation_review: "Documentation review",
      in_production: "In production",
      quality_control: "Quality control",
      packaging: "Packaging",
      dispatched: "Dispatched",
      delivered: "Delivered",
    },
    unitPrice: "unit",
    quoteRetail: "Quote retail",
    settledUnit: "Discounted unit",
    volumeDiscount: "volume discount",
    perBox: "box",
    productLines: "product lines",
    assembly: "product assembly",
    firstOrder: "First order",
    repeatOrder: "Repeat order",
    repeatOf: "Reorder of",
    fees: "packaging, testing & logistics",
  },
  pt: {
    tag: "Registro de atendimento",
    title: "Atividade recente do fluxo.",
    text: "Um modelo sem identificação de como pedidos B2B avançam por documentação, produção, qualidade, embalagem, despacho e entrega.",
    count: "registros",
    window: "limite de pedidos recentes",
    marketsLabel: "mercados-alvo",
    refresh: "Atualizar",
    updated: "Data do registro",
    nextUpdate: "Próxima atualização diária",
    notice: "Dados ilustrativos do fluxo, mostrando os {count} pedidos mais recentes.",
    loading: "Carregando registros…",
    error: "Os registros estão temporariamente indisponíveis.",
    empty: "Não há registros publicados para este período.",
    headers: [
      "Data",
      "Referência",
      "Destino",
      "Configuração de produtos / especificação",
      "Serviço",
      "Faixa do pedido",
      "Valor (USD)",
      "Status",
    ],
    allMarkets: "Todos",
    markets: {
      "United States": "Estados Unidos",
      Canada: "Canadá",
      Brazil: "Brasil",
      Mexico: "México",
    },
    services: {
      catalogue: "Catálogo",
      private_label: "Marca própria",
      bulk: "Grande volume",
      custom: "Projeto personalizado",
    },
    statuses: {
      confirmed: "Pedido confirmado",
      documentation_review: "Revisão documental",
      in_production: "Em produção",
      quality_control: "Controle de qualidade",
      packaging: "Embalagem",
      dispatched: "Despachado",
      delivered: "Entregue",
    },
    unitPrice: "unidade",
    quoteRetail: "Preço de tabela",
    settledUnit: "Preço com desconto",
    volumeDiscount: "desconto por volume",
    perBox: "caixa",
    productLines: "linhas de produtos",
    assembly: "combinação de produtos",
    firstOrder: "Primeiro pedido",
    repeatOrder: "Pedido recorrente",
    repeatOf: "Reposição de",
    fees: "embalagem, testes e logística",
  },
  es: {
    tag: "Registro de cumplimiento",
    title: "Actividad reciente del flujo.",
    text: "Un modelo anonimizado de cómo los pedidos B2B avanzan por documentación, producción, calidad, empaque, despacho y entrega.",
    count: "registros",
    window: "límite de pedidos recientes",
    marketsLabel: "mercados objetivo",
    refresh: "Actualizar",
    updated: "Fecha del registro",
    nextUpdate: "Próxima actualización diaria",
    notice: "Datos ilustrativos del flujo, mostrando los {count} pedidos más recientes.",
    loading: "Cargando registros…",
    error: "Los registros no están disponibles temporalmente.",
    empty: "No hay registros publicados para este período.",
    headers: [
      "Fecha",
      "Referencia",
      "Destino",
      "Configuración de productos / especificación",
      "Servicio",
      "Escala del pedido",
      "Importe (USD)",
      "Estado",
    ],
    allMarkets: "Todos",
    markets: {
      "United States": "Estados Unidos",
      Canada: "Canadá",
      Brazil: "Brasil",
      Mexico: "México",
    },
    services: {
      catalogue: "Catálogo",
      private_label: "Marca privada",
      bulk: "Gran volumen",
      custom: "Proyecto personalizado",
    },
    statuses: {
      confirmed: "Pedido confirmado",
      documentation_review: "Revisión documental",
      in_production: "En producción",
      quality_control: "Control de calidad",
      packaging: "Empaque",
      dispatched: "Despachado",
      delivered: "Entregado",
    },
    unitPrice: "unidad",
    quoteRetail: "Precio de lista",
    settledUnit: "Precio con descuento",
    volumeDiscount: "descuento por volumen",
    perBox: "caja",
    productLines: "líneas de producto",
    assembly: "combinación de productos",
    firstOrder: "Primer pedido",
    repeatOrder: "Pedido recurrente",
    repeatOf: "Recompra de",
    fees: "empaque, pruebas y logística",
  },
  fr: {
    tag: "Registre d’exécution",
    title: "Activité récente du flux.",
    text: "Un modèle anonymisé de progression des commandes B2B entre documentation, production, qualité, emballage, expédition et livraison.",
    count: "enregistrements",
    window: "limite de commandes récentes",
    marketsLabel: "marchés cibles",
    refresh: "Actualiser",
    updated: "Date du registre",
    nextUpdate: "Prochaine mise à jour quotidienne",
    notice: "Données illustratives du flux, présentant les {count} commandes les plus récentes.",
    loading: "Chargement des enregistrements…",
    error: "Les enregistrements sont temporairement indisponibles.",
    empty: "Aucun enregistrement publié pour cette période.",
    headers: [
      "Date",
      "Référence",
      "Destination",
      "Configuration produits / spécification",
      "Service",
      "Taille de commande",
      "Montant (USD)",
      "Statut",
    ],
    allMarkets: "Tous",
    markets: {
      "United States": "États-Unis",
      Canada: "Canada",
      Brazil: "Brésil",
      Mexico: "Mexique",
    },
    services: {
      catalogue: "Catalogue",
      private_label: "Marque blanche",
      bulk: "Grand volume",
      custom: "Projet personnalisé",
    },
    statuses: {
      confirmed: "Commande confirmée",
      documentation_review: "Revue documentaire",
      in_production: "En production",
      quality_control: "Contrôle qualité",
      packaging: "Emballage",
      dispatched: "Expédié",
      delivered: "Livré",
    },
    unitPrice: "unité",
    quoteRetail: "Prix catalogue",
    settledUnit: "Prix remisé",
    volumeDiscount: "remise sur volume",
    perBox: "boîte",
    productLines: "lignes de produits",
    assembly: "assemblage de produits",
    firstOrder: "Première commande",
    repeatOrder: "Commande récurrente",
    repeatOf: "Réachat de",
    fees: "emballage, essais et logistique",
  },
  zh: {
    tag: "履约台账",
    title: "近期订单流程记录。",
    text: "以脱敏示例展示 B2B 订单从确认、文件审核、生产、质检、包装、发运到送达的完整推进过程。",
    count: "条记录",
    window: "条新订单上限",
    marketsLabel: "个目标市场",
    refresh: "刷新记录",
    updated: "台账日期",
    nextUpdate: "下次每日更新",
    notice: "示例履约流程数据，仅展示近{count}条新订单",
    loading: "正在读取近期记录…",
    error: "近期记录暂时无法加载。",
    empty: "该时间范围内暂无记录。",
    headers: [
      "日期",
      "记录编号",
      "目的地",
      "产品组合 / 规格",
      "服务类型",
      "订单规模",
      "金额 (USD)",
      "状态",
    ],
    allMarkets: "全部市场",
    markets: {
      "United States": "美国",
      Canada: "加拿大",
      Brazil: "巴西",
      Mexico: "墨西哥",
    },
    services: {
      catalogue: "目录产品供应",
      private_label: "贴牌服务",
      bulk: "大货供应",
      custom: "定制项目",
    },
    statuses: {
      confirmed: "订单已确认",
      documentation_review: "文件审核中",
      in_production: "生产中",
      quality_control: "质量检测",
      packaging: "包装中",
      dispatched: "已发运",
      delivered: "已送达",
    },
    unitPrice: "单价",
    quoteRetail: "报价表零售价",
    settledUnit: "折后成交单价",
    volumeDiscount: "数量折扣",
    perBox: "盒",
    productLines: "个产品规格",
    assembly: "搭配组装",
    firstOrder: "首次订单",
    repeatOrder: "客户复购",
    repeatOf: "对应前单",
    fees: "包装、检测及物流",
  },
} as const;

const marketValues = [
  "all",
  "United States",
  "Canada",
  "Brazil",
  "Mexico",
] as const;

export default function FulfillmentCases({ locale }: { locale: Locale }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [market, setMarket] =
    useState<(typeof marketValues)[number]>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const t = content[locale];
  const ledgerNotice = t.notice.replace(
    "{count}",
    String(data?.limit ?? 300),
  );

  async function loadRecords() {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/fulfillment-cases");
      if (!response.ok) throw new Error("Unable to load records");
      setData((await response.json()) as ApiResponse);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadRecords());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const visibleRecords = useMemo(() => {
    const records = data?.records ?? [];
    return market === "all"
      ? records
      : records.filter((record) => record.destination === market);
  }, [data, market]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(localeCodes[locale], {
        month: "short",
        day: "2-digit",
        year: "numeric",
      }),
    [locale],
  );
  const amountFormatter = useMemo(
    () =>
      new Intl.NumberFormat(localeCodes[locale], {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale],
  );
  return (
    <section
      className="case-ledger section-shell"
      id="fulfillment"
      aria-labelledby="case-ledger-title"
    >
      <div className="case-ledger-heading">
        <div>
          <p className="section-tag">{t.tag}</p>
          <h2 id="case-ledger-title">{t.title}</h2>
          <p>{t.text}</p>
        </div>
        <dl className="case-ledger-stats">
          <div>
            <dt>{data?.count ?? "—"}</dt>
            <dd>{t.count}</dd>
          </div>
          <div>
            <dt>{data?.limit ?? 300}</dt>
            <dd>{t.window}</dd>
          </div>
          <div>
            <dt>4</dt>
            <dd>{t.marketsLabel}</dd>
          </div>
        </dl>
      </div>

      <p className="case-ledger-notice">{ledgerNotice}</p>

      <div className="case-ledger-toolbar">
        <div
          className="case-market-filters"
          role="group"
          aria-label={t.headers[2]}
        >
          {marketValues.map((value) => (
            <button
              type="button"
              className={market === value ? "active" : undefined}
              aria-pressed={market === value}
              onClick={() => setMarket(value)}
              key={value}
            >
              {value === "all" ? t.allMarkets : t.markets[value]}
            </button>
          ))}
        </div>
        <button
          className="case-refresh"
          type="button"
          onClick={() => void loadRecords()}
          disabled={loading}
        >
          <span aria-hidden="true">↻</span>
          {t.refresh}
        </button>
      </div>

      <div className="case-table-shell">
        {loading ? (
          <p className="case-state">{t.loading}</p>
        ) : error ? (
          <p className="case-state case-state-error">{t.error}</p>
        ) : visibleRecords.length === 0 ? (
          <p className="case-state">{t.empty}</p>
        ) : (
          <table className="case-table">
            <thead>
              <tr>
                {t.headers.map((header) => (
                  <th scope="col" key={header}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((record) => {
                const fees =
                  record.packagingFeeUsdCents +
                  record.testingFeeUsdCents +
                  record.logisticsFeeUsdCents;
                const orderItems =
                  record.items?.length
                    ? record.items
                    : [
                        {
                          productName: record.productName,
                          specification: record.specification,
                        },
                      ];
                const hasMultipleProducts = orderItems.length > 1;
                return (
                  <tr key={record.id}>
                    <td data-label={t.headers[0]}>
                      {dateFormatter.format(
                        new Date(`${record.occurredAt}T00:00:00Z`),
                      )}
                    </td>
                    <td data-label={t.headers[1]}>
                      <code>{record.reference}</code>
                      <span
                        className={`case-order-kind ${record.orderKind === "repeat" ? "is-repeat" : ""}`}
                      >
                        {record.orderKind === "repeat"
                          ? t.repeatOrder
                          : t.firstOrder}
                      </span>
                      {record.orderKind === "repeat" &&
                        record.repeatOfReference && (
                          <small className="case-repeat-reference">
                            {t.repeatOf} {record.repeatOfReference}
                          </small>
                        )}
                    </td>
                    <td data-label={t.headers[2]}>
                      {t.markets[record.destination]}
                    </td>
                    <td className="case-product" data-label={t.headers[3]}>
                      <span className="case-assembly-label">
                        {hasMultipleProducts
                          ? `${orderItems.length} ${t.assembly}`
                          : t.assembly}
                      </span>
                      <div className="case-product-lines">
                        {orderItems.map((item, index) => (
                          <span
                            className="case-product-line"
                            key={`${record.id}-${item.productName}-${item.specification}-${index}`}
                          >
                            <strong>{item.productName}</strong>
                            <small>{item.specification}</small>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="case-service" data-label={t.headers[4]}>
                      <strong>
                        {t.services[
                          record.service as keyof typeof t.services
                        ] ?? record.service}
                      </strong>
                    </td>
                    <td className="case-quantity" data-label={t.headers[5]}>
                      {profiles[locale][
                        record.orderProfile as keyof (typeof profiles)[typeof locale]
                      ] ?? record.orderProfile}
                    </td>
                    <td className="case-amount" data-label={t.headers[6]}>
                      <strong>
                        {amountFormatter.format(record.amountUsdCents / 100)}
                      </strong>
                      <small className="case-price-breakdown">
                        {hasMultipleProducts ? (
                          <>
                            <span>
                              {orderItems.length} {t.productLines}
                              {record.discountBps > 0 && (
                                <>
                                  {" · "}
                                  {t.volumeDiscount}{" "}
                                  {(record.discountBps / 100).toFixed(0)}%
                                </>
                              )}
                            </span>
                            {fees > 0 && (
                              <span>
                                {amountFormatter.format(fees / 100)} {t.fees}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span>
                              {t.quoteRetail}{" "}
                              {amountFormatter.format(
                                record.retailUnitPriceUsdCents / 100,
                              )}
                              /{t.perBox}
                              {record.discountBps > 0 && (
                                <>
                                  {" · "}
                                  {t.volumeDiscount}{" "}
                                  {(record.discountBps / 100).toFixed(0)}%
                                </>
                              )}
                            </span>
                            <span>
                              {t.settledUnit}{" "}
                              {amountFormatter.format(
                                record.unitPriceUsdCents / 100,
                              )}
                              /{t.perBox}
                              {fees > 0 && (
                                <>
                                  {" · "}
                                  {amountFormatter.format(fees / 100)} {t.fees}
                                </>
                              )}
                            </span>
                          </>
                        )}
                      </small>
                    </td>
                    <td data-label={t.headers[7]}>
                      <span
                        className={`case-status case-status-${record.status}`}
                      >
                        {t.statuses[
                          record.status as keyof typeof t.statuses
                        ] ?? record.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {data && (
        <p className="case-ledger-updated">
          <span>{ledgerNotice}</span>
          <span>
            {t.updated}: {dateFormatter.format(new Date(data.generatedAt))} ·{" "}
            {t.nextUpdate}:{" "}
            {dateFormatter.format(new Date(data.nextUpdateAt))}
          </span>
        </p>
      )}
    </section>
  );
}
