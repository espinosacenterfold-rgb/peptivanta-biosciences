import { PRODUCT_CATALOG } from "../../../lib/product-catalog.ts";
import {
  calculateMultiItemOrderPricing,
  orderProfileForQuantity,
} from "../../../lib/order-pricing.ts";

export const LEDGER_VERSION = "daily-v4-10-30-orders";
export const DISPLAY_LIMIT = 300;
export const MAX_GENERATED_RETENTION = 500;
export const UPDATE_INTERVAL_DAYS = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

export type FulfillmentMarket =
  | "United States"
  | "Canada"
  | "Brazil"
  | "Mexico";

export type FulfillmentService =
  | "catalogue"
  | "private_label"
  | "bulk"
  | "custom";

export type FulfillmentStatus =
  | "confirmed"
  | "documentation_review"
  | "in_production"
  | "quality_control"
  | "packaging"
  | "dispatched"
  | "delivered";

type Weighted<T> = T & { weight: number };

type QuantityProfile = Weighted<{
  label: string;
  minimum: number;
  maximum: number;
}>;

type Product = Weighted<{
  sku: string;
  name: string;
  specification: string;
  unitPriceUsdCents: number;
}>;

export type GeneratorSettings = {
  displayLimit: number;
  dailyMinimum: number;
  dailyMaximum: number;
  largeOrderRateBps: number;
  repeatOrderRateBps: number;
  multiProductRateBps: number;
  bulkGapDays: number;
  repeatMinimumDays: number;
  repeatMaximumDays: number;
  marketUsWeight: number;
  marketCaWeight: number;
  marketBrWeight: number;
  marketMxWeight: number;
  generationEnabled: boolean;
};

export const DEFAULT_GENERATOR_SETTINGS: GeneratorSettings = {
  displayLimit: DISPLAY_LIMIT,
  dailyMinimum: 10,
  dailyMaximum: 30,
  // Private-label and bulk work together represent a visible but restrained
  // B2B expansion layer. Bulk is still independently spaced below.
  largeOrderRateBps: 1500,
  repeatOrderRateBps: 3500,
  multiProductRateBps: 5000,
  bulkGapDays: 20,
  repeatMinimumDays: 5,
  repeatMaximumDays: 14,
  marketUsWeight: 48,
  marketCaWeight: 25,
  marketBrWeight: 17,
  marketMxWeight: 10,
  generationEnabled: true,
};

export function normalizeGeneratorSettings(
  input: Partial<GeneratorSettings> = {},
): GeneratorSettings {
  const displayLimit = Math.round(
    Number(input.displayLimit ?? DEFAULT_GENERATOR_SETTINGS.displayLimit),
  );
  const dailyMinimum = Math.round(
    Number(input.dailyMinimum ?? DEFAULT_GENERATOR_SETTINGS.dailyMinimum),
  );
  const dailyMaximum = Math.round(
    Number(input.dailyMaximum ?? DEFAULT_GENERATOR_SETTINGS.dailyMaximum),
  );
  const largeOrderRateBps = Math.round(
    Number(
      input.largeOrderRateBps ??
        DEFAULT_GENERATOR_SETTINGS.largeOrderRateBps,
    ),
  );
  const repeatOrderRateBps = Math.round(
    Number(
      input.repeatOrderRateBps ??
        DEFAULT_GENERATOR_SETTINGS.repeatOrderRateBps,
    ),
  );
  const multiProductRateBps = Math.round(
    Number(
      input.multiProductRateBps ??
        DEFAULT_GENERATOR_SETTINGS.multiProductRateBps,
    ),
  );
  const bulkGapDays = Math.round(
    Number(input.bulkGapDays ?? DEFAULT_GENERATOR_SETTINGS.bulkGapDays),
  );
  const repeatMinimumDays = Math.round(
    Number(
      input.repeatMinimumDays ??
        DEFAULT_GENERATOR_SETTINGS.repeatMinimumDays,
    ),
  );
  const repeatMaximumDays = Math.round(
    Number(
      input.repeatMaximumDays ??
        DEFAULT_GENERATOR_SETTINGS.repeatMaximumDays,
    ),
  );
  const normalizedRepeatMinimumDays = Math.max(
    2,
    Math.min(30, repeatMinimumDays || 2),
  );
  const marketWeight = (value: number | undefined, fallback: number) =>
    Math.max(1, Math.min(100, Math.round(Number(value ?? fallback)) || fallback));
  const minimum = Math.max(1, Math.min(50, dailyMinimum || 1));
  return {
    displayLimit: Math.max(100, Math.min(500, displayLimit || DISPLAY_LIMIT)),
    dailyMinimum: minimum,
    dailyMaximum: Math.max(
      minimum,
      Math.min(60, dailyMaximum || minimum),
    ),
    largeOrderRateBps: Math.max(500, Math.min(2500, largeOrderRateBps)),
    repeatOrderRateBps: Math.max(0, Math.min(6000, repeatOrderRateBps)),
    multiProductRateBps: Math.max(
      0,
      Math.min(9000, multiProductRateBps),
    ),
    bulkGapDays: Math.max(7, Math.min(60, bulkGapDays || 20)),
    repeatMinimumDays: normalizedRepeatMinimumDays,
    repeatMaximumDays: Math.max(
      normalizedRepeatMinimumDays,
      Math.min(60, repeatMaximumDays || normalizedRepeatMinimumDays),
    ),
    marketUsWeight: marketWeight(
      input.marketUsWeight,
      DEFAULT_GENERATOR_SETTINGS.marketUsWeight,
    ),
    marketCaWeight: marketWeight(
      input.marketCaWeight,
      DEFAULT_GENERATOR_SETTINGS.marketCaWeight,
    ),
    marketBrWeight: marketWeight(
      input.marketBrWeight,
      DEFAULT_GENERATOR_SETTINGS.marketBrWeight,
    ),
    marketMxWeight: marketWeight(
      input.marketMxWeight,
      DEFAULT_GENERATOR_SETTINGS.marketMxWeight,
    ),
    generationEnabled:
      input.generationEnabled ?? DEFAULT_GENERATOR_SETTINGS.generationEnabled,
  };
}

export type GeneratedOrderItem = {
  sku: string;
  productName: string;
  specification: string;
  quantityUnits: number;
  retailUnitPriceUsdCents: number;
  discountedUnitPriceUsdCents: number;
  lineAmountUsdCents: number;
};

export type RepeatCandidate = {
  reference: string;
  occurredAt: string;
  destination: FulfillmentMarket;
  service: FulfillmentService;
  items: GeneratedOrderItem[];
  quantityUnits: number;
  customerKey: string;
};

export type GenerationContext = {
  lastBulkAt: string | null;
  lastMegaBulkAt: string | null;
  repeatCandidates: RepeatCandidate[];
};

export type GeneratedFulfillmentRow = {
  reference: string;
  occurredAt: string;
  destination: FulfillmentMarket;
  service: FulfillmentService;
  orderProfile: string;
  productName: string;
  specification: string;
  quantityUnits: number;
  unitPriceUsdCents: number;
  packagingFeeUsdCents: number;
  testingFeeUsdCents: number;
  logisticsFeeUsdCents: number;
  itemsJson: string;
  orderKind: "new" | "repeat";
  repeatOfReference: string;
  customerKey: string;
  amountUsdCents: number;
  status: FulfillmentStatus;
  cycleKey: string;
  isSample: true;
  isPublished: true;
};

export function mergeFulfillmentRecords<
  TManual extends { occurredAt: string; reference: string },
  TSample extends { occurredAt: string; reference: string },
>(
  manualRecords: readonly TManual[],
  sampleRecords: readonly TSample[],
  limit: number,
) {
  const manual = manualRecords.slice(0, limit);
  const sampleSlots = Math.max(0, limit - manual.length);
  return [...manual, ...sampleRecords.slice(0, sampleSlots)]
    .sort(
      (left, right) =>
        right.occurredAt.localeCompare(left.occurredAt) ||
        right.reference.localeCompare(left.reference),
    )
    .slice(0, limit);
}

/**
 * Profiles are weighted within each service. Small catalogue and pilot orders
 * are intentionally common; high-volume orders are intentionally rare.
 */
export const SERVICE_PROFILES = {
  catalogue: [
    { label: "1–2 kits", minimum: 1, maximum: 2, weight: 44 },
    { label: "3–5 kits", minimum: 3, maximum: 5, weight: 32 },
    { label: "6–10 kits", minimum: 6, maximum: 10, weight: 18 },
    { label: "10–50 kits", minimum: 11, maximum: 50, weight: 6 },
  ],
  private_label: [
    { label: "100–300 kits", minimum: 100, maximum: 300, weight: 64 },
    { label: "300–500 kits", minimum: 301, maximum: 500, weight: 28 },
    { label: "500–1,000 kits", minimum: 501, maximum: 1000, weight: 8 },
  ],
  bulk: [
    { label: "500–1,000 kits", minimum: 500, maximum: 1000, weight: 73 },
    { label: "1,000–3,000 kits", minimum: 1001, maximum: 3000, weight: 23 },
    { label: "3,000+ kits", minimum: 3001, maximum: 4800, weight: 4 },
  ],
  custom: [
    { label: "Pilot order", minimum: 1, maximum: 3, weight: 54 },
    { label: "3–10 kits", minimum: 4, maximum: 10, weight: 30 },
    { label: "10–50 kits", minimum: 11, maximum: 50, weight: 13 },
    { label: "50–100 kits", minimum: 51, maximum: 100, weight: 3 },
  ],
} as const satisfies Record<
  FulfillmentService,
  readonly QuantityProfile[]
>;

function marketWeights(
  settings: GeneratorSettings,
): readonly Weighted<{ value: FulfillmentMarket }>[] {
  return [
    { value: "United States", weight: settings.marketUsWeight },
    { value: "Canada", weight: settings.marketCaWeight },
    { value: "Brazil", weight: settings.marketBrWeight },
    { value: "Mexico", weight: settings.marketMxWeight },
  ];
}

function serviceWeights(
  market: FulfillmentMarket,
  largeOrderRateBps: number,
): readonly Weighted<{ value: FulfillmentService }>[] {
  const marketAdjustment =
    market === "Brazil" ? 150 : market === "Canada" ? -100 : 0;
  const combinedLarge = Math.max(
    500,
    Math.min(2500, largeOrderRateBps + marketAdjustment),
  );
  const custom = market === "Brazil" ? 650 : market === "Mexico" ? 550 : 500;
  // Most growth is private-label work; true bulk lots remain the rarer quarter
  // and are also guarded by a 20-day spacing rule.
  const bulk = Math.round(combinedLarge * 0.24);
  const privateLabel = combinedLarge - bulk;
  const catalogue = 10_000 - combinedLarge - custom;

  return [
    { value: "catalogue", weight: catalogue },
    { value: "private_label", weight: privateLabel },
    { value: "custom", weight: custom },
    { value: "bulk", weight: bulk },
  ];
}

const CATALOGUE_PRODUCTS: readonly Product[] = PRODUCT_CATALOG.map((item) => ({
  sku: item.sku,
  name: item.productName,
  specification: item.specification,
  unitPriceUsdCents: item.retailUsdCents,
  // Lower-priced catalogue lines are intentionally more common so the public
  // flow is led by realistic tens/hundreds-of-dollars orders rather than a
  // wall of high-dose, high-value configurations. Every quoted SKU remains
  // eligible and well-known lines receive a modest visibility multiplier.
  weight:
    (item.retailUsdCents <= 6_000
      ? 9
      : item.retailUsdCents <= 10_000
        ? 6
        : item.retailUsdCents <= 18_000
          ? 3
          : item.retailUsdCents <= 30_000
            ? 2
            : 1) *
    (item.productName === "Tirzepatide" ||
    item.productName === "Retatrutide" ||
    item.productName === "Semaglutide" ||
    item.productName === "BPC 157" ||
    item.productName === "GHK-Cu" ||
    item.productName === "MOTS-c"
      ? 2
      : 1),
}));

const CUSTOM_PRODUCTS: readonly Product[] = [
  {
    sku: "CUSTOM-SEQUENCE",
    name: "Custom peptide sequence",
    specification: "Specification-led pilot lot",
    unitPriceUsdCents: 21450,
    weight: 42,
  },
  {
    sku: "CUSTOM-VIAL",
    name: "Custom vial configuration",
    specification: "Lyophilized · customer-defined strength",
    unitPriceUsdCents: 18675,
    weight: 34,
  },
  {
    sku: "CUSTOM-MULTI",
    name: "Multi-peptide configuration",
    specification: "Customer-defined composition",
    unitPriceUsdCents: 23780,
    weight: 24,
  },
];

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date) {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function addUtcDays(date: Date, days: number) {
  const result = startOfUtcDay(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number) {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T extends { weight: number }>(
  values: readonly T[],
  random: () => number,
) {
  const total = values.reduce((sum, item) => sum + item.weight, 0);
  let draw = random() * total;
  for (const item of values) {
    draw -= item.weight;
    if (draw <= 0) return item;
  }
  return values[values.length - 1];
}

function randomInteger(minimum: number, maximum: number, random: () => number) {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function daysBetween(left: string | null, right: Date) {
  if (!left) return Number.POSITIVE_INFINITY;
  return Math.floor(
    (startOfUtcDay(right).getTime() - Date.parse(`${left}T00:00:00.000Z`)) /
      DAY_MS,
  );
}

const QUIET_DATES = new Set([
  "01-01",
  "07-01",
  "07-04",
  "09-07",
  "09-16",
  "12-25",
]);

function dailyOrderCount(
  date: Date,
  random: () => number,
  settings: GeneratorSettings,
) {
  const day = date.getUTCDay();
  const monthDay = isoDate(date).slice(5);
  const minimum = Math.max(1, Math.min(50, settings.dailyMinimum));
  const maximum = Math.max(minimum, Math.min(60, settings.dailyMaximum));
  const span = maximum - minimum;
  const scaledRange = (low: number, high: number) => [
    Math.min(maximum, minimum + Math.round(span * low)),
    Math.min(maximum, minimum + Math.round(span * high)),
  ] as const;

  if (day === 0 || day === 6) {
    const [low, high] = scaledRange(0, 0.2);
    return randomInteger(low, high, random);
  }

  if (QUIET_DATES.has(monthDay)) {
    const [low, high] = scaledRange(0, 0.15);
    return randomInteger(low, high, random);
  }

  if (day === 1) {
    const [low, high] = scaledRange(0.25, 0.65);
    return randomInteger(low, high, random);
  }

  if (day >= 2 && day <= 4) {
    const [low, high] = scaledRange(0.5, 1);
    return randomInteger(low, high, random);
  }

  const [low, high] = scaledRange(0.2, 0.6);
  return randomInteger(low, high, random);
}

function serviceSpecification(product: Product) {
  // Packaging/service type is shown in its own column. The specification stays
  // byte-for-byte aligned with the official quotation workbook.
  return product.specification;
}

function orderFees(
  service: FulfillmentService,
  destination: FulfillmentMarket,
  quantity: number,
  random: () => number,
) {
  if (service === "catalogue") {
    // Catalogue prices represent stocked product only. Packing, testing and
    // freight are not added to catalogue order values; freight is quoted
    // separately during the enquiry.
    return {
      packagingFeeUsdCents: 0,
      testingFeeUsdCents: 0,
      logisticsFeeUsdCents: 0,
    };
  }

  const packagingRanges: Record<FulfillmentService, [number, number]> = {
    catalogue: [0, 0],
    private_label: [50000, 180000],
    bulk: [25000, 120000],
    custom: [35000, 140000],
  };
  const logisticsBase: Record<FulfillmentMarket, [number, number]> = {
    "United States": [18000, 68000],
    Canada: [22000, 82000],
    Brazil: [45000, 165000],
    Mexico: [30000, 110000],
  };
  const [packagingMinimum, packagingMaximum] = packagingRanges[service];
  const [logisticsMinimum, logisticsMaximum] = logisticsBase[destination];
  const packagingFeeUsdCents = randomInteger(
    packagingMinimum,
    packagingMaximum,
    random,
  );
  const testingFeeUsdCents =
    random() < 0.72
      ? randomInteger(18500, service === "bulk" ? 125000 : 78000, random)
      : 0;
  const logisticsFeeUsdCents =
    randomInteger(logisticsMinimum, logisticsMaximum, random) +
    Math.round(quantity * (service === "bulk" ? 23 : 61));

  return {
    packagingFeeUsdCents,
    testingFeeUsdCents,
    logisticsFeeUsdCents,
  };
}

function productLineCount(
  service: FulfillmentService,
  quantityUnits: number,
  random: () => number,
  multiProductRateBps: number,
) {
  if (service === "custom" || quantityUnits < 2) return 1;
  if (random() * 10_000 >= multiProductRateBps) return 1;
  // Once an assembled order is selected, two-product combinations remain the
  // normal case and three-product combinations stay visibly less frequent.
  return Math.min(quantityUnits, random() < 0.76 ? 2 : 3);
}

function splitQuantity(
  total: number,
  lineCount: number,
  random: () => number,
) {
  if (lineCount === 1) return [total];
  const weights = Array.from({ length: lineCount }, () => 0.6 + random());
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const quantities = weights.map((weight) =>
    Math.max(1, Math.floor((total * weight) / weightTotal)),
  );
  let assigned = quantities.reduce((sum, quantity) => sum + quantity, 0);
  while (assigned < total) {
    quantities[assigned % lineCount] += 1;
    assigned += 1;
  }
  while (assigned > total) {
    const index = quantities.findIndex((quantity) => quantity > 1);
    if (index < 0) break;
    quantities[index] -= 1;
    assigned -= 1;
  }
  return quantities;
}

function freshProductLines(
  service: FulfillmentService,
  quantityUnits: number,
  random: () => number,
  settings: GeneratorSettings,
) {
  const lineCount = productLineCount(
    service,
    quantityUnits,
    random,
    settings.multiProductRateBps,
  );
  const selected: Product[] = [];
  const productPool = service === "custom" ? CUSTOM_PRODUCTS : CATALOGUE_PRODUCTS;
  while (selected.length < lineCount) {
    const product = pickWeighted(productPool, random);
    if (!selected.some((item) => item.sku === product.sku)) {
      selected.push(product);
    }
  }
  const quantities = splitQuantity(quantityUnits, lineCount, random);
  return selected.map((product, index) => ({
    sku: product.sku,
    productName: product.name,
    specification: serviceSpecification(product),
    retailUnitPriceUsdCents: product.unitPriceUsdCents,
    quantityUnits: quantities[index],
  }));
}

function candidateAgeDays(candidate: RepeatCandidate, date: Date) {
  return Math.floor(
    (startOfUtcDay(date).getTime() -
      Date.parse(`${candidate.occurredAt}T00:00:00.000Z`)) /
      DAY_MS,
  );
}

function pickRepeatCandidate(
  context: GenerationContext,
  date: Date,
  random: () => number,
  settings: GeneratorSettings,
) {
  const eligible = context.repeatCandidates.filter((candidate) => {
    if (candidate.service === "bulk") return false;
    const age = candidateAgeDays(candidate, date);
    return (
      age >= settings.repeatMinimumDays &&
      age <= settings.repeatMaximumDays
    );
  });
  if (eligible.length === 0) return null;
  // More recent eligible customers are more likely to place a visible repeat.
  const weighted = eligible.map((candidate) => ({
    candidate,
    weight: Math.max(
      1,
      settings.repeatMaximumDays + 2 - candidateAgeDays(candidate, date),
    ),
  }));
  return pickWeighted(weighted, random).candidate;
}

function repeatProductLines(
  candidate: RepeatCandidate,
  random: () => number,
) {
  const growthDraw = random();
  const multiplier = growthDraw < 0.5 ? 1 : growthDraw < 0.84 ? 1.2 : 1.45;
  const maximum =
    candidate.service === "catalogue"
      ? 50
      : candidate.service === "private_label"
        ? 1_000
        : 100;
  const total = Math.max(
    candidate.items.length,
    Math.min(maximum, Math.round(candidate.quantityUnits * multiplier)),
  );
  const quantities = splitQuantity(total, candidate.items.length, random);
  return candidate.items.map((item, index) => ({
    sku: item.sku,
    productName: item.productName,
    specification: item.specification,
    retailUnitPriceUsdCents: item.retailUnitPriceUsdCents,
    quantityUnits: quantities[index],
  }));
}

function createOrder(
  date: Date,
  index: number,
  context: GenerationContext,
  random: () => number,
  settings: GeneratorSettings,
  forcedService?: FulfillmentService,
) {
  const shouldRepeat =
    !forcedService && random() * 10_000 < settings.repeatOrderRateBps;
  const repeatCandidate = shouldRepeat
    ? pickRepeatCandidate(context, date, random, settings)
    : null;
  const destination =
    repeatCandidate?.destination ??
    pickWeighted(marketWeights(settings), random).value;
  let service =
    repeatCandidate?.service ??
    forcedService ??
    pickWeighted(serviceWeights(destination, settings.largeOrderRateBps), random)
      .value;

  // Keep high-volume orders spaced apart. A blocked bulk draw becomes the
  // common catalogue workflow rather than being silently dropped.
  if (
    service === "bulk" &&
    daysBetween(context.lastBulkAt, date) < settings.bulkGapDays
  ) {
    service = "catalogue";
  }

  const profiles = SERVICE_PROFILES[service];
  let profile = pickWeighted(profiles, random);
  if (
    service === "bulk" &&
    profile.label === "3,000+ kits" &&
    daysBetween(context.lastMegaBulkAt, date) < 60
  ) {
    profile = profiles[0];
  }

  const freshQuantity = randomInteger(profile.minimum, profile.maximum, random);
  const draftItems = repeatCandidate
    ? repeatProductLines(repeatCandidate, random)
    : freshProductLines(service, freshQuantity, random, settings);
  const quantityUnits = draftItems.reduce(
    (sum, item) => sum + item.quantityUnits,
    0,
  );
  const fees = orderFees(service, destination, quantityUnits, random);
  const pricing = calculateMultiItemOrderPricing({
    items: draftItems,
    service,
    serviceFeeUsdCents:
      fees.packagingFeeUsdCents + fees.testingFeeUsdCents,
  });
  const items: GeneratedOrderItem[] = pricing.items;
  const firstItem = items[0];
  const unitPriceUsdCents = firstItem.discountedUnitPriceUsdCents;
  const amountUsdCents = pricing.amountUsdCents + fees.logisticsFeeUsdCents;
  const dateKey = isoDate(date);
  const marketCode: Record<FulfillmentMarket, string> = {
    "United States": "US",
    Canada: "CA",
    Brazil: "BR",
    Mexico: "MX",
  };
  const serviceCode: Record<FulfillmentService, string> = {
    catalogue: "C",
    private_label: "P",
    bulk: "B",
    custom: "X",
  };
  const checksum = String(10 + Math.floor(random() * 90));
  const reference = `PV-${dateKey.replaceAll("-", "")}-${marketCode[destination]}${serviceCode[service]}-${String(index + 1).padStart(2, "0")}${checksum}`;
  const customerKey =
    repeatCandidate?.customerKey ||
    `ACC-${hashSeed(`${reference}-${destination}`).toString(36).toUpperCase()}`;

  const row: GeneratedFulfillmentRow = {
    reference,
    occurredAt: dateKey,
    destination,
    service,
    orderProfile: orderProfileForQuantity(quantityUnits),
    productName: firstItem.productName,
    specification: firstItem.specification,
    quantityUnits,
    unitPriceUsdCents,
    ...fees,
    itemsJson: JSON.stringify(items),
    orderKind: repeatCandidate ? "repeat" : "new",
    repeatOfReference: repeatCandidate?.reference ?? "",
    customerKey,
    amountUsdCents,
    status: "confirmed",
    cycleKey: `${LEDGER_VERSION}:${dateKey}`,
    isSample: true,
    isPublished: true,
  };

  const nextContext: GenerationContext = {
    ...context,
    repeatCandidates: [
      ...context.repeatCandidates,
      {
        reference,
        occurredAt: dateKey,
        destination,
        service,
        items,
        quantityUnits,
        customerKey,
      },
    ].slice(-600),
  };
  if (service === "bulk") {
    nextContext.lastBulkAt = dateKey;
    if (profile.label === "3,000+ kits") {
      nextContext.lastMegaBulkAt = dateKey;
    }
  }

  return { row, context: nextContext };
}

export function createDailyRows(
  date: Date,
  context: GenerationContext = {
    lastBulkAt: null,
    lastMegaBulkAt: null,
    repeatCandidates: [],
  },
  settings: GeneratorSettings = DEFAULT_GENERATOR_SETTINGS,
) {
  const orderDate = startOfUtcDay(date);
  const random = createSeededRandom(
    hashSeed(`peptivanta-${LEDGER_VERSION}-${isoDate(orderDate)}`),
  );
  const count = dailyOrderCount(orderDate, random, settings);
  const rows: GeneratedFulfillmentRow[] = [];
  let nextContext = { ...context };

  for (let index = 0; index < count; index += 1) {
    const result = createOrder(
      orderDate,
      index,
      nextContext,
      random,
      settings,
    );
    rows.push(result.row);
    nextContext = result.context;
  }

  return { rows, context: nextContext };
}

export function createBackfillRows(
  count: number,
  asOf: Date,
  settings: GeneratorSettings = DEFAULT_GENERATOR_SETTINGS,
) {
  const end = startOfUtcDay(asOf);
  const estimatedDays = Math.ceil(count / Math.max(1, settings.dailyMinimum));
  const start = addUtcDays(end, -(estimatedDays + 10));
  const rows: GeneratedFulfillmentRow[] = [];
  let context: GenerationContext = {
    lastBulkAt: null,
    lastMegaBulkAt: null,
    repeatCandidates: [],
  };

  for (
    let date = startOfUtcDay(start);
    date.getTime() <= end.getTime();
    date = addUtcDays(date, 1)
  ) {
    const result = createDailyRows(date, context, settings);
    rows.push(...result.rows);
    context = result.context;
  }

  // The weighted workday schedule normally produces more than 100 rows. This
  // fallback keeps a new empty database useful if a shorter window is requested.
  let supplementIndex = 0;
  while (rows.length < count) {
    const date = addUtcDays(start, supplementIndex % 60);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) {
      const random = createSeededRandom(
        hashSeed(`supplement-${LEDGER_VERSION}-${isoDate(date)}-${supplementIndex}`),
      );
      const result = createOrder(
        date,
        20 + supplementIndex,
        context,
        random,
        settings,
        "catalogue",
      );
      rows.push(result.row);
      context = result.context;
    }
    supplementIndex += 1;
  }

  const selected = rows
    .sort(
      (left, right) =>
        left.occurredAt.localeCompare(right.occurredAt) ||
        left.reference.localeCompare(right.reference),
    )
    .slice(-count);

  // If the selected window trimmed away the parent of an early repeat, expose
  // that row as a normal first order instead of showing a broken reference.
  const selectedReferences = new Set(selected.map((row) => row.reference));
  return selected.map((row) =>
    row.orderKind === "repeat" &&
    !selectedReferences.has(row.repeatOfReference)
      ? { ...row, orderKind: "new" as const, repeatOfReference: "" }
      : row,
  );
}

/**
 * Adds history strictly before the oldest stored row. It is used when the
 * display expands from 100 to 300, so no existing reference or amount is ever
 * regenerated. The returned rows remain chronological and self-contained.
 */
export function createHistoricalRowsBefore(
  count: number,
  beforeDate: Date,
  settings: GeneratorSettings = DEFAULT_GENERATOR_SETTINGS,
) {
  if (count <= 0) return [];
  return createBackfillRows(
    count,
    addUtcDays(startOfUtcDay(beforeDate), -1),
    settings,
  );
}

const COUNTRY_HOLIDAYS: Record<FulfillmentMarket, ReadonlySet<string>> = {
  "United States": new Set(["01-01", "07-04", "12-25"]),
  Canada: new Set(["01-01", "07-01", "12-25"]),
  Brazil: new Set(["01-01", "09-07", "12-25"]),
  Mexico: new Set(["01-01", "09-16", "12-25"]),
};

function businessDaysBetween(
  occurredAt: Date,
  asOf: Date,
  destination: FulfillmentMarket,
) {
  const end = startOfUtcDay(asOf);
  let cursor = startOfUtcDay(occurredAt);
  let count = 0;

  while (cursor.getTime() < end.getTime()) {
    cursor = addUtcDays(cursor, 1);
    const day = cursor.getUTCDay();
    const isWeekend = day === 0 || day === 6;
    const isHoliday = COUNTRY_HOLIDAYS[destination].has(isoDate(cursor).slice(5));
    if (!isWeekend && !isHoliday) count += 1;
  }

  return count;
}

function calendarDaysBetween(occurredAt: Date, asOf: Date) {
  const milliseconds =
    startOfUtcDay(asOf).getTime() - startOfUtcDay(occurredAt).getTime();
  return Math.max(0, Math.floor(milliseconds / 86_400_000));
}

function workflowDurations(
  service: FulfillmentService,
  quantityUnits: number,
  destination: FulfillmentMarket,
) {
  /*
   * These are elapsed business-day windows, not promises to a customer.
   *
   * Catalogue orders are treated as stocked finished goods: they do not enter
   * document review or production. They move through release checks, packing,
   * dispatch and destination-specific transit.
   *
   * Private-label, bulk and custom work remains made-to-order, but production
   * time scales with quantity instead of applying one long duration to every
   * project.
   */
  const transitDays: Record<FulfillmentMarket, number> = {
    "United States": 3,
    Canada: 4,
    Brazil: 7,
    Mexico: 5,
  };

  if (service === "catalogue") {
    return {
      documentation: 0,
      production: 0,
      // Stocked 1-10 box orders are released during the confirmation day.
      // Larger catalogue lots retain one separate release-check workday.
      quality: quantityUnits <= 10 ? 0 : 1,
      packaging: 1,
      transit: transitDays[destination],
    };
  }
  if (service === "private_label") {
    return {
      documentation: 1,
      production:
        quantityUnits <= 150
          ? 5
          : quantityUnits <= 300
            ? 6
            : quantityUnits <= 500
              ? 7
              : quantityUnits <= 1000
                ? 10
                : 14,
      quality: 1,
      packaging: 2,
      transit: transitDays[destination],
    };
  }
  if (service === "bulk") {
    return {
      documentation: 2,
      production:
        quantityUnits <= 1000 ? 10 : quantityUnits <= 3000 ? 15 : 22,
      quality: 2,
      packaging: 2,
      transit: transitDays[destination],
    };
  }
  return {
    documentation: 1,
    production:
      quantityUnits <= 5
        ? 2
        : quantityUnits <= 10
          ? 3
          : quantityUnits <= 50
            ? 4
            : quantityUnits <= 100
              ? 6
              : 10,
    quality: 1,
    packaging: 1,
    transit: transitDays[destination],
  };
}

/**
 * Visible status is derived from elapsed business days. It never uses a random
 * draw, never skips ahead on a new order, and advances automatically each day.
 */
export function currentFulfillmentStatus(
  record: Pick<
    GeneratedFulfillmentRow,
    "occurredAt" | "destination" | "service" | "quantityUnits"
  >,
  asOf: Date,
): FulfillmentStatus {
  const occurredAt = new Date(`${record.occurredAt}T00:00:00.000Z`);

  /*
   * Commercial display guardrail: every non-bulk order is complete after
   * fourteen full calendar days. Bulk projects are the only exception because
   * their production quantity can legitimately require a longer lead time.
   */
  if (
    record.service !== "bulk" &&
    calendarDaysBetween(occurredAt, asOf) > 14
  ) {
    return "delivered";
  }

  const businessDays = businessDaysBetween(
    occurredAt,
    asOf,
    record.destination,
  );
  const duration = workflowDurations(
    record.service,
    record.quantityUnits,
    record.destination,
  );

  if (businessDays === 0) return "confirmed";
  if (businessDays <= duration.documentation) return "documentation_review";

  const productionEnd = duration.documentation + duration.production;
  if (businessDays <= productionEnd) return "in_production";

  const qualityEnd = productionEnd + duration.quality;
  if (businessDays <= qualityEnd) return "quality_control";

  const packagingEnd = qualityEnd + duration.packaging;
  if (businessDays <= packagingEnd) return "packaging";

  const deliveryEnd = packagingEnd + duration.transit;
  if (businessDays <= deliveryEnd) return "dispatched";

  return "delivered";
}
