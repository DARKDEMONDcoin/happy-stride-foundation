/**
 * أدلة ميدانية لسِراج (السوشيال ميديا) — مصادر مجانية بلا مفتاح:
 * اقتراحات البحث الحيّة (Google/Bing) + نتائج بحث حقيقية عن الترند والمنافسين.
 *
 * الهدف: أن تكون مخرجات «رادار الترند» و«مقارنة المنافسين» و«مختبر الهاشتاق»
 * مبنية على ما يبحث عنه الناس فعلاً الآن، لا على معرفة النموذج المخزّنة.
 */
import { googleSuggest, bingSuggest, serpSearch, withBudget } from "./seo-research.server";

/** القدرات التي تستفيد فعلاً من بحث حيّ قبل الكتابة. */
export const SOCIAL_RESEARCH_SKILLS = new Set([
  "trend-watch",
  "competitor-benchmark",
  "hashtag-lab",
  "content-calendar",
  "social-daily-ideas",
  "launch-campaign",
  "social-brand-voice",
]);

export type SocialEvidence = { block: string; used: string[] };

const EMPTY: SocialEvidence = { block: "", used: [] };

/** ذاكرة قصيرة للأدلة: نفس الموضوع خلال نصف ساعة لا يستحق ١٢ ثانية بحث جديدة. */
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; value: SocialEvidence }>();

function uniq(list: string[], max: number): string[] {
  return [...new Set(list.map((s) => s.trim()).filter((s) => s.length > 1))].slice(0, max);
}

/**
 * يجمع أدلة سوشيال حيّة حول موضوع/قطاع، بسقف زمني صارم حتى لا يؤخّر المخرج.
 */
export async function socialEvidence(
  topic: string,
  opts: {
    city?: string | undefined;
    platform?: string | undefined;
    rivals?: string | undefined;
    budgetMs?: number;
  } = {},
): Promise<SocialEvidence> {
  const seed = topic.trim().slice(0, 80);
  if (seed.length < 3) return EMPTY;

  const platform = (opts.platform ?? "").trim();
  const city = (opts.city ?? "").trim();

  const handles = uniq((opts.rivals ?? "").match(/@[A-Za-z0-9._]{2,30}/g) ?? [], 3);

  const key = `${seed}|${platform}|${city}|${handles.join(",")}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const work = (async (): Promise<SocialEvidence> => {
    const [g, b, trendSerp, hashSerp, rivalSerp] = await Promise.all([
      googleSuggest(seed).catch(() => [] as string[]),
      bingSuggest(seed).catch(() => [] as string[]),
      serpSearch(`${seed} ${platform || "سوشيال ميديا"} ترند ${new Date().getFullYear()}`).catch(
        () => [],
      ),
      serpSearch(`هاشتاقات ${seed}${city ? ` ${city}` : ""}`).catch(() => []),
      handles.length
        ? serpSearch(`${handles.join(" OR ")} ${seed}`).catch(() => [])
        : Promise.resolve([]),
    ]);

    const parts: string[] = [];
    const used: string[] = [];

    const suggestions = uniq([...g, ...b], 18);
    if (suggestions.length) {
      used.push(`اقتراحات بحث حيّة: ${seed}`);
      parts.push(
        `### ما يبحث عنه الناس فعلاً الآن حول «${seed}» (إكمال Google/Bing)\n- ${suggestions.join(" | ")}`,
      );
    }

    if (trendSerp.length) {
      used.push("نتائج بحث: الترند");
      parts.push(
        [
          `### إشارات ترند حقيقية (نتائج بحث لحظية)`,
          ...trendSerp.slice(0, 6).map((r) => `${r.rank}. ${r.title} — ${r.url}\n   ${r.snippet}`),
        ].join("\n"),
      );
    }

    if (hashSerp.length) {
      used.push("نتائج بحث: الهاشتاقات");
      parts.push(
        [
          `### مراجع هاشتاقات متداولة${city ? ` في ${city}` : ""} (نتائج بحث لحظية)`,
          ...hashSerp.slice(0, 5).map((r) => `- ${r.title} — ${r.url}\n  ${r.snippet}`),
        ].join("\n"),
      );
    }

    if (rivalSerp.length) {
      used.push(`نتائج بحث: منافسون (${handles.join(" ")})`);
      parts.push(
        [
          `### ما يظهر عن المنافسين المذكورين في البحث`,
          ...rivalSerp.slice(0, 5).map((r) => `- ${r.title} — ${r.url}\n  ${r.snippet}`),
        ].join("\n"),
      );
    }

    if (!parts.length) return EMPTY;
    return { block: parts.join("\n\n"), used };
  })();

  const value = await withBudget(work, opts.budgetMs ?? 12_000, EMPTY);
  if (value.block) cache.set(key, { at: Date.now(), value });
  return value;
}
