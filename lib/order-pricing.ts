export type PricingService =
  | "catalogue"
  | "private_label"
  | "bulk"
  | "custom";

/**
 * Reference volume ladder applied to the official retail price per box.
 *
 * The public wholesale market commonly publishes roughly 20–40% off retail
 * once wholesale thresholds are reached, while very high-volume programmes
 * often add another 10/20/30% across their larger tiers. This ladder reaches
 * those levels gradually so a 3-box order does not look like a wholesale lot.
 *
 * Benchmarks reviewed:
 * - https://www.22exo.com/wholesale
 * - https://azmarislabs.com/
 *
 * Basis points keep calculations exact: 300 bps = 3%.
 */
export const VOLUME_DISCOUNT_TIERS = [
  { minimum: 1, maximum: 2, discountBps: 0 },
  { minimum: 3, maximum: 5, discountBps: 500 },
  { minimum: 6, maximum: 10, discountBps: 1000 },
  { minimum: 11, maximum: 24, discountBps: 1500 },
  { minimum: 25, maximum: 49, discountBps: 2000 },
  { minimum: 50, maximum: 99, discountBps: 2500 },
  { minimum: 100, maximum: 299, discountBps: 3000 },
  { minimum: 300, maximum: 499, discountBps: 3300 },
  { minimum: 500, maximum: 999, discountBps: 3500 },
  { minimum: 1000, maximum: 2499, discountBps: 3800 },
  { minimum: 2500, maximum: Number.POSITIVE_INFINITY, discountBps: 4000 },
] as const;

export function volumeDiscountBps(quantity: number) {
  const normalized = Math.max(1, Math.floor(quantity));
  return (
    VOLUME_DISCOUNT_TIERS.find(
      (tier) => normalized >= tier.minimum && normalized <= tier.maximum,
    )?.discountBps ?? 0
  );
}

export function orderProfileForQuantity(quantity: number) {
  const value = Math.max(1, Math.floor(quantity));
  if (value <= 2) return "1–2 kits";
  if (value <= 5) return "3–5 kits";
  if (value <= 10) return "6–10 kits";
  if (value <= 50) return "10–50 kits";
  if (value <= 100) return "50–100 kits";
  if (value <= 300) return "100–300 kits";
  if (value <= 500) return "300–500 kits";
  if (value <= 1000) return "500–1,000 kits";
  if (value <= 3000) return "1,000–3,000 kits";
  return "3,000+ kits";
}

export type PricingInput = {
  retailUnitPriceUsdCents: number;
  quantityUnits: number;
  service: PricingService;
  serviceFeeUsdCents?: number;
  shippingFeeUsdCents?: number;
  deductionUsdCents?: number;
};

export type PricingResult = {
  retailSubtotalUsdCents: number;
  discountBps: number;
  discountUsdCents: number;
  discountedUnitPriceUsdCents: number;
  serviceFeeUsdCents: number;
  shippingFeeUsdCents: number;
  deductionUsdCents: number;
  amountUsdCents: number;
};

export type MultiItemPricingInput = {
  items: readonly {
    sku: string;
    productName: string;
    specification: string;
    retailUnitPriceUsdCents: number;
    quantityUnits: number;
  }[];
  service: PricingService;
  serviceFeeUsdCents?: number;
  deductionUsdCents?: number;
};

export type MultiItemPricingResult = {
  items: Array<
    MultiItemPricingInput["items"][number] & {
      discountedUnitPriceUsdCents: number;
      lineAmountUsdCents: number;
    }
  >;
  quantityUnits: number;
  retailSubtotalUsdCents: number;
  discountBps: number;
  discountUsdCents: number;
  serviceFeeUsdCents: number;
  deductionUsdCents: number;
  amountUsdCents: number;
};

/**
 * Mirrors the supplied order application:
 * subtotal - percentage discount + shipping/service fees - extra deduction.
 *
 * Service and shipping fees remain explicit inputs because the official quote
 * workbook states that shipping is not included and actual private-label costs
 * depend on the approved packaging configuration.
 */
export function calculateOrderPricing(input: PricingInput): PricingResult {
  const retailUnitPriceUsdCents = Math.max(
    1,
    Math.round(input.retailUnitPriceUsdCents),
  );
  const quantityUnits = Math.max(1, Math.floor(input.quantityUnits));
  const retailSubtotalUsdCents = retailUnitPriceUsdCents * quantityUnits;
  const discountBps =
    input.service === "custom" ? 0 : volumeDiscountBps(quantityUnits);
  const discountUsdCents = Math.round(
    (retailSubtotalUsdCents * discountBps) / 10_000,
  );
  const serviceFeeUsdCents = Math.max(
    0,
    Math.round(input.serviceFeeUsdCents ?? 0),
  );
  const shippingFeeUsdCents = Math.max(
    0,
    Math.round(input.shippingFeeUsdCents ?? 0),
  );
  const deductionUsdCents = Math.max(
    0,
    Math.round(input.deductionUsdCents ?? 0),
  );
  const amountUsdCents = Math.max(
    0,
    retailSubtotalUsdCents -
      discountUsdCents +
      serviceFeeUsdCents +
      shippingFeeUsdCents -
      deductionUsdCents,
  );

  return {
    retailSubtotalUsdCents,
    discountBps,
    discountUsdCents,
    discountedUnitPriceUsdCents: Math.round(
      (retailUnitPriceUsdCents * (10_000 - discountBps)) / 10_000,
    ),
    serviceFeeUsdCents,
    shippingFeeUsdCents,
    deductionUsdCents,
    amountUsdCents,
  };
}

/**
 * Prices a mixed-product order using the total number of boxes to select the
 * volume tier, then applies that same tier to every catalogue line. Freight is
 * deliberately excluded from website order values and remains an off-ledger
 * quotation item.
 */
export function calculateMultiItemOrderPricing(
  input: MultiItemPricingInput,
): MultiItemPricingResult {
  if (input.items.length === 0) {
    throw new Error("At least one product line is required.");
  }

  const quantityUnits = input.items.reduce(
    (sum, item) => sum + Math.max(1, Math.floor(item.quantityUnits)),
    0,
  );
  const discountBps =
    input.service === "custom" ? 0 : volumeDiscountBps(quantityUnits);
  const items = input.items.map((item) => {
    const retailUnitPriceUsdCents = Math.max(
      1,
      Math.round(item.retailUnitPriceUsdCents),
    );
    const lineQuantity = Math.max(1, Math.floor(item.quantityUnits));
    const discountedUnitPriceUsdCents = Math.round(
      (retailUnitPriceUsdCents * (10_000 - discountBps)) / 10_000,
    );
    return {
      ...item,
      retailUnitPriceUsdCents,
      quantityUnits: lineQuantity,
      discountedUnitPriceUsdCents,
      lineAmountUsdCents: discountedUnitPriceUsdCents * lineQuantity,
    };
  });
  const retailSubtotalUsdCents = items.reduce(
    (sum, item) =>
      sum + item.retailUnitPriceUsdCents * item.quantityUnits,
    0,
  );
  const discountedProductTotalUsdCents = items.reduce(
    (sum, item) => sum + item.lineAmountUsdCents,
    0,
  );
  const serviceFeeUsdCents = Math.max(
    0,
    Math.round(input.serviceFeeUsdCents ?? 0),
  );
  const deductionUsdCents = Math.max(
    0,
    Math.round(input.deductionUsdCents ?? 0),
  );
  const amountUsdCents = Math.max(
    0,
    discountedProductTotalUsdCents +
      serviceFeeUsdCents -
      deductionUsdCents,
  );

  return {
    items,
    quantityUnits,
    retailSubtotalUsdCents,
    discountBps,
    discountUsdCents:
      retailSubtotalUsdCents - discountedProductTotalUsdCents,
    serviceFeeUsdCents,
    deductionUsdCents,
    amountUsdCents,
  };
}
