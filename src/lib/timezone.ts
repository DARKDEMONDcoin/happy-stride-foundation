/**
 * حساب المناطق الزمنية: مصدر واحد لكل الجدولة (الطابور، الطيار الآلي، المهام الآلية، التقويم)
 * حتى لا تختلف الساعة من ميزة لأخرى، ومع مراعاة التوقيت الصيفي في كل لحظة على حدة.
 */

/** إزاحة المنطقة الزمنية بالدقائق في لحظة محددة (تراعي التوقيت الصيفي). */
export function offsetMinutes(timeZone: string, at: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(at);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
    const asUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") % 24,
      get("minute"),
      get("second"),
    );
    return Math.round((asUtc - at.getTime()) / 60000);
  } catch {
    return 0;
  }
}

/** أجزاء التاريخ المحلي (سنة/شهر/يوم/يوم الأسبوع) في منطقة زمنية. */
export function localParts(timeZone: string, at: Date) {
  const shifted = new Date(at.getTime() + offsetMinutes(timeZone, at) * 60000);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    dow: shifted.getUTCDay(),
  };
}

/**
 * يحوّل لحظة محلية (سنة/شهر/يوم/ساعة/دقيقة في منطقة زمنية) إلى لحظة UTC حقيقية،
 * مع تصحيح مزدوج يضمن الصحة حتى عند تغيّر التوقيت الصيفي في نفس اليوم.
 */
export function zonedTimeToUtc(
  timeZone: string,
  y: number,
  m: number,
  d: number,
  hour: number,
  minute = 0,
): Date {
  const guess = Date.UTC(y, m, d, hour, minute, 0);
  const first = new Date(guess - offsetMinutes(timeZone, new Date(guess)) * 60000);
  return new Date(guess - offsetMinutes(timeZone, first) * 60000);
}
