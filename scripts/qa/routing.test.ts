/** اختبارات التوجيه بين الموظفين: من يملك الطلب، ومتى يُمنع التحويل. */
import { expect, test } from "bun:test";

import { detectHandoff, isDecisivelyMine } from "../../src/lib/handoff";
import { scopeBoundaryBlock } from "../../src/lib/scope-boundaries";
import { chatIntent } from "../../src/lib/chat-intent";
import { answerPolicyBlock } from "../../src/lib/answer-policy";

test("طلب تصميم صريح لدانة لا يُحوَّل رغم ذكر اسم منصة", () => {
  const request = "صممي ستوري إنستجرام لعرض القهوة الباردة";
  expect(isDecisivelyMine(request, "dana")).toBe(true);
  const block = scopeBoundaryBlock("dana", request);
  expect(block).toContain("ممنوع منعاً باتاً تحويلها");
});

test("طلب نشر على إنستجرام من دانة يُحوَّل إلى سِراج بالاسم", () => {
  const handoff = detectHandoff("انشري المنشور ده على إنستجرام دلوقتي", "dana");
  expect(handoff?.id).toBe("sonny");
  expect(handoff?.name.length).toBeGreaterThan(1);
});

test("الموظف لا يُحوَّل إلى نفسه", () => {
  const handoff = detectHandoff("اكتب منشور إنستجرام عن العرض", "sonny");
  expect(handoff).toBeNull();
});

test("كتلة الحدود تذكر اختصاص الموظف وزملاءه بالأسماء", () => {
  const block = scopeBoundaryBlock("nour");
  expect(block).toContain("حدود اختصاصك");
  expect(block).toContain("السيو");
  expect(block.split("\n").length).toBeGreaterThan(5);
});

test("موظف غير معروف لا يُنتج كتلة حدود", () => {
  expect(scopeBoundaryBlock("ghost")).toBe("");
});

test("سياسة الرد تتبع نية الرسالة", () => {
  expect(chatIntent("صباح الخير")).toBe("smalltalk");
  expect(answerPolicyBlock("sonny", "smalltalk").length).toBeGreaterThan(10);
  expect(answerPolicyBlock("sonny", "work")).not.toBe(answerPolicyBlock("sonny", "smalltalk"));
});
