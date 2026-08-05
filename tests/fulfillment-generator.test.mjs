import assert from "node:assert/strict";
import test from "node:test";

import {
  createBackfillRows,
  createDailyRows,
  createHistoricalRowsBefore,
  currentFulfillmentStatus,
  DISPLAY_LIMIT,
  LEDGER_VERSION,
  mergeFulfillmentRecords,
  UPDATE_INTERVAL_DAYS,
} from "../app/api/fulfillment-cases/generator.ts";
import { PRODUCT_CATALOG } from "../lib/product-catalog.ts";
import {
  calculateMultiItemOrderPricing,
  calculateOrderPricing,
  orderProfileForQuantity,
  volumeDiscountBps,
} from "../lib/order-pricing.ts";

const asOf = new Date("2026-07-28T00:00:00.000Z");

test("daily ledger backfill is deterministic and limited to 300 records", () => {
  const first = createBackfillRows(DISPLAY_LIMIT, asOf);
  const second = createBackfillRows(DISPLAY_LIMIT, asOf);

  assert.equal(LEDGER_VERSION, "daily-v4-10-30-orders");
  assert.equal(UPDATE_INTERVAL_DAYS, 1);
  assert.equal(first.length, 300);
  assert.deepEqual(first, second);
  assert.ok(first.every((row) => row.occurredAt >= "2026-04-28"));
});

test("service, size, and market weights resemble a catalogue-led business", () => {
  const rows = createBackfillRows(DISPLAY_LIMIT, asOf);
  const serviceCount = Object.fromEntries(
    ["catalogue", "private_label", "bulk", "custom"].map((service) => [
      service,
      rows.filter((row) => row.service === service).length,
    ]),
  );
  const marketCount = Object.fromEntries(
    ["United States", "Canada", "Brazil", "Mexico"].map((market) => [
      market,
      rows.filter((row) => row.destination === market).length,
    ]),
  );
  const smallOrders = rows.filter((row) => row.quantityUnits <= 10);
  const ordersUnder500Usd = rows.filter((row) => row.amountUsdCents < 50_000);
  const ordersUnder1000Usd = rows.filter((row) => row.amountUsdCents < 100_000);
  const ordersOver5000Usd = rows.filter((row) => row.amountUsdCents >= 500_000);
  const megaBulk = rows.filter(
    (row) => row.service === "bulk" && row.orderProfile === "3,000+ kits",
  );

  assert.ok(serviceCount.catalogue >= 225, serviceCount);
  assert.ok(serviceCount.private_label >= 20, serviceCount);
  assert.ok(serviceCount.bulk <= 5, serviceCount);
  assert.ok(serviceCount.private_label + serviceCount.bulk <= 50, serviceCount);
  assert.ok(smallOrders.length >= 220);
  assert.ok(ordersUnder500Usd.length >= 175);
  assert.ok(ordersUnder1000Usd.length >= 220);
  assert.ok(ordersOver5000Usd.length <= 50);
  assert.ok(megaBulk.length <= 2);
  assert.ok(marketCount["United States"] > marketCount.Canada, marketCount);
  assert.ok(marketCount.Canada > marketCount.Mexico, marketCount);
  assert.ok(marketCount.Brazil > 0);
  assert.ok(marketCount.Mexico > 0);
});

test("bulk orders remain separated while daily activity stays continuous", () => {
  const rows = createBackfillRows(DISPLAY_LIMIT, asOf);
  const bulkRows = rows
    .filter((row) => row.service === "bulk")
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));

  for (let index = 1; index < bulkRows.length; index += 1) {
    const gap =
      (Date.parse(`${bulkRows[index].occurredAt}T00:00:00.000Z`) -
        Date.parse(`${bulkRows[index - 1].occurredAt}T00:00:00.000Z`)) /
      86_400_000;
    assert.ok(gap >= 20, `bulk gap was ${gap} days`);
  }
  assert.ok(new Set(rows.map((row) => row.occurredAt)).size >= 4);
});

test("product assemblies and repeat orders are linked to visible prior orders", () => {
  const rows = createBackfillRows(DISPLAY_LIMIT, asOf);
  const references = new Set(rows.map((row) => row.reference));
  const repeated = rows.filter((row) => row.orderKind === "repeat");
  const mixed = rows.filter((row) => JSON.parse(row.itemsJson).length > 1);

  assert.ok(mixed.length >= 75, `only ${mixed.length} assembled orders`);
  assert.ok(repeated.length >= 35, `only ${repeated.length} repeat orders`);
  assert.ok(repeated.length <= 90, `too many repeat orders: ${repeated.length}`);
  for (const row of repeated) {
    assert.ok(references.has(row.repeatOfReference), row.repeatOfReference);
    const parent = rows.find(
      (candidate) => candidate.reference === row.repeatOfReference,
    );
    assert.ok(parent);
    assert.ok(parent.occurredAt < row.occurredAt);
    assert.equal(parent.destination, row.destination);
    assert.deepEqual(
      JSON.parse(parent.itemsJson).map((item) => [
        item.productName,
        item.specification,
      ]),
      JSON.parse(row.itemsJson).map((item) => [
        item.productName,
        item.specification,
      ]),
    );
  }
});

test("capacity expansion generates only dates before the existing ledger", () => {
  const history = createHistoricalRowsBefore(
    200,
    new Date("2026-07-31T00:00:00.000Z"),
  );
  assert.equal(history.length, 200);
  assert.ok(history.every((row) => row.occurredAt < "2026-07-31"));
  assert.equal(new Set(history.map((row) => row.reference)).size, 200);
});

test("amounts use the official quote catalogue and volume discount ladder", () => {
  const rows = createBackfillRows(DISPLAY_LIMIT, asOf);
  let nonRoundedAmounts = 0;

  for (const row of rows) {
    assert.ok(row.productName.length > 0);
    assert.ok(row.specification.length > 0);
    if (row.service !== "custom") {
      const items = JSON.parse(row.itemsJson);
      assert.ok(items.length >= 1 && items.length <= 3);
      for (const line of items) {
        const catalogueItem = PRODUCT_CATALOG.find(
          (item) =>
            item.productName === line.productName &&
            line.specification.startsWith(item.specification),
        );
        assert.ok(catalogueItem, `${line.productName} ${line.specification}`);
        assert.equal(line.retailUnitPriceUsdCents, catalogueItem.retailUsdCents);
      }
      if (row.service === "catalogue") {
        assert.equal(row.packagingFeeUsdCents, 0);
        assert.equal(row.testingFeeUsdCents, 0);
        assert.equal(row.logisticsFeeUsdCents, 0);
      }
      const pricing = calculateMultiItemOrderPricing({
        items,
        service: row.service,
        serviceFeeUsdCents:
          row.packagingFeeUsdCents + row.testingFeeUsdCents,
      });
      assert.equal(
        row.unitPriceUsdCents,
        pricing.items[0].discountedUnitPriceUsdCents,
      );
      assert.equal(
        row.amountUsdCents,
        pricing.amountUsdCents + row.logisticsFeeUsdCents,
      );
    }
    if (row.amountUsdCents % 1000 !== 0) nonRoundedAmounts += 1;
  }

  assert.ok(nonRoundedAmounts >= 80);
});

test("the official catalogue and market discount tiers remain auditable", () => {
  assert.equal(PRODUCT_CATALOG.length, 96);
  assert.equal(
    new Set(PRODUCT_CATALOG.map((item) => item.productName)).size,
    46,
  );
  assert.equal(volumeDiscountBps(1), 0);
  assert.equal(volumeDiscountBps(10), 1000);
  assert.equal(volumeDiscountBps(100), 3000);
  assert.equal(volumeDiscountBps(500), 3500);
  assert.equal(volumeDiscountBps(2500), 4000);
  assert.equal(orderProfileForQuantity(501), "500–1,000 kits");

  const quote = calculateOrderPricing({
    retailUnitPriceUsdCents: 5100,
    quantityUnits: 100,
    service: "private_label",
    serviceFeeUsdCents: 10_000,
    shippingFeeUsdCents: 5_000,
    deductionUsdCents: 2_000,
  });
  assert.equal(quote.retailSubtotalUsdCents, 510_000);
  assert.equal(quote.discountBps, 3000);
  assert.equal(quote.amountUsdCents, 370_000);
});

test("mixed-product real orders use one total-quantity discount and no freight", () => {
  const quote = calculateMultiItemOrderPricing({
    items: [
      {
        sku: "TR5",
        productName: "Tirzepatide",
        specification: "5mg*10vials",
        retailUnitPriceUsdCents: 5100,
        quantityUnits: 2,
      },
      {
        sku: "BC5",
        productName: "BPC 157",
        specification: "5mg*10vials",
        retailUnitPriceUsdCents: 4600,
        quantityUnits: 4,
      },
    ],
    service: "private_label",
    serviceFeeUsdCents: 10_000,
    deductionUsdCents: 2_000,
  });

  assert.equal(quote.quantityUnits, 6);
  assert.equal(quote.discountBps, 1000);
  assert.equal(quote.items.length, 2);
  assert.equal(quote.items[0].discountedUnitPriceUsdCents, 4590);
  assert.equal(quote.items[1].discountedUnitPriceUsdCents, 4140);
  assert.equal(quote.amountUsdCents, 33_740);
  assert.ok(!("shippingFeeUsdCents" in quote));
});

test("catalogue totals contain product value only", () => {
  const rows = createBackfillRows(DISPLAY_LIMIT, asOf).filter(
    (row) => row.service === "catalogue",
  );

  for (const row of rows) {
    assert.equal(row.packagingFeeUsdCents, 0);
    assert.equal(row.testingFeeUsdCents, 0);
    assert.equal(row.logisticsFeeUsdCents, 0);
    const items = JSON.parse(row.itemsJson);
    assert.equal(
      row.amountUsdCents,
      items.reduce((sum, item) => sum + item.lineAmountUsdCents, 0),
    );
  }
});

test("stocked catalogue orders skip document review and production", () => {
  const record = {
    occurredAt: "2026-07-06",
    destination: "United States",
    service: "catalogue",
    quantityUnits: 24,
  };
  const order = [
    "confirmed",
    "documentation_review",
    "in_production",
    "quality_control",
    "packaging",
    "dispatched",
    "delivered",
  ];
  const seen = new Set();
  let previousRank = -1;

  for (let offset = 0; offset <= 30; offset += 1) {
    const date = new Date("2026-07-06T00:00:00.000Z");
    date.setUTCDate(date.getUTCDate() + offset);
    const status = currentFulfillmentStatus(record, date);
    const rank = order.indexOf(status);
    assert.ok(rank >= previousRank, `${status} regressed on day ${offset}`);
    seen.add(status);
    previousRank = rank;
  }

  assert.equal(currentFulfillmentStatus(record, new Date("2026-07-06")), "confirmed");
  assert.equal(
    currentFulfillmentStatus(record, new Date("2026-07-07")),
    "quality_control",
  );
  assert.ok(!seen.has("documentation_review"));
  assert.ok(!seen.has("in_production"));
  assert.ok(seen.has("quality_control"));
  assert.ok(seen.has("packaging"));
  assert.ok(seen.has("dispatched"));
  assert.ok(seen.has("delivered"));
});

test("made-to-order timelines scale with service and quantity", () => {
  const privateLabel = {
    occurredAt: "2026-07-06",
    destination: "Canada",
    service: "private_label",
    quantityUnits: 480,
  };
  const bulk = {
    occurredAt: "2026-07-06",
    destination: "Brazil",
    service: "bulk",
    quantityUnits: 3600,
  };

  assert.equal(
    currentFulfillmentStatus(privateLabel, new Date("2026-07-20")),
    "packaging",
  );
  assert.equal(
    currentFulfillmentStatus(bulk, new Date("2026-07-27")),
    "in_production",
  );
  assert.notEqual(
    currentFulfillmentStatus(bulk, new Date("2026-09-30")),
    "in_production",
  );
});

test("reported July examples follow inventory-aware workflow timing", () => {
  const asOf = new Date("2026-07-29T12:00:00.000Z");
  const examples = [
    ["2026-07-08", "Brazil", "custom", 25, "delivered"],
    ["2026-07-09", "United States", "private_label", 400, "delivered"],
    ["2026-07-10", "United States", "catalogue", 40, "delivered"],
    ["2026-07-13", "United States", "private_label", 400, "delivered"],
    ["2026-07-15", "Canada", "custom", 4, "delivered"],
    ["2026-07-16", "United States", "catalogue", 1, "delivered"],
    ["2026-07-16", "Canada", "catalogue", 1, "delivered"],
    ["2026-07-24", "United States", "catalogue", 4, "dispatched"],
    ["2026-07-23", "United States", "catalogue", 1, "dispatched"],
    ["2026-07-22", "United States", "private_label", 200, "in_production"],
    ["2026-07-22", "Canada", "catalogue", 8, "dispatched"],
    ["2026-07-21", "United States", "catalogue", 1, "delivered"],
    ["2026-07-28", "United States", "private_label", 400, "documentation_review"],
    ["2026-07-28", "Mexico", "catalogue", 4, "packaging"],
    ["2026-07-27", "United States", "catalogue", 1, "dispatched"],
  ];

  for (const [
    occurredAt,
    destination,
    service,
    quantityUnits,
    expected,
  ] of examples) {
    assert.equal(
      currentFulfillmentStatus(
        { occurredAt, destination, service, quantityUnits },
        asOf,
      ),
      expected,
      `${occurredAt} ${service} ${quantityUnits}`,
    );
  }
});

test("non-bulk orders cannot remain open beyond fourteen calendar days", () => {
  const asOf = new Date("2026-07-29T12:00:00.000Z");
  for (const service of ["catalogue", "private_label", "custom"]) {
    assert.equal(
      currentFulfillmentStatus(
        {
          occurredAt: "2026-07-14",
          destination: "Brazil",
          service,
          quantityUnits: service === "private_label" ? 900 : 40,
        },
        asOf,
      ),
      "delivered",
    );
  }

  assert.equal(
    currentFulfillmentStatus(
      {
        occurredAt: "2026-07-14",
        destination: "Brazil",
        service: "bulk",
        quantityUnits: 3600,
      },
      asOf,
    ),
    "in_production",
  );
});

test("daily generation is stable and produces 10-30 new rows", () => {
  const first = createDailyRows(new Date("2026-07-28T00:00:00.000Z"));
  const second = createDailyRows(new Date("2026-07-28T00:00:00.000Z"));
  assert.deepEqual(first, second);

  for (let offset = 0; offset < 14; offset += 1) {
    const date = new Date("2026-07-20T00:00:00.000Z");
    date.setUTCDate(date.getUTCDate() + offset);
    const daily = createDailyRows(date);
    assert.ok(daily.rows.length >= 10, `${date.toISOString()} was below 10`);
    assert.ok(daily.rows.length <= 30, `${date.toISOString()} exceeded 30`);
  }
});

test("the next daily update appends records without rewriting prior orders", () => {
  const priorRows = createBackfillRows(DISPLAY_LIMIT, asOf);
  const immutableSnapshot = structuredClone(priorRows);
  const lastBulk = priorRows.find((row) => row.service === "bulk");
  const lastMegaBulk = priorRows.find(
    (row) => row.service === "bulk" && row.quantityUnits >= 3000,
  );

  const nextDay = createDailyRows(new Date("2026-07-29T00:00:00.000Z"), {
    lastBulkAt: lastBulk?.occurredAt ?? null,
    lastMegaBulkAt: lastMegaBulk?.occurredAt ?? null,
    repeatCandidates: priorRows.map((row) => ({
      reference: row.reference,
      occurredAt: row.occurredAt,
      destination: row.destination,
      service: row.service,
      items: JSON.parse(row.itemsJson),
      quantityUnits: row.quantityUnits,
      customerKey: row.customerKey,
    })),
  });
  const combinedRows = [...priorRows, ...nextDay.rows];

  assert.deepEqual(priorRows, immutableSnapshot);
  assert.ok(nextDay.rows.length > 0);
  assert.ok(nextDay.rows.every((row) => row.occurredAt === "2026-07-29"));
  assert.equal(
    new Set(combinedRows.map((row) => row.reference)).size,
    combinedRows.length,
  );

  for (const priorRow of priorRows) {
    assert.deepEqual(
      combinedRows.find((row) => row.reference === priorRow.reference),
      priorRow,
    );
  }
});

test("real orders follow their business date instead of being pinned", () => {
  const manual = [
    { reference: "REAL-OLD", occurredAt: "2026-07-02", source: "manual" },
    { reference: "REAL-NEW", occurredAt: "2026-07-30", source: "manual" },
  ];
  const samples = [
    { reference: "SAMPLE-3", occurredAt: "2026-07-29", source: "sample" },
    { reference: "SAMPLE-2", occurredAt: "2026-07-20", source: "sample" },
    { reference: "SAMPLE-1", occurredAt: "2026-07-10", source: "sample" },
  ];

  const records = mergeFulfillmentRecords(manual, samples, 4);
  assert.deepEqual(
    records.map((record) => record.reference),
    ["REAL-NEW", "SAMPLE-3", "SAMPLE-2", "REAL-OLD"],
  );
});
