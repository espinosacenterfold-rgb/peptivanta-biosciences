import { PRODUCT_CATALOG } from "../../../lib/product-catalog.ts";
import {
  calculateOrderPricing,
  orderProfileForQuantity,
} from "../../../lib/order-pricing.ts";

export const LEDGER_VERSION = "daily-v4-10-30-orders";
export const DISPLAY_LIMIT = 100;
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
  name: string;
  specification: string;
  unitPriceUsdCents: number;
}>;

export type GenerationContext = {
  lastBulkAt: string | null;
  lastMegaBulkAt: string | null;
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

const MARKET_WEIGHTS: readonly Weighted<{ value: FulfillmentMarket }>[] = [
  { value: "United States", weight: 48 },
  { value: "Canada", weight: 25 },
  { value: "Brazil", weight: 17 },
  { value: "Mexico", weight: 10 },
];

const SERVICE_WEIGHTS: Record<
  FulfillmentMarket,
  readonly Weighted<{ value: FulfillmentService }>[]
> = {
  "United States": [
    { value: "catalogue", weight: 87 },
    { value: "private_label", weight: 6 },
    { value: "custom", weight: 5 },
    { value: "bulk", weight: 2 },
  ],
  Canada: [
    { value: "catalogue", weight: 89 },
    { value: "private_label", weight: 5 },
    { value: "custom", weight: 4 },
    { value: "bulk", weight: 2 },
  ],
  Brazil: [
    { value: "catalogue", weight: 83 },
    { value: "private_label", weight: 7 },
    { value: "custom", weight: 7 },
    { value: "bulk", weight: 3 },
  ],
  Mexico: [
    { value: "catalogue", weight: 86 },
    { value: "private_label", weight: 6 },
    { value: "custom", weight: 6 },
    { value: "bulk", weight: 2 },
  ],
};

const CATALOGUE_PRODUCTS: readonly Product[] = PRODUCT_CATALOG.map((item) => ({
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
    name: "Custom peptide sequence",
    specification: "Specification-led pilot lot",
    unitPriceUsdCents: 21450,
    weight: 42,
  },
  {
    name: "Custom vial configuration",
    specification: "Lyophilized · customer-defined strength",
    unitPriceUsdCents: 18675,
    weight: 34,
  },
  {
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

function dailyOrderCount(date: Date, random: () => number) {
  const day = date.getUTCDay();
  const monthDay = isoDate(date).slice(5);

  if (day === 0 || day === 6) {
    return randomInteger(10, 14, random);
  }

  if (QUIET_DATES.has(monthDay)) {
    return randomInteger(10, 13, random);
  }

  if (day === 1) {
    return randomInteger(15, 23, random);
  }

  if (day >= 2 && day <= 4) {
    return randomInteger(20, 30, random);
  }

  return randomInteger(14, 22, random);
}

function serviceProduct(
  service: FulfillmentService,
  random: () => number,
) {
  if (service === "custom") {
    return pickWeighted(CUSTOM_PRODUCTS, random);
  }
  return pickWeighted(CATALOGUE_PRODUCTS, random);
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

function createOrder(
  date: Date,
  index: number,
  context: GenerationContext,
  random: () => number,
  forcedService?: FulfillmentService,
) {
  const destination = pickWeighted(MARKET_WEIGHTS, random).value;
  let service =
    forcedService ?? pickWeighted(SERVICE_WEIGHTS[destination], random).value;

  // Keep high-volume orders spaced apart. A blocked bulk draw becomes the
  // common catalogue workflow rather than being silently dropped.
  if (service === "bulk" && daysBetween(context.lastBulkAt, date) < 20) {
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

  const quantityUnits = randomInteger(profile.minimum, profile.maximum, random);
  const product = serviceProduct(service, random);
  const fees = orderFees(service, destination, quantityUnits, random);
  const pricing = calculateOrderPricing({
    retailUnitPriceUsdCents: product.unitPriceUsdCents,
    quantityUnits,
    service,
    serviceFeeUsdCents:
      fees.packagingFeeUsdCents + fees.testingFeeUsdCents,
    shippingFeeUsdCents: fees.logisticsFeeUsdCents,
  });
  const unitPriceUsdCents = pricing.discountedUnitPriceUsdCents;
  const amountUsdCents = pricing.amountUsdCents;
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

  const row: GeneratedFulfillmentRow = {
    reference: `PV-${dateKey.replaceAll("-", "")}-${marketCode[destination]}${serviceCode[service]}-${String(index + 1).padStart(2, "0")}${checksum}`,
    occurredAt: dateKey,
    destination,
    service,
    orderProfile: orderProfileForQuantity(quantityUnits),
    productName: product.name,
    specification: serviceSpecification(product),
    quantityUnits,
    unitPriceUsdCents,
    ...fees,
    amountUsdCents,
    status: "confirmed",
    cycleKey: `${LEDGER_VERSION}:${dateKey}`,
    isSample: true,
    isPublished: true,
  };

  const nextContext = { ...context };
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
  },
) {
  const orderDate = startOfUtcDay(date);
  const random = createSeededRandom(
    hashSeed(`peptivanta-${LEDGER_VERSION}-${isoDate(orderDate)}`),
  );
  const count = dailyOrderCount(orderDate, random);
  const rows: GeneratedFulfillmentRow[] = [];
  let nextContext = { ...context };

  for (let index = 0; index < count; index += 1) {
    const result = createOrder(orderDate, index, nextContext, random);
    rows.push(result.row);
    nextContext = result.context;
  }

  return { rows, context: nextContext };
}

export function createBackfillRows(
  count: number,
  asOf: Date,
) {
  const end = startOfUtcDay(asOf);
  // Ten to thirty new rows per day means the latest 100 normally fit inside
  // one to two weeks; no need to synthesize an unused three-month backlog.
  const start = addUtcDays(end, -14);
  const rows: GeneratedFulfillmentRow[] = [];
  let context: GenerationContext = {
    lastBulkAt: null,
    lastMegaBulkAt: null,
  };

  for (
    let date = startOfUtcDay(start);
    date.getTime() <= end.getTime();
    date = addUtcDays(date, 1)
  ) {
    const result = createDailyRows(date, context);
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
        "catalogue",
      );
      rows.push(result.row);
      context = result.context;
    }
    supplementIndex += 1;
  }

  return rows
    .sort(
      (left, right) =>
        left.occurredAt.localeCompare(right.occurredAt) ||
        left.reference.localeCompare(right.reference),
    )
    .slice(-count);
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
