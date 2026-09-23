/**
 * إحالة ذكية بين الموظفين: يحلّل طلب المستخدم (ورد الموظف) ويقرر إن كان الطلب
 * من اختصاص زميل آخر، فيعرض زر «التوجّه إلى …» مع نقل نص الطلب كما هو.
 */

import { employeeDirectory, type EmployeeId } from "@/lib/team-knowledge";

type Rule = { id: EmployeeId; words: string[]; topic: string };

/** كلمات دالة على اختصاص كل موظف — عربية ولاتينية. */
const RULES: Rule[] = [
  {
    id: "sonny",
    topic: "منشورات ونشر السوشيال ميديا",
    words: [
      "منشور",
      "منشورات",
      "بوست",
      "ريلز",
      "reel",
      "story",
      "ستوري",
      "كاروسيل",
      "هاشتاق",
      "هاشتاج",
      "انستجرام",
      "إنستغرام",
      "instagram",
      "تيك توك",
      "tiktok",
      "سناب",
      "تويتر",
      "تغريدة",
      "فيسبوك",
      "facebook",
      "جدولة منشور",
      "تقويم محتوى",
      "انشر",
      "أنشر",
      "ننشر",
      "النشر",
      "نشر",
      "publish",
      "كابشن",
      "caption",
      "محتوى سوشيال",
      "سوشيال ميديا",
      "social media",
      "لينكدإن",
      "linkedin",
    ],
  },
  {
    id: "nour",
    topic: "المقالات والسيو وصفحات الموقع",
    words: [
      "مقال",
      "مقالة",
      "سيو",
      "seo",
      "كلمات مفتاحية",
      "كلمة مفتاحية",
      "keyword",
      "ترتيب في جوجل",
      "search console",
      "ميتا ديسكربشن",
      "وصف ميتا",
      "backlink",
      "باك لينك",
      "صفحة هبوط",
      "landing page",
      "مدونة",
      "ووردبريس",
      "wordpress",
      "فهرسة",
      "نشر المقال",
      "نشر مقال",
      "نشر المقالة",
    ],
  },
  {
    id: "eva",
    topic: "البريد والمواعيد والتنظيم",
    words: [
      "بريد",
      "ايميل",
      "إيميل",
      "email",
      "gmail",
      "inbox",
      "موعد",
      "مواعيد",
      "اجتماع",
      "تقويم",
      "calendar",
      "محضر",
      "تذكير",
      "رتب يومي",
      "جدول يومي",
    ],
  },
  {
    id: "sam",
    topic: "المبيعات والعملاء والعروض",
    words: [
      "مبيعات",
      "عميل محتمل",
      "عملاء محتملين",
      "lead",
      "leads",
      "صفقة",
      "صفقات",
      "crm",
      "hubspot",
      "عرض سعر",
      "تسعير عرض",
      "متابعة عميل",
      "اعتراض",
      "pipeline",
      "خط الأنابيب",
    ],
  },
  {
    id: "dana",
    topic: "التصميم والهوية البصرية",
    words: [
      "تصميم",
      "هوية بصرية",
      "لوجو",
      "شعار",
      "لوحة ألوان",
      "خطوط",
      "canva",
      "كانفا",
      "figma",
      "فيجما",
      "موك اب",
      "غلاف",
      "بريف تصميم",
      "عرض تقديمي",
    ],
  },
  {
    id: "adam",
    topic: "الأرقام والتقارير والحملات",
    words: [
      "تحليل بيانات",
      "ga4",
      "analytics",
      "تقرير أداء",
      "تقرير الأداء",
      "أداء الحملة",
      "اداء الحملة",
      "الحملة الإعلانية",
      "حملة اعلانية",
      "إعلانات",
      "اعلانات",
      "ميزانية",
      "مؤشرات",
      "kpi",
      "conversion",
      "تحويلات",
      "ميزانية إعلان",
      "حملة إعلانية",
      "roas",
      "cpc",
      "إنفاق",
      "لوحة مؤشرات",
    ],
  },
];

export type Handoff = { id: EmployeeId; name: string; role: string; topic: string };

function score(text: string, rule: Rule): number {
  let n = 0;
  // الكلمات الدالة هنا كلها مصطلحات مجال، فكلمة واحدة واضحة تكفي للإحالة.
  for (const w of rule.words) if (text.includes(w)) n += w.length > 5 ? 3 : w.length >= 4 ? 2 : 1;
  return n;
}

/**
 * ملكية صريحة: طلبات يملكها الموظف الحالي رغم ورود كلمة تخص زميلاً.
 * مثال: رسالة متابعة لعميل عند سالم بريد، لكنها مبيعات لا تنظيم بريد.
 */
const OWNS: Partial<Record<string, RegExp>> = {
  // رسائل البيع والمتابعة والعروض من صميم عمل سالم حتى لو كانت بريداً.
  sam: /(عميل|عرض|العرض|سعر|تسعير|صفقة|متابعة|اعتراض|تفاوض|خصم|proposal|deal|lead)/i,
  // نور تكتب وتنشر المقال بنفسها حتى لو ورد «نشر».
  nour: /(مقال|مقالة|سيو|seo|مدونة|ووردبريس|wordpress|صفحة هبوط|landing)/i,
  // سِراج يكتب الكابشن والمنشور حتى لو ورد «مقال» أو «بريد».
  sonny: /(منشور|بوست|كابشن|caption|ريلز|ستوري|هاشتا)/i,
  // دانة تصمم حتى لو ورد اسم منصة.
  dana: /(تصميم|صمم|لوجو|شعار|بوستر|هوية|بانر|موك ?اب|design)/i,
  // آدم يحلل الأرقام حتى لو ورد «حملة» أو «مبيعات».
  adam: /(تقرير|حلل|تحليل|أرقام|ارقام|مؤشر|kpi|roas|cpc|أداء|اداء)/i,
  // إيفا ترتب البريد والمواعيد حتى لو ورد «عميل».
  eva: /(موعد|مواعيد|اجتماع|تقويم|calendar|صندوق الوارد|inbox|تذكير|محضر)/i,
};

/**
 * ملكية حاسمة: أفعال أمر صريحة موجَّهة للموظف الحالي تُلغي أي إحالة مهما بلغ فارق
 * الدرجات — لأن المستخدم حدّد الخدمة بنفسه لا المنصة.
 */
const DECISIVE: Partial<Record<string, RegExp>> = {
  dana: /(صمّ?م|صممي|تصميم|ديزاين|design|موك ?اب|هوية بصرية|بوستر|بانر|لوجو|شعار|كاروسيل|بريف بصري)/i,
  sonny: /(منشور|بوست|كابشن|caption|ريلز|هاشتا|انشر|جدول(ي)? منشور)/i,
  nour: /(اكتب(ي)? مقال|مقال|سيو|seo|ميتا|كلمات مفتاحية|مدونة)/i,
  sam: /(عرض سعر|تسعير|صفقة|متابعة عميل|اعتراض|تفاوض|crm)/i,
  adam: /(حلّ?ل|حللي|تقرير|أرقام|ارقام|roas|cpc|kpi|لوحة أداء)/i,
  eva: /(رتّ?ب|رتبي|أولويات|موعد|مواعيد|اجتماع|محضر|تقويم)/i,
};

/**
 * يعيد الزميل الأنسب إن كان الطلب واضح الانتماء لاختصاصه وليس اختصاص الموظف الحالي.
 * يعيد null إن كان الطلب ضمن اختصاص الموظف الحالي أو غامضاً.
 */
/** هل الطلب فعل أمر صريح من صميم عمل هذا الموظف؟ (يمنع التحويل ويُلزمه بالتنفيذ) */
export function isDecisivelyMine(request: string, currentId: string): boolean {
  const decisive = DECISIVE[currentId];
  return Boolean(decisive && decisive.test((request || "").toLowerCase()));
}

export function detectHandoff(request: string, currentId: string): Handoff | null {
  const text = (request || "").toLowerCase();
  if (text.trim().length < 4) return null;

  const scores = RULES.map((r) => ({ rule: r, s: score(text, r) })).sort((a, b) => b.s - a.s);
  const top = scores[0];
  if (!top || top.s < 2) return null;
  if (top.rule.id === currentId) return null;

  // إن كان الموظف الحالي قريباً في الدرجة، فالطلب يخصه — لا إحالة.
  const mine = scores.find((x) => x.rule.id === currentId);
  if (mine && mine.s >= top.s) return null;

  // ملكية صريحة تتقدّم على تطابق كلمة واحدة عند الزميل — لكنها مرجّح لا نقض مطلق:
  // إن كان الزميل متفوّقاً بفارق واضح (٣ نقاط فأكثر) فالطلب يخصّه فعلاً.
  const owns = OWNS[currentId];
  const gap = top.s - (mine?.s ?? 0);
  if (owns && owns.test(text) && gap < 3) return null;

  // ملكية حاسمة: فعل صريح من صميم عمل الموظف الحالي يُنهي الجدل مهما ورد اسم منصة
  // في الطلب — «صمّمي ستوري إنستجرام» تصميم لدانة، لا نشر لسِراج.
  const decisive = DECISIVE[currentId];
  if (decisive && decisive.test(text)) return null;

  const e = employeeDirectory[top.rule.id];
  if (!e) return null;
  return { id: top.rule.id, name: e.name, role: e.role, topic: top.rule.topic };
}
