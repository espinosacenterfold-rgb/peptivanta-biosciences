import { ensureFulfillmentSchema, getD1 } from "../../../../db";
import { findCatalogVariant } from "../../../../lib/product-catalog.ts";
import {
  calculateMultiItemOrderPricing,
  orderProfileForQuantity,
  type PricingService,
} from "../../../../lib/order-pricing.ts";
import { requireFulfillmentAdmin } from "../auth";

const markets = new Set([
  "United States",
  "Canada",
  "Brazil",
  "Mexico",
]);
const services = new Set([
  "catalogue",
  "private_label",
  "bulk",
  "custom",
]);
const statuses = new Set([
  "confirmed",
  "documentation_review",
  "in_production",
  "quality_control",
  "packaging",
  "dispatched",
  "delivered",
]);

type ManualOrderItemInput = {
  sku?: unknown;
  productName?: unknown;
  specification?: unknown;
  quantityUnits?: unknown;
};

type ManualOrderInput = {
  id?: unknown;
  reference?: unknown;
  occurredAt?: unknown;
  destination?: unknown;
  service?: unknown;
  items?: unknown;
  // These legacy fields keep older deployed admin clients compatible.
  sku?: unknown;
  productName?: unknown;
  specification?: unknown;
  quantityUnits?: unknown;
  deductionUsdCents?: unknown;
  status?: unknown;
  isPublished?: unknown;
};

type StoredOrder = {
  id: number;
  reference: string;
  occurredAt: string;
  destination: string;
  service: PricingService;
  orderProfile: string;
  sku: string;
  productName: string;
  specification: string;
  quantityUnits: number;
  retailUnitPriceUsdCents: number;
  discountBps: number;
  deductionUsdCents: number;
  status: string;
  isPublished: number;
  createdAt: string;
  updatedAt: string;
};

type StoredItem = {
  id: number;
  orderId: number;
  sku: string;
  productName: string;
  specification: string;
  quantityUnits: number;
  retailUnitPriceUsdCents: number;
  discountedUnitPriceUsdCents: number;
  lineAmountUsdCents: number;
  position: number;
};

function textField(value: unknown, name: string, maximum: number) {
  if (typeof value !== "string") {
    throw new Error(`${name} is required.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw new Error(`${name} must contain 1-${maximum} characters.`);
  }
  return normalized;
}

function validateDate(value: unknown) {
  const date = textField(value, "Order date", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Order date must use YYYY-MM-DD.");
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("Order date is invalid.");
  }
  return date;
}

function normalizeReference(value: unknown, occurredAt: string) {
  const supplied = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (supplied) {
    if (!/^[A-Z0-9][A-Z0-9-]{4,39}$/.test(supplied)) {
      throw new Error(
        "Reference must contain 5-40 uppercase letters, numbers, or hyphens.",
      );
    }
    return supplied;
  }
  return `PV-R-${occurredAt.replaceAll("-", "")}-${crypto
    .randomUUID()
    .slice(0, 6)
    .toUpperCase()}`;
}

function moneyField(value: unknown, name: string) {
  const amount = Number(value ?? 0);
  if (
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    amount > 1_000_000_000
  ) {
    throw new Error(`${name} must be between US$0 and US$10,000,000.`);
  }
  return amount;
}

function validateItem(input: ManualOrderItemInput, index: number) {
  const quantityUnits = Number(input.quantityUnits);
  if (
    !Number.isSafeInteger(quantityUnits) ||
    quantityUnits < 1 ||
    quantityUnits > 100_000
  ) {
    throw new Error(
      `Product ${index + 1} quantity must be a whole number between 1 and 100,000.`,
    );
  }

  const sku = textField(input.sku, `Product ${index + 1} SKU`, 40);
  const productName = textField(
    input.productName,
    `Product ${index + 1} name`,
    120,
  );
  const specification = textField(
    input.specification,
    `Product ${index + 1} specification`,
    180,
  );
  const catalogItem = findCatalogVariant(sku, productName, specification);
  if (!catalogItem) {
    throw new Error(
      `Product ${index + 1} does not match the official quote catalogue.`,
    );
  }

  return {
    sku: catalogItem.sku,
    productName: catalogItem.productName,
    specification: catalogItem.specification,
    quantityUnits,
    retailUnitPriceUsdCents: catalogItem.retailUsdCents,
  };
}

function validateInput(body: ManualOrderInput, includeId: boolean) {
  const occurredAt = validateDate(body.occurredAt);
  const destination = textField(body.destination, "Destination", 40);
  const service = textField(body.service, "Service", 30);
  const status = textField(body.status, "Status", 40);

  if (!markets.has(destination)) throw new Error("Destination is invalid.");
  if (!services.has(service)) throw new Error("Service is invalid.");
  if (!statuses.has(status)) throw new Error("Status is invalid.");

  const id = Number(body.id);
  if (includeId && (!Number.isSafeInteger(id) || id < 1)) {
    throw new Error("Order id is invalid.");
  }

  const submittedItems = Array.isArray(body.items)
    ? (body.items as ManualOrderItemInput[])
    : [
        {
          sku: body.sku,
          productName: body.productName,
          specification: body.specification,
          quantityUnits: body.quantityUnits,
        },
      ];
  if (submittedItems.length < 1 || submittedItems.length > 20) {
    throw new Error("An order must contain between 1 and 20 product lines.");
  }
  const items = submittedItems.map(validateItem);
  const duplicateKeys = new Set<string>();
  for (const item of items) {
    const key = `${item.sku}\u0000${item.productName}\u0000${item.specification}`;
    if (duplicateKeys.has(key)) {
      throw new Error(
        "The same product specification appears more than once. Combine its quantity into one line.",
      );
    }
    duplicateKeys.add(key);
  }

  const deductionUsdCents = moneyField(
    body.deductionUsdCents,
    "Extra deduction",
  );
  const pricing = calculateMultiItemOrderPricing({
    items,
    service: service as PricingService,
    deductionUsdCents,
  });
  if (pricing.amountUsdCents < 1) {
    throw new Error("The calculated order total must be greater than US$0.");
  }

  const firstItem = pricing.items[0];
  return {
    id,
    reference: normalizeReference(body.reference, occurredAt),
    occurredAt,
    destination,
    service: service as PricingService,
    orderProfile: orderProfileForQuantity(pricing.quantityUnits),
    sku: firstItem.sku,
    productName: firstItem.productName,
    specification: firstItem.specification,
    quantityUnits: pricing.quantityUnits,
    retailUnitPriceUsdCents: firstItem.retailUnitPriceUsdCents,
    discountBps: pricing.discountBps,
    // Real-order totals intentionally contain product value only. Private
    // label, packing, testing and freight are handled outside this ledger.
    serviceFeeUsdCents: 0,
    deductionUsdCents,
    amountUsdCents: pricing.amountUsdCents,
    status,
    isPublished: body.isPublished === false ? 0 : 1,
    items: pricing.items,
  };
}

function itemInsertStatements(
  d1: Awaited<ReturnType<typeof getD1>>,
  orderId: number,
  items: ReturnType<typeof validateInput>["items"],
) {
  return items.map((item, position) =>
    d1
      .prepare(
        `INSERT INTO manual_fulfillment_order_items (
           order_id,
           sku,
           product_name,
           specification,
           quantity_units,
           retail_unit_price_usd_cents,
           discounted_unit_price_usd_cents,
           line_amount_usd_cents,
           position
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        orderId,
        item.sku,
        item.productName,
        item.specification,
        item.quantityUnits,
        item.retailUnitPriceUsdCents,
        item.discountedUnitPriceUsdCents,
        item.lineAmountUsdCents,
        position,
      ),
  );
}

async function readOrders() {
  const d1 = await getD1();
  const [orderResult, itemResult] = await Promise.all([
    d1
      .prepare(
        `SELECT
           id,
           reference,
           occurred_at AS occurredAt,
           destination,
           service,
           order_profile AS orderProfile,
           sku,
           product_name AS productName,
           specification,
           quantity_units AS quantityUnits,
           retail_unit_price_usd_cents AS retailUnitPriceUsdCents,
           discount_bps AS discountBps,
           deduction_usd_cents AS deductionUsdCents,
           status,
           is_published AS isPublished,
           created_at AS createdAt,
           updated_at AS updatedAt
         FROM manual_fulfillment_orders
         ORDER BY occurred_at DESC, created_at DESC, id DESC
         LIMIT 200`,
      )
      .all(),
    d1
      .prepare(
        `SELECT
           id,
           order_id AS orderId,
           sku,
           product_name AS productName,
           specification,
           quantity_units AS quantityUnits,
           retail_unit_price_usd_cents AS retailUnitPriceUsdCents,
           discounted_unit_price_usd_cents AS discountedUnitPriceUsdCents,
           line_amount_usd_cents AS lineAmountUsdCents,
           position
         FROM manual_fulfillment_order_items
         ORDER BY order_id, position, id`,
      )
      .all(),
  ]);

  const storedOrders = orderResult.results as unknown as StoredOrder[];
  const storedItems = itemResult.results as unknown as StoredItem[];

  const itemsByOrder = new Map<number, StoredItem[]>();
  for (const item of storedItems) {
    const group = itemsByOrder.get(item.orderId) ?? [];
    group.push(item);
    itemsByOrder.set(item.orderId, group);
  }

  return storedOrders.map((order) => {
    const items = itemsByOrder.get(order.id) ?? [
      {
        id: 0,
        orderId: order.id,
        sku: order.sku,
        productName: order.productName,
        specification: order.specification,
        quantityUnits: order.quantityUnits,
        retailUnitPriceUsdCents: order.retailUnitPriceUsdCents,
        discountedUnitPriceUsdCents: Math.round(
          (order.retailUnitPriceUsdCents * (10_000 - order.discountBps)) /
            10_000,
        ),
        lineAmountUsdCents:
          Math.round(
            (order.retailUnitPriceUsdCents * (10_000 - order.discountBps)) /
              10_000,
          ) * order.quantityUnits,
        position: 0,
      },
    ];
    const productTotal = items.reduce(
      (sum, item) => sum + item.lineAmountUsdCents,
      0,
    );
    return {
      ...order,
      amountUsdCents: Math.max(
        0,
        productTotal - order.deductionUsdCents,
      ),
      items,
    };
  });
}

export async function GET(request: Request) {
  const unauthorized = await requireFulfillmentAdmin(request);
  if (unauthorized) return unauthorized;

  await ensureFulfillmentSchema();
  return Response.json(
    { orders: await readOrders() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const unauthorized = await requireFulfillmentAdmin(request);
  if (unauthorized) return unauthorized;

  let insertedOrderId: number | null = null;
  try {
    await ensureFulfillmentSchema();
    const order = validateInput(
      (await request.json()) as ManualOrderInput,
      false,
    );
    const d1 = await getD1();
    const result = await d1
      .prepare(
        `INSERT INTO manual_fulfillment_orders (
           reference,
           occurred_at,
           destination,
           service,
           order_profile,
           sku,
           product_name,
           specification,
           quantity_units,
           retail_unit_price_usd_cents,
           discount_bps,
           service_fee_usd_cents,
           shipping_fee_usd_cents,
           deduction_usd_cents,
           amount_usd_cents,
           status,
           is_published,
           updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      )
      .bind(
        order.reference,
        order.occurredAt,
        order.destination,
        order.service,
        order.orderProfile,
        order.sku,
        order.productName,
        order.specification,
        order.quantityUnits,
        order.retailUnitPriceUsdCents,
        order.discountBps,
        order.serviceFeeUsdCents,
        order.deductionUsdCents,
        order.amountUsdCents,
        order.status,
        order.isPublished,
      )
      .run();
    insertedOrderId = Number(result.meta.last_row_id);
    if (!Number.isSafeInteger(insertedOrderId) || insertedOrderId < 1) {
      throw new Error("The new order id could not be resolved.");
    }
    await d1.batch(itemInsertStatements(d1, insertedOrderId, order.items));

    return Response.json(
      { ok: true, orders: await readOrders() },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (insertedOrderId) {
      try {
        const d1 = await getD1();
        await d1
          .prepare("DELETE FROM manual_fulfillment_orders WHERE id = ?")
          .bind(insertedOrderId)
          .run();
      } catch {
        // Preserve the original error response if cleanup itself fails.
      }
    }
    const message =
      error instanceof Error ? error.message : "Unable to create order.";
    const status = /UNIQUE constraint failed/i.test(message) ? 409 : 400;
    return Response.json(
      { error: status === 409 ? "That order reference already exists." : message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function PATCH(request: Request) {
  const unauthorized = await requireFulfillmentAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    await ensureFulfillmentSchema();
    const order = validateInput(
      (await request.json()) as ManualOrderInput,
      true,
    );
    const d1 = await getD1();
    const results = await d1.batch([
      d1
        .prepare(
          `UPDATE manual_fulfillment_orders SET
             reference = ?,
             occurred_at = ?,
             destination = ?,
             service = ?,
             order_profile = ?,
             sku = ?,
             product_name = ?,
             specification = ?,
             quantity_units = ?,
             retail_unit_price_usd_cents = ?,
             discount_bps = ?,
             service_fee_usd_cents = ?,
             shipping_fee_usd_cents = 0,
             deduction_usd_cents = ?,
             amount_usd_cents = ?,
             status = ?,
             is_published = ?,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(
          order.reference,
          order.occurredAt,
          order.destination,
          order.service,
          order.orderProfile,
          order.sku,
          order.productName,
          order.specification,
          order.quantityUnits,
          order.retailUnitPriceUsdCents,
          order.discountBps,
          order.serviceFeeUsdCents,
          order.deductionUsdCents,
          order.amountUsdCents,
          order.status,
          order.isPublished,
          order.id,
        ),
      d1
        .prepare("DELETE FROM manual_fulfillment_order_items WHERE order_id = ?")
        .bind(order.id),
      ...itemInsertStatements(d1, order.id, order.items),
    ]);

    if (!results[0].meta.changes) {
      return Response.json(
        { error: "Order not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    return Response.json(
      { ok: true, orders: await readOrders() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update order.";
    const status = /UNIQUE constraint failed/i.test(message) ? 409 : 400;
    return Response.json(
      { error: status === 409 ? "That order reference already exists." : message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await requireFulfillmentAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    await ensureFulfillmentSchema();
    const body = (await request.json()) as { id?: unknown };
    const id = Number(body.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return Response.json(
        { error: "Order id is invalid." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const d1 = await getD1();
    const results = await d1.batch([
      d1
        .prepare("DELETE FROM manual_fulfillment_order_items WHERE order_id = ?")
        .bind(id),
      d1.prepare("DELETE FROM manual_fulfillment_orders WHERE id = ?").bind(id),
    ]);

    if (!results[1].meta.changes) {
      return Response.json(
        { error: "Order not found." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    return Response.json(
      { ok: true, orders: await readOrders() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete order.";
    return Response.json(
      { error: message },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
