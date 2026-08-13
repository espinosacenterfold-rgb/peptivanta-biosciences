"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createWhatsAppUrl, siteConfig } from "../site.config";
import {
  htmlLang,
  isSiteLocale,
  LANGUAGE_OPTIONS,
  LOCALE_STORAGE_KEY,
  type SiteLocale as Locale,
} from "./i18n";
import FactoryWorkflow from "./FactoryWorkflow";

type Category = "all" | "catalogue" | "cosmetic" | "custom";
type IntroState = "hidden" | "visible" | "closing";

const INTRO_SESSION_KEY = "peptivanta-factory-intro-seen";

const customerAccessLabels: Record<Locale, string> = {
  en: "Customer access",
  pt: "Acesso do cliente",
  es: "Acceso de clientes",
  fr: "Accès client",
  zh: "客户登录",
};

const copy = {
  en: {
    nav: ["Products", "Quality", "COA documents", "Private label", "Company", "Recent fulfillment"],
    navIds: ["products", "quality", "coa", "private-label", "company", "fulfillment"],
    eyebrow: "Peptide catalogue · Private label · Export coordination",
    heroTitleA: "Peptide supply,",
    heroTitleB: "made clear.",
    heroText:
      "Documented catalogue peptides, flexible private-label support, and responsive export coordination for qualified professional customers.",
    primaryCta: "Request a quote",
    secondaryCta: "Explore catalogue",
    introReplay: "Watch the workflow",
    introSkip: "Skip intro",
    introKicker: "Peptivanta · Operations",
    introLead: "Precision",
    introFinish: "in motion.",
    introStatement: "A visible path from line preparation and automated handling to labelled inventory control.",
    introStages: ["Prepare", "Process", "Label", "Pack", "Track"],
    introAria: "Peptivanta facility workflow introduction",
    introMeta: "FACTORY WORKFLOW · MUTED · 08 SEC",
    imageLabel: "Controlled packaging environment",
    imageSub: "Authentic operational facility image",
    heroImageAlt: "Controlled packaging facility",
    proof: [
      ["Batch-linked", "documentation"],
      ["Professional", "B2B support"],
      ["Global", "export coordination"],
    ],
    introTag: "A clearer supply experience",
    introTitle: "Built around documents, not promises.",
    introText:
      "A focused workflow for distributors, research organizations, formulation teams, and qualified commercial buyers.",
    pillars: [
      ["01", "Defined specifications", "Product, format, quantity, and documentation are confirmed before quotation."],
      ["02", "Quality visibility", "Available COA, analytical data, and batch information are reviewed with each inquiry."],
      ["03", "Human support", "A dedicated contact follows the request from qualification through dispatch."],
    ],
    workflowTag: "Factory workflow",
    workflowTitle: "One line. Five visible stages.",
    workflowText:
      "Follow the movement from prepared components through automated handling, identification, packaging, and inventory control inside our manufacturing facility.",
    workflowMediaLabel: "FACTORY PROCESS VIEW",
    workflowHint: "Scroll or select a stage to continue",
    workflowSteps: [
      ["01", "Prepare", "Components are arranged and the line is readied for an organized production run.", "LINE SETUP"],
      ["02", "Process", "Automated transfer moves units consistently through the production line.", "AUTOMATED HANDLING"],
      ["03", "Label", "Product identification is applied through the dedicated labelling stage.", "IDENTIFICATION"],
      ["04", "Pack", "Finished units are grouped and organized for controlled handling.", "PACKAGING"],
      ["05", "Track", "Inventory is scanned, placed, and organized for the next operational step.", "INVENTORY CONTROL"],
    ],
    categoryTag: "Products Categories",
    categoryTitle: "A clearer way into the catalogue.",
    categoryText:
      "Browse by supply format and professional application. Open any category to view matching products and request availability, MOQ, and a quotation.",
    categoryItems: [
      ["01", "Catalogue Peptides", "Defined configurations across a broad peptide catalogue.", "Retatrutide · Tirzepatide · BPC-157", "catalogue"],
      ["02", "Cosmetic Ingredients", "Peptide ingredients for qualified formulation and sourcing teams.", "GHK-Cu · Acetyl Hexapeptide-8", "cosmetic"],
      ["03", "Peptide Blends", "Configuration-led discussion for multi-component product requirements.", "Specification review · Batch planning", "catalogue"],
      ["04", "Bulk Supply", "Quantity, format, documentation, and destination reviewed together.", "Commercial quantities · Export review", "custom"],
      ["05", "Private Label", "Label artwork, vial presentation, and packaging coordination.", "OEM · Packaging · Brand support", "custom"],
      ["06", "Custom Inquiry", "A guided path for requirements not covered by the visible catalogue.", "Sequence · Format · Documentation", "custom"],
    ],
    productsTag: "Selected catalogue",
    productsTitle: "Find a starting point.",
    productsText:
      "Representative items from a broader catalogue. Availability and destination eligibility are confirmed individually.",
    search: "Search product name",
    categories: ["All", "Catalogue peptides", "Cosmetic ingredients", "Custom & bulk"],
    ask: "Get quote on WhatsApp",
    docs: "Documentation review",
    noProducts: "No matching products.",
    productGroupLabel: "Product categories",
    qualityTag: "Quality framework",
    qualityTitle: "Traceable by design.",
    qualityText:
      "Our process prioritizes specification alignment, document availability, careful packaging, and clear handover.",
    steps: [
      ["01", "Requirement review", "We confirm product identity, configuration, quantity, destination, and professional use."],
      ["02", "Document alignment", "Available batch information and analytical documents are matched to the request."],
      ["03", "Packaging control", "Packaging configuration and handling requirements are confirmed before dispatch."],
      ["04", "Export coordination", "Shipping options are reviewed against destination requirements and order profile."],
    ],
    facilityKicker: "Manufacturing facility",
    facilityTitle: "Inside our production and inventory environment.",
    facilityText:
      "The imagery shown on this site comes from our production line and inventory operations. Product availability and applicable documentation are confirmed with each request.",
    inventoryCaption: "Organized inventory and order allocation",
    facilityMetrics: ["Availability review", "Analytical data where available"],
    privateTag: "Private-label support",
    privateTitle: "Your brand, with a more disciplined workflow.",
    privateText:
      "For qualified distributors and brand teams, we support label artwork coordination, packaging configuration, and batch-based production planning.",
    privateBullets: [
      "Label size and artwork review",
      "Low-volume pilot discussion",
      "Batch and packaging coordination",
      "Confidential B2B communication",
    ],
    privateCta: "Discuss a private-label project",
    vialsAlt: "Unlabelled vials prepared for packaging",
    customLabelSystem: "CUSTOM LABEL SYSTEM",
    companyTag: "The brand",
    companyTitle: "Peptivanta Biosciences is designed around professional supply clarity.",
    companyText:
      "Peptivanta Biosciences is our product and service brand for professional customer communication, request qualification, documentation coordination, and export follow-through.",
    companyDetails: ["Operating region", "Brand focus", "Response target", "Registered address"],
    operatingRegion: "Hong Kong SAR · Sales & Export Coordination",
    brandFocusValue: "Professional peptide supply inquiries",
    responseTime: "Within one business day",
    inquiryTag: "Quote & availability",
    inquiryTitle: "Request availability and pricing.",
    inquiryText:
      "Share the product, configuration, quantity, and destination. We will reply with available options, MOQ, document availability, and export coordination details.",
    form: {
      name: "Your name",
      company: "Company / organization",
      country: "Destination country",
      contact: "Email or WhatsApp (optional)",
      product: "Product or service",
      quantity: "Estimated quantity (optional)",
      use: "Professional intended use (optional)",
      placeholderUse: "Research, analytical, formulation, distribution…",
      consent: "I confirm this is a professional inquiry and accept the compliance notice.",
      submit: "Get quote on WhatsApp",
      missing:
        "The site owner has not added a WhatsApp number yet. Please update site.config.ts before launch.",
    },
    complianceTitle: "Professional-use and compliance notice",
    complianceText:
      "Products displayed are offered only for qualified research, analytical, formulation-development, or other lawful professional applications. They are not presented as medicines and are not for human or veterinary use. No medical claims, dosing advice, or consumer-use instructions are provided. Supply is subject to customer qualification, destination-country review, and applicable law.",
    footerNote: "Documented peptide supply for qualified professional customers.",
    footerLinks: ["Privacy", "Terms", "Compliance"],
    contactLabels: ["WhatsApp", "Email"],
    contactMissing: ["Add number in site.config.ts", "Add email in site.config.ts"],
    whatsappCta: "Get quote",
    whatsappAria: "WhatsApp inquiry",
    servicePrinciplesLabel: "Service principles",
    menuLabel: "Toggle navigation",
    navLabel: "Primary navigation",
  },
  pt: {
    nav: ["Produtos", "Qualidade", "Documentos COA", "Marca própria", "Empresa", "Atividade recente"],
    navIds: ["products", "quality", "coa", "private-label", "company", "fulfillment"],
    eyebrow: "Catálogo de peptídeos · Marca própria · Coordenação de exportação",
    heroTitleA: "Fornecimento de peptídeos,",
    heroTitleB: "com mais clareza.",
    heroText:
      "Peptídeos de catálogo documentados, suporte flexível de marca própria e coordenação ágil de exportação para clientes profissionais qualificados.",
    primaryCta: "Solicitar cotação",
    secondaryCta: "Ver catálogo",
    introReplay: "Ver o fluxo",
    introSkip: "Pular abertura",
    introKicker: "Peptivanta · Operações",
    introLead: "Precisão",
    introFinish: "em movimento.",
    introStatement: "Um percurso visível da preparação da linha e do manuseio automatizado ao controle do estoque identificado.",
    introStages: ["Preparar", "Processar", "Rotular", "Embalar", "Rastrear"],
    introAria: "Introdução ao fluxo operacional da Peptivanta",
    introMeta: "FLUXO DA FÁBRICA · SEM ÁUDIO · 08 SEG",
    imageLabel: "Ambiente controlado de embalagem",
    imageSub: "Imagem autêntica do ambiente operacional",
    heroImageAlt: "Ambiente controlado de embalagem",
    proof: [
      ["Documentação", "vinculada ao lote"],
      ["Suporte", "B2B profissional"],
      ["Global", "coordenação de exportação"],
    ],
    introTag: "Uma experiência de fornecimento mais clara",
    introTitle: "Baseado em documentos, não em promessas.",
    introText:
      "Um fluxo objetivo para distribuidores, organizações de pesquisa, equipes de formulação e compradores comerciais qualificados.",
    pillars: [
      ["01", "Especificações definidas", "Produto, formato, quantidade e documentação são confirmados antes da cotação."],
      ["02", "Visibilidade de qualidade", "COA, dados analíticos e informações de lote disponíveis são revisados em cada consulta."],
      ["03", "Suporte humano", "Um contato dedicado acompanha a solicitação até a expedição."],
    ],
    workflowTag: "Fluxo da fábrica",
    workflowTitle: "Uma linha. Cinco etapas visíveis.",
    workflowText:
      "Acompanhe o percurso dos componentes preparados pelo manuseio automatizado, identificação, embalagem e controle de estoque dentro de nossa fábrica.",
    workflowMediaLabel: "VISÃO DO PROCESSO",
    workflowHint: "Role ou selecione uma etapa para continuar",
    workflowSteps: [
      ["01", "Preparar", "Os componentes são organizados e a linha é preparada para uma produção ordenada.", "PREPARAÇÃO DA LINHA"],
      ["02", "Processar", "A transferência automatizada conduz as unidades de forma consistente pela linha.", "MANUSEIO AUTOMATIZADO"],
      ["03", "Rotular", "A identificação do produto é aplicada na etapa dedicada de rotulagem.", "IDENTIFICAÇÃO"],
      ["04", "Embalar", "As unidades finalizadas são agrupadas e organizadas para o manuseio controlado.", "EMBALAGEM"],
      ["05", "Rastrear", "O estoque é escaneado, armazenado e organizado para a próxima etapa operacional.", "CONTROLE DE ESTOQUE"],
    ],
    categoryTag: "Products Categories",
    categoryTitle: "Uma entrada mais clara para o catálogo.",
    categoryText:
      "Navegue por formato de fornecimento e aplicação profissional. Abra uma categoria para ver os produtos e solicitar disponibilidade, MOQ e cotação.",
    categoryItems: [
      ["01", "Peptídeos de catálogo", "Configurações definidas em um amplo catálogo de peptídeos.", "Retatrutide · Tirzepatide · BPC-157", "catalogue"],
      ["02", "Ingredientes cosméticos", "Ingredientes peptídicos para equipes qualificadas de formulação e compras.", "GHK-Cu · Acetyl Hexapeptide-8", "cosmetic"],
      ["03", "Misturas de peptídeos", "Discussão orientada por especificações para requisitos multicomponentes.", "Especificação · Planejamento de lote", "catalogue"],
      ["04", "Fornecimento a granel", "Quantidade, formato, documentos e destino revisados em conjunto.", "Volume comercial · Revisão de exportação", "custom"],
      ["05", "Marca própria", "Coordenação de arte, apresentação dos frascos e embalagem.", "OEM · Embalagem · Suporte de marca", "custom"],
      ["06", "Consulta personalizada", "Um caminho guiado para requisitos fora do catálogo visível.", "Sequência · Formato · Documentação", "custom"],
    ],
    productsTag: "Catálogo selecionado",
    productsTitle: "Encontre um ponto de partida.",
    productsText:
      "Itens representativos de um catálogo maior. Disponibilidade e elegibilidade por destino são confirmadas individualmente.",
    search: "Buscar nome do produto",
    categories: ["Todos", "Peptídeos de catálogo", "Ingredientes cosméticos", "Personalizado e granel"],
    ask: "Cotação no WhatsApp",
    docs: "Revisão de documentação",
    noProducts: "Nenhum produto encontrado.",
    productGroupLabel: "Categorias de produtos",
    qualityTag: "Estrutura de qualidade",
    qualityTitle: "Rastreável por princípio.",
    qualityText:
      "Nosso processo prioriza especificações, disponibilidade documental, embalagem cuidadosa e transferência clara.",
    steps: [
      ["01", "Análise do requisito", "Confirmamos identidade, configuração, quantidade, destino e uso profissional."],
      ["02", "Alinhamento documental", "Informações de lote e documentos analíticos disponíveis são associados à solicitação."],
      ["03", "Controle de embalagem", "Configuração e manuseio são confirmados antes da expedição."],
      ["04", "Coordenação de exportação", "As opções de envio são revisadas conforme destino e perfil do pedido."],
    ],
    facilityKicker: "Instalações de fabricação",
    facilityTitle: "Nosso ambiente de produção e estoque.",
    facilityText:
      "As imagens exibidas no site vêm de nossa linha de produção e das operações de estoque. A disponibilidade do produto e os documentos aplicáveis são confirmados em cada solicitação.",
    inventoryCaption: "Estoque organizado e alocação de pedidos",
    facilityMetrics: ["Revisão de disponibilidade", "Dados analíticos quando disponíveis"],
    privateTag: "Suporte de marca própria",
    privateTitle: "Sua marca, com um processo mais disciplinado.",
    privateText:
      "Para distribuidores e equipes de marca qualificados, apoiamos a arte do rótulo, a configuração da embalagem e o planejamento por lote.",
    privateBullets: [
      "Revisão de tamanho e arte do rótulo",
      "Discussão de piloto de baixo volume",
      "Coordenação de lote e embalagem",
      "Comunicação B2B confidencial",
    ],
    privateCta: "Discutir um projeto de marca própria",
    vialsAlt: "Frascos sem rótulo preparados para embalagem",
    customLabelSystem: "SISTEMA DE RÓTULO PERSONALIZADO",
    companyTag: "A marca",
    companyTitle: "Peptivanta Biosciences foi criada para dar clareza ao fornecimento profissional.",
    companyText:
      "Peptivanta Biosciences é nossa marca de produtos e serviços para comunicação profissional, qualificação, coordenação documental e acompanhamento de exportação.",
    companyDetails: ["Região operacional", "Foco da marca", "Meta de resposta", "Endereço registrado"],
    operatingRegion: "Hong Kong SAR · Coordenação de vendas e exportação",
    brandFocusValue: "Consultas profissionais sobre fornecimento de peptídeos",
    responseTime: "Em até um dia útil",
    inquiryTag: "Cotação e disponibilidade",
    inquiryTitle: "Solicite disponibilidade e cotação.",
    inquiryText:
      "Informe produto, configuração, quantidade e destino. Responderemos com opções disponíveis, MOQ, documentos e detalhes de coordenação de exportação.",
    form: {
      name: "Seu nome",
      company: "Empresa / organização",
      country: "País de destino",
      contact: "E-mail ou WhatsApp (opcional)",
      product: "Produto ou serviço",
      quantity: "Quantidade estimada (opcional)",
      use: "Uso profissional pretendido (opcional)",
      placeholderUse: "Pesquisa, análise, formulação, distribuição…",
      consent: "Confirmo que esta é uma consulta profissional e aceito o aviso de conformidade.",
      submit: "Solicitar cotação no WhatsApp",
      missing:
        "O número de WhatsApp ainda não foi configurado. Atualize site.config.ts antes do lançamento.",
    },
    complianceTitle: "Aviso de uso profissional e conformidade",
    complianceText:
      "Os produtos são oferecidos somente para pesquisa qualificada, análise, desenvolvimento de formulações ou outras aplicações profissionais lícitas. Não são apresentados como medicamentos e não se destinam ao uso humano ou veterinário. Não fornecemos alegações médicas, doses ou instruções de uso ao consumidor. O fornecimento depende da qualificação do cliente, análise do país de destino e legislação aplicável.",
    footerNote: "Fornecimento documentado para clientes profissionais qualificados.",
    footerLinks: ["Privacidade", "Termos", "Conformidade"],
    contactLabels: ["WhatsApp", "E-mail"],
    contactMissing: ["Adicione o número em site.config.ts", "Adicione o e-mail em site.config.ts"],
    whatsappCta: "Cotação",
    whatsappAria: "Consulta pelo WhatsApp",
    servicePrinciplesLabel: "Princípios do serviço",
    menuLabel: "Alternar navegação",
    navLabel: "Navegação principal",
  },
  es: {
    nav: ["Productos", "Calidad", "Documentos COA", "Marca privada", "Empresa", "Actividad reciente"],
    navIds: ["products", "quality", "coa", "private-label", "company", "fulfillment"],
    eyebrow: "Catálogo de péptidos · Marca privada · Coordinación de exportación",
    heroTitleA: "Suministro de péptidos,",
    heroTitleB: "con mayor claridad.",
    heroText:
      "Péptidos de catálogo documentados, soporte flexible de marca privada y coordinación ágil de exportación para clientes profesionales cualificados.",
    primaryCta: "Solicitar cotización",
    secondaryCta: "Ver catálogo",
    introReplay: "Ver el proceso",
    introSkip: "Saltar introducción",
    introKicker: "Peptivanta · Operaciones",
    introLead: "Precisión",
    introFinish: "en movimiento.",
    introStatement: "Un recorrido visible desde la preparación de la línea y la manipulación automatizada hasta el control del inventario identificado.",
    introStages: ["Preparar", "Procesar", "Etiquetar", "Embalar", "Trazar"],
    introAria: "Introducción al flujo operativo de Peptivanta",
    introMeta: "FLUJO DE FÁBRICA · SIN AUDIO · 08 SEG",
    imageLabel: "Entorno controlado de empaque",
    imageSub: "Imagen auténtica del entorno operativo",
    heroImageAlt: "Entorno controlado de empaque",
    proof: [
      ["Documentación", "vinculada al lote"],
      ["Soporte", "B2B profesional"],
      ["Global", "coordinación de exportación"],
    ],
    introTag: "Una experiencia de suministro más clara",
    introTitle: "Basado en documentos, no en promesas.",
    introText:
      "Un proceso enfocado para distribuidores, organizaciones de investigación, equipos de formulación y compradores comerciales cualificados.",
    pillars: [
      ["01", "Especificaciones definidas", "Producto, formato, cantidad y documentación se confirman antes de cotizar."],
      ["02", "Visibilidad de calidad", "El COA, los datos analíticos y la información de lote disponibles se revisan con cada consulta."],
      ["03", "Atención personal", "Un contacto dedicado acompaña la solicitud desde la cualificación hasta el despacho."],
    ],
    workflowTag: "Flujo de fábrica",
    workflowTitle: "Una línea. Cinco etapas visibles.",
    workflowText:
      "Siga el recorrido desde los componentes preparados hasta la manipulación automatizada, la identificación, el embalaje y el control de inventario dentro de nuestra fábrica.",
    workflowMediaLabel: "VISTA DEL PROCESO",
    workflowHint: "Desplácese o seleccione una etapa para continuar",
    workflowSteps: [
      ["01", "Preparar", "Los componentes se organizan y la línea se acondiciona para una producción ordenada.", "PREPARACIÓN DE LÍNEA"],
      ["02", "Procesar", "La transferencia automatizada desplaza las unidades de forma constante por la línea.", "MANIPULACIÓN AUTOMATIZADA"],
      ["03", "Etiquetar", "La identificación del producto se aplica en la etapa dedicada de etiquetado.", "IDENTIFICACIÓN"],
      ["04", "Embalar", "Las unidades terminadas se agrupan y organizan para una manipulación controlada.", "EMBALAJE"],
      ["05", "Trazar", "El inventario se escanea, ubica y organiza para la siguiente etapa operativa.", "CONTROL DE INVENTARIO"],
    ],
    categoryTag: "Categorías de productos",
    categoryTitle: "Una entrada más clara al catálogo.",
    categoryText:
      "Explore por formato de suministro y aplicación profesional. Abra una categoría para ver productos y solicitar disponibilidad, MOQ y cotización.",
    categoryItems: [
      ["01", "Péptidos de catálogo", "Configuraciones definidas en un amplio catálogo de péptidos.", "Retatrutide · Tirzepatide · BPC-157", "catalogue"],
      ["02", "Ingredientes cosméticos", "Ingredientes peptídicos para equipos cualificados de formulación y compras.", "GHK-Cu · Acetyl Hexapeptide-8", "cosmetic"],
      ["03", "Mezclas de péptidos", "Revisión orientada por especificaciones para necesidades multicomponente.", "Especificación · Planificación de lote", "catalogue"],
      ["04", "Suministro a granel", "Cantidad, formato, documentos y destino se revisan en conjunto.", "Volumen comercial · Revisión de exportación", "custom"],
      ["05", "Marca privada", "Coordinación de arte, presentación de viales y empaque.", "OEM · Empaque · Soporte de marca", "custom"],
      ["06", "Consulta personalizada", "Un proceso guiado para requisitos fuera del catálogo visible.", "Secuencia · Formato · Documentación", "custom"],
    ],
    productsTag: "Catálogo seleccionado",
    productsTitle: "Encuentre un punto de partida.",
    productsText:
      "Artículos representativos de un catálogo más amplio. La disponibilidad y elegibilidad por destino se confirman individualmente.",
    search: "Buscar nombre del producto",
    categories: ["Todos", "Péptidos de catálogo", "Ingredientes cosméticos", "Personalizado y granel"],
    ask: "Cotizar por WhatsApp",
    docs: "Revisión documental",
    noProducts: "No se encontraron productos.",
    productGroupLabel: "Categorías de productos",
    qualityTag: "Marco de calidad",
    qualityTitle: "Trazabilidad desde el diseño.",
    qualityText:
      "Nuestro proceso prioriza la alineación de especificaciones, disponibilidad documental, empaque cuidadoso y entrega clara.",
    steps: [
      ["01", "Revisión del requisito", "Confirmamos identidad, configuración, cantidad, destino y uso profesional."],
      ["02", "Alineación documental", "La información de lote y los documentos analíticos disponibles se asocian a la solicitud."],
      ["03", "Control de empaque", "La configuración y los requisitos de manipulación se confirman antes del despacho."],
      ["04", "Coordinación de exportación", "Las opciones de envío se revisan según el destino y el perfil del pedido."],
    ],
    facilityKicker: "Instalaciones de fabricación",
    facilityTitle: "Nuestro entorno de producción e inventario.",
    facilityText:
      "Las imágenes de este sitio proceden de nuestra línea de producción y de las operaciones de inventario. La disponibilidad del producto y la documentación aplicable se confirman con cada solicitud.",
    inventoryCaption: "Inventario organizado y asignación de pedidos",
    facilityMetrics: ["Revisión de disponibilidad", "Datos analíticos cuando estén disponibles"],
    privateTag: "Soporte de marca privada",
    privateTitle: "Su marca, con un proceso más disciplinado.",
    privateText:
      "Para distribuidores y equipos de marca cualificados, apoyamos la coordinación del diseño de etiquetas, la configuración del empaque y la planificación por lote.",
    privateBullets: [
      "Revisión de tamaño y diseño de etiqueta",
      "Evaluación de pedido piloto",
      "Coordinación de lote y empaque",
      "Comunicación B2B confidencial",
    ],
    privateCta: "Hablar sobre un proyecto de marca privada",
    vialsAlt: "Viales sin etiqueta preparados para empaque",
    customLabelSystem: "SISTEMA DE ETIQUETA PERSONALIZADA",
    companyTag: "La marca",
    companyTitle: "Peptivanta Biosciences está diseñada para aportar claridad al suministro profesional.",
    companyText:
      "Peptivanta Biosciences es nuestra marca de productos y servicios para la comunicación profesional, cualificación de solicitudes, coordinación documental y seguimiento de exportación.",
    companyDetails: ["Región operativa", "Enfoque de la marca", "Objetivo de respuesta", "Dirección registrada"],
    operatingRegion: "RAE de Hong Kong · Coordinación de ventas y exportación",
    brandFocusValue: "Consultas profesionales sobre suministro de péptidos",
    responseTime: "En un día hábil",
    inquiryTag: "Cotización y disponibilidad",
    inquiryTitle: "Solicite disponibilidad y cotización.",
    inquiryText:
      "Indique producto, configuración, cantidad y destino. Responderemos con opciones disponibles, MOQ, documentación y detalles de coordinación de exportación.",
    form: {
      name: "Su nombre",
      company: "Empresa / organización",
      country: "País de destino",
      contact: "Correo o WhatsApp (opcional)",
      product: "Producto o servicio",
      quantity: "Cantidad estimada (opcional)",
      use: "Uso profesional previsto (opcional)",
      placeholderUse: "Investigación, análisis, formulación, distribución…",
      consent: "Confirmo que esta es una consulta profesional y acepto el aviso de cumplimiento.",
      submit: "Solicitar cotización por WhatsApp",
      missing: "El número de WhatsApp aún no está configurado. Actualice site.config.ts antes del lanzamiento.",
    },
    complianceTitle: "Aviso de uso profesional y cumplimiento",
    complianceText:
      "Los productos se ofrecen únicamente para investigación cualificada, análisis, desarrollo de formulaciones u otras aplicaciones profesionales lícitas. No se presentan como medicamentos ni están destinados a uso humano o veterinario. No proporcionamos afirmaciones médicas, dosis ni instrucciones de uso al consumidor. El suministro está sujeto a la cualificación del cliente, revisión del país de destino y legislación aplicable.",
    footerNote: "Suministro documentado de péptidos para clientes profesionales cualificados.",
    footerLinks: ["Privacidad", "Términos", "Cumplimiento"],
    contactLabels: ["WhatsApp", "Correo"],
    contactMissing: ["Añada el número en site.config.ts", "Añada el correo en site.config.ts"],
    whatsappCta: "Cotizar",
    whatsappAria: "Consulta por WhatsApp",
    servicePrinciplesLabel: "Principios del servicio",
    menuLabel: "Abrir o cerrar navegación",
    navLabel: "Navegación principal",
  },
  fr: {
    nav: ["Produits", "Qualité", "Documents COA", "Marque blanche", "Entreprise", "Activité récente"],
    navIds: ["products", "quality", "coa", "private-label", "company", "fulfillment"],
    eyebrow: "Catalogue de peptides · Marque blanche · Coordination export",
    heroTitleA: "L’approvisionnement en peptides,",
    heroTitleB: "en toute clarté.",
    heroText:
      "Peptides de catalogue documentés, accompagnement flexible en marque blanche et coordination export réactive pour les clients professionnels qualifiés.",
    primaryCta: "Demander un devis",
    secondaryCta: "Voir le catalogue",
    introReplay: "Voir le processus",
    introSkip: "Passer l’introduction",
    introKicker: "Peptivanta · Opérations",
    introLead: "La précision",
    introFinish: "en mouvement.",
    introStatement: "Un parcours visible, de la préparation de ligne et la manipulation automatisée au contrôle des stocks identifiés.",
    introStages: ["Préparer", "Traiter", "Étiqueter", "Emballer", "Tracer"],
    introAria: "Introduction au flux opérationnel de Peptivanta",
    introMeta: "FLUX DE L’USINE · SANS SON · 08 SEC",
    imageLabel: "Environnement d’emballage contrôlé",
    imageSub: "Image authentique de l’environnement opérationnel",
    heroImageAlt: "Environnement d’emballage contrôlé",
    proof: [
      ["Documentation", "liée au lot"],
      ["Accompagnement", "B2B professionnel"],
      ["International", "coordination export"],
    ],
    introTag: "Une expérience d’approvisionnement plus claire",
    introTitle: "Fondé sur des documents, pas sur des promesses.",
    introText:
      "Un processus ciblé pour les distributeurs, organismes de recherche, équipes de formulation et acheteurs professionnels qualifiés.",
    pillars: [
      ["01", "Spécifications définies", "Le produit, le format, la quantité et la documentation sont confirmés avant devis."],
      ["02", "Visibilité qualité", "Les COA, données analytiques et informations de lot disponibles sont examinés avec chaque demande."],
      ["03", "Suivi humain", "Un interlocuteur dédié accompagne la demande de la qualification jusqu’à l’expédition."],
    ],
    workflowTag: "Flux de l’usine",
    workflowTitle: "Une ligne. Cinq étapes visibles.",
    workflowText:
      "Suivez le parcours des composants préparés jusqu’à la manipulation automatisée, l’identification, l’emballage et le contrôle des stocks au sein de notre usine.",
    workflowMediaLabel: "VUE DU PROCESSUS",
    workflowHint: "Faites défiler ou sélectionnez une étape",
    workflowSteps: [
      ["01", "Préparer", "Les composants sont organisés et la ligne est préparée pour une production ordonnée.", "PRÉPARATION DE LIGNE"],
      ["02", "Traiter", "Le transfert automatisé déplace les unités de manière régulière sur la ligne.", "MANIPULATION AUTOMATISÉE"],
      ["03", "Étiqueter", "L’identification du produit est appliquée lors de l’étape dédiée d’étiquetage.", "IDENTIFICATION"],
      ["04", "Emballer", "Les unités terminées sont regroupées et organisées pour une manipulation contrôlée.", "EMBALLAGE"],
      ["05", "Tracer", "Le stock est scanné, rangé et organisé pour l’étape opérationnelle suivante.", "CONTRÔLE DES STOCKS"],
    ],
    categoryTag: "Catégories de produits",
    categoryTitle: "Un accès plus clair au catalogue.",
    categoryText:
      "Parcourez les produits par format et application professionnelle. Ouvrez une catégorie pour demander disponibilité, MOQ et devis.",
    categoryItems: [
      ["01", "Peptides de catalogue", "Configurations définies sur un large catalogue de peptides.", "Retatrutide · Tirzepatide · BPC-157", "catalogue"],
      ["02", "Ingrédients cosmétiques", "Ingrédients peptidiques pour les équipes qualifiées de formulation et d’approvisionnement.", "GHK-Cu · Acetyl Hexapeptide-8", "cosmetic"],
      ["03", "Mélanges de peptides", "Échange guidé par les spécifications pour les besoins multicomposants.", "Spécification · Planification de lot", "catalogue"],
      ["04", "Approvisionnement en vrac", "Quantité, format, documents et destination sont examinés ensemble.", "Volumes commerciaux · Revue export", "custom"],
      ["05", "Marque blanche", "Coordination du graphisme, de la présentation des flacons et de l’emballage.", "OEM · Emballage · Accompagnement de marque", "custom"],
      ["06", "Demande personnalisée", "Un parcours guidé pour les besoins hors catalogue visible.", "Séquence · Format · Documentation", "custom"],
    ],
    productsTag: "Sélection du catalogue",
    productsTitle: "Trouvez un point de départ.",
    productsText:
      "Produits représentatifs d’un catalogue plus large. La disponibilité et l’éligibilité selon la destination sont confirmées individuellement.",
    search: "Rechercher un produit",
    categories: ["Tous", "Peptides de catalogue", "Ingrédients cosmétiques", "Personnalisé et vrac"],
    ask: "Devis sur WhatsApp",
    docs: "Examen documentaire",
    noProducts: "Aucun produit correspondant.",
    productGroupLabel: "Catégories de produits",
    qualityTag: "Cadre qualité",
    qualityTitle: "La traçabilité dès la conception.",
    qualityText:
      "Notre processus privilégie l’alignement des spécifications, la disponibilité documentaire, un emballage soigné et une transmission claire.",
    steps: [
      ["01", "Examen du besoin", "Nous confirmons l’identité, la configuration, la quantité, la destination et l’usage professionnel."],
      ["02", "Alignement documentaire", "Les informations de lot et documents analytiques disponibles sont associés à la demande."],
      ["03", "Contrôle de l’emballage", "La configuration et les exigences de manipulation sont confirmées avant expédition."],
      ["04", "Coordination export", "Les options d’envoi sont examinées selon la destination et le profil de commande."],
    ],
    facilityKicker: "Site de fabrication",
    facilityTitle: "Notre environnement de production et de stockage.",
    facilityText:
      "Les images présentées sur ce site proviennent de notre ligne de production et de nos opérations de stockage. La disponibilité des produits et les documents applicables sont confirmés pour chaque demande.",
    inventoryCaption: "Inventaire organisé et affectation des commandes",
    facilityMetrics: ["Vérification de disponibilité", "Données analytiques lorsqu’elles sont disponibles"],
    privateTag: "Accompagnement en marque blanche",
    privateTitle: "Votre marque, avec un processus plus rigoureux.",
    privateText:
      "Pour les distributeurs et équipes de marque qualifiés, nous accompagnons la coordination du graphisme, la configuration de l’emballage et la planification par lot.",
    privateBullets: [
      "Vérification du format et du graphisme de l’étiquette",
      "Étude d’une commande pilote",
      "Coordination du lot et de l’emballage",
      "Communication B2B confidentielle",
    ],
    privateCta: "Échanger sur un projet de marque blanche",
    vialsAlt: "Flacons non étiquetés préparés pour l’emballage",
    customLabelSystem: "SYSTÈME D’ÉTIQUETTE PERSONNALISÉE",
    companyTag: "La marque",
    companyTitle: "Peptivanta Biosciences apporte davantage de clarté à l’approvisionnement professionnel.",
    companyText:
      "Peptivanta Biosciences est notre marque de produits et services dédiée à la communication professionnelle, la qualification des demandes, la coordination documentaire et le suivi export.",
    companyDetails: ["Région opérationnelle", "Positionnement de la marque", "Délai de réponse", "Adresse enregistrée"],
    operatingRegion: "R.A.S. de Hong Kong · Coordination commerciale et export",
    brandFocusValue: "Demandes professionnelles d’approvisionnement en peptides",
    responseTime: "Sous un jour ouvré",
    inquiryTag: "Devis et disponibilité",
    inquiryTitle: "Demandez disponibilité et devis.",
    inquiryText:
      "Indiquez le produit, la configuration, la quantité et la destination. Nous répondrons avec les options disponibles, le MOQ, les documents et les détails de coordination export.",
    form: {
      name: "Votre nom",
      company: "Entreprise / organisme",
      country: "Pays de destination",
      contact: "E-mail ou WhatsApp (facultatif)",
      product: "Produit ou service",
      quantity: "Quantité estimée (facultatif)",
      use: "Usage professionnel prévu (facultatif)",
      placeholderUse: "Recherche, analyse, formulation, distribution…",
      consent: "Je confirme qu’il s’agit d’une demande professionnelle et j’accepte l’avis de conformité.",
      submit: "Demander un devis sur WhatsApp",
      missing: "Le numéro WhatsApp n’est pas encore configuré. Mettez à jour site.config.ts avant le lancement.",
    },
    complianceTitle: "Avis d’usage professionnel et de conformité",
    complianceText:
      "Les produits sont proposés uniquement pour la recherche qualifiée, l’analyse, le développement de formulations ou d’autres applications professionnelles licites. Ils ne sont pas présentés comme des médicaments et ne sont pas destinés à un usage humain ou vétérinaire. Nous ne fournissons aucune allégation médicale, posologie ou instruction d’utilisation grand public. L’approvisionnement est soumis à la qualification du client, à l’examen du pays de destination et à la législation applicable.",
    footerNote: "Approvisionnement documenté en peptides pour les clients professionnels qualifiés.",
    footerLinks: ["Confidentialité", "Conditions", "Conformité"],
    contactLabels: ["WhatsApp", "E-mail"],
    contactMissing: ["Ajoutez le numéro dans site.config.ts", "Ajoutez l’e-mail dans site.config.ts"],
    whatsappCta: "Devis",
    whatsappAria: "Demande via WhatsApp",
    servicePrinciplesLabel: "Principes de service",
    menuLabel: "Ouvrir ou fermer la navigation",
    navLabel: "Navigation principale",
  },
  zh: {
    nav: ["产品目录", "质量体系", "COA 文件", "贴牌服务", "品牌介绍", "近期履约"],
    navIds: ["products", "quality", "coa", "private-label", "company", "fulfillment"],
    eyebrow: "多肽目录 · 贴牌服务 · 出口协调",
    heroTitleA: "多肽供应，",
    heroTitleB: "清晰可控。",
    heroText:
      "提供文件化的多肽产品目录、灵活的贴牌支持，以及面向合格专业客户的出口协调服务。",
    primaryCta: "获取报价",
    secondaryCta: "浏览产品目录",
    introReplay: "观看工厂流程",
    introSkip: "跳过开场",
    introKicker: "Peptivanta · 运营流程",
    introLead: "精准把控",
    introFinish: "贯穿全程。",
    introStatement: "从产线准备、自动流转到贴标、包装与库存追踪，完整呈现生产链路。",
    introStages: ["准备", "流转", "贴标", "包装", "追踪"],
    introAria: "Peptivanta 工厂流程开场",
    introMeta: "工厂流程 · 静音播放 · 08 秒",
    imageLabel: "规范化包装环境",
    imageSub: "真实运营场景照片",
    heroImageAlt: "规范化包装作业环境",
    proof: [
      ["批次关联", "文件与信息"],
      ["专业客户", "B2B 对接支持"],
      ["全球市场", "出口协调服务"],
    ],
    introTag: "更清晰的供应体验",
    introTitle: "以文件为依据，而不是空泛承诺。",
    introText:
      "为经销商、科研机构、配方团队和合格商业采购方提供聚焦、清晰的对接流程。",
    pillars: [
      ["01", "明确产品规格", "报价前确认产品、规格、数量和所需文件。"],
      ["02", "质量信息透明", "根据询盘核对可提供的 COA、分析数据和批次信息。"],
      ["03", "专人跟进支持", "从资质确认到发运交接，由专人持续跟进。"],
    ],
    workflowTag: "工厂生产流程",
    workflowTitle: "一条产线，五个清晰环节。",
    workflowText:
      "从物料准备到自动流转、产品识别、包装整理和库存追踪，直观查看我们的工厂作业链路。",
    workflowMediaLabel: "工厂流程画面",
    workflowHint: "继续滚动或点击步骤查看",
    workflowSteps: [
      ["01", "准备", "整理生产组件并完成产线准备，使后续作业有序衔接。", "产线准备"],
      ["02", "流转", "通过自动化输送，让产品在生产线上持续、稳定流转。", "自动化处理"],
      ["03", "贴标", "通过专用贴标环节完成产品识别信息的应用。", "产品识别"],
      ["04", "包装", "将完成的产品集中整理，进入规范化包装处理。", "包装整理"],
      ["05", "追踪", "通过扫码、上架和库存整理，完成后续环节前的追踪管理。", "库存管理"],
    ],
    categoryTag: "产品分类 · Products Categories",
    categoryTitle: "更快找到合适的产品入口。",
    categoryText:
      "可按供应形式和专业应用浏览。打开任一分类，即可查看匹配产品并咨询供应情况、起订量和报价。",
    categoryItems: [
      ["01", "目录多肽", "覆盖多种目录多肽与既定规格。", "Retatrutide · Tirzepatide · BPC-157", "catalogue"],
      ["02", "化妆品肽原料", "面向合格配方与采购团队的多肽原料。", "GHK-Cu · Acetyl Hexapeptide-8", "cosmetic"],
      ["03", "复配多肽", "针对多组分产品需求进行规格化沟通。", "规格审核 · 批次规划", "catalogue"],
      ["04", "大货供应", "综合评估数量、规格、文件和目的地要求。", "商业数量 · 出口审核", "custom"],
      ["05", "贴牌服务", "支持标签设计、瓶型呈现和包装协调。", "OEM · 包装 · 品牌支持", "custom"],
      ["06", "定制询盘", "针对目录之外的要求提供引导式对接。", "序列 · 规格 · 文件", "custom"],
    ],
    productsTag: "精选产品目录",
    productsTitle: "从这里开始筛选。",
    productsText:
      "以下为完整目录中的代表性产品。具体供应情况及目的地合规性需要逐项确认。",
    search: "搜索产品名称",
    categories: ["全部", "目录多肽", "化妆品肽原料", "定制与大货"],
    ask: "WhatsApp 获取报价",
    docs: "批次文件审核",
    noProducts: "未找到匹配的产品。",
    productGroupLabel: "产品分类筛选",
    qualityTag: "质量管理框架",
    qualityTitle: "从流程开始建立可追溯性。",
    qualityText:
      "我们的流程重点关注规格一致性、文件可用性、包装控制和清晰交接。",
    steps: [
      ["01", "需求审核", "确认产品名称、规格、数量、目的地及专业用途。"],
      ["02", "文件匹配", "将可提供的批次信息和分析文件与询盘要求进行匹配。"],
      ["03", "包装控制", "发运前确认包装配置及相应操作要求。"],
      ["04", "出口协调", "根据目的地要求与订单情况评估运输方案。"],
    ],
    facilityKicker: "自有生产工厂",
    facilityTitle: "走进我们的生产与仓储环境。",
    facilityText:
      "网站展示的影像来自我们的生产线与库存作业现场。具体产品的供应情况及适用文件将结合每项需求确认。",
    inventoryCaption: "规范化库存管理与订单分配",
    facilityMetrics: ["根据批次确认可用性", "在可提供时匹配分析数据"],
    privateTag: "贴牌服务支持",
    privateTitle: "让你的品牌拥有更严谨的交付流程。",
    privateText:
      "面向合格经销商和品牌团队，我们支持标签设计协调、包装规格确认及按批次规划。",
    privateBullets: [
      "标签尺寸与设计稿审核",
      "小批量试单沟通",
      "批次与包装协调",
      "保密的 B2B 商务沟通",
    ],
    privateCta: "沟通贴牌项目",
    vialsAlt: "准备进行包装的无标签西林瓶",
    customLabelSystem: "定制标签系统",
    companyTag: "品牌介绍",
    companyTitle: "Peptivanta Biosciences 专注于提升专业供应沟通的清晰度。",
    companyText:
      "Peptivanta Biosciences 是我们的产品与服务品牌，用于专业客户沟通、询盘资质确认、文件协调和出口跟进。",
    companyDetails: ["运营区域", "品牌业务方向", "回复时效", "注册地址"],
    operatingRegion: "中国香港特别行政区 · 销售与出口协调",
    brandFocusValue: "专业多肽供应询盘",
    responseTime: "一个工作日内",
    inquiryTag: "供应与报价",
    inquiryTitle: "查询供应情况并获取报价。",
    inquiryText:
      "请提供产品、规格、预计数量和目的地。我们会回复可选规格、起订量、相关文件与出口协调信息。",
    form: {
      name: "姓名",
      company: "公司 / 机构",
      country: "目的国家或地区",
      contact: "邮箱或 WhatsApp（选填）",
      product: "产品或服务",
      quantity: "预计数量（选填）",
      use: "预期专业用途（选填）",
      placeholderUse: "科研、分析、配方开发、经销等",
      consent: "我确认这是专业用途询盘，并同意网站合规声明。",
      submit: "前往 WhatsApp 获取报价",
      missing: "网站尚未配置 WhatsApp 号码，请先在 site.config.ts 中添加。",
    },
    complianceTitle: "专业用途与合规声明",
    complianceText:
      "网站展示的产品仅面向合格的科研、分析、配方开发或其他合法专业用途，不作为药品展示，也不面向人用或兽用。网站不提供医疗功效宣称、剂量建议或消费者使用指导。供应需经过客户资质审核、目的地法规评估，并遵守适用法律。",
    footerNote: "为合格专业客户提供文件化的多肽供应服务。",
    footerLinks: ["隐私政策", "网站条款", "合规声明"],
    contactLabels: ["WhatsApp", "企业邮箱"],
    contactMissing: ["请在 site.config.ts 中添加号码", "请在 site.config.ts 中添加邮箱"],
    whatsappCta: "获取报价",
    whatsappAria: "通过 WhatsApp 发起询盘",
    servicePrinciplesLabel: "服务原则",
    menuLabel: "展开或收起导航",
    navLabel: "主导航",
  },
} as const;

const products = [
  {
    names: { en: "Retatrutide", pt: "Retatrutide", es: "Retatrutide", fr: "Retatrutide", zh: "Retatrutide" },
    code: "RT",
    category: "catalogue",
    formats: { en: "5–100 mg · 10 vials", pt: "5–100 mg · 10 frascos", es: "5–100 mg · 10 viales", fr: "5–100 mg · 10 flacons", zh: "5–100 mg · 10 瓶" },
  },
  {
    names: { en: "Tirzepatide", pt: "Tirzepatide", es: "Tirzepatide", fr: "Tirzepatide", zh: "Tirzepatide" },
    code: "TR",
    category: "catalogue",
    formats: { en: "5–60 mg · 10 vials", pt: "5–60 mg · 10 frascos", es: "5–60 mg · 10 viales", fr: "5–60 mg · 10 flacons", zh: "5–60 mg · 10 瓶" },
  },
  {
    names: { en: "Semaglutide", pt: "Semaglutide", es: "Semaglutide", fr: "Semaglutide", zh: "Semaglutide" },
    code: "SM",
    category: "catalogue",
    formats: { en: "Multiple configurations", pt: "Várias configurações", es: "Varias configuraciones", fr: "Plusieurs configurations", zh: "多种规格" },
  },
  {
    names: { en: "BPC-157", pt: "BPC-157", es: "BPC-157", fr: "BPC-157", zh: "BPC-157" },
    code: "BC",
    category: "catalogue",
    formats: { en: "2–10 mg · 10 vials", pt: "2–10 mg · 10 frascos", es: "2–10 mg · 10 viales", fr: "2–10 mg · 10 flacons", zh: "2–10 mg · 10 瓶" },
  },
  {
    names: { en: "TB-500", pt: "TB-500", es: "TB-500", fr: "TB-500", zh: "TB-500" },
    code: "TB",
    category: "catalogue",
    formats: { en: "2–10 mg · 10 vials", pt: "2–10 mg · 10 frascos", es: "2–10 mg · 10 viales", fr: "2–10 mg · 10 flacons", zh: "2–10 mg · 10 瓶" },
  },
  {
    names: { en: "CJC-1295", pt: "CJC-1295", es: "CJC-1295", fr: "CJC-1295", zh: "CJC-1295" },
    code: "CJ",
    category: "catalogue",
    formats: { en: "Multiple configurations", pt: "Várias configurações", es: "Varias configuraciones", fr: "Plusieurs configurations", zh: "多种规格" },
  },
  {
    names: { en: "Ipamorelin", pt: "Ipamorelin", es: "Ipamorelin", fr: "Ipamorelin", zh: "Ipamorelin" },
    code: "IP",
    category: "catalogue",
    formats: { en: "5–10 mg · 10 vials", pt: "5–10 mg · 10 frascos", es: "5–10 mg · 10 viales", fr: "5–10 mg · 10 flacons", zh: "5–10 mg · 10 瓶" },
  },
  {
    names: { en: "MOTS-C", pt: "MOTS-C", es: "MOTS-C", fr: "MOTS-C", zh: "MOTS-C" },
    code: "MC",
    category: "catalogue",
    formats: { en: "10–40 mg · 10 vials", pt: "10–40 mg · 10 frascos", es: "10–40 mg · 10 viales", fr: "10–40 mg · 10 flacons", zh: "10–40 mg · 10 瓶" },
  },
  {
    names: { en: "GHK-Cu", pt: "GHK-Cu", es: "GHK-Cu", fr: "GHK-Cu", zh: "GHK-Cu" },
    code: "CU",
    category: "cosmetic",
    formats: { en: "50–100 mg · Raw material", pt: "50–100 mg · Matéria-prima", es: "50–100 mg · Materia prima", fr: "50–100 mg · Matière première", zh: "50–100 mg · 原料" },
  },
  {
    names: { en: "Acetyl Hexapeptide-8", pt: "Acetyl Hexapeptide-8", es: "Acetyl Hexapeptide-8", fr: "Acetyl Hexapeptide-8", zh: "Acetyl Hexapeptide-8" },
    code: "AH8",
    category: "cosmetic",
    formats: { en: "Bulk inquiry", pt: "Consulta a granel", es: "Consulta a granel", fr: "Demande en vrac", zh: "大货询盘" },
  },
  {
    names: { en: "Custom configuration", pt: "Configuração personalizada", es: "Configuración personalizada", fr: "Configuration personnalisée", zh: "自定义规格" },
    code: "OEM",
    category: "custom",
    formats: { en: "Private label · Packaging", pt: "Marca própria · Embalagem", es: "Marca privada · Empaque", fr: "Marque blanche · Emballage", zh: "贴牌 · 包装" },
  },
  {
    names: { en: "Bulk peptide inquiry", pt: "Consulta de peptídeos a granel", es: "Consulta de péptidos a granel", fr: "Demande de peptides en vrac", zh: "多肽大货询盘" },
    code: "BLK",
    category: "custom",
    formats: { en: "Specification-led review", pt: "Revisão orientada por especificação", es: "Revisión según especificaciones", fr: "Examen selon les spécifications", zh: "按规格审核" },
  },
] satisfies Array<{
  names: Record<Locale, string>;
  code: string;
  category: Exclude<Category, "all">;
  formats: Record<Locale, string>;
}>;

function Brand() {
  return (
    <Link className="brand" href="#top" aria-label="Peptivanta home">
      <img src="/logo-mark.svg" alt="" width={44} height={44} />
      <span>
        <strong>{siteConfig.brandName}</strong>
        <small>Biosciences</small>
      </span>
    </Link>
  );
}

export default function Home() {
  const [locale, setLocale] = useState<Locale>("en");
  const [category, setCategory] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [formStatus, setFormStatus] = useState("");
  const [introState, setIntroState] = useState<IntroState>("hidden");
  const [inquiryVisible, setInquiryVisible] = useState(false);
  const [fulfillmentCount, setFulfillmentCount] = useState(100);
  const t = copy[locale];

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
      // The language switcher still works when browser storage is unavailable.
    }

    return () => window.cancelAnimationFrame(localeFrame);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/fulfillment-cases")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { count?: number }) => {
        if (active) setFulfillmentCount(data.count ?? 100);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    let hasSeenIntro = false;

    try {
      hasSeenIntro = window.sessionStorage.getItem(INTRO_SESSION_KEY) === "1";
    } catch {
      hasSeenIntro = false;
    }

    if (reducedMotion || connection?.saveData || hasSeenIntro) return;

    const revealTimer = window.setTimeout(() => {
      setIntroState("visible");
      try {
        window.sessionStorage.setItem(INTRO_SESSION_KEY, "1");
      } catch {
        // The intro can still run when browser storage is unavailable.
      }
    }, 180);

    return () => window.clearTimeout(revealTimer);
  }, []);

  useEffect(() => {
    const inquirySection = document.getElementById("inquiry");
    if (!inquirySection) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInquiryVisible(entry.isIntersecting),
      { threshold: 0.12 },
    );
    observer.observe(inquirySection);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (introState === "hidden") return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const fallbackTimer =
      introState === "visible" ? window.setTimeout(() => closeIntro(), 9000) : undefined;

    return () => {
      document.body.style.overflow = originalOverflow;
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
    };
  }, [introState]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter(
      (product) =>
        (category === "all" || product.category === category) &&
        (!normalized ||
          product.names[locale].toLowerCase().includes(normalized) ||
          product.code.toLowerCase().includes(normalized)),
    );
  }, [category, locale, query]);

  function productMessage(name: string, formats: string) {
    if (locale === "zh") {
      return `您好，我代表一家专业机构，希望了解 ${name}（${formats}）。请提供可选规格、起订量、相关文件以及目的地供应条件。`;
    }
    if (locale === "pt") {
      return `Olá, represento uma organização profissional e tenho interesse em ${name} (${formats}). Por favor, envie configurações disponíveis, MOQ, documentação e elegibilidade para o destino.`;
    }
    if (locale === "es") {
      return `Hola, represento a una organización profesional y me interesa ${name} (${formats}). Comparta las configuraciones disponibles, MOQ, documentación y elegibilidad para el destino.`;
    }
    if (locale === "fr") {
      return `Bonjour, je représente un organisme professionnel et je m’intéresse à ${name} (${formats}). Merci de communiquer les configurations disponibles, le MOQ, la documentation et l’éligibilité de la destination.`;
    }
    return `Hello, I represent a professional organization and am interested in ${name} (${formats}). Please share available configurations, MOQ, documentation, and destination eligibility.`;
  }

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    setFormStatus("");
    document.documentElement.lang = htmlLang(nextLocale);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // Keep the selected language for the current page when storage is unavailable.
    }
  }

  function closeIntro() {
    setIntroState((current) => (current === "hidden" ? current : "closing"));
    window.setTimeout(() => setIntroState("hidden"), 700);
  }

  function openIntro() {
    setIntroState("visible");
  }

  function handleInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!siteConfig.whatsappNumber) {
      setFormStatus(t.form.missing);
      return;
    }
    const messageLabels: Record<Locale, string[]> = {
      en: ["Professional website inquiry", "Name", "Company", "Destination", "Contact", "Product", "Quantity", "Professional use"],
      pt: ["Consulta profissional pelo site", "Nome", "Empresa", "Destino", "Contato", "Produto", "Quantidade", "Uso profissional"],
      es: ["Consulta profesional desde el sitio", "Nombre", "Empresa", "Destino", "Contacto", "Producto", "Cantidad", "Uso profesional"],
      fr: ["Demande professionnelle depuis le site", "Nom", "Entreprise", "Destination", "Contact", "Produit", "Quantité", "Usage professionnel"],
      zh: ["网站专业询盘", "姓名", "公司", "目的地", "联系方式", "产品", "数量", "专业用途"],
    };
    const labels = messageLabels[locale];
    const values = [
      data.get("name"),
      data.get("company"),
      data.get("country"),
      data.get("contact"),
      data.get("product"),
      data.get("quantity"),
      data.get("intendedUse"),
    ];
    const messageDetails = values
      .map((value, index) => [labels[index + 1], String(value ?? "").trim()] as const)
      .filter(([, value]) => value);
    const message = [
      labels[0],
      ...messageDetails.map(([label, value]) => `${label}: ${value}`),
    ].join("\n");
    window.open(createWhatsAppUrl(message), "_blank", "noopener,noreferrer");
  }

  return (
    <main id="top" className={locale === "zh" ? "lang-zh" : undefined}>
      {introState !== "hidden" && (
        <section
          className={`site-intro site-intro-${introState}`}
          aria-label={t.introAria}
        >
          <video
            className="site-intro-video"
            autoPlay
            muted
            playsInline
            preload="metadata"
            poster="/media/factory-flow-poster-v2.webp"
            onEnded={closeIntro}
            aria-hidden="true"
          >
            <source
              src="/media/factory-flow-mobile-v2.mp4"
              type="video/mp4"
              media="(max-width: 720px)"
            />
            <source src="/media/factory-flow-desktop-v2.mp4" type="video/mp4" />
          </video>
          <div className="site-intro-shade" aria-hidden="true" />
          <div className="site-intro-grid" aria-hidden="true" />
          <div className="site-intro-frame" aria-hidden="true" />

          <div className="site-intro-brand">
            <img src="/logo-mark.svg" alt="" width={46} height={46} />
            <span><strong>PEPTIVANTA</strong><small>BIOSCIENCES</small></span>
          </div>

          <button className="site-intro-skip" type="button" onClick={closeIntro}>
            {t.introSkip}<span aria-hidden="true">↗</span>
          </button>

          <div className="site-intro-copy">
            <p>{t.introKicker}</p>
            <h2><span>{t.introLead}</span><em>{t.introFinish}</em></h2>
            <div className="site-intro-statement">
              <span aria-hidden="true">01—04</span>
              <p>{t.introStatement}</p>
            </div>
          </div>

          <div className="site-intro-timeline">
            <div className="site-intro-progress" aria-hidden="true" />
            <ol>
              {t.introStages.map((stage, index) => (
                <li key={stage}><span>0{index + 1}</span>{stage}</li>
              ))}
            </ol>
          </div>

          <p className="site-intro-meta">{t.introMeta}</p>
        </section>
      )}

      <div className="noise" aria-hidden="true" />
      <header className="site-header">
        <Brand />
        <button
          className="menu-button"
          type="button"
          aria-label={t.menuLabel}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
        </button>
        <nav className={menuOpen ? "nav nav-open" : "nav"} aria-label={t.navLabel}>
          {t.nav.map((item, index) => {
            const sectionId = t.navIds[index];
            const href =
              sectionId === "fulfillment"
                ? "/fulfillment"
                : sectionId === "coa"
                  ? "/coa"
                  : `#${sectionId}`;

            return (
              <Link key={item} href={href} onClick={() => setMenuOpen(false)}>{item}</Link>
            );
          })}
        </nav>
        <div className="header-actions">
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
          <Link className="customer-access-link" href="/customer/access">
            {customerAccessLabels[locale]}
          </Link>
          <a className="button button-small" href="#inquiry">
            {t.primaryCta}
          </a>
        </div>
      </header>

      <section className="hero section-shell">
        <div className="hero-copy">
          <p className="eyebrow"><span />{t.eyebrow}</p>
          <h1>
            {t.heroTitleA}
            <em>{t.heroTitleB}</em>
          </h1>
          <p className="hero-text">{t.heroText}</p>
          <div className="hero-actions">
            <a className="button" href="#inquiry">{t.primaryCta}<span>↗</span></a>
            <a className="text-link" href="#products">{t.secondaryCta}<span>↓</span></a>
          </div>
          <button className="workflow-replay" type="button" onClick={openIntro}>
            <span className="workflow-replay-icon" aria-hidden="true">▶</span>
            {t.introReplay}
            <small>08 SEC</small>
          </button>
        </div>
        <div className="hero-visual">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="hero-image-frame">
            <img
              src="/images/facility.jpg"
              alt={t.heroImageAlt}
            />
            <div className="image-scan" aria-hidden="true" />
          </div>
          <div className="image-caption">
            <span className="pulse" />
            <div><strong>{t.imageLabel}</strong><small>{t.imageSub}</small></div>
          </div>
          <div className="molecule-card">
            <span>QC</span>
            <strong>Identity</strong>
            <small>Purity · Mass · Batch</small>
          </div>
        </div>
      </section>

      <section className="proof-strip section-shell" aria-label={t.servicePrinciplesLabel}>
        {t.proof.map(([value, label]) => (
          <div key={value}><strong>{value}</strong><span>{label}</span></div>
        ))}
        <p>{t.operatingRegion}</p>
      </section>

      <section className="intro section-shell">
        <div className="section-heading">
          <p className="section-tag">{t.introTag}</p>
          <h2>{t.introTitle}</h2>
          <p>{t.introText}</p>
        </div>
        <div className="pillar-grid">
          {t.pillars.map(([number, title, text]) => (
            <article className="pillar-card" key={number}>
              <span>{number}</span><h3>{title}</h3><p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <FactoryWorkflow
        tag={t.workflowTag}
        title={t.workflowTitle}
        text={t.workflowText}
        mediaLabel={t.workflowMediaLabel}
        hint={t.workflowHint}
        steps={t.workflowSteps}
      />

      <section className="category-showcase section-shell" id="categories">
        <div className="section-heading split-heading">
          <div>
            <p className="section-tag">{t.categoryTag}</p>
            <h2>{t.categoryTitle}</h2>
          </div>
          <p>{t.categoryText}</p>
        </div>
        <div className="category-grid">
          {t.categoryItems.map(([number, title, description, examples, target], index) => (
            <button
              className={`category-card category-card-${index + 1}`}
              type="button"
              key={number}
              onClick={() => {
                setCategory(target as Category);
                document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <span className="category-number">{number}</span>
              <span className="category-symbol" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <strong>{title}</strong>
              <small>{description}</small>
              <em>{examples}</em>
              <b aria-hidden="true">↗</b>
            </button>
          ))}
        </div>
      </section>

      <section className="products section-shell" id="products">
        <div className="section-heading split-heading">
          <div><p className="section-tag">{t.productsTag}</p><h2>{t.productsTitle}</h2></div>
          <p>{t.productsText}</p>
        </div>
        <div className="catalogue-tools">
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.search}
              aria-label={t.search}
            />
          </label>
          <div className="filter-tabs" role="group" aria-label={t.productGroupLabel}>
            {(["all", "catalogue", "cosmetic", "custom"] as Category[]).map((item, index) => (
              <button
                key={item}
                type="button"
                className={category === item ? "active" : ""}
                onClick={() => setCategory(item)}
              >
                {t.categories[index]}
              </button>
            ))}
          </div>
        </div>
        <div className="product-grid">
          {filtered.map((product, index) => {
            const productName = product.names[locale];
            const productFormat = product.formats[locale];
            return (
              <article className="product-card" key={product.code}>
                <div className="product-top">
                  <span>{product.code}</span>
                  <small>{String(index + 1).padStart(2, "0")}</small>
                </div>
                <h3>{productName}</h3>
                <p>{productFormat}</p>
                <div className="product-meta"><i />{t.docs}</div>
                <a
                  href={createWhatsAppUrl(productMessage(productName, productFormat))}
                  target={siteConfig.whatsappNumber ? "_blank" : undefined}
                  rel="noreferrer"
                >
                  {t.ask}<span>↗</span>
                </a>
              </article>
            );
          })}
        </div>
        {!filtered.length && <p className="empty-state">{t.noProducts}</p>}
        <div className="catalogue-disclaimer">
          {t.complianceText}
        </div>
      </section>

      <section className="quality" id="quality">
        <div className="section-shell quality-shell">
          <div className="quality-copy">
            <p className="section-tag">{t.qualityTag}</p>
            <h2>{t.qualityTitle}</h2>
            <p>{t.qualityText}</p>
          </div>
          <div className="quality-steps">
            {t.steps.map(([number, title, text]) => (
              <article key={number}>
                <span>{number}</span>
                <div><h3>{title}</h3><p>{text}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="facility section-shell">
        <div className="facility-copy">
          <p className="section-tag">{t.facilityKicker}</p>
          <h2>{t.facilityTitle}</h2>
          <p>{t.facilityText}</p>
          <div className="facility-metrics">
            <div><strong>COA</strong><span>{t.facilityMetrics[0]}</span></div>
            <div><strong>HPLC / MS</strong><span>{t.facilityMetrics[1]}</span></div>
          </div>
        </div>
        <figure className="facility-photo">
          <img
            src="/images/inventory.webp"
            alt={t.inventoryCaption}
            width={1080}
            height={1652}
            loading="lazy"
            decoding="async"
          />
          <figcaption>{t.inventoryCaption}</figcaption>
        </figure>
      </section>

      <section className="private-label section-shell" id="private-label">
        <div className="private-image">
          <img src="/images/vials.png" alt={t.vialsAlt} />
          <div className="label-sample">
            <img src="/logo-mark.svg" alt="" width={30} height={30} />
            <div><strong>PEPTIVANTA</strong><small>{t.customLabelSystem}</small></div>
          </div>
        </div>
        <div className="private-copy">
          <p className="section-tag">{t.privateTag}</p>
          <h2>{t.privateTitle}</h2>
          <p>{t.privateText}</p>
          <ul>{t.privateBullets.map((item) => <li key={item}><span>✓</span>{item}</li>)}</ul>
          <a className="button button-dark" href="#inquiry">{t.privateCta}<span>↗</span></a>
        </div>
      </section>

      <section className="company section-shell" id="company">
        <div className="company-heading">
          <p className="section-tag">{t.companyTag}</p>
          <h2>{t.companyTitle}</h2>
        </div>
        <div className="company-content">
          <p>{t.companyText}</p>
          <dl>
            <div><dt>{t.companyDetails[0]}</dt><dd>{t.operatingRegion}</dd></div>
            <div><dt>{t.companyDetails[1]}</dt><dd>{t.brandFocusValue}</dd></div>
            <div><dt>{t.companyDetails[2]}</dt><dd>{t.responseTime}</dd></div>
            {siteConfig.registeredAddress && (
              <div><dt>{t.companyDetails[3]}</dt><dd>{siteConfig.registeredAddress}</dd></div>
            )}
          </dl>
          <Link className="company-ledger-link" href="/fulfillment">
            <span>{fulfillmentCount}</span>
            <div>
              <small>{t.nav[5]}</small>
              <strong aria-hidden="true">↗</strong>
            </div>
          </Link>
        </div>
      </section>

      <section className="inquiry" id="inquiry">
        <div className="section-shell inquiry-shell">
          <div className="inquiry-copy">
            <p className="section-tag">{t.inquiryTag}</p>
            <h2>{t.inquiryTitle}</h2>
            <p>{t.inquiryText}</p>
            <div className="contact-lines">
              <span>{t.contactLabels[0]}</span><strong>{siteConfig.whatsappNumber || t.contactMissing[0]}</strong>
              {siteConfig.salesEmail && (
                <>
                  <span>{t.contactLabels[1]}</span><strong>{siteConfig.salesEmail}</strong>
                </>
              )}
            </div>
          </div>
          <form className="inquiry-form" onSubmit={handleInquiry}>
            <div className="form-row">
              <label>{t.form.name}<input name="name" required /></label>
              <label>{t.form.company}<input name="company" required /></label>
            </div>
            <div className="form-row">
              <label>{t.form.country}<input name="country" required /></label>
              <label>{t.form.contact}<input name="contact" /></label>
            </div>
            <div className="form-row">
              <label>{t.form.product}<input name="product" required /></label>
              <label>{t.form.quantity}<input name="quantity" /></label>
            </div>
            <label>{t.form.use}<textarea name="intendedUse" placeholder={t.form.placeholderUse} /></label>
            <label className="consent">
              <input type="checkbox" required /><span>{t.form.consent}</span>
            </label>
            <button className="button form-submit" type="submit">{t.form.submit}<span>↗</span></button>
            {formStatus && <p className="form-status" role="status">{formStatus}</p>}
          </form>
        </div>
      </section>

      <section className="compliance section-shell">
        <span>!</span>
        <div><h2>{t.complianceTitle}</h2><p>{t.complianceText}</p></div>
      </section>

      <footer className="footer section-shell">
        <div><Brand /><p>{t.footerNote}</p></div>
        <div className="footer-links">
          <Link href="/customer/access">{customerAccessLabels[locale]}</Link>
          <Link href="/privacy">{t.footerLinks[0]}</Link>
          <Link href="/terms">{t.footerLinks[1]}</Link>
          <Link href="/compliance">{t.footerLinks[2]}</Link>
        </div>
        <p>© {new Date().getFullYear()} {siteConfig.fullBrandName}</p>
      </footer>

      <a
        className={`whatsapp-float${inquiryVisible ? " is-hidden" : ""}`}
        href={createWhatsAppUrl(
          locale === "zh"
            ? "您好，我有一项专业多肽供应询盘。"
            : locale === "pt"
              ? "Olá, tenho uma consulta profissional sobre fornecimento de peptídeos."
              : locale === "es"
                ? "Hola, tengo una consulta profesional sobre suministro de péptidos."
                : locale === "fr"
                  ? "Bonjour, j’ai une demande professionnelle concernant l’approvisionnement en peptides."
                  : "Hello, I have a professional peptide supply inquiry.",
        )}
        target={siteConfig.whatsappNumber ? "_blank" : undefined}
        rel="noreferrer"
        aria-label={t.whatsappAria}
        aria-hidden={inquiryVisible}
        tabIndex={inquiryVisible ? -1 : undefined}
      >
        <span>WA</span><small>{t.whatsappCta}</small>
      </a>
    </main>
  );
}
