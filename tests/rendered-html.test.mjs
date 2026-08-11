import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the finished website", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Peptivanta Biosciences/i);
  assert.match(html, /Peptide supply,/i);
  assert.match(html, /made clear/i);
  assert.match(html, /Watch the workflow/i);
  assert.match(html, /One line\. Five visible stages\./i);
  assert.match(html, /Factory process view/i);
  assert.match(html, /Request a quote/i);
  assert.match(html, /Get quote on WhatsApp/i);
  assert.match(html, /Recent fulfillment/i);
  assert.match(html, /href="\/fulfillment"/i);
  assert.match(html, /COA documents/i);
  assert.match(html, /href="\/coa"/i);
  assert.match(html, /\/images\/inventory\.webp/);
  assert.match(html, /Português/);
  assert.match(html, /Español/);
  assert.match(html, /Français/);
  assert.match(html, /中文/);
  assert.match(html, /Professional-use and compliance notice/i);
  assert.doesNotMatch(
    html,
    /Evidence first|Every batch|No direct online ordering/i,
  );
  assert.doesNotMatch(html, /Add email in site\.config\.ts/i);
  assert.doesNotMatch(html, /\/images\/inventory\.jpg/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("includes complete multilingual ledger content", async () => {
  const [homepage, ledger, fulfillmentPage, legalDocument] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/FulfillmentCases.tsx", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../app/fulfillment/FulfillmentLedgerPage.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(new URL("../app/LegalDocument.tsx", import.meta.url), "utf8"),
    ]);

  assert.match(homepage, /多肽供应，/);
  assert.match(homepage, /一条产线，五个清晰环节。/);
  assert.match(homepage, /Suministro de péptidos,/);
  assert.match(homepage, /L’approvisionnement en peptides,/);
  assert.match(homepage, /factory-flow-desktop-v2\.mp4/);
  assert.match(homepage, /FactoryWorkflow/);
  assert.match(homepage, /产品分类 · Products Categories/);
  assert.match(ledger, /近期订单流程记录/);
  assert.match(ledger, /示例履约流程数据/);
  assert.match(ledger, /示例履约流程数据，仅展示近\{count\}条新订单/);
  assert.match(ledger, /产品组合 \/ 规格/);
  assert.match(ledger, /客户复购/);
  assert.match(ledger, /对应前单/);
  assert.match(ledger, /Mexico/);
  assert.match(ledger, /Order size/);
  assert.match(ledger, /Faixa do pedido/);
  assert.match(ledger, /Escala del pedido/);
  assert.match(ledger, /Taille de commande/);
  assert.match(ledger, /Quote retail/);
  assert.match(ledger, /volume discount/);
  assert.doesNotMatch(ledger, /Recorded order|已登记订单|recordedOrder/);
  assert.match(ledger, /订单规模/);
  assert.doesNotMatch(ledger, /准确数量/);
  assert.match(ledger, /文件审核中/);
  assert.match(ledger, /质量检测/);
  assert.match(ledger, /已送达/);
  assert.match(fulfillmentPage, /返回网站/);
  assert.match(fulfillmentPage, /FulfillmentCases/);
  assert.match(fulfillmentPage, /FeedbackPreview/);
  assert.match(homepage, /前往 WhatsApp 获取报价/);
  assert.match(legalDocument, /隐私政策/);
  assert.match(legalDocument, /Política de Privacidad/);
  assert.match(legalDocument, /Politique de confidentialité/);
  assert.match(legalDocument, /网站使用条款/);
  assert.match(legalDocument, /合规声明/);
  assert.doesNotMatch(
    homepage,
    /先看证据|每一批次|不提供在线直接下单|每一份询盘均需审核|供应链现场/,
  );
});

test("configures a durable daily incremental ledger", async () => {
  const [hosting, route, generator, schema, database] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/fulfillment-cases/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/fulfillment-cases/generator.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
  ]);

  assert.equal(JSON.parse(hosting).d1, "DB");
  assert.match(generator, /DISPLAY_LIMIT = 300/);
  assert.match(generator, /MAX_GENERATED_RETENTION = 500/);
  assert.match(generator, /UPDATE_INTERVAL_DAYS = 1/);
  assert.match(generator, /LEDGER_VERSION = "daily-v4-10-30-orders"/);
  assert.match(generator, /createBackfillRows/);
  assert.match(generator, /createDailyRows/);
  assert.match(generator, /currentFulfillmentStatus/);
  assert.match(generator, /documentation: 0/);
  assert.match(generator, /production: 0/);
  assert.match(generator, /documentation_review/);
  assert.match(generator, /quality_control/);
  assert.match(generator, /packaging/);
  assert.match(generator, /Mexico/);
  assert.doesNotMatch(route, /clearPreviousHistoryOnce/);
  assert.match(route, /LAST_GENERATED_KEY/);
  assert.match(route, /pruneIllustrativeRows/);
  assert.match(route, /ORDER BY occurred_at DESC, id DESC/);
  assert.match(route, /manualFulfillmentOrders/);
  assert.match(route, /mergeFulfillmentRecords/);
  assert.match(generator, /right\.occurredAt\.localeCompare\(left\.occurredAt\)/);
  assert.match(route, /dataMode: "mixed_workflow"/);
  assert.match(route, /ON CONFLICT\(reference\) DO NOTHING/);
  assert.match(route, /rows\.slice\(index, index \+ 50\)/);
  assert.doesNotMatch(route, /\.update\(fulfillmentCases\)/);
  assert.match(route, /itemsJson/);
  assert.match(route, /retailUnitPriceUsdCents/);
  assert.match(route, /discountBps/);
  assert.match(route, /row\.service === "catalogue" \? 0/);
  assert.match(route, /cataloguePricing\?\.amountUsdCents/);
  assert.doesNotMatch(route, /setUTCMonth\(cutoff\.getUTCMonth\(\) - 3\)/);
  assert.doesNotMatch(route, /eq\(fulfillmentCases\.cycleKey/);
  assert.match(schema, /fulfillment_ledger_meta/);
  assert.match(schema, /product_name/);
  assert.match(schema, /quantity_units/);
  assert.match(schema, /unit_price_usd_cents/);
  assert.match(schema, /packaging_fee_usd_cents/);
  assert.match(schema, /testing_fee_usd_cents/);
  assert.match(schema, /logistics_fee_usd_cents/);
  assert.match(schema, /items_json/);
  assert.match(schema, /order_kind/);
  assert.match(schema, /repeat_of_reference/);
  assert.match(schema, /fulfillment_generator_settings/);
  assert.match(schema, /manual_fulfillment_orders/);
  assert.match(schema, /manual_fulfillment_order_items/);
  assert.match(schema, /is_published/);
  assert.match(schema, /retail_unit_price_usd_cents/);
  assert.match(schema, /discount_bps/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS fulfillment_ledger_meta/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS manual_fulfillment_orders/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS manual_fulfillment_order_items/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS fulfillment_generator_settings/);
});

test("renders the dedicated fulfillment page", async () => {
  const response = await render("/fulfillment");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Recent workflow activity/i);
  assert.match(html, /Loading recent records/i);
  assert.match(html, /Back to website/i);
  assert.match(html, /wa\.me\/19863059927/i);
});

test("renders the deeper unified fulfillment administration entry", async () => {
  const response = await render("/admin/orders");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /正在打开管理中心/);
  assert.match(html, /正在验证此标签页的安全会话/);
  assert.match(html, /name="robots" content="noindex, nofollow, nocache"/i);

  const [adminPage, adminRoute, auth, catalogue, pricing] = await Promise.all([
    readFile(
      new URL("../app/admin/orders/AdminOrdersPage.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/api/admin/orders/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/product-catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/order-pricing.ts", import.meta.url), "utf8"),
  ]);
  assert.match(adminPage, /\/api\/admin\/orders/);
  assert.match(adminPage, /PRODUCT_CATALOG/);
  assert.match(adminPage, /自动计算总额/);
  assert.match(adminPage, /其他费用不计入订单展示/);
  assert.match(adminPage, /添加另一个产品/);
  assert.doesNotMatch(adminPage, /运费（USD/);
  assert.doesNotMatch(adminPage, /贴牌\/包装\/检测费/);
  assert.doesNotMatch(adminPage, /serviceFeeUsd/);
  assert.match(adminPage, /AdminHeader/);
  assert.match(adminPage, /window\.confirm/);
  assert.match(adminPage, /删除订单/);
  assert.match(adminPage, /bulk_visibility/);
  assert.match(adminPage, /批量更新阶段/);
  assert.match(adminPage, /downloadAdminCsv/);
  assert.match(adminRoute, /manual_fulfillment_orders/);
  assert.doesNotMatch(adminRoute, /fulfillmentCases/);
  assert.match(adminRoute, /findCatalogVariant/);
  assert.match(adminRoute, /calculateMultiItemOrderPricing/);
  assert.match(adminRoute, /manual_fulfillment_order_items/);
  assert.match(adminRoute, /export async function DELETE/);
  assert.match(adminRoute, /DELETE FROM manual_fulfillment_orders WHERE id = \?/);
  assert.match(adminRoute, /ORDER BY occurred_at DESC, created_at DESC, id DESC/);
  assert.match(adminRoute, /bulk_status/);
  assert.match(adminRoute, /WHERE id IN/);
  assert.match(auth, /FULFILLMENT_ADMIN_KEY/);
  assert.match(auth, /Bearer/);
  assert.equal((catalogue.match(/\{ sku:/g) ?? []).length, 96);
  assert.match(pricing, /VOLUME_DISCOUNT_TIERS/);
  assert.match(pricing, /discountBps: 4000/);
});

test("does not expose a top-level admin landing page", async () => {
  const response = await render("/admin");
  assert.equal(response.status, 404);
});

for (const [pathname, expected] of [
  ["/feedback", /A clearer view of the buying experience/i],
  ["/customer/access", /Your order feedback, in one light account/i],
  ["/admin/workspace", /正在打开管理中心/],
  ["/admin/feedback", /正在打开管理中心/],
  ["/admin/customers", /正在打开管理中心/],
  ["/admin/media", /正在打开管理中心/],
]) {
  test(`renders the new ${pathname} surface`, async () => {
    const response = await render(pathname);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, expected);
  });
}

test("renders the expanded illustrative-order workspace", async () => {
  const response = await render("/admin/generator");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /正在打开管理中心/);
  assert.match(html, /正在验证此标签页的安全会话/);

  const [page, route] = await Promise.all([
    readFile(
      new URL("../app/admin/generator/AdminGeneratorPage.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/admin/generator/route.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(page, /贴牌 \+ 大货目标占比/);
  assert.match(page, /复购订单目标占比/);
  assert.match(page, /多产品组装目标占比/);
  assert.match(page, /目标市场权重/);
  assert.match(page, /大宗订单最短间隔/);
  assert.match(page, /同步今日记录并刷新统计/);
  assert.match(page, /AdminHeader/);
  assert.match(page, /admin-settings-disclosure/);
  assert.match(page, /一键业务方案/);
  assert.match(page, /暂停每日生成/);
  assert.match(page, /B2B 拓展/);
  assert.match(page, /历史订单保护/);
  assert.match(page, /旧订单保持不变/);
  assert.match(page, /\/api\/admin\/generator/);
  assert.match(route, /fulfillment_generator_settings/);
  assert.match(route, /mode: "append_only"/);
  assert.match(route, /multi_product_rate_bps/);
  assert.match(route, /market_us_weight/);
  assert.doesNotMatch(route, /manual_fulfillment_orders/);

  const settingsPatch = route.slice(route.indexOf("export async function PATCH"));
  assert.match(settingsPatch, /UPDATE fulfillment_generator_settings SET/);
  assert.doesNotMatch(settingsPatch, /UPDATE\s+fulfillment_cases/i);
  assert.doesNotMatch(settingsPatch, /DELETE\s+FROM\s+fulfillment_cases/i);
});

test("uses one detailed admin hub with shared navigation and focused management tools", async () => {
  const [chrome, workspace, dashboard, customers, feedback, media] = await Promise.all([
    readFile(new URL("../app/admin/_components/AdminChrome.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/workspace/AdminWorkspacePage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/dashboard/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/customers/AdminCustomersPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/feedback/AdminFeedbackPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/media/AdminMediaPage.tsx", import.meta.url), "utf8"),
  ]);

  for (const href of ["/admin/workspace", "/admin/orders", "/admin/generator", "/admin/feedback", "/admin/customers", "/admin/media"]) {
    assert.match(chrome, new RegExp(href.replaceAll("/", "\\/")));
  }
  assert.match(workspace, /常用操作/);
  assert.match(workspace, /当前待办/);
  assert.match(workspace, /全部功能/);
  assert.match(workspace, /真实订单管线/);
  assert.match(workspace, /市场分布/);
  assert.match(workspace, /近期动态/);
  assert.match(dashboard, /real_order_value_usd_cents/);
  assert.match(dashboard, /UNION ALL/);
  assert.match(customers, /搜索客户/);
  assert.match(customers, /导出当前结果/);
  assert.match(feedback, /admin-settings-disclosure/);
  assert.match(feedback, /搜索反馈/);
  assert.match(media, /R2 容量保护/);
  assert.match(media, /admin-inline-disclosure/);
  assert.match(media, /搜索素材/);
});

test("keeps one server-validated admin session across module navigation", async () => {
  const [layout, session, chrome, orders, generator] = await Promise.all([
    readFile(new URL("../app/admin/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/_components/useAdminSession.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/_components/AdminChrome.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/orders/AdminOrdersPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/generator/AdminGeneratorPage.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /AdminSessionProvider/);
  assert.match(session, /sessionStorage\.getItem\(ADMIN_SESSION_KEY\)/);
  assert.match(session, /performRequest\("\/api\/admin\/dashboard"/);
  assert.match(session, /response\.status === 401/);
  assert.match(session, /sessionStorage\.removeItem\(ADMIN_SESSION_KEY\)/);
  assert.match(chrome, /正在验证此标签页的安全会话/);
  assert.match(orders, /useAdminSession/);
  assert.match(generator, /useAdminSession/);
  assert.doesNotMatch(orders, /const SESSION_KEY/);
  assert.doesNotMatch(generator, /const SESSION_KEY/);
});

test("renders the dedicated multilingual analytical report library", async () => {
  const response = await render("/coa");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Reports, organised/i);
  assert.match(html, /Choose a product/i);
  assert.match(html, /All reports/i);
  assert.match(html, /Retatrutide/i);
  assert.match(html, /BPC-157/i);
  assert.match(html, /101.*reports displayed/is);
  assert.match(html, /wa\.me\/19863059927/i);

  const source = await readFile(
    new URL("../app/coa/CoaLibraryPage.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /检测报告按/);
  assert.match(source, /Biblioteca de relatórios analíticos/);
  assert.match(source, /Biblioteca de informes analíticos/);
  assert.match(source, /Bibliothèque de rapports analytiques/);
  assert.match(source, /View full report/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /setSelectedProduct\(\(current\) => current === product \? null : product\)/);
});

test("every published analytical report preview exists", async () => {
  const source = await readFile(
    new URL("../app/coa/coa-documents.generated.ts", import.meta.url),
    "utf8",
  );
  const previewHrefs = [
    ...source.matchAll(/"previewHref": "([^"]+)"/g),
  ].map((match) => match[1]);

  assert.equal(previewHrefs.length, 101);
  assert.equal(new Set(previewHrefs).size, previewHrefs.length);

  for (const href of previewHrefs) {
    await access(new URL(`../public${href}`, import.meta.url));
  }
});

for (const pathname of ["/privacy", "/terms", "/compliance"]) {
  test(`renders ${pathname}`, async () => {
    const response = await render(pathname);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Peptivanta/i);
  });
}
