"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { siteConfig } from "../site.config";
import {
  htmlLang,
  isSiteLocale,
  LANGUAGE_OPTIONS,
  LOCALE_STORAGE_KEY,
  type SiteLocale as Locale,
} from "./i18n";

type DocumentKind = "privacy" | "terms" | "compliance";

const shared = {
  en: {
    back: "← Back to Peptivanta",
    region: "Hong Kong SAR · Sales & Export Coordination",
  },
  pt: {
    back: "← Voltar para Peptivanta",
    region: "Hong Kong SAR · Coordenação de vendas e exportação",
  },
  es: {
    back: "← Volver a Peptivanta",
    region: "RAE de Hong Kong · Coordinación comercial y de exportación",
  },
  fr: {
    back: "← Retour à Peptivanta",
    region: "R.A.S. de Hong Kong · Coordination commerciale et export",
  },
  zh: {
    back: "← 返回 Peptivanta 首页",
    region: "中国香港特别行政区 · 销售与出口协调",
  },
} as const;

const documents = {
  privacy: {
    en: {
      tag: "Legal information",
      title: "Privacy Policy",
      date: "Last updated: August 8, 2026",
      sections: [
        ["Information we receive", "When you submit or continue an inquiry, we may receive your name, organization, destination country, contact details, requested product, estimated quantity, intended professional use, and the content of your message."],
        ["How information is used", "Information is used to assess customer qualification, destination eligibility, documentation availability, quotation needs, and export coordination. We do not use inquiry information to provide medical advice or consumer-use recommendations."],
        ["WhatsApp and external services", "If you choose to continue through WhatsApp or email, your information is also subject to the privacy terms of that service. Do not send confidential personal health information through the website."],
        ["Customer accounts and feedback", "If you create a customer account, we store your username, lightweight one-way credential records, profile details, linked-order references, login-session records, profile-change history, and feedback submissions. Passwords, recovery codes, binding codes, and session tokens are not stored in readable form. Approved feedback and authorized media remain public for up to 180 days; rejected or expired public content is removed from display."],
        ["Retention and requests", "Business inquiry records may be retained for compliance, service, and commercial recordkeeping purposes. Contact us through the published business channel to request access, correction, or deletion where applicable."],
      ],
    },
    pt: {
      tag: "Informações legais",
      title: "Política de Privacidade",
      date: "Última atualização: 8 de agosto de 2026",
      sections: [
        ["Informações que recebemos", "Ao enviar ou continuar uma consulta, podemos receber seu nome, organização, país de destino, dados de contato, produto solicitado, quantidade estimada, uso profissional pretendido e o conteúdo da mensagem."],
        ["Como usamos as informações", "As informações são usadas para avaliar a qualificação do cliente, elegibilidade do destino, disponibilidade documental, necessidades de cotação e coordenação de exportação. Não usamos os dados da consulta para fornecer orientação médica ou recomendações de uso ao consumidor."],
        ["WhatsApp e serviços externos", "Se você optar por continuar pelo WhatsApp ou e-mail, seus dados também estarão sujeitos aos termos de privacidade desse serviço. Não envie informações confidenciais de saúde pessoal pelo site."],
        ["Contas de clientes e feedback", "Ao criar uma conta de cliente, armazenamos seu nome de usuário, registros unidirecionais leves das credenciais, dados do perfil, referências de pedidos vinculados, sessões de acesso, histórico de alterações e feedback enviado. Senhas, códigos de recuperação, códigos de vínculo e tokens de sessão não são armazenados de forma legível. Feedback aprovado e mídia autorizada permanecem públicos por até 180 dias."],
        ["Retenção e solicitações", "Registros de consultas comerciais podem ser mantidos para fins de conformidade, atendimento e registro comercial. Entre em contato pelo canal empresarial publicado para solicitar acesso, correção ou exclusão, quando aplicável."],
      ],
    },
    es: {
      tag: "Información legal",
      title: "Política de Privacidad",
      date: "Última actualización: 8 de agosto de 2026",
      sections: [
        ["Información que recibimos", "Cuando envía o continúa una consulta, podemos recibir su nombre, organización, país de destino, datos de contacto, producto solicitado, cantidad estimada, uso profesional previsto y el contenido de su mensaje."],
        ["Cómo utilizamos la información", "La información se utiliza para evaluar la cualificación del cliente, la elegibilidad del destino, la disponibilidad documental, las necesidades de cotización y la coordinación de exportación. No utilizamos los datos de la consulta para ofrecer asesoramiento médico ni recomendaciones de uso al consumidor."],
        ["WhatsApp y servicios externos", "Si decide continuar por WhatsApp o correo electrónico, su información también estará sujeta a las condiciones de privacidad de dicho servicio. No envíe información personal de salud confidencial a través del sitio web."],
        ["Cuentas de clientes y comentarios", "Al crear una cuenta de cliente, almacenamos el nombre de usuario, registros unidireccionales ligeros de credenciales, datos del perfil, referencias de pedidos vinculados, sesiones, historial de cambios y comentarios enviados. Las contraseñas, códigos de recuperación, códigos de vinculación y tokens de sesión no se almacenan de forma legible. Los comentarios aprobados y medios autorizados permanecen públicos hasta 180 días."],
        ["Conservación y solicitudes", "Los registros de consultas comerciales pueden conservarse con fines de cumplimiento, servicio y archivo empresarial. Utilice el canal comercial publicado para solicitar acceso, corrección o eliminación cuando corresponda."],
      ],
    },
    fr: {
      tag: "Informations juridiques",
      title: "Politique de confidentialité",
      date: "Dernière mise à jour : 8 août 2026",
      sections: [
        ["Informations que nous recevons", "Lorsque vous soumettez ou poursuivez une demande, nous pouvons recevoir votre nom, votre organisation, le pays de destination, vos coordonnées, le produit recherché, la quantité estimée, l’usage professionnel prévu et le contenu de votre message."],
        ["Utilisation des informations", "Ces informations servent à évaluer la qualification du client, l’éligibilité de la destination, la disponibilité des documents, les besoins de devis et la coordination de l’exportation. Elles ne sont pas utilisées pour fournir des conseils médicaux ou des recommandations d’usage destinées aux consommateurs."],
        ["WhatsApp et services externes", "Si vous poursuivez l’échange via WhatsApp ou par e-mail, vos informations sont également soumises aux conditions de confidentialité de ce service. Ne transmettez pas de données personnelles de santé confidentielles via le site."],
        ["Comptes clients et avis", "Lors de la création d’un compte client, nous conservons le nom d’utilisateur, des empreintes unidirectionnelles légères des identifiants, le profil, les références de commandes liées, les sessions, l’historique des modifications et les avis soumis. Les mots de passe, codes de récupération, codes de liaison et jetons de session ne sont pas stockés sous une forme lisible. Les avis approuvés et médias autorisés restent publics jusqu’à 180 jours."],
        ["Conservation et demandes", "Les dossiers de demandes commerciales peuvent être conservés à des fins de conformité, de service et d’archivage commercial. Utilisez le canal professionnel publié pour demander l’accès, la rectification ou la suppression de vos données lorsque cela s’applique."],
      ],
    },
    zh: {
      tag: "法律信息",
      title: "隐私政策",
      date: "最后更新：2026 年 8 月 8 日",
      sections: [
        ["我们可能接收的信息", "当你提交或继续询盘时，我们可能会接收你的姓名、公司或机构、目的国家或地区、联系方式、所需产品、预计数量、预期专业用途以及消息内容。"],
        ["信息的使用方式", "相关信息用于评估客户资质、目的地供应条件、文件可用性、报价需求及出口协调。我们不会使用询盘信息提供医疗建议或消费者使用推荐。"],
        ["WhatsApp 与外部服务", "如果你选择通过 WhatsApp 或电子邮件继续沟通，你的信息也将受相应服务的隐私条款约束。请勿通过本网站发送个人健康隐私信息。"],
        ["客户账号与反馈", "创建客户账号后，我们会保存轻量单向凭据记录、资料、已关联订单编号、资料修改留痕及提交的反馈。账号/恢复码/订单绑定码和会话令牌均不会以可读取的明文保存。审核通过的反馈和已获授权素材公开保留最长 180 天；被拒绝或到期的内容不再公开展示。"],
        ["信息保存与相关请求", "出于合规、服务和商业记录需要，业务询盘记录可能会被保留。在适用情况下，你可以通过网站公布的商务渠道申请访问、更正或删除相关信息。"],
      ],
    },
  },
  terms: {
    en: {
      tag: "Legal information",
      title: "Website Terms",
      date: "Last updated: August 8, 2026",
      sections: [
        ["Professional audience", "This website is intended for organizations and qualified professional customers. It is not a consumer pharmacy, clinic, telehealth service, or source of medical advice."],
        ["No online sale", "Catalogue content is informational and does not constitute an offer for unrestricted sale. A website inquiry creates no order or supply commitment. Customer, intended-use, destination, documentation, and legal reviews may be required before a quotation."],
        ["Product information", "Configurations and document availability can vary by batch. Final specifications, packaging, lead time, documentation, and commercial terms must be confirmed in writing for each qualified inquiry."],
        ["Accounts, feedback, and media", "Customer accounts are provided only for linked-order and feedback workflows. Customer-submitted feedback is reviewed before publication. System-generated content is always labelled as illustrative service feedback and is not represented as a genuine customer testimonial. Users may submit only content and media they are authorized to share; medical, dosing, treatment, or efficacy claims are not accepted."],
        ["Acceptable use", "You may not use this website to seek products for unlawful, unauthorized, human, or veterinary administration. We may refuse or discontinue any request that does not meet professional or legal requirements."],
      ],
    },
    pt: {
      tag: "Informações legais",
      title: "Termos do Site",
      date: "Última atualização: 8 de agosto de 2026",
      sections: [
        ["Público profissional", "Este site é destinado a organizações e clientes profissionais qualificados. Não é uma farmácia de varejo, clínica, serviço de telessaúde ou fonte de orientação médica."],
        ["Sem venda online", "O conteúdo do catálogo é informativo e não constitui oferta de venda irrestrita. Uma consulta pelo site não cria pedido nem compromisso de fornecimento. Avaliações do cliente, uso pretendido, destino, documentos e legislação podem ser exigidas antes da cotação."],
        ["Informações dos produtos", "As configurações e a disponibilidade documental podem variar por lote. Especificações finais, embalagem, prazo, documentação e condições comerciais devem ser confirmadas por escrito para cada consulta qualificada."],
        ["Contas, feedback e mídia", "As contas de clientes servem apenas para pedidos vinculados e feedback. Opiniões de clientes são revisadas antes da publicação. Conteúdo gerado pelo sistema é sempre identificado como feedback ilustrativo e não é apresentado como depoimento real. Só podem ser enviados conteúdos e mídias com autorização; não aceitamos alegações médicas, de dose, tratamento ou eficácia."],
        ["Uso aceitável", "Você não pode usar este site para buscar produtos destinados a uso ilícito, não autorizado, humano ou veterinário. Podemos recusar ou interromper qualquer solicitação que não cumpra requisitos profissionais ou legais."],
      ],
    },
    es: {
      tag: "Información legal",
      title: "Condiciones del Sitio",
      date: "Última actualización: 8 de agosto de 2026",
      sections: [
        ["Público profesional", "Este sitio web está dirigido a organizaciones y clientes profesionales cualificados. No es una farmacia minorista, clínica, servicio de telesalud ni fuente de asesoramiento médico."],
        ["Sin venta online", "El contenido del catálogo es informativo y no constituye una oferta de venta sin restricciones. Una consulta desde el sitio no genera un pedido ni un compromiso de suministro. Antes de cotizar puede ser necesario revisar al cliente, el uso previsto, el destino, la documentación y los requisitos legales."],
        ["Información de producto", "Las configuraciones y la disponibilidad documental pueden variar según el lote. Las especificaciones finales, el embalaje, el plazo, la documentación y las condiciones comerciales deben confirmarse por escrito para cada consulta profesional."],
        ["Cuentas, comentarios y medios", "Las cuentas de clientes se limitan a pedidos vinculados y comentarios. Los comentarios de clientes se revisan antes de publicarse. El contenido generado por el sistema siempre se identifica como ejemplo ilustrativo y no se presenta como testimonio real. Solo puede enviarse contenido o material autorizado; no se aceptan afirmaciones médicas, de dosis, tratamiento o eficacia."],
        ["Uso aceptable", "No puede utilizar este sitio para solicitar productos destinados a usos ilícitos, no autorizados, humanos o veterinarios. Podemos rechazar o interrumpir cualquier solicitud que no cumpla los requisitos profesionales o legales."],
      ],
    },
    fr: {
      tag: "Informations juridiques",
      title: "Conditions d’utilisation du site",
      date: "Dernière mise à jour : 8 août 2026",
      sections: [
        ["Public professionnel", "Ce site s’adresse aux organisations et aux clients professionnels qualifiés. Il ne s’agit ni d’une pharmacie grand public, ni d’une clinique, ni d’un service de télésanté, ni d’une source de conseils médicaux."],
        ["Aucune vente en ligne", "Le contenu du catalogue est fourni à titre informatif et ne constitue pas une offre de vente sans restriction. Une demande effectuée sur le site ne crée ni commande ni engagement de fourniture. Une vérification du client, de l’usage prévu, de la destination, des documents et du cadre légal peut être requise avant tout devis."],
        ["Informations produit", "Les configurations et la disponibilité des documents peuvent varier selon le lot. Les spécifications finales, l’emballage, le délai, la documentation et les conditions commerciales doivent être confirmés par écrit pour chaque demande professionnelle."],
        ["Comptes, avis et médias", "Les comptes clients sont limités aux commandes liées et aux avis. Les avis clients sont contrôlés avant publication. Le contenu généré par le système est toujours identifié comme exemple illustratif et n’est pas présenté comme un témoignage réel. Seuls les contenus et médias autorisés peuvent être soumis; les allégations médicales, de dosage, de traitement ou d’efficacité sont refusées."],
        ["Utilisation acceptable", "Vous ne pouvez pas utiliser ce site pour rechercher des produits destinés à une utilisation illicite, non autorisée, humaine ou vétérinaire. Nous pouvons refuser ou interrompre toute demande qui ne répond pas aux exigences professionnelles ou légales."],
      ],
    },
    zh: {
      tag: "法律信息",
      title: "网站使用条款",
      date: "最后更新：2026 年 8 月 8 日",
      sections: [
        ["专业用户范围", "本网站面向公司、机构及合格专业客户，不属于消费者药房、诊所、远程医疗服务或医疗建议来源。"],
        ["不构成在线销售", "产品目录仅用于信息展示，不构成不受限制的销售要约。提交网站询盘不会自动形成订单或供货承诺。报价前可能需要进行客户、预期用途、目的地、文件及法律合规审核。"],
        ["产品信息", "产品规格和文件可用性可能因批次而异。每一份合格询盘的最终规格、包装、交期、文件及商务条款均需另行书面确认。"],
        ["账号、反馈与素材", "客户账号仅用于关联订单和提交反馈。真实客户反馈必须先经人工审核；系统生成内容始终标注为“示例服务反馈”，不得冒充真实客户证言。用户只能提交自己拥有或已获授权的内容与素材；医疗、剂量、治疗或药效类表述不予发布。"],
        ["可接受的使用方式", "不得通过本网站寻求用于违法、未经授权、人用或兽用给药的产品。对于不符合专业或法律要求的请求，我们有权拒绝或终止处理。"],
      ],
    },
  },
  compliance: {
    en: {
      tag: "Responsible supply",
      title: "Compliance Notice",
      date: "Qualified professional inquiries only",
      sections: [
        ["Intended professional applications", "Products displayed may be considered only for qualified research, analytical, formulation-development, manufacturing, or other lawful professional applications. They are not presented as medicines and are not intended for human or veterinary use."],
        ["No medical or consumer-use content", "We do not provide medical claims, treatment recommendations, dosing, reconstitution instructions, injection guidance, before-and-after testimonials, or advice for personal use."],
        ["Customer and destination review", "Product eligibility can differ by jurisdiction. We may request organization details, intended-use information, import credentials, end-user declarations, or other documents. A request may be declined when the destination or intended use cannot be supported lawfully."],
        ["Documentation", "References to COA or analytical information mean that availability will be checked for the relevant product and batch. No certification, approval, accreditation, or regulatory status should be inferred unless it is expressly supported by current documentary evidence."],
      ],
    },
    pt: {
      tag: "Fornecimento responsável",
      title: "Aviso de Conformidade",
      date: "Somente consultas profissionais qualificadas",
      sections: [
        ["Aplicações profissionais pretendidas", "Os produtos exibidos podem ser considerados apenas para pesquisa qualificada, análise, desenvolvimento de formulações, fabricação ou outras aplicações profissionais lícitas. Não são apresentados como medicamentos e não se destinam ao uso humano ou veterinário."],
        ["Sem conteúdo médico ou de uso ao consumidor", "Não fornecemos alegações médicas, recomendações de tratamento, doses, instruções de reconstituição, orientação de injeção, depoimentos de antes e depois ou aconselhamento para uso pessoal."],
        ["Análise do cliente e do destino", "A elegibilidade do produto pode variar conforme a jurisdição. Podemos solicitar dados da organização, informações de uso pretendido, credenciais de importação, declarações de usuário final ou outros documentos. Uma solicitação pode ser recusada quando o destino ou uso pretendido não puder ser atendido legalmente."],
        ["Documentação", "Referências a COA ou informações analíticas significam que a disponibilidade será verificada para o produto e lote pertinentes. Nenhuma certificação, aprovação, acreditação ou situação regulatória deve ser presumida sem suporte expresso em documentação atual."],
      ],
    },
    es: {
      tag: "Suministro responsable",
      title: "Aviso de Cumplimiento",
      date: "Solo consultas profesionales cualificadas",
      sections: [
        ["Aplicaciones profesionales previstas", "Los productos mostrados solo pueden considerarse para investigación cualificada, análisis, desarrollo de formulaciones, fabricación u otras aplicaciones profesionales lícitas. No se presentan como medicamentos ni están destinados al uso humano o veterinario."],
        ["Sin contenido médico ni de uso al consumidor", "No proporcionamos afirmaciones médicas, recomendaciones de tratamiento, dosis, instrucciones de reconstitución, orientación sobre inyecciones, testimonios de antes y después ni consejos para uso personal."],
        ["Revisión del cliente y del destino", "La elegibilidad del producto puede variar según la jurisdicción. Podemos solicitar datos de la organización, información sobre el uso previsto, credenciales de importación, declaraciones del usuario final u otros documentos. Una solicitud puede rechazarse cuando el destino o el uso previsto no pueda atenderse legalmente."],
        ["Documentación", "Las referencias a COA o información analítica significan que se comprobará su disponibilidad para el producto y lote correspondientes. No debe presuponerse ninguna certificación, aprobación, acreditación o situación regulatoria salvo que esté respaldada expresamente por documentación vigente."],
      ],
    },
    fr: {
      tag: "Approvisionnement responsable",
      title: "Avis de conformité",
      date: "Demandes professionnelles qualifiées uniquement",
      sections: [
        ["Applications professionnelles prévues", "Les produits présentés peuvent uniquement être envisagés pour la recherche qualifiée, l’analyse, le développement de formulations, la fabrication ou d’autres applications professionnelles licites. Ils ne sont pas présentés comme des médicaments et ne sont pas destinés à un usage humain ou vétérinaire."],
        ["Aucun contenu médical ou destiné aux consommateurs", "Nous ne fournissons aucune allégation médicale, recommandation de traitement, posologie, instruction de reconstitution, indication d’injection, témoignage avant-après ou conseil d’usage personnel."],
        ["Vérification du client et de la destination", "L’éligibilité d’un produit peut varier selon la juridiction. Nous pouvons demander des informations sur l’organisation et l’usage prévu, des justificatifs d’importation, une déclaration de l’utilisateur final ou d’autres documents. Une demande peut être refusée lorsque la destination ou l’usage prévu ne peut pas être pris en charge légalement."],
        ["Documentation", "Toute référence à un COA ou à des informations analytiques signifie que leur disponibilité sera vérifiée pour le produit et le lot concernés. Aucune certification, approbation, accréditation ou situation réglementaire ne doit être présumée sans preuve documentaire actuelle et explicite."],
      ],
    },
    zh: {
      tag: "负责任的供应",
      title: "合规声明",
      date: "仅接受合格专业用途询盘",
      sections: [
        ["预期专业应用", "网站展示的产品仅可用于合格的科研、分析、配方开发、制造或其他合法专业应用，不作为药品展示，也不面向人用或兽用。"],
        ["不提供医疗或消费者使用内容", "我们不提供医疗功效宣称、治疗建议、剂量信息、复溶说明、注射指导、使用前后对比案例或个人使用建议。"],
        ["客户与目的地审核", "不同司法管辖区的产品供应条件可能不同。我们可能要求提供机构信息、预期用途、进口资质、最终用户声明或其他文件。当目的地或预期用途无法获得合法支持时，相关请求可能被拒绝。"],
        ["文件说明", "网站提及 COA 或分析信息，仅表示我们会针对相关产品和批次核查其可用性。除非有当前有效文件明确支持，否则不应推定任何认证、批准、认可或监管状态。"],
      ],
    },
  },
} as const;

export default function LegalDocument({ kind }: { kind: DocumentKind }) {
  const [locale, setLocale] = useState<Locale>("en");
  const content = documents[kind][locale];
  const common = shared[locale];

  useEffect(() => {
    let localeFrame = 0;

    try {
      const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isSiteLocale(savedLocale)) {
        localeFrame = window.requestAnimationFrame(() => {
          setLocale(savedLocale);
          document.documentElement.lang = htmlLang(savedLocale);
        });
      }
    } catch {
      // The legal page remains available in English when storage is unavailable.
    }

    return () => window.cancelAnimationFrame(localeFrame);
  }, []);

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    document.documentElement.lang = htmlLang(nextLocale);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // Keep the selected language for this page when storage is unavailable.
    }
  }

  return (
    <main className={`legal-page${locale === "zh" ? " legal-page-zh" : ""}`}>
      <div className="legal-toolbar">
        <Link className="legal-back" href="/">{common.back}</Link>
        <label className="language-select">
          <span aria-hidden="true">LANG</span>
          <span className="sr-only">Language / Idioma / Langue / 语言</span>
          <select
            value={locale}
            onChange={(event) => changeLocale(event.target.value as Locale)}
            aria-label="Language / Idioma / Langue / 语言"
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option value={option.code} key={option.code}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="section-tag">{content.tag}</p>
      <h1>{content.title}</h1>
      <p className="legal-date">{content.date}</p>

      {content.sections.map(([title, text]) => (
        <section key={title}>
          <h2>{title}</h2>
          <p>{text}</p>
        </section>
      ))}

      <footer>{siteConfig.fullBrandName} · {common.region}</footer>
    </main>
  );
}
