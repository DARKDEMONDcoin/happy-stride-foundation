/**
 * جسر اللغة — سبب مباشر في جودة البحث، وليس رفاهية.
 *
 * المصادر العالمية (OpenAlex، Crossref، arXiv، GitHub، Hacker News، Stack Exchange)
 * فهارسها إنجليزية. إرسال استعلام عربي إليها لا يعيد «لا شيء» — بل يعيد **أسوأ من
 * لا شيء**: أحدث الأوراق أو أشهر المستودعات بلا أي صلة بالموضوع، فيظن النموذج
 * أنها أدلة. لذلك نترجم مصطلحات المجال بمعجم ثابت (مجاني، بلا استدعاء خارجي،
 * بلا زمن انتظار)، وإن لم نجد مقابلاً إنجليزياً **نمتنع عن سؤال تلك المصادر**
 * أصلاً. الامتناع أصدق من دليل زائف.
 */

/** معجم مصطلحات التسويق والأعمال العربية ← الإنجليزية. */
const GLOSSARY: [RegExp, string][] = [
  // قنوات ومنصات
  [/سيو|محرك(ات)? البحث|تحسين محركات/, "seo search engine optimization"],
  [/إعلان(ات)?|اعلان(ات)?|حمل(ة|ات) اعلاني/, "advertising ads campaign"],
  [/بريد|إيميل|ايميل|نشرة بريدية/, "email marketing newsletter"],
  [/سوشيال|تواصل اجتماعي|وسائل التواصل/, "social media"],
  [/إنستجرام|انستجرام|انستغرام/, "instagram"],
  [/تيك ?توك/, "tiktok"],
  [/فيس ?بوك/, "facebook"],
  [/لينك(د)?إن|لينكدين/, "linkedin"],
  [/يوتيوب/, "youtube"],
  [/واتس ?اب/, "whatsapp"],
  [/متجر|تجارة إلكترونية|التجارة الالكترونية/, "ecommerce online store"],
  [/ووردبريس|وردبريس/, "wordpress"],
  // مفاهيم تجارية
  [/أسعار|اسعار|تسعير|باق(ة|ات)|اشتراك(ات)?/, "pricing plans subscription"],
  [/منافس(ين|ون)?|منافسة/, "competitors competitive analysis"],
  [/عملاء|زبائن|جمهور|مستهلك/, "customers audience"],
  [/مبيعات|صفق(ة|ات)/, "sales pipeline deals"],
  [/تحويل|معدل التحويل/, "conversion rate"],
  [/معايير|بنشمارك|متوسط(ات)? القطاع/, "benchmark industry average"],
  [/ميزانية|تكلفة|عائد|ROI|العائد على/, "budget cost roi return"],
  [/ولاء|احتفاظ|استبقاء/, "retention loyalty"],
  [/محتوى|مقال(ات)?|مدونة/, "content marketing blog"],
  [/ترند|رائج|اتجاه(ات)?/, "trends"],
  [/هوية بصرية|تصميم|شعار|لوجو|علامة تجارية/, "branding visual identity logo design"],
  [/تطبيق|موقع إلكتروني|موقع الكتروني/, "website app"],
  [/ذكاء اصطناعي/, "artificial intelligence"],
  [/تقرير|تحليل|بيانات|إحصائيات|احصائيات/, "report analytics data statistics"],
  [/حجز|مواعيد|اجتماع/, "booking appointments scheduling"],
  // قطاعات
  [/مطاعم|مطعم|كافيه|قهوة/, "restaurants food beverage"],
  [/عقار(ات)?/, "real estate"],
  [/صحة|طبي|عيادة/, "healthcare clinic"],
  [/تعليم|دورات|تدريب/, "education online courses"],
  [/سياحة|سفر|فنادق/, "travel tourism hotels"],
  [/أزياء|ملابس|موضة/, "fashion apparel"],
  [/رياضة|لياقة|جيم/, "fitness gym"],
  [/تجميل|عناية بالبشرة|مستحضرات/, "beauty skincare cosmetics"],
];

const hasLatin = (s: string) => /[A-Za-z]{3,}/.test(s);

/**
 * يبني استعلاماً إنجليزياً من نص عربي.
 * يعيد "" حين لا يوجد أي مقابل معروف — وهي إشارة بأن المصادر الإنجليزية
 * يجب ألا تُستدعى أصلاً لهذا الموضوع.
 */
export function latinQuery(text: string): string {
  const src = (text ?? "").trim();
  if (!src) return "";

  const terms: string[] = [];
  for (const [rx, en] of GLOSSARY) {
    if (rx.test(src)) terms.push(en);
  }

  // كلمات لاتينية كتبها المستخدم بنفسه (أسماء منتجات، علامات، مصطلحات) تُحترم كما هي.
  const latinWords = src.match(/[A-Za-z][A-Za-z0-9.+-]{2,}/g) ?? [];
  terms.push(...latinWords.slice(0, 5));

  const out = [...new Set(terms.join(" ").split(/\s+/).filter(Boolean))].slice(0, 10).join(" ");
  return hasLatin(out) ? out : "";
}
