import { expect, test } from "bun:test";
import { extractImagePrompt, stripImagePrompt } from "../../src/lib/image-gen.server";
import { scorePost } from "../../src/lib/post-quality";
import { extractPostText, sanitizePostBody } from "../../src/lib/post-format";
import { publishBlockers } from "../../src/lib/publish-guard";

const output =
  "# عنوان المنشور\n\nنص عربي جاهز للنشر يحمل وعداً واضحاً.\n\n**وصف الصورة:** A cinematic photo of an Arabic coffee shop, warm light, shallow depth of field.\n\nخاتمة عربية.";

test("authored image prompt is used then removed from the delivered text", () => {
  expect(extractImagePrompt(output)).toContain("cinematic photo");
  const cleaned = stripImagePrompt(output);
  expect(cleaned).not.toContain("cinematic photo");
  expect(cleaned).toContain("نص عربي جاهز للنشر");
  expect(cleaned).toContain("خاتمة عربية");
});

test("Arabic body content is never stripped as a prompt block", () => {
  const arabicOnly = "# عنوان\n\nفقرة عربية كاملة بلا أي برومبت.\n\n```\nمثال عربي داخل كتلة\n```";
  expect(stripImagePrompt(arabicOnly)).toContain("مثال عربي داخل كتلة");
});

test("autopilot hard blockers reject over-limit X posts before scheduling", () => {
  const report = scorePost({ text: "ن".repeat(600), provider: "x" });
  expect(report.blockers.length).toBeGreaterThan(0);
});

test("publishing strips platform strategy and measurement notes", () => {
  const dirty = `خبر موثّق وواضح للجمهور.\n\nمنشور مخصص لمنصة فيسبوك: شارك المنشور مع شخص يفضّل الخبر الموثّق على العنوان المثير (مؤشر القياس: متابعة عدد المشاركات بعد 48 ساعة).`;
  expect(sanitizePostBody(dirty)).toBe("خبر موثّق وواضح للجمهور.");
});

test("an explicit post section wins over longer employee commentary", () => {
  const response = `## نص المنشور\n\nعرض ٥٠٪ حتى منتصف الليل. اطلب الآن.\n\n## التوقيت والقياس\n\nهذا شرح طويل جداً موجّه لصاحب العمل عن توقيت النشر ومؤشرات القياس ولا يجب أن يدخل المنشور أبداً.`;
  expect(extractPostText(response)).toBe("عرض ٥٠٪ حتى منتصف الليل. اطلب الآن.");
});

test("Telegram uses its real message limit", () => {
  const report = scorePost({ text: "ن".repeat(4097), provider: "telegram", hasMedia: false });
  expect(report.blockers.some((check) => check.id === "limit")).toBe(true);
});

test("Telegram applies the smaller caption limit when media is attached", () => {
  const report = scorePost({ text: "ن".repeat(1025), provider: "telegram", hasMedia: true });
  expect(report.blockers.some((check) => check.id === "limit")).toBe(true);
});

test("owner-directed subject and KPI lines never reach the published post", () => {
  const dirty = [
    "الموضوع: وجبات السمك يوم الجمعة",
    "",
    "خصم ٢٠٪ على وجبات السمك الجمعة.",
    "",
    "مؤشر الأداء للقياس بعد 48 ساعة: عدد الرسائل التي تتضمن كلمة «سمك».",
  ].join("\n");
  const clean = sanitizePostBody(dirty);
  expect(clean).toBe("خصم ٢٠٪ على وجبات السمك الجمعة.");
  expect(clean).not.toContain("الموضوع");
  expect(clean).not.toContain("مؤشر الأداء");
});

test("extractPostText drops the trailing KPI note", () => {
  const reply = "اطلب طبق السمك الطازج اليوم.\n\nمؤشر الأداء: عدد الرسائل.";
  expect(extractPostText(reply)).toBe("اطلب طبق السمك الطازج اليوم.");
});

test("owner notes inside a post body are a hard publish blocker", () => {
  const report = scorePost({
    text: "الموضوع: عرض الجمعة\n\nخصم ٢٠٪ على كل الطلبات اليوم.",
    provider: "facebook",
    hasMedia: false,
  });
  expect(report.blockers.some((check) => check.id === "owner-notes")).toBe(true);
});

test("publish guard blocks guaranteed-result and medical claims", () => {
  expect(publishBlockers("نضمن لك نتيجة مضمونة خلال أسبوع.").length).toBeGreaterThan(0);
  expect(publishBlockers("هذا المنتج يشفي من الصداع نهائياً.").length).toBeGreaterThan(0);
  expect(publishBlockers("أرباح مضمونة من أول شهر.").length).toBeGreaterThan(0);
  expect(publishBlockers("جرّب طبق السمك الطازج عندنا اليوم في جدة.")).toEqual([]);
});

test("hashtags survive when an owner note sits above them", () => {
  const dirty = "خصم ٢٠٪ على وجبات السمك.\n\nمؤشر القياس بعد ٤٨ ساعة: عدد الرسائل.\n\n#سمك #عرض";
  const clean = sanitizePostBody(dirty);
  expect(clean).toContain("#سمك");
  expect(clean).not.toContain("مؤشر القياس");
});

test("a standalone label line above the post is removed", () => {
  expect(sanitizePostBody("إعلان\n\nخصم ٢٠٪ اليوم فقط.")).toBe("خصم ٢٠٪ اليوم فقط.");
});

test("an inline measurement parenthesis is stripped from the post", () => {
  const dirty = "أرسل كلمة «قهوة» في رسالة (يُقاس التفاعل بعد ٤٨ ساعة بعدد الرسائل).";
  expect(sanitizePostBody(dirty)).toBe("أرسل كلمة «قهوة» في رسالة.");
});
