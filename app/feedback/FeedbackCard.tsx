import type { SiteLocale } from "../i18n";

export type PublicFeedbackRecord = {
  id: string;
  sourceType: "illustrative" | "customer_submitted" | string;
  countryCode: string;
  service: string;
  orderKind: string;
  locale: string;
  text: string;
  publishedAt: string;
  mediaUrl: string | null;
  mediaAlt: string;
};

const labels = {
  en: {
    illustrative: "Illustrative service feedback",
    real: "Customer submitted · reviewed",
    first: "First order",
    repeat: "Repeat order",
    image: "Illustrative image",
  },
  pt: {
    illustrative: "Exemplo ilustrativo de serviço",
    real: "Enviado por cliente · revisado",
    first: "Primeiro pedido",
    repeat: "Recompra",
    image: "Imagem ilustrativa",
  },
  es: {
    illustrative: "Ejemplo ilustrativo de servicio",
    real: "Enviado por cliente · revisado",
    first: "Primer pedido",
    repeat: "Recompra",
    image: "Imagen ilustrativa",
  },
  fr: {
    illustrative: "Exemple illustratif de service",
    real: "Soumis par un client · vérifié",
    first: "Première commande",
    repeat: "Commande répétée",
    image: "Image illustrative",
  },
  zh: {
    illustrative: "示例服务反馈",
    real: "客户提交 · 已审核",
    first: "首次订单",
    repeat: "客户复购",
    image: "示意图片",
  },
} as const;

const countries: Record<string, Record<SiteLocale, string>> = {
  US: { en: "United States", pt: "Estados Unidos", es: "Estados Unidos", fr: "États-Unis", zh: "美国" },
  CA: { en: "Canada", pt: "Canadá", es: "Canadá", fr: "Canada", zh: "加拿大" },
  BR: { en: "Brazil", pt: "Brasil", es: "Brasil", fr: "Brésil", zh: "巴西" },
  MX: { en: "Mexico", pt: "México", es: "México", fr: "Mexique", zh: "墨西哥" },
};

const serviceNames: Record<string, Record<SiteLocale, string>> = {
  catalogue: { en: "Catalogue supply", pt: "Catálogo", es: "Catálogo", fr: "Catalogue", zh: "目录产品供应" },
  private_label: { en: "Private label", pt: "Marca própria", es: "Marca privada", fr: "Marque privée", zh: "贴牌服务" },
  bulk: { en: "Bulk supply", pt: "Fornecimento a granel", es: "Suministro a granel", fr: "Approvisionnement en gros", zh: "大货供应" },
  custom: { en: "Custom project", pt: "Projeto personalizado", es: "Proyecto personalizado", fr: "Projet personnalisé", zh: "定制项目" },
};

export default function FeedbackCard({
  record,
  locale,
}: {
  record: PublicFeedbackRecord;
  locale: SiteLocale;
}) {
  const t = labels[locale];
  const illustrative = record.sourceType === "illustrative";
  const date = new Intl.DateTimeFormat(
    locale === "zh" ? "zh-CN" : locale === "pt" ? "pt-BR" : locale,
    { year: "numeric", month: "short", day: "2-digit" },
  ).format(new Date(record.publishedAt));

  return (
    <article className={`feedback-card ${record.mediaUrl ? "has-media" : "is-text-only"}`}>
      {record.mediaUrl && (
        <figure className="feedback-card-media">
          <img src={record.mediaUrl} alt={record.mediaAlt || t.image} loading="lazy" decoding="async" />
          {illustrative && <figcaption>{t.image}</figcaption>}
        </figure>
      )}
      <div className="feedback-card-body">
        <div className="feedback-card-labels">
          <span className={illustrative ? "is-illustrative" : "is-customer"}>
            {illustrative ? t.illustrative : t.real}
          </span>
          <span>{record.orderKind === "repeat" ? t.repeat : t.first}</span>
        </div>
        <blockquote>{record.text}</blockquote>
        <footer>
          <div>
            <strong>{countries[record.countryCode]?.[locale] ?? record.countryCode}</strong>
            <small>{serviceNames[record.service]?.[locale] ?? record.service}</small>
          </div>
          <time dateTime={record.publishedAt}>{date}</time>
        </footer>
      </div>
    </article>
  );
}
