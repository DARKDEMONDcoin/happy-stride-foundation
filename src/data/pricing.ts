/**
 * مصدر واحد لحقيقة الأسعار — تستخدمه صفحة /pricing وقسم الأسعار في الصفحة الرئيسية
 * حتى لا تختلف الأرقام أو أسماء الباقات بين مكانين.
 */
export type Plan = {
  id: "start" | "growth" | "scale";
  name: string;
  /** السعر الشهري بالريال، أو null للباقة حسب الطلب. */
  monthly: number | null;
  tag: string;
  desc: string;
  highlight: boolean;
  cta: string;
  perks: string[];
};

/** خصم الاشتراك السنوي. */
export const yearlyDiscount = 0.2;

export const plans: Plan[] = [
  {
    id: "start",
    name: "البداية",
    monthly: 149,
    tag: "لصاحب مشروع يبدأ وحده",
    desc: "موظف رقمي واحد تختاره ويبدأ العمل اليوم.",
    highlight: false,
    cta: "ابدأ ١٤ يوماً مجاناً",
    perks: [
      "موظف رقمي واحد تختاره",
      "٣ حسابات مرتبطة",
      "٦٠ مهمة شهرياً",
      "توليد صور بنص عربي",
      "تقرير أسبوعي",
      "دعم بالبريد خلال ٢٤ ساعة",
    ],
  },
  {
    id: "growth",
    name: "النمو",
    monthly: 399,
    tag: "الأكثر اختياراً",
    desc: "الفريق الستة كاملاً بمسارات عمل تلقائية بينهم.",
    highlight: true,
    cta: "ابدأ ١٤ يوماً مجاناً",
    perks: [
      "الفريق الستة كاملاً",
      "حسابات غير محدودة",
      "١٠٠٠ مهمة شهرياً",
      "مسارات عمل تلقائية بين الموظفين",
      "صندوق موحّد للعملاء",
      "ذاكرة علامة تجارية متقدمة",
      "دعم أولوية خلال ٣ ساعات",
    ],
  },
  {
    id: "scale",
    name: "المؤسسات",
    monthly: null,
    tag: "لفرق متعددة الفروع والعلامات",
    desc: "علامات وفروع متعددة بصلاحيات ومدير حساب.",
    highlight: false,
    cta: "تحدّث مع المبيعات",
    perks: [
      "علامات وفروع متعددة",
      "صلاحيات وأدوار للفريق",
      "مهام غير محدودة",
      "سجل تدقيق كامل واتفاقية مستوى خدمة",
      "مدير حساب مخصص",
      "تدريب الفريق وإعداد أولي",
    ],
  },
];

/** العملات المحلية — السعر الأساسي بالريال السعودي، ويُعرض بعملة بلد الزائر. */
export type Currency = { code: string; label: string; rate: number; step: number };

const USD: Currency = { code: "USD", label: "دولار", rate: 0.267, step: 1 };

export const CURRENCIES: Record<string, Currency> = {
  SA: { code: "SAR", label: "ر.س", rate: 1, step: 1 },
  EG: { code: "EGP", label: "ج.م", rate: 13.3, step: 10 },
  AE: { code: "AED", label: "د.إ", rate: 0.98, step: 1 },
  KW: { code: "KWD", label: "د.ك", rate: 0.082, step: 0.5 },
  QA: { code: "QAR", label: "ر.ق", rate: 0.97, step: 1 },
  BH: { code: "BHD", label: "د.ب", rate: 0.1, step: 0.5 },
  OM: { code: "OMR", label: "ر.ع", rate: 0.103, step: 0.5 },
  JO: { code: "JOD", label: "د.أ", rate: 0.19, step: 1 },
  MA: { code: "MAD", label: "د.م", rate: 2.6, step: 5 },
};

export function currencyOf(countryCode: string): Currency {
  return CURRENCIES[countryCode] ?? USD;
}

function roundTo(n: number, step: number): number {
  const v = Math.round(n / step) * step;
  return step < 1 ? Number(v.toFixed(1)) : v;
}

/** السعر المعروض حسب دورة الفوترة المختارة وعملة البلد. */
export function priceOf(plan: Plan, yearly: boolean, countryCode = "SA"): string {
  if (plan.monthly === null) return "حسب الطلب";
  const cur = currencyOf(countryCode);
  const sar = yearly ? plan.monthly * (1 - yearlyDiscount) : plan.monthly;
  return roundTo(sar * cur.rate, cur.step).toLocaleString("en-US");
}
