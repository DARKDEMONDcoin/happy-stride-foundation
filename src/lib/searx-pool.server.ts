/**
 * مجمّع SearXNG الديناميكي — أقوى مصدر بحث حي مجاني ومفتوح المصدر لنور.
 *
 * بدل قائمة ثابتة من 3–5 نسخ (تُحجب أو تُغلق JSON فتعود النتائج فارغة)، نكتشف
 * كل النسخ العامة من سجل searx.space (AGPL، مفتوح المصدر)، نجرّب دفعة منها
 * بالتوازي بصيغة JSON، ونرفع النسخ الناجحة إلى مقدمة الطابور للطلبات التالية.
 */

export type SearxRow = { title: string; url: string; snippet: string };

const REGISTRY = "https://searx.space/data/instances.json";

/** نسخ احتياطية تُستخدم لو تعذّر الوصول لسجل searx.space. */
const SEED = [
  "https://sx.xo.st",
  "https://search.mectov.my.id",
  "https://search.lumy.live",
  "https://search.inetol.net",
  "https://searx.tiekoetter.com",
  "https://searx.be",
  "https://paulgo.io",
  "https://baresearch.org",
  "https://priv.au",
];

const REGISTRY_TTL_MS = 6 * 60 * 60 * 1000;
let registry: string[] = [];
let registryAt = 0;
let registryInFlight: Promise<string[]> | null = null;

/** النسخ التي ردّت بنتائج فعلية مؤخراً — تُجرَّب أولاً. */
const proven: string[] = [];
/** النسخ التي فشلت مؤخراً — تُؤجَّل لمدة ساعة بدل استهلاك الوقت عليها. */
const failedAt = new Map<string, number>();
const FAIL_TTL_MS = 60 * 60 * 1000;

const AGENTS = [
  "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
];
let agent = 0;

async function loadRegistry(): Promise<string[]> {
  if (registry.length && Date.now() - registryAt < REGISTRY_TTL_MS) return registry;
  if (registryInFlight) return registryInFlight;

  registryInFlight = (async () => {
    try {
      const res = await fetch(REGISTRY, {
        headers: { "User-Agent": AGENTS[0]!, Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as {
        instances?: Record<string, { network_type?: string; http?: { status_code?: number } }>;
      };
      const urls = Object.entries(json.instances ?? [])
        .filter(([, v]) => (v.network_type ?? "normal") === "normal" && v.http?.status_code === 200)
        .map(([u]) => u.replace(/\/$/, ""));
      if (urls.length) {
        registry = urls;
        registryAt = Date.now();
      }
    } catch {
      // السجل اختياري — نكمل بالنسخ الاحتياطية
    } finally {
      registryInFlight = null;
    }
    return registry.length ? registry : SEED;
  })();

  return registryInFlight;
}

function shuffle<T>(list: T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

async function askInstance(base: string, query: string, ms: number): Promise<SearxRow[]> {
  const url = `${base}/search?q=${encodeURIComponent(query)}&format=json&language=ar&safesearch=0`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": AGENTS[agent++ % AGENTS.length]!,
      Accept: "application/json",
      "Accept-Language": "ar,en;q=0.8",
    },
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`${base} ${res.status}`);
  const json = (await res.json()) as {
    results?: { title?: string; url?: string; content?: string }[];
  };
  const rows = (json.results ?? [])
    .filter((r) => r.url && r.title)
    .map((r) => ({
      title: r.title!.slice(0, 200),
      url: r.url!,
      snippet: (r.content ?? "").slice(0, 300),
    }));
  if (!rows.length) throw new Error(`${base} empty`);
  return rows;
}

/**
 * بحث عبر مجمّع SearXNG: يجرّب دفعتين من النسخ بالتوازي وأول نتيجة حقيقية تفوز.
 * يعيد قائمة فارغة إن رفضت كل النسخ — بلا اختلاق نتائج.
 */
export async function searxPoolSearch(query: string, budgetMs = 11_000): Promise<SearxRow[]> {
  const all = await loadRegistry();
  const now = Date.now();
  const fresh = (u: string) => now - (failedAt.get(u) ?? 0) > FAIL_TTL_MS;

  const candidates = [
    ...proven.filter(fresh),
    ...shuffle(all.filter((u) => !proven.includes(u) && fresh(u))),
    ...shuffle(all.filter((u) => !fresh(u))),
  ];

  const started = Date.now();
  const batchSize = 10;

  for (let i = 0; i < candidates.length; i += batchSize) {
    const left = budgetMs - (Date.now() - started);
    if (left < 2_500) break;
    const batch = candidates.slice(i, i + batchSize);
    const tries = batch.map(async (base) => {
      try {
        const rows = await askInstance(base, query, Math.min(left, 9_000));
        if (!proven.includes(base)) proven.unshift(base);
        if (proven.length > 8) proven.length = 8;
        failedAt.delete(base);
        return rows;
      } catch (error) {
        failedAt.set(base, Date.now());
        const idx = proven.indexOf(base);
        if (idx >= 0) proven.splice(idx, 1);
        throw error;
      }
    });
    try {
      return await Promise.any(tries);
    } catch {
      // الدفعة كلها فشلت — ننتقل للتالية ضمن الميزانية
    }
  }
  return [];
}

/** بحث ويكيبيديا العربية: مصدر حقيقي مستقر يُستخدم كملاذ أخير لا كبديل مختلق. */
export async function wikipediaSearch(query: string): Promise<SearxRow[]> {
  try {
    const url = `https://ar.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query,
    )}&srlimit=8&format=json&origin=*`;
    const res = await fetch(url, {
      headers: { "User-Agent": AGENTS[0]!, Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      query?: { search?: { title?: string; snippet?: string }[] };
    };
    return (json.query?.search ?? [])
      .filter((r) => r.title)
      .map((r) => ({
        title: r.title!,
        url: `https://ar.wikipedia.org/wiki/${encodeURIComponent(r.title!.replace(/ /g, "_"))}`,
        snippet: (r.snippet ?? "").replace(/<[^>]+>/g, "").slice(0, 300),
      }));
  } catch {
    return [];
  }
}
