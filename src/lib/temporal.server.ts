/**
 * الطبقة الزمنية للأدلة: تحويل الكلام النسبي («امبارح»، «الأسبوع اللي فات») إلى
 * تواريخ مطلقة، ووسم كل دليل بعمره الحقيقي، وترتيب الأدلة بانحدار زمني.
 *
 * السبب: النموذج لا يستطيع حساب «قبل كام ساعة» بنفسه، ولا يفرّق بين خبر عمره
 * ساعتين وخبر عمره ثلاثة أشهر ما لم نقل له ذلك صراحةً بالأرقام.
 */

import { nowFacts } from "./time-awareness.server";

/** يقرأ أي صيغة تاريخ تأتي من RSS/GDELT/JSON ويعيد وقتاً بالميلي ثانية (0 = مجهول). */
export function parseStamp(raw?: string): number {
  if (!raw) return 0;
  const s = raw.trim();
  // GDELT: 20260918T051500Z أو 20260918051500
  const compact = /^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/.exec(s);
  if (compact) {
    const [, y, mo, d, h, mi, se] = compact;
    const t = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${se}Z`);
    return Number.isNaN(t) ? 0 : t;
  }
  if (/^\d{8}$/.test(s)) {
    const t = Date.parse(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00Z`);
    return Number.isNaN(t) ? 0 : t;
  }
  if (/^\d{10}$/.test(s)) return Number(s) * 1000;
  if (/^\d{13}$/.test(s)) return Number(s);
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

/** وسم بشري بالعربية لعمر الدليل: «منذ ٣ ساعات»، «أمس»، «منذ شهرين». */
export function ageLabel(stamp: number, now = Date.now()): string {
  if (!stamp) return "بلا تاريخ";
  const diff = Math.max(0, now - stamp);
  const min = Math.round(diff / 60_000);
  if (min < 2) return "الآن";
  if (min < 60) return `منذ ${min} دقيقة`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.round(hours / 24);
  if (days === 1) return "أمس";
  if (days < 30) return `منذ ${days} يوماً`;
  const months = Math.round(days / 30);
  if (months < 12) return `منذ ${months} شهراً`;
  return `منذ ${Math.round(months / 12)} سنة`;
}

/** تصنيف الطزاجة — يُعرض للنموذج ليعرف ما يُعتمد عليه كـ«الآن» وما يُذكر كخلفية. */
export function freshnessTag(stamp: number, now = Date.now()): "طازج" | "حديث" | "قديم" | "مجهول" {
  if (!stamp) return "مجهول";
  const hours = (now - stamp) / 3_600_000;
  if (hours <= 24) return "طازج";
  if (hours <= 24 * 14) return "حديث";
  return "قديم";
}

/**
 * انحدار زمني أُسّي بنصف عمر قابل للضبط حسب نوع السؤال:
 * أسئلة «الآن» نصف عمرها ساعات، والأسئلة المعرفية نصف عمرها أسابيع.
 */
export function decayScore(stamp: number, halfLifeHours: number, now = Date.now()): number {
  if (!stamp) return 0.25; // بلا تاريخ: لا نُعدمه ولا نُقدّمه
  const hours = Math.max(0, (now - stamp) / 3_600_000);
  return Math.pow(0.5, hours / halfLifeHours);
}

/** نصف العمر المناسب لنيّة السؤال (ساعات). */
export function halfLifeFor(message: string): number {
  if (/عاجل|الآن|الان|دلوقتي|هذه اللحظة|breaking/u.test(message)) return 6;
  if (/النهارده|النهاردة|اليوم|today/u.test(message)) return 18;
  if (/أمس|امبارح|yesterday/u.test(message)) return 36;
  if (/الأسبوع|هذا الأسبوع|week/u.test(message)) return 96;
  if (/الشهر|month/u.test(message)) return 480;
  return 72;
}

export type RelativeWindow = { label: string; from: string; to: string };

/**
 * يحوّل التعبيرات النسبية في سؤال المستخدم إلى نافذة تواريخ مطلقة بتوقيت العلامة،
 * حتى يبحث الموظف بالتاريخ الصحيح ويقرأ تواريخ المصادر على أساسه.
 */
export function resolveRelative(message: string, timeZone: string): RelativeWindow[] {
  const f = nowFacts(timeZone);
  const base = new Date(`${f.iso}T12:00:00Z`).getTime();
  const day = 86_400_000;
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  const out: RelativeWindow[] = [];
  const add = (label: string, fromT: number, toT: number) =>
    out.push({ label, from: iso(fromT), to: iso(toT) });

  if (/النهارده|النهاردة|اليوم|دلوقتي|الآن|الان|today/u.test(message)) add("اليوم", base, base);
  if (/أمس|امبارح|yesterday/u.test(message)) add("أمس", base - day, base - day);
  if (/أول امبارح|أول أمس/u.test(message)) add("أول أمس", base - 2 * day, base - 2 * day);
  if (/بكرة|غداً|غدا|tomorrow/u.test(message)) add("غداً", base + day, base + day);
  if (/الأسبوع (اللي فات|الماضي)|last week/u.test(message)) add("الأسبوع الماضي", base - 7 * day, base - day);
  if (/(هذا|ده) الأسبوع|الأسبوع ده|this week/u.test(message)) add("هذا الأسبوع", base - 6 * day, base);
  if (/الشهر (اللي فات|الماضي)|last month/u.test(message)) add("الشهر الماضي", base - 30 * day, base - day);
  if (/(هذا|ده) الشهر|الشهر ده|this month/u.test(message)) add("هذا الشهر", base - 29 * day, base);
  if (/السنة (اللي فاتت|الماضية)|last year/u.test(message))
    add("السنة الماضية", base - 365 * day, base - day);

  const ago = /منذ\s*(\d{1,3})\s*(دقيقة|ساعة|يوم|أيام|يوماً|أسبوع|أسابيع|شهر|شهور|أشهر|سنة|سنوات)/u.exec(
    message,
  );
  if (ago) {
    const n = Number(ago[1]);
    const unit = ago[2]!;
    const mult = /دقيقة/.test(unit)
      ? 60_000
      : /ساعة/.test(unit)
        ? 3_600_000
        : /يوم|أيام|يوماً/.test(unit)
          ? day
          : /أسبوع|أسابيع/.test(unit)
            ? 7 * day
            : /شهر|شهور|أشهر/.test(unit)
              ? 30 * day
              : 365 * day;
    add(`منذ ${n} ${unit}`, base - n * mult, base);
  }

  return out;
}

/** سطر يُحقن في التعليمات: ترجمة كل تعبير نسبي إلى تاريخ مطلق لا لبس فيه. */
export function relativeBlock(message: string, timeZone: string): string {
  const windows = resolveRelative(message, timeZone);
  if (!windows.length) return "";
  return (
    "ترجمة التعبيرات الزمنية في سؤال المستخدم إلى تواريخ مطلقة: " +
    windows
      .map((w) => (w.from === w.to ? `«${w.label}» = ${w.from}` : `«${w.label}» = ${w.from} → ${w.to}`))
      .join(" • ") +
    "."
  );
}
