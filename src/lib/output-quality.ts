/**
 * فاحص جودة حتمي لمخرجات الموظفين غير المنشورات (مقال، بريد، تقرير، مقترح، موجز تصميم).
 *
 * المنشورات لها مقياسها الخاص (post-quality.ts). هذا الملف يغطي بقية المخرجات
 * بنفس المنطق: قواعد قابلة للقياس لا آراء — بقايا فراغات، بتر، حشو، جداول ناقصة،
 * مهام بلا مسؤول أو تاريخ، أرقام بلا مصدر، وطول لا يناسب نوع المخرج.
 *
 * مخرجه قائمة «إصلاحات إلزامية» تُمرَّر لحَكَم الجودة فيعيد الكتابة على أساسها،
 * فلا يعتمد الحكم على تقدير النموذج وحده.
 */

export type OutputIssue = { id: string; hint: string };

export type OutputAudit = {
  /** خصم من ١٠٠ بحسب خطورة ما وُجد (٠ = لا ملاحظات). */
  penalty: number;
  issues: OutputIssue[];
};

/** بقايا فراغات القوالب التي يجب ألّا تصل للمالك أبداً. */
const PLACEHOLDER = [
  /\{\{[^}]{1,60}\}\}/,
  /\[(?:اسم|رابط|السعر|التاريخ|المدينة|المنتج|العلامة|الشركة)[^\]]{0,40}\]/,
  /\b(?:XXX|TBD|TODO|Lorem ipsum)\b/i,
  /«?(?:اسم المنصة|اسم العميل|اسم المنتج)»?/,
];

/** عبارات تدل على أن المخرج توقف في منتصفه بدل إكماله. */
const TRUNCATION = [
  /وهكذا\s*$/m,
  /باقي (?:الأيام|الأسابيع|البنود) (?:مشابهة|مثلها|بنفس)/,
  /\(?يُكمل لاحقاً\)?/,
  /^\s*\.{3,}\s*$/m,
];

/** حشو لغوي بلا معلومة — يُستبدل بمحتوى أو يُحذف. */
const FILLER = [
  "في عالم اليوم",
  "لا يخفى على أحد",
  "مما لا شك فيه",
  "في ظل التطور",
  "كما نعلم جميعاً",
  "الجدير بالذكر",
  "بلا شك",
  "في نهاية المطاف",
];

/** ادعاءات مطلقة تحتاج دليلاً أو تخفيفاً. */
const OVERCLAIM = [
  "الأفضل في العالم",
  "نتيجة مضمونة",
  "مضمون 100",
  "بلا أي مخاطر",
  "الأول عالمياً",
  "لا مثيل له",
];

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** هل يوجد تاريخ أو مدة محددة في النص (يوم/شهر/تاريخ رقمي/بعد N أيام)؟ */
function hasDate(text: string): boolean {
  return (
    /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/.test(text) ||
    /(?:الأحد|الاثنين|الإثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت)/.test(text) ||
    /(?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)/.test(text) ||
    /خلال\s*\d+\s*(?:يوم|أيام|أسبوع|أسابيع)/.test(text) ||
    /(?:اليوم|غداً|بعد غد)\b/.test(text)
  );
}

/** جداول Markdown ناقصة: صف بعدد أعمدة مختلف عن رأس الجدول. */
function brokenTable(text: string): boolean {
  const lines = text.split("\n");
  let headerCols = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      headerCols = 0;
      continue;
    }
    // عدّ الأعمدة بحدود الأنابيب لا بالخلايا غير الفارغة، حتى لا تُحسب الخلية الفارغة نقصاً.
    const cells = trimmed.replace(/^\|/, "").replace(/\|$/, "").split("|");
    const cols = cells.length;
    if (/^\|[\s:|-]+\|?$/.test(trimmed)) continue;
    if (!headerCols) headerCols = cols;
    else if (cols !== headerCols) return true;

  }
  return false;
}

/** نوع المخرج المستنتج من الطلب ونص المخرج نفسه. */
export type OutputKind =
  | "email"
  | "article"
  | "report"
  | "proposal"
  | "plan"
  | "social"
  | "design"
  | "generic";

export function detectKind(request: string, text: string, employeeId: string): OutputKind {
  const all = `${request}\n${text}`.toLowerCase();
  const ar = `${request}\n${text}`;
  const isEmail = /\b(email|subject)\b/.test(all) || /(?:رسالة|بريد|رد على|الموضوع:)/.test(ar);
  // منشورات السوشيال ومخرجات التصميم لها معايير قابلة للقياس مثل بقية الأنواع.
  if (/(?:منشور|تغريدة|كابشن|ستوري|ريلز|كاروسيل|هاشتاق)/.test(ar) && !isEmail) return "social";
  if (/(?:وصف صورة|بروميت|تصميم|نص بديل|ألوان العلامة|مقاس)/.test(ar) || employeeId === "dana")
    return "design";
  if (isEmail) return "email";
  if (/(?:مقال|تدوينة|محتوى الصفحة|meta description|وصف ميتا)/i.test(ar) || employeeId === "nour")
    return "article";
  if (/(?:تقرير|تحليل الأداء|لوحة مؤشرات|قراءة الأرقام)/.test(ar) || employeeId === "adam")
    return "report";
  if (/(?:مقترح|عرض سعر|proposal|تسعير)/i.test(ar)) return "proposal";
  if (/(?:خطة|جدول محتوى|رزنامة|roadmap)/i.test(ar)) return "plan";
  if (employeeId === "sonny") return "social";
  return "generic";
}


/**
 * تطبيع عربي للمقارنة فقط (لا يُعرض للمستخدم): يوحّد الهمزات والألف المقصورة
 * والتاء المربوطة، ويحذف التشكيل والتطويل والمسافات الزائدة.
 */
export function normalizeArabic(value: string): string {
  return value
    .replace(/[\u064B-\u0652\u0670]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * يفحص مخرجاً نصياً ويعيد ملاحظات إصلاح محددة. لا يستدعي أي نموذج — حتمي وسريع.
 */
export function auditOutput(input: {
  text: string;
  employeeId: string;
  request?: string;
  bannedWords?: string[];
  kind?: OutputKind;
}): OutputAudit {
  const text = (input.text ?? "").trim();
  const issues: OutputIssue[] = [];
  let penalty = 0;
  if (!text) return { penalty: 0, issues };

  const kind = input.kind ?? detectKind(input.request ?? "", text, input.employeeId);
  const add = (id: string, hint: string, cost: number) => {
    if (issues.some((i) => i.id === id)) return;
    issues.push({ id, hint });
    penalty += cost;
  };

  // نص مطبَّع للمقارنات اللغوية: توحيد الهمزات والألف المقصورة والتاء المربوطة،
  // وحذف التشكيل والتطويل — كي لا تمرّ كلمة ممنوعة بتغيير همزة واحدة.
  const norm = normalizeArabic(text);

  // فحص الفراغات والكلمات الممنوعة يسري على أي نص مهما قصر: تغريدة من ٣٠ حرفاً
  // فيها «[اسم المدينة]» كانت تمرّ بلا ملاحظة.
  if (PLACEHOLDER.some((re) => re.test(text)))
    add(
      "placeholder",
      "احذف كل فراغ قالب ([اسم…]، {{…}}، XXX) واستبدله بمعلومة حقيقية من سياق المالك أو بصياغة طبيعية بلا فراغ.",
      18,
    );

  const bannedShort = (input.bannedWords ?? []).filter(
    (w) => w.trim() && norm.includes(normalizeArabic(w.trim())),
  );
  if (bannedShort.length)
    add(
      "banned",
      `احذف الكلمات الممنوعة في صوت العلامة: ${bannedShort.slice(0, 3).join("، ")}.`,
      20,
    );

  // بقية الفحوص تحتاج نصاً له جسد فعلي.
  if (text.length < 40) return { penalty, issues };

  if (TRUNCATION.some((re) => re.test(text)))
    add(
      "truncated",
      "أكمل المخرج حتى آخر بند مطلوب واحذف عبارات مثل «وهكذا» أو «باقي الأيام مشابهة».",
      16,
    );

  if (brokenTable(text))
    add("table", "أكمل صفوف الجدول بحيث يتساوى عدد الأعمدة في كل صف مع رأس الجدول.", 10);

  const filler = FILLER.filter((f) => norm.includes(normalizeArabic(f)));
  if (filler.length)
    add("filler", `احذف الحشو بلا معلومة: ${filler.slice(0, 3).join("، ")}، وضع محتوى محدداً مكانه.`, 8);

  const over = OVERCLAIM.filter((f) => norm.includes(normalizeArabic(f)));
  if (over.length)
    add("overclaim", `احذف الادعاء المطلق (${over[0]}) أو اربطه بدليل محدد.`, 12);

  // تكرار فقرة كاملة — علامة على لصق مزدوج.
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 80);
  if (new Set(paras).size < paras.length)
    add("duplicate", "احذف الفقرة المكرّرة وأبقِ ظهورها الأول فقط.", 10);

  if (kind === "email") {
    if (words(text) > 200)
      add("email-length", "اختصر الرسالة إلى أقل من ١٢٠ كلمة مع إبقاء الطلب الواحد واضحاً.", 10);
    if (!/(?:الموضوع|Subject)\s*[:：]/i.test(text))
      add("email-subject", "أضف سطر «الموضوع:» من ٣–٥ كلمات بلا كلمات دعائية.", 8);
    if (!/[؟?]|(?:أرجو|هل يناسبك|يمكنك|نلتقي|أرسل|أكّد)/.test(text))
      add("email-cta", "أنهِ الرسالة بطلب واحد سهل وواضح (سؤال نعم/لا أو موعد محدد).", 10);
  }

  if (kind === "article") {
    const heads = (text.match(/^#{2,3}\s+\S/gm) ?? []).length;
    if (words(text) > 300 && heads < 3)
      add("article-structure", "قسّم المقال بعناوين فرعية (H2/H3) كل ١٥٠–٢٥٠ كلمة.", 10);
    const meta = text.match(/(?:وصف ميتا|meta description)\s*[:：]\s*(.+)/i)?.[1]?.trim();
    if (meta && (meta.length < 110 || meta.length > 160))
      add("article-meta", `اضبط وصف الميتا بين ١٢٠ و١٥٥ حرفاً (الحالي ${meta.length}).`, 8);
    const title = text.match(/(?:عنوان ميتا|meta title|عنوان الصفحة)\s*[:：]\s*(.+)/i)?.[1]?.trim();
    if (title && title.length > 62)
      add("article-title", `اختصر عنوان الميتا إلى ٦٠ حرفاً أو أقل (الحالي ${title.length}).`, 8);
  }

  if (kind === "report") {
    if (!/\d/.test(text))
      add("report-numbers", "أضف الأرقام الفعلية التي يستند إليها التحليل بدل الوصف العام.", 14);
    if (!/(?:المصدر|حسب بيانات|من حساب|وفق)/.test(text))
      add("report-source", "اذكر مصدر كل رقم (حساب مربوط، تقدير، بيانات المالك) في سطر واحد.", 10);
    if (!/(?:التوصية|الخطوة التالية|ما نفعله)/.test(text))
      add("report-action", "أنهِ التقرير بتوصيات قابلة للتنفيذ مرتّبة بالأولوية.", 12);
  }

  if (kind === "proposal") {
    if (!/(?:السعر|التكلفة|الاستثمار|ر\.س|ج\.م|د\.إ|\$)/.test(text))
      add("proposal-price", "أضف قسم السعر بثلاثة خيارات أو سطراً يوضّح أن التسعير بانتظار معطيات المالك.", 12);
    if (!/(?:خارج النطاق|لا يشمل)/.test(text))
      add("proposal-scope", "أضف «خارج النطاق» حتى لا يتوسع العمل بلا مقابل.", 8);
    if (!hasDate(text))
      add("proposal-date", "أضف خطاً زمنياً وتاريخ صلاحية للعرض.", 10);
  }

  if (kind === "plan") {
    if (!hasDate(text)) add("plan-date", "اربط كل بند بيوم أو تاريخ محدد.", 12);
    if (!/(?:المسؤول|مسؤول|ينفّذه|صاحب المهمة)/.test(text) && /(?:مهام|مهمة)/.test(text))
      add("plan-owner", "حدّد مسؤولاً لكل مهمة ومعيار إنجاز واضحاً.", 10);
  }

  if (kind === "social") {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const hook = lines[0] ?? "";
    if (hook.length > 95)
      add("social-hook", "اجعل السطر الأول خطافاً قصيراً (أقل من ٩٠ حرفاً) يوقف التمرير فوراً.", 12);
    const tags = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
    if (tags.length > 12)
      add("social-hashtags", `قلّل الهاشتاقات إلى ٥–٩ موزّعة بين واسع ومتخصص (الحالي ${tags.length}).`, 8);
    if (!/[؟?]|(?:احجز|اطلب|جرّب|سجّل|تواصل|اكتب|شارك|احفظ|زور|اشترِ)/.test(text))
      add("social-cta", "أضف دعوة فعل واحدة واضحة في آخر المنشور (فعل أمر أو سؤال مباشر).", 12);
    const emojis = (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;
    if (emojis > 8)
      add("social-emoji", `قلّل الرموز التعبيرية (الحالي ${emojis}) إلى رمز واحد لكل فقرة كحد أقصى.`, 6);
    if (/!{2,}|[A-Z]{8,}/.test(text))
      add("social-shout", "احذف علامات التعجّب المتكررة والكتابة بحروف كبيرة — تقلل الثقة.", 6);
  }

  if (kind === "design") {
    if (!/(?:نص بديل|alt)\s*[:：]/i.test(text))
      add("design-alt", "أضف «نص بديل:» يصف الصورة لمن لا يراها في سطر واحد.", 12);
    if (!/(?:\d{3,4}\s*[x×]\s*\d{3,4}|مقاس|أبعاد)/i.test(text))
      add("design-size", "حدّد المقاس بالبكسل المناسب للمنصة (مثال: 1080×1350).", 10);
    if (!/(?:تباين|contrast|#[0-9a-fA-F]{6})/.test(text))
      add("design-contrast", "اذكر ألوان العلامة بكودها ونسبة تباين النص (٤٫٥:١ على الأقل).", 8);
    if (/(?:نص بديل|alt)\s*[:：]\s*(?:صورة (?:لـ|تُظهر|توضح)|صوره لـ)/i.test(text))
      add("design-alt-opener", "لا تبدأ النص البديل بـ«صورة لـ» — صف المشهد مباشرة واذكر أي نص مكتوب داخل الصورة.", 6);
    const size = text.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/);
    if (size && /ستوري|ريلز|reels|story|تيك ?توك|tiktok/i.test(text) && !/(?:منطقة آمنة|المناطق الآمنة|safe zone|١٥٪|15%)/i.test(text))
      add("design-safezone", "حدّد المنطقة الآمنة: لا نص ولا شعار في أول ١٥٪ وآخر ١٥٪ من إطار الستوري/الريلز.", 8);
    if (/#[0-9a-fA-F]{6}/.test(text) && !/\d(?:[.,٫]\d)?\s*:\s*1|٤٫?٥\s*:\s*١|4\.5\s*:\s*1/.test(text))
      add("design-contrast-ratio", "اذكر نسبة التباين المحسوبة رقمياً (٤٫٥:١ لنص الجسم و٣:١ للنص الكبير).", 8);
  }

  if (input.employeeId === "adam") {
    if (/ROAS|عائد (?:الإنفاق|إعلاني)|العائد على الإنفاق/i.test(text) && !/(?:معلن من المنصة|إضافي|incremental|منسوب)/i.test(text))
      add("adam-roas-label", "وسم كل رقم عائد: «معلن من المنصة» أو «أثر إضافي حقيقي» — المعلن يتضخم عادة ٣٠–٧٠٪.", 12);
    if (/(?:اختبار|تجربة|A\/?B|نسخة فائزة|الفائز)/i.test(text) && !/(?:٩٥|95)\s*٪?%?|ثقة|دلالة إحصائية|حجم العينة|١٠٠ تحويل|100 تحويل/i.test(text))
      add("adam-test-rigor", "لا تُعلن فائزاً بلا شرطي الحسم: ١٠٠ تحويل لكل نسخة وأسبوع كامل وثقة ٩٥٪ — وإلا اكتب «غير محسوم».", 12);
  }

  if (input.employeeId === "sam") {
    const subject = text.match(/^\s*(?:الموضوع|عنوان الرسالة)\s*[:：]\s*(.+)$/m)?.[1]?.trim();
    if (subject && subject.length > 75)
      add("sam-subject", `اختصر سطر الموضوع إلى أقل من ٧٥ حرفاً (الحالي ${subject.length}).`, 10);
    if (/\b(?:مجان(?:اً|ي)|مضمون|تصرّف الآن|عرض ينتهي|اربح)\b/.test(subject ?? ""))
      add("sam-subject-spam", "احذف كلمات فلاتر السبام من سطر الموضوع («مجاناً»، «مضمون»، «تصرّف الآن»).", 8);
    if (/(?:تسلسل|سلسلة|كادنس|cadence|متابعات)/i.test(text)) {
      const touches = (text.match(/(?:لمسة|رسالة|اتصال|متابعة)\s*\d|^\s*(?:\d+)[).\-]\s/gm) ?? []).length;
      if (touches > 0 && touches < 5)
        add("sam-cadence", `لا يقل التسلسل عن ٥ لمسات قبل اعتبار العميل غير مهتم (الحالي ${touches}).`, 12);
    }
  }

  if (input.employeeId === "nour" && kind === "article") {
    if (!/(?:الكاتب|بقلم|كتبته|كتبه|author)\s*[:：]?/i.test(text))
      add("nour-author", "أضف اسم الكاتب وصفته وتاريخ المراجعة — بيانات الكاتب شرط للثقة وللظهور في مساعدات البحث.", 10);
    const internalLinks = (text.match(/\[[^\]]{2,80}\]\((?:\/|https?:\/\/)[^)]+\)/g) ?? []).length;
    if (internalLinks < 3)
      add("nour-internal-links", `أضف ٣–٥ روابط داخلية سياقية + رابط لصفحة الركيزة (الحالي ${internalLinks}).`, 10);
    if (/\d+\s*٪|\d+%/.test(text) && !/(?:المصدر|حسب|وفق|according)/i.test(text))
      add("nour-citations", "كل نسبة أو إحصائية تحتاج مصدراً مذكوراً بالاسم — الرقم بلا مصدر يُحذف.", 12);
  }

  // مهام بلا تاريخ في مخرجات التنفيذ اليومي (إيفا خصوصاً).
  if (input.employeeId === "eva" && /(?:مهام|المتابعات|خطوات)/.test(text) && !hasDate(text))
    add("eva-date", "أعطِ كل مهمة ومتابعة تاريخاً محدداً بدل «قريباً» أو «لاحقاً».", 10);

  return { penalty: Math.min(60, penalty), issues: issues.slice(0, 5) };
}
