/**
 * Tavily — محرك بحث مدفوع الجودة على الباقة المجانية (1000 طلب/شهر).
 *
 * المنطق: Tavily «الاحتياطي الذكي» لا المصدر الأول. المصادر المجانية تعمل دائماً،
 * ويُستدعى Tavily فقط حين يستحق السؤال ذلك:
 *  - الأدلة المجانية ضعيفة (قليلة أو بلا تأكيد)، أو
 *  - السؤال لحظي/مالي (أخبار، أسعار، ترند) حيث المصادر المجانية أضعف ما تكون.
 * مع حمايات الحصة: سقف يومي (~30)، ذاكرة 6 ساعات لنفس الاستعلام، ودمج الطلبات
 * المتزامنة لنفس الاستعلام، وبحث basic فقط (رصيد واحد لكل طلب).
 */
import type { Finding } from "./open-data.server";

const DAILY_CAP = 30; // 30 × 31 ≈ 930 < 1000 — هامش أمان للشهر كله.
const CACHE_TTL = 6 * 60 * 60_000;

const cache = new Map<string, { at: number; rows: Finding[] }>();
const inflight = new Map<string, Promise<Finding[]>>();
let day = "";
let used = 0;

export function tavilyAvailable(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    used = 0;
  }
  return !!process.env["TAVILY_API_KEY"] && used < DAILY_CAP;
}

export async function tavilySearch(
  query: string,
  opts: {
    news?: boolean;
    topic?: "general" | "news" | "finance";
    timeRange?: "day" | "week" | "month" | "year" | undefined;
    country?: string | undefined;
    max?: number;
    timeoutMs?: number;
  } = {},
): Promise<Finding[]> {
  const q = query.trim().replace(/\s+/g, " ").slice(0, 380);
  if (q.length < 3) return [];
  const topic = opts.topic ?? (opts.news ? "news" : "general");
  const key = `${topic}|${opts.timeRange ?? ""}|${opts.country ?? ""}|${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.rows;
  const running = inflight.get(key);
  if (running) return running;
  if (!tavilyAvailable()) return [];

  const apiKey = process.env["TAVILY_API_KEY"]!;
  used++;
  const COUNTRIES: Record<string, string> = { EG: "egypt", SA: "saudi arabia", AE: "united arab emirates", KW: "kuwait", QA: "qatar", JO: "jordan", MA: "morocco", US: "united states", GB: "united kingdom" };
  const country = topic === "general" && opts.country ? COUNTRIES[opts.country.toUpperCase()] : undefined;
  const job = (async () => {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          query: q,
          search_depth: "basic",
          topic,
          ...(opts.timeRange ? { time_range: opts.timeRange } : {}),
          ...(country ? { country } : {}),
          max_results: opts.max ?? 6,
          include_answer: false,
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 7_000),
      });
      if (!res.ok) {
        // الحصة نفدت أو المفتاح مرفوض: نوقف الاستدعاء لبقية اليوم بدل الإلحاح.
        if (res.status === 401 || res.status === 429 || res.status === 432) used = DAILY_CAP;
        return [];
      }
      const data = (await res.json()) as {
        results?: { title?: string; url?: string; content?: string; published_date?: string }[];
      };
      const rows: Finding[] = (data.results ?? [])
        .filter((r) => r.url && r.title)
        .map((r) => ({
          title: String(r.title).slice(0, 160),
          url: String(r.url),
          snippet: String(r.content ?? "").slice(0, 400),
          source: "Tavily",
        }));
      cache.set(key, { at: Date.now(), rows });
      return rows;
    } catch {
      return [];
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, job);
  return job;
}
