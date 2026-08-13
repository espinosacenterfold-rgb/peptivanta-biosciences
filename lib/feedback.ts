import type { SiteLocale } from "../app/i18n";

export type FeedbackContent = Record<SiteLocale, string>;

export type IllustrativeFeedbackContext = {
  destination: string;
  service: string;
  orderKind: string;
  productName: string;
  itemCount: number;
};

export function stableNumber(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const phrasePools: Record<
  SiteLocale,
  { openings: string[]; details: string[]; endings: string[] }
> = {
  en: {
    openings: [
      "Communication was clear from confirmation onward.",
      "The order was handled with consistent updates.",
      "Our team received a prompt and organized response.",
      "The follow-up was practical and easy to understand.",
      "The supply discussion stayed focused and well documented.",
      "The process felt organized from the first confirmation.",
    ],
    details: [
      "The specification list matched the agreed configuration.",
      "The document handover was straightforward to review.",
      "The packaging arrived orderly and the product lines were easy to identify.",
      "Progress updates made the dispatch timing easy to follow.",
      "The multi-product configuration was presented clearly.",
      "Questions about the order format were answered without unnecessary delay.",
      "The batch-related documents were arranged in a useful format.",
      "The final order summary was accurate and concise.",
    ],
    endings: [
      "A smooth professional supply experience overall.",
      "We appreciated the responsive coordination.",
      "The workflow was suitable for a professional purchase.",
      "The clear handover made internal review easier.",
      "We would be comfortable using the same process again.",
      "The service remained consistent through completion.",
    ],
  },
  pt: {
    openings: [
      "A comunicação foi clara desde a confirmação.",
      "O pedido foi acompanhado com atualizações consistentes.",
      "Nossa equipe recebeu um retorno rápido e organizado.",
      "O acompanhamento foi prático e fácil de entender.",
      "A conversa comercial permaneceu objetiva e bem documentada.",
      "O processo foi organizado desde a primeira confirmação.",
    ],
    details: [
      "A lista de especificações correspondeu à configuração acordada.",
      "A entrega dos documentos foi simples de revisar.",
      "A embalagem chegou organizada e os itens estavam fáceis de identificar.",
      "As atualizações permitiram acompanhar bem o prazo de envio.",
      "A configuração com vários produtos foi apresentada com clareza.",
      "As dúvidas sobre o formato do pedido foram respondidas sem demora desnecessária.",
      "Os documentos relacionados ao lote vieram em um formato útil.",
      "O resumo final do pedido estava correto e objetivo.",
    ],
    endings: [
      "No geral, uma experiência profissional e tranquila.",
      "Agradecemos a coordenação ágil.",
      "O fluxo atendeu bem a uma compra profissional.",
      "A entrega clara facilitou nossa revisão interna.",
      "Usaríamos o mesmo processo novamente.",
      "O atendimento permaneceu consistente até a conclusão.",
    ],
  },
  es: {
    openings: [
      "La comunicación fue clara desde la confirmación.",
      "El pedido se gestionó con actualizaciones constantes.",
      "Nuestro equipo recibió una respuesta rápida y ordenada.",
      "El seguimiento fue práctico y fácil de entender.",
      "La conversación comercial se mantuvo enfocada y documentada.",
      "El proceso estuvo organizado desde la primera confirmación.",
    ],
    details: [
      "La lista de especificaciones coincidió con la configuración acordada.",
      "La entrega de documentos fue sencilla de revisar.",
      "El embalaje llegó ordenado y las líneas de producto eran fáciles de identificar.",
      "Las actualizaciones permitieron seguir claramente el despacho.",
      "La configuración de varios productos se presentó con claridad.",
      "Las preguntas sobre el formato del pedido se respondieron sin demoras innecesarias.",
      "Los documentos del lote estaban organizados en un formato útil.",
      "El resumen final del pedido fue preciso y conciso.",
    ],
    endings: [
      "En general, una experiencia profesional fluida.",
      "Agradecemos la coordinación receptiva.",
      "El flujo fue adecuado para una compra profesional.",
      "La entrega clara facilitó nuestra revisión interna.",
      "Volveríamos a utilizar el mismo proceso.",
      "El servicio se mantuvo constante hasta finalizar.",
    ],
  },
  fr: {
    openings: [
      "La communication est restée claire dès la confirmation.",
      "La commande a été suivie avec des mises à jour régulières.",
      "Notre équipe a reçu une réponse rapide et structurée.",
      "Le suivi était pratique et facile à comprendre.",
      "L’échange commercial est resté précis et bien documenté.",
      "Le processus était organisé dès la première confirmation.",
    ],
    details: [
      "La liste des spécifications correspondait à la configuration convenue.",
      "La transmission des documents était simple à examiner.",
      "L’emballage était ordonné et les lignes de produits faciles à identifier.",
      "Les mises à jour permettaient de suivre clairement l’expédition.",
      "La configuration multiproduit était présentée clairement.",
      "Les questions sur le format de commande ont reçu une réponse rapide.",
      "Les documents liés au lot étaient organisés dans un format utile.",
      "Le récapitulatif final de la commande était précis et concis.",
    ],
    endings: [
      "Une expérience d’approvisionnement professionnelle et fluide.",
      "Nous avons apprécié la coordination réactive.",
      "Le flux convenait bien à un achat professionnel.",
      "La transmission claire a facilité notre contrôle interne.",
      "Nous utiliserions volontiers le même processus à nouveau.",
      "Le service est resté constant jusqu’à la fin.",
    ],
  },
  zh: {
    openings: [
      "从订单确认开始，沟通一直比较清楚。",
      "整个订单过程都有稳定的进度更新。",
      "我们很快收到了条理清晰的回复。",
      "后续沟通直接明了，理解起来很轻松。",
      "供应沟通始终围绕规格和文件展开。",
      "从首次确认开始，整体流程安排得很有序。",
    ],
    details: [
      "规格清单与双方确认的配置一致。",
      "相关文件整理清楚，内部审核比较方便。",
      "包装整齐，各个产品规格也容易辨认。",
      "进度更新让发运时间更容易掌握。",
      "多产品组合的信息展示得比较清楚。",
      "关于订单形式的问题得到了及时回复。",
      "批次相关文件的排列方式很实用。",
      "最终订单汇总准确且简洁。",
    ],
    endings: [
      "整体是一次顺畅的专业采购体验。",
      "我们很认可这次响应和协调。",
      "这套流程比较适合专业采购。",
      "清晰的交接也方便了我们的内部核对。",
      "后续复购仍愿意沿用这一流程。",
      "直到完成，服务衔接都比较稳定。",
    ],
  },
};

export function createIllustrativeFeedback(
  seed: string,
  context: IllustrativeFeedbackContext,
): FeedbackContent {
  const base = stableNumber(`${seed}:${context.service}:${context.orderKind}`);
  return Object.fromEntries(
    (Object.keys(phrasePools) as SiteLocale[]).map((locale, localeIndex) => {
      const pool = phrasePools[locale];
      const opening = pool.openings[(base + localeIndex) % pool.openings.length];
      const detail = pool.details[(Math.floor(base / 7) + context.itemCount + localeIndex) % pool.details.length];
      const ending = pool.endings[(Math.floor(base / 31) + localeIndex) % pool.endings.length];
      return [locale, `${opening} ${detail} ${ending}`];
    }),
  ) as FeedbackContent;
}

const sensitivePatterns = [
  /treat|cure|disease|dose|dosage|inject|injection|weight\s*loss|muscle\s*gain|patient|therapeutic/i,
  /治疗|治愈|疾病|剂量|注射|减重|增肌|患者|疗效|药效/,
  /tratar|cura|doença|dose|injeção|perda de peso|paciente|terapêutic/i,
  /tratamiento|curar|enfermedad|dosis|inyección|pérdida de peso|paciente|terapéutic/i,
  /traitement|guérir|maladie|dose|injection|perte de poids|patient|thérapeut/i,
];

const unsupportedPurityPatterns = [
  /(?:100\s*%\s*(?:pure|purity)|(?:pure|purity)\s*(?:at\s*)?100\s*%|guaranteed purity|highest purity|purest)/i,
  /百分之百|保证纯度|最高纯度|最纯/,
  /pureza garantida|maior pureza/i,
  /pureza garantizada|máxima pureza/i,
  /pureté garantie|pureté maximale/i,
];

export function feedbackRiskFlags(text: string) {
  const flags: string[] = [];
  if (sensitivePatterns.some((pattern) => pattern.test(text))) {
    flags.push("medical_or_effect_claim");
  }
  if (unsupportedPurityPatterns.some((pattern) => pattern.test(text))) {
    flags.push("unsupported_purity_claim");
  }
  return flags;
}

export function destinationCode(destination: string) {
  if (destination === "United States") return "US";
  if (destination === "Canada") return "CA";
  if (destination === "Brazil") return "BR";
  if (destination === "Mexico") return "MX";
  return "";
}
