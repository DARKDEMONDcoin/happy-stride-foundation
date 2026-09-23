/** اختبارات حارس جودة المخرجات: الفراغات القالبية، البتر، البريد، المقال. */
import { expect, test } from "bun:test";

import { auditOutput, detectKind } from "../../src/lib/output-quality";

const long = (s: string) => `${s}\n\n${"نص عربي حقيقي يشرح التفاصيل بوضوح كافٍ للقارئ. ".repeat(4)}`;

test("يميّز نوع المخرج من الطلب والموظف", () => {
  expect(detectKind("اكتب منشور إنستجرام", "كابشن قصير", "sonny")).toBe("social");
  expect(detectKind("اكتب رسالة بريد للعميل", "الموضوع: متابعة", "eva")).toBe("email");
  expect(detectKind("اكتب مقال", "محتوى الصفحة", "nour")).toBe("article");
});

test("يرصد الفراغات القالبية والبتر", () => {
  const audit = auditOutput({
    text: long("مرحباً [اسم العميل]، إليك العرض.\n\nوهكذا باقي الأيام مشابهة."),
    employeeId: "sam",
    request: "اكتب عرضاً",
  });
  const ids = audit.issues.map((i) => i.id);
  expect(ids).toContain("placeholder");
  expect(audit.penalty).toBeGreaterThan(0);
});

test("يرصد الكلمات الممنوعة في صوت العلامة", () => {
  const audit = auditOutput({
    text: long("نقدّم خدمة رخيصة جداً لعملائنا."),
    employeeId: "sonny",
    bannedWords: ["رخيصة"],
  });
  expect(audit.issues.map((i) => i.id)).toContain("banned");
});

test("البريد بلا موضوع أو طلب واضح يُرصد", () => {
  const audit = auditOutput({
    text: long("مرحباً، أردت إخبارك بآخر التحديثات لدينا هذا الأسبوع."),
    employeeId: "eva",
    request: "اكتب رسالة بريد",
    kind: "email",
  });
  const ids = audit.issues.map((i) => i.id);
  expect(ids).toContain("email-subject");
});

test("المخرج النظيف لا يُعاقَب", () => {
  const audit = auditOutput({
    text: "الموضوع: موعد المراجعة\n\nأهلاً أحمد، جهّزنا تقرير الشهر ويحتاج نصف ساعة لمراجعته معك. هل يناسبك الثلاثاء الساعة ١١ صباحاً؟\n\nشكراً لك.",
    employeeId: "eva",
    request: "اكتب رسالة بريد قصيرة",
    kind: "email",
  });
  expect(audit.penalty).toBe(0);
});
