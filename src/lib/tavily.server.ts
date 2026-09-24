/**
 * Tavily — بحث ويب عالي الجودة، لكن الباقة المجانية ١٠٠٠ طلب شهرياً فقط.
 * لذلك هو «الاحتياطي الذكي» لا المصدر الأول:
 * - يُستدعى فقط حين تعجز المصادر المجانية (أدلة قليلة) أو حين يحتاج السؤال حداثة لحظية.
 * - بحث basic فقط (رصيد واحد لكل طلب).
 * - ذاكرة مؤقتة ٦ ساعات لنفس السؤال، وسقف يومي ٣٠ طلباً، وسقف شهري ٩٥٠ (هامش أمان).
 * - إن نفد الرصيد أو رفض المفتاح، يتوقف تلقائياً حتى نهاية اليوم دون أي أثر على الرد.
 */
import type { Finding } from "./open-data.server";
import { getSecret } from "./secrets.server";

const DAILY_CAP = 30;
const MONTHLY_CAP = 950;
const CACHE_TTL = 6 * 60 * 60_000;

const cache = new Map<string, { at: number; rows: Finding[] }>();
const usage = { day: "", dayCount: 0, month: "", monthCount: 0, blockedUntil: 0 };

function allow(): boolean {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  if (usage.day !== day) Object.assign(usage, { day, dayCount: 0 });
  if (usage.month !== month) Object.assign(usage, { month, monthCount: 0 });
  if (Date.now() < usage.blockedUntil) return false;
  return usage.dayCount < DAILY_CAP && usage.monthCount < MONTHLY_CAP;
}

const norm = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 200);

export async function tavilySearch(
  query: string,
  opts: { fresh?: boolean; max?: number; ms?: number } = {},
): Promise<Finding[]> {
  const q = norm(query);
  if (q.length < 3) return [];
  const key = `${q}|${opts.fresh ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.rows;

  const apiKey = await getSecret("TAVILY_API_KEY");
  if (!apiKey || !allow()) return [];
  usage.dayCount++;
  usage.monthCount++;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.ms ?? 6_000);
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        query: query.slice(0, 380),
        search_depth: "basic",
        topic: opts.fresh ? "news" : "general",
        ...(opts.fresh ? { time_range: "week" } : {}),
        max_results: opts.max ?? 6,
        include_answer: true,
      }),
    });
    if (res.status === 401 || res.status === 429 || res.status === 432 || res.status === 433) {
      usage.blockedUntil = Date.now() + 12 * 60 * 60_000;
      return [];
    }
    if (!res.ok) return [];
    const json = (await res.json()) as {
      answer?: string;
      results?: { title?: string; url?: string; content?: string; published_date?: string }[];
    };
    const rows: Finding[] = (json.results ?? [])
      .filter((r) => r.title && r.url)
      .map((r) => {
        const y = Number((r.published_date ?? "").slice(0, 4));
        return {
          title: r.title!.slice(0, 200),
          url: r.url!,
          snippet: (r.content ?? "").slice(0, 400),
          source: "Tavily",
          ...(y > 2000 ? { year: y } : {}),
        };
      });
    if (json.answer && rows[0]) rows[0].snippet = `${json.answer.slice(0, 300)} — ${rows[0].snippet}`;
    cache.set(key, { at: Date.now(), rows });
    return rows;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
