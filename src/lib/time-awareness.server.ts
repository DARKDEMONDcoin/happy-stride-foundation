/**
 * «مرساة الزمن» (Now-Anchoring) — الطبقة التي تمنح كل موظف إحساساً حقيقياً بالوقت.
 *
 * النموذج اللغوي لا يملك ساعة، ومعرفته متوقفة عند تاريخ تدريبه. الحل المعتمد عالمياً
 * هو حقن «اللحظة الآن» محسوبةً على الخادم داخل تعليمات كل نداء — لا كأداة تُستدعى.
 * هذا الملف يحسب: التوقيت المحلي للعلامة + UTC + اليوم + الأسبوع + التاريخ الهجري
 * (أم القرى) + التواريخ النسبية الجاهزة (اليوم/غداً/الأسبوع القادم) + أقرب المواسم.
 */

const WEEK = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** المنطقة الزمنية المناسبة لكل سوق عربي — بدل تخمين القاهرة للجميع. */
const COUNTRY_TZ: Record<string, string> = {
  SA: "Asia/Riyadh",
  AE: "Asia/Dubai",
  KW: "Asia/Kuwait",
  QA: "Asia/Qatar",
  BH: "Asia/Bahrain",
  OM: "Asia/Muscat",
  YE: "Asia/Aden",
  IQ: "Asia/Baghdad",
  JO: "Asia/Amman",
  LB: "Asia/Beirut",
  SY: "Asia/Damascus",
  PS: "Asia/Hebron",
  EG: "Africa/Cairo",
  SD: "Africa/Khartoum",
  LY: "Africa/Tripoli",
  TN: "Africa/Tunis",
  DZ: "Africa/Algiers",
  MA: "Africa/Casablanca",
  MR: "Africa/Nouakchott",
  SO: "Africa/Mogadishu",
  DJ: "Africa/Djibouti",
  KM: "Indian/Comoro",
  TR: "Europe/Istanbul",
  GB: "Europe/London",
  US: "America/New_York",
  FR: "Europe/Paris",
  DE: "Europe/Berlin",
};

/** يحوّل رمز الدولة إلى منطقة زمنية حقيقية (الافتراضي: الرياض). */
export function timezoneForCountry(country?: string | null, fallback = "Asia/Riyadh"): string {
  const code = (country ?? "").trim().toUpperCase();
  return COUNTRY_TZ[code] ?? fallback;
}

/** العملة المحلية لكل سوق — تُستخدم في الأسعار والحقائق المالية اللحظية. */
const COUNTRY_CURRENCY: Record<string, string> = {
  SA: "SAR",
  AE: "AED",
  KW: "KWD",
  QA: "QAR",
  BH: "BHD",
  OM: "OMR",
  EG: "EGP",
  JO: "JOD",
  IQ: "IQD",
  LB: "LBP",
  MA: "MAD",
  TN: "TND",
  DZ: "DZD",
  LY: "LYD",
  SD: "SDG",
  TR: "TRY",
};

export function currencyForCountry(country?: string | null): string {
  return COUNTRY_CURRENCY[(country ?? "").trim().toUpperCase()] ?? "USD";
}

function part(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions, locale = "ar-EG") {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(date);
  } catch {
    return new Intl.DateTimeFormat(locale, options).format(date);
  }
}

export type NowFacts = {
  timeZone: string;
  /** 2026-09-18 بالتوقيت المحلي. */
  iso: string;
  /** 01:59 بالتوقيت المحلي (24 ساعة). */
  clock: string;
  weekday: string;
  /** وصف عربي طويل: الجمعة ١٨ سبتمبر ٢٠٢٦. */
  long: string;
  hijri: string;
  utc: string;
  /** إزاحة المنطقة عن UTC بالساعات، مثل "+03:00". */
  offset: string;
  /** جزء اليوم: فجر/صباح/ظهر/عصر/مساء/ليل — يفيد نبرة المخاطبة والتوقيت. */
  dayPart: string;
  epochMs: number;
};

/** أجزاء التاريخ المحلي كأرقام. */
function localParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => fmt.find((p) => p.type === t)?.value ?? "";
  const hour = Number(get("hour") === "24" ? "00" : get("hour"));
  return {
    iso: `${get("year")}-${get("month")}-${get("day")}`,
    clock: `${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`,
    hour,
  };
}

function offsetOf(date: Date, timeZone: string): string {
  try {
    const value = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value;
    return (value ?? "UTC+00:00").replace("GMT", "UTC");
  } catch {
    return "UTC+00:00";
  }
}

/** التحية العربية المطابقة للساعة المحلية — تمنع «مساء الخير» في الحادية عشرة صباحاً. */
export function greetingFor(clock: string): string {
  const hour = Number.parseInt(clock.slice(0, 2), 10);
  if (!Number.isFinite(hour)) return "أهلاً";
  if (hour < 5) return "مساء الخير";
  if (hour < 12) return "صباح الخير";
  return "مساء الخير";
}

function dayPartOf(hour: number): string {
  if (hour < 5) return "بعد منتصف الليل";
  if (hour < 12) return "صباحاً";
  if (hour < 15) return "ظهراً";
  if (hour < 18) return "عصراً";
  if (hour < 21) return "مساءً";
  return "ليلاً";
}

/** التاريخ الهجري (تقويم أم القرى) بصيغة رقمية قابلة للحساب. */
export function hijriParts(date: Date, timeZone?: string): { y: number; m: number; d: number } {
  try {
    const fmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
      ...(timeZone ? { timeZone } : {}),
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(date);
    const get = (t: string) => Number((fmt.find((p) => p.type === t)?.value ?? "0").replace(/\D/g, ""));
    return { y: get("year"), m: get("month"), d: get("day") };
  } catch {
    return { y: 0, m: 0, d: 0 };
  }
}

const HIJRI_MONTHS = [
  "محرّم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوال",
  "ذو القعدة",
  "ذو الحجة",
];

/** حقائق اللحظة الحالية — تُحسب على الخادم فلا مجال للتخمين. */
export function nowFacts(timeZone = "Asia/Riyadh"): NowFacts {
  const now = new Date();
  const { iso, clock, hour } = localParts(now, timeZone);
  const weekday = WEEK[new Date(`${iso}T12:00:00Z`).getUTCDay()] ?? "";
  const h = hijriParts(now, timeZone);
  return {
    timeZone,
    iso,
    clock,
    weekday,
    long: part(now, timeZone, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    hijri: h.y ? `${h.d} ${HIJRI_MONTHS[h.m - 1] ?? h.m} ${h.y}هـ` : "",
    utc: now.toISOString().replace("T", " ").slice(0, 16) + " UTC",
    offset: offsetOf(now, timeZone),
    dayPart: dayPartOf(hour),
    epochMs: now.getTime(),
  };
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function labelOf(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${iso} (${WEEK[d.getUTCDay()]})`;
}

/** أقرب المواسم والمناسبات المؤثرة تسويقياً، محسوبة فعلياً لا من الذاكرة. */
export function upcomingOccasions(timeZone: string, country?: string | null): string[] {
  const facts = nowFacts(timeZone);
  const out: { label: string; days: number }[] = [];

  // مناسبات هجرية: نمسح الأيام القادمة ونحوّل كل يوم إلى هجري حتى نجد بدايتها.
  const targets: { m: number; d: number; label: string }[] = [
    { m: 9, d: 1, label: "بداية رمضان" },
    { m: 10, d: 1, label: "عيد الفطر" },
    { m: 12, d: 10, label: "عيد الأضحى" },
  ];
  const found = new Set<string>();
  for (let i = 0; i <= 400 && found.size < targets.length; i++) {
    const day = new Date(`${addDays(facts.iso, i)}T12:00:00Z`);
    const h = hijriParts(day);
    for (const t of targets) {
      if (found.has(t.label)) continue;
      if (h.m === t.m && h.d === t.d) {
        found.add(t.label);
        out.push({ label: t.label, days: i });
      }
    }
  }

  // مناسبات ميلادية ثابتة + الجمعة البيضاء (الجمعة الرابعة من نوفمبر).
  const year = Number(facts.iso.slice(0, 4));
  const fixed: { iso: string; label: string }[] = [
    { iso: `${year}-01-01`, label: "رأس السنة الميلادية" },
    { iso: `${year + 1}-01-01`, label: "رأس السنة الميلادية" },
    { iso: `${year}-02-14`, label: "عيد الحب" },
    { iso: `${year + 1}-02-14`, label: "عيد الحب" },
    { iso: `${year}-09-23`, label: "اليوم الوطني السعودي" },
    { iso: `${year + 1}-09-23`, label: "اليوم الوطني السعودي" },
    { iso: `${year}-12-02`, label: "اليوم الوطني الإماراتي" },
    { iso: `${year + 1}-12-02`, label: "اليوم الوطني الإماراتي" },
  ];
  for (const f of fixed) {
    const days = Math.round(
      (new Date(`${f.iso}T12:00:00Z`).getTime() - new Date(`${facts.iso}T12:00:00Z`).getTime()) /
        86_400_000,
    );
    if (days >= 0 && days <= 200) out.push({ label: f.label, days });
  }

  // الجمعة البيضاء: آخر جمعة في نوفمبر بعد يوم الشكر (الخميس الرابع).
  for (const y of [year, year + 1]) {
    const nov = new Date(Date.UTC(y, 10, 1, 12));
    let thursdays = 0;
    for (let d = 1; d <= 30; d++) {
      nov.setUTCDate(d);
      if (nov.getUTCDay() === 4) thursdays++;
      if (thursdays === 4) {
        const bf = new Date(nov.getTime() + 86_400_000);
        const days = Math.round(
          (bf.getTime() - new Date(`${facts.iso}T12:00:00Z`).getTime()) / 86_400_000,
        );
        if (days >= 0 && days <= 200)
          out.push({ label: "الجمعة البيضاء (بلاك فرايداي)", days });
        break;
      }
    }
  }

  const seen = new Set<string>();
  return out
    .filter((o) => o.days >= 0 && (!seen.has(o.label) ? seen.add(o.label) : false))
    .sort((a, b) => a.days - b.days)
    .slice(0, 4)
    .map((o) =>
      o.days === 0
        ? `${o.label}: اليوم`
        : `${o.label}: بعد ${o.days} يوم (${labelOf(addDays(facts.iso, o.days))})`,
    );
}

/**
 * سطر واحد مضغوط يُحقن في كل نداء نموذج في المنصة بلا استثناء —
 * حتى المهام الخلفية (البريفنج، الأوتوبايلوت، واتساب، الجدولة) تعرف اللحظة.
 */
export function nowAnchorLine(timeZone = "Asia/Riyadh"): string {
  const f = nowFacts(timeZone);
  return [
    `[اللحظة الآن — حقيقة محسوبة على الخادم] ${f.long} ${f.dayPart}، الساعة ${f.clock} بتوقيت ${f.timeZone} (${f.offset}).`,
    `التاريخ الميلادي ${f.iso} (${f.weekday})${f.hijri ? ` — الهجري ${f.hijri}` : ""}. UTC: ${f.utc}.`,
    "احسب أي تعبير زمني (اليوم، غداً، أمس، هذا الأسبوع، بعد ٣ أيام) من هذه اللحظة بالضبط، ولا تعتمد على تاريخ تدريبك ولا تقل إنك لا تعرف التاريخ أو الوقت.",
  ].join(" ");
}

/** الكتلة الكاملة للمحادثة: زمن دقيق + تواريخ نسبية جاهزة + مواسم قادمة + قواعد صدق. */
export function nowBlock(timeZone = "Asia/Riyadh", country?: string | null): string {
  const f = nowFacts(timeZone);
  const occasions = upcomingOccasions(timeZone, country);
  return [
    "## اللحظة الحالية (حقيقة مؤكدة محسوبة الآن على الخادم — لا تخمّن الزمن أبداً)",
    `- الآن: ${f.long} ${f.dayPart}، الساعة ${f.clock} بتوقيت ${f.timeZone} (${f.offset}).`,
    `- الميلادي: ${f.iso} (${f.weekday}).${f.hijri ? ` الهجري: ${f.hijri}.` : ""} بالتوقيت العالمي: ${f.utc}.`,
    "- التواريخ النسبية الجاهزة (استخدمها حرفياً عند الجدولة):",
    `  • أمس ${labelOf(addDays(f.iso, -1))} • اليوم ${labelOf(f.iso)} • غداً ${labelOf(addDays(f.iso, 1))} • بعد غد ${labelOf(addDays(f.iso, 2))}`,
    `  • بعد أسبوع ${labelOf(addDays(f.iso, 7))} • بعد شهر ${labelOf(addDays(f.iso, 30))}`,
    occasions.length ? `- مواسم قادمة محسوبة فعلياً: ${occasions.join(" • ")}.` : "",
    "- معرفتك المخزّنة قديمة بطبيعتها: أي حدث أو رقم أو سعر أو نتيجة أو «آخر إصدار» لا يُعتمد من ذاكرتك، بل من كتلة «حقائق لحظية» أدناه فقط. إن لم تكن موجودة، قل بصراحة إنك تحققت ولم تجد مصدراً بدل الاختلاق.",
    "- ممنوع نهائياً أن تقول «لا أعرف التاريخ» أو «معلوماتي تتوقف عند سنة كذا» أو أن تذكر سنة خاطئة.",
    `- التحية الصحيحة الآن هي «${greetingFor(f.clock)}» — لا تكتب تحية تخالف الساعة أعلاه، لا في الرد ولا داخل أي مخرج (رسالة، بريد، منشور) إلا إن حدّد المالك وقت الإرسال صراحةً فتُطابق التحية وقته.`,
  ]
    .filter(Boolean)
    .join("\n");
}
