import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createIllustrativeFeedback,
  feedbackRiskFlags,
} from "../lib/feedback.ts";

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
  const [hosting, wrangler, mediaRoute, mediaPage, worker] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/media/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/media/AdminMediaPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
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
  assert.match(worker, /cleanupExpiredMedia/);
  assert.match(worker, /cleanupExpiredCustomerAuth/);
});
