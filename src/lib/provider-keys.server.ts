/**
 * مفاتيح مزوّدي الذكاء الاصطناعي — تُقرأ عبر الطبقة الموحّدة للأسرار،
 * أي من جدول app_secrets في Supabase (مع البيئة كاحتياطي).
 */
import { getSecrets, resetSecretsCache } from "./secrets.server";

type Keys = { lovable: string; gemini: string; openrouter: string };

/** إبطال الذاكرة المؤقتة بعد تحديث المفاتيح من الإعدادات. */
export function resetProviderKeys(): void {
  resetSecretsCache();
}

export async function providerKeys(): Promise<Keys> {
  const found = await getSecrets([
    "LOVABLE_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "OPENROUTER_API_KEY",
  ] as const);
  return {
    lovable: found.LOVABLE_API_KEY,
    gemini: found.GEMINI_API_KEY || found.GOOGLE_API_KEY,
    openrouter: found.OPENROUTER_API_KEY,
  };
}
