/**
 * مصنّف نية البحث المحلي (بدون نموذج، أقل من مللي ثانية).
 * يحدد: نوع السؤال، ومدى حاجته للحداثة، وأنسب طريقة لاستدعاء Tavily.
 * الهدف: كل سؤال يذهب للمصدر الأنسب له، وحصة Tavily تُصرف حيث تصنع فرقاً.
 */
export type SearchKind =
  | "news"
  | "finance"
  | "prices"
  | "sports"
  | "local"
  | "tech"
  | "health"
  | "science"
  | "howto"
  | "entity"
  | "general";

export type SearchIntent = {
  kinds: SearchKind[];
  /** يحتاج معلومة حديثة جداً (اليوم/الأسبوع). */
  fresh: boolean;
  timeRange?: "day" | "week" | "month" | "year" | undefined;
  tavilyTopic: "general" | "news" | "finance";
  /** يستحق Tavily فوراً مع المصادر المجانية (لا احتياطياً). */
  tavilyFirst: boolean;
};

const R: Record<Exclude<SearchKind, "general">, RegExp> = {
  news: /(خبر|أخبار|اخبار|عاجل|حدث|أحداث|تصريح|انتخابات|حرب|news|breaking|announce)/i,
  finance: /(سهم|أسهم|اسهم|بورصة|البورصة|دولار|يورو|سعر الصرف|ذهب|بيتكوين|عملة|تضخم|فائدة|stock|shares|crypto|bitcoin|exchange rate|inflation|nasdaq)/i,
  prices: /(سعر|أسعار|اسعار|تكلفة|بكام|كام سعر|باقة|باقات|اشتراك|price|pricing|cost|plan)/i,
  sports: /(مباراة|ماتش|دوري|كأس|نتيجة|الأهلي|الزمالك|منتخب|لاعب|هدف|match|league|score|fifa)/i,
  local: /(قريب|بالقرب|في القاهرة|في الرياض|في دبي|في جدة|فرع|عنوان|مطعم|محل|near me|nearby|address)/i,
  tech: /(ذكاء اصطناعي|تطبيق|برنامج|آيفون|ايفون|أندرويد|اندرويد|إصدار|تحديث|api|ai|gpt|iphone|android|release|update|software)/i,
  health: /(صحة|مرض|علاج|دواء|أعراض|سعرات|رجيم|health|disease|symptom|treatment|diet)/i,
  science: /(دراسة|بحث علمي|أبحاث|إحصائية|احصائية|نسبة|تقرير|study|research|statistics|report|survey)/i,
  howto: /(ازاي|إزاي|كيف|طريقة|خطوات|how to|tutorial|guide|steps)/i,
  entity: /(مين|من هو|من هي|ما هو|ما هي|إيه هو|ايه هي|who is|what is|biography)/i,
};

const FRESH = /(اليوم|النهارده|الآن|دلوقتي|حالياً|حاليا|هذا الأسبوع|الاسبوع ده|أحدث|آخر|جديد|latest|today|now|this week|current|recent|2026)/i;

export function classifySearch(text: string): SearchIntent {
  const t = (text ?? "").slice(0, 400);
  const kinds = (Object.keys(R) as (keyof typeof R)[]).filter((k) => R[k].test(t)) as SearchKind[];
  if (!kinds.length) kinds.push("general");
  const fresh = FRESH.test(t) || kinds.includes("news") || kinds.includes("sports") || kinds.includes("finance");

  const tavilyTopic: SearchIntent["tavilyTopic"] = kinds.includes("finance")
    ? "finance"
    : kinds.includes("news") || kinds.includes("sports")
      ? "news"
      : "general";

  const timeRange: SearchIntent["timeRange"] = /(اليوم|النهارده|الآن|دلوقتي|today|now|عاجل|breaking)/i.test(t)
    ? "day"
    : fresh
      ? "week"
      : kinds.includes("prices") || kinds.includes("tech")
        ? "year"
        : undefined;

  // المجاني قوي في: الموسوعي، الأكاديمي، الشرح. ضعيف في: اللحظي، الأسعار، الرياضة، المحلي.
  const tavilyFirst =
    fresh || kinds.some((k) => k === "prices" || k === "finance" || k === "local" || k === "sports");

  return { kinds, fresh, timeRange, tavilyTopic, tavilyFirst };
}
