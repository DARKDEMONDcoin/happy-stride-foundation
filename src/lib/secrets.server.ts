/**
 * الطبقة الموحّدة لكل الأسرار والمفاتيح في التطبيق.
 * المصدر الأول والأخير: جدول app_secrets في قاعدة بيانات Supabase.
 * أي مفتاح جديد يُضاف للجدول يصبح متاحاً فوراً لكل الكود بدون أي تعديل برمجي.
 * (متغيّرات البيئة تُستخدم كاحتياطي فقط لو الجدول لا يحتوي المفتاح.)
 */

let cache: { at: number; rows: Record<string, string> } | null = null;
const TTL = 60 * 1000;

/** إبطال الذاكرة المؤقتة — يُنادى بعد أي تعديل على المفاتيح. */
export function resetSecretsCache(): void {
  cache = null;
}

/** يحمّل كل الأسرار من قاعدة البيانات (مع تخزين مؤقت قصير). */
export async function loadSecrets(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < TTL) return cache.rows;

  const rows: Record<string, string> = {};
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("app_secrets").select("name, value");
    for (const row of (data ?? []) as { name: string; value: string }[]) {
      const value = (row.value ?? "").trim();
      if (value) rows[row.name] = value;
    }
    cache = { at: Date.now(), rows };
  } catch {
    // لا نخزّن الفشل مؤقتاً حتى نعيد المحاولة في الطلب التالي
  }
  return rows;
}

/** قيمة مفتاح واحد: من قاعدة البيانات أولاً ثم البيئة. سلسلة فارغة إن لم يوجد. */
export async function getSecret(name: string): Promise<string> {
  const rows = await loadSecrets();
  const fromDb = rows[name];
  if (fromDb) return fromDb;
  return (process.env[name] ?? "").trim();
}

/** قيم عدة مفاتيح في نداء واحد. */
export async function getSecrets<T extends readonly string[]>(
  names: T,
): Promise<Record<T[number], string>> {
  const rows = await loadSecrets();
  const out = {} as Record<T[number], string>;
  for (const name of names) {
    out[name as T[number]] = rows[name] || (process.env[name] ?? "").trim();
  }
  return out;
}
