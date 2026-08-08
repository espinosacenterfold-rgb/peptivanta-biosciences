import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createIllustrativeFeedback,
  feedbackRiskFlags,
} from "../lib/feedback.ts";
import {
  feedbackGenerationDue,
  normalizeCollectionKeywords,
  xiaohongshuSearchUrl,
} from "../lib/community-rules.ts";

test("illustrative feedback is stable, multilingual, and service-only", () => {
  const context = {
    destination: "United States",
    service: "catalogue",
    orderKind: "repeat",
    productName: "BPC 157",
    itemCount: 2,
  };
  const first = createIllustrativeFeedback("PV-EXAMPLE-001", context);
  const second = createIllustrativeFeedback("PV-EXAMPLE-001", context);

  assert.deepEqual(first, second);
  assert.deepEqual(Object.keys(first).sort(), ["en", "es", "fr", "pt", "zh"]);
  for (const text of Object.values(first)) {
    assert.ok(text.length >= 30);
    assert.deepEqual(feedbackRiskFlags(text), []);
  }
});

test("feedback moderation detects medical and unsupported purity claims", () => {
  assert.deepEqual(feedbackRiskFlags("The communication and document handover were clear."), []);
  assert.ok(feedbackRiskFlags("This cured a disease after injection.").includes("medical_or_effect_claim"));
  assert.ok(feedbackRiskFlags("Guaranteed purity is 100%.").includes("unsupported_purity_claim"));
  assert.ok(feedbackRiskFlags("治疗效果很好，建议注射。 ").includes("medical_or_effect_claim"));
});

test("illustrative feedback uses a stable three-day cadence", () => {
  assert.equal(feedbackGenerationDue(null, "2026-08-09", 3), true);
  assert.equal(feedbackGenerationDue("2026-08-07", "2026-08-09", 3), false);
  assert.equal(feedbackGenerationDue("2026-08-06", "2026-08-09", 3), true);
  assert.equal(feedbackGenerationDue("invalid", "2026-08-09", 3), true);
});

test("Xiaohongshu collection creates research links without copying posts", () => {
  assert.deepEqual(normalizeCollectionKeywords("多肽包装，实验室包装\n多肽包装"), [
    "多肽包装",
    "实验室包装",
  ]);
  const url = new URL(xiaohongshuSearchUrl("外贸 发货"));
  assert.equal(url.hostname, "www.xiaohongshu.com");
  assert.equal(url.searchParams.get("keyword"), "外贸 发货");
});

test("customer access and feedback workspace expose all five site languages", async () => {
  const [access, portal] = await Promise.all([
    readFile(new URL("../app/customer/access/CustomerAccessPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/customer/feedback/CustomerFeedbackPage.tsx", import.meta.url), "utf8"),
  ]);
  for (const source of [access, portal]) {
    assert.match(source, /LANGUAGE_OPTIONS/);
    assert.match(source, /LOCALE_STORAGE_KEY/);
    assert.match(source, /customer-language-switcher/);
  }
  assert.match(access, /Your order feedback/);
  assert.match(access, /用一个轻量账号管理订单反馈/);
  assert.match(portal, /Vincule pedidos entregues/);
});

test("community storage keeps secrets one-way and public feedback labelled", async () => {
  const [schema, auth, ledger, card, customerRoute, adminFeedback, migration] =
    await Promise.all([
      readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/customer-auth.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/feedback-ledger.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/feedback/FeedbackCard.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/api/customer/feedback/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/admin/feedback/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../drizzle/0008_yellow_overlord.sql", import.meta.url), "utf8"),
    ]);

  assert.match(schema, /password_hash/);
  assert.match(schema, /recovery_hash/);
  assert.doesNotMatch(schema, /password_plain|recovery_plain|session_token\b/);
  assert.match(auth, /HMAC/);
  assert.match(auth, /__Host-pv_customer_session/);
  assert.match(auth, /identity:/);
  assert.match(auth, /value\.length >= 10 && value\.length <= 72/);
  assert.match(auth, /\[a-zA-Z0-9\]/);
  assert.match(ledger, /RETENTION_DAYS = 180/);
  assert.match(ledger, /daily_maximum/);
  assert.match(card, /示例服务反馈/);
  assert.match(card, /客户提交 · 已审核/);
  assert.match(customerRoute, /pending_review/);
  assert.match(customerRoute, /order\.status !== "delivered"/);
  assert.match(adminFeedback, /feedbackRiskFlags\(publicText\)/);
  assert.match(migration, /ON DELETE set null/i);
  assert.match(migration, /feedback_entries_sample_case_idx/);
});

test("media library uses R2, delayed availability, and safe helper links", async () => {
  const [hosting, wrangler, mediaRoute, mediaPage, worker, storage, collection, schema, migration, collectionMigration] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/media/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/media/AdminMediaPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/media-storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/media-collection.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0009_tiresome_the_initiative.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0010_outstanding_tyrannus.sql", import.meta.url), "utf8"),
  ]);

  assert.equal(JSON.parse(hosting).r2, "MEDIA");
  assert.match(wrangler, /peptivanta-feedback-media/);
  assert.match(wrangler, /17 3 \* \* \*/);
  assert.match(mediaRoute, /https:\/\/www\.tiktok\.com\/oembed/);
  assert.match(mediaRoute, /https:\/\/tiksave\.io\/zh-cn/);
  assert.match(mediaRoute, /https:\/\/dy\.kukutool\.com\/xiaohongshu/);
  assert.match(mediaRoute, /owned_or_authorized/);
  assert.match(mediaRoute, /scheduledDate/);
  assert.match(mediaPage, /image\/webp/);
  assert.match(mediaPage, /0\.82/);
  assert.match(mediaPage, /10GB 免费额度保护/);
  assert.match(mediaPage, /保存容量预设/);
  assert.match(storage, /R2_FREE_STORAGE_BYTES = 10_000_000_000/);
  assert.match(storage, /DEFAULT_MEDIA_CLEANUP_TARGET_BYTES = 9_500_000_000/);
  assert.match(storage, /protect_customer_media/);
  assert.match(storage, /capacity_threshold/);
  assert.match(mediaRoute, /status = 'uploading'/);
  assert.match(mediaRoute, /hard_limit_bytes/);
  assert.match(mediaRoute, /let r2Removed = false/);
  assert.match(mediaRoute, /if \(r2Removed\)/);
  assert.match(schema, /mediaStorageSettings/);
  assert.match(schema, /mediaCleanupEvents/);
  assert.match(migration, /10000000000/);
  assert.match(migration, /9500000000/);
  assert.match(worker, /cleanupExpiredMedia/);
  assert.match(worker, /cleanupExpiredCustomerAuth/);
  assert.match(worker, /maintainMediaCollectionTasks/);
  assert.match(collection, /does not fetch, parse, download, or republish/i);
  assert.match(collectionMigration, /media_collection_tasks/);
  assert.match(collectionMigration, /generation_interval_days/);
});
