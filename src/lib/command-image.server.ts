/**
 * صورة المنشور القادم من قناة التحكّم: صورة حقيقية عن الحدث أولاً (من الأخبار)،
 * وإن لم توجد صورة صالحة نولّد صورة بهوية العلامة. لا نُرجع رابطاً غير متحقَّق منه.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

const IMAGE_INTENT =
  /صور[ةه]|بصور|تصميم|بوستر|بنر|خلفي[ةه]|جرافيك|إنفوجراف|انفوجراف|image|photo|poster/i;
const EVENT_INTENT =
  /فوز|خسار[ةه]|مبارا[ةه]|ماتش|هدف|جونين|جول|بطول[ةه]|خبر|أخبار|اخبار|حدث|إعلان|اعلان|نتيج[ةه]/i;

const NO_IMAGE =
  /(بدون|بلا|من\s*غير|مش\s*عايز|لا\s*أريد)\s*(صور[ةه]?|صور|تصميم|وسائط|ميديا)|نص\s*(فقط|بس)|no\s*image|text\s*only/iu;

/**
 * الصورة تُرفَق فقط حين يطلبها صاحب العمل صراحةً.
 * كان مجرد ذكر حدث (فوز، خبر…) يُشغّل توليد صورة لم يطلبها أحد.
 */
export function wantsImage(text: string): boolean {
  if (NO_IMAGE.test(text)) return false;
  return IMAGE_INTENT.test(text);
}

async function looksLikeImage(url: string, ms = 8000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, { method: "GET", signal: controller.signal });
      if (!res.ok) return false;
      const type = res.headers.get("content-type") ?? "";
      return type.startsWith("image/");
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

/** يبحث عن صورة حقيقية منشورة عن نفس الحدث (og:image من أهم خبر). */
export async function findEventImage(
  query: string,
  country?: string | null,
): Promise<{ url: string; source: string; title: string } | null> {
  try {
    const { googleNewsSearch } = await import("./live-sources.server");
    const rows = await googleNewsSearch(query, {
      lang: "ar",
      country: (country ?? "EG").slice(0, 2).toUpperCase(),
      ms: 9000,
    });
    for (const row of rows.slice(0, 4)) {
      try {
        const { resilientText } = await import("./net-resilience.server");
        const html = await resilientText(row.url, { ms: 9000 });
        const match =
          /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html) ??
          /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i.exec(html);
        const candidate = match?.[1];
        if (!candidate || !/^https?:\/\//.test(candidate)) continue;
        if (!(await looksLikeImage(candidate))) continue;
        return { url: candidate, source: row.source, title: row.title };
      } catch {
        continue;
      }
    }
  } catch (error) {
    console.error("[command] event image search failed:", error);
  }
  return null;
}

/**
 * يعيد صورة جاهزة للنشر مع بيان مصدرها: حقيقية من الأخبار أو مولّدة.
 * يعيد null إن تعذّر الحصول على صورة صالحة (فلا يخرج منشور بصورة مكسورة).
 */
export async function resolvePostImage(
  admin: Admin,
  workspaceId: string,
  request: string,
  context: { industry?: string | null; country?: string | null } = {},
): Promise<{ url: string; origin: "news" | "generated"; note: string } | null> {
  if (EVENT_INTENT.test(request)) {
    const found = await findEventImage(request.slice(0, 200), context.country ?? null);
    if (found) {
      return {
        url: found.url,
        origin: "news",
        note: `🖼️ صورة حقيقية من ${found.source}`,
      };
    }
  }

  try {
    const { imageBrief, ownedHeroImage } = await import("./image-gen.server");
    const prompt = await imageBrief({
      request: request.slice(0, 500),
      brand: {
        ...(context.industry ? { industry: context.industry } : {}),
        country: context.country ?? null,
      },
    });
    const url = await ownedHeroImage(admin, workspaceId, prompt);
    if (url) return { url, origin: "generated", note: "🖼️ صورة مولّدة بهوية علامتك" };
  } catch (error) {
    console.error("[command] image generation failed:", error);
  }
  return null;
}
