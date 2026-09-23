/**
 * اتحاد المصادر المفتوحة المجانية — العمود الفقري لبحثنا.
 *
 * كل مصدر هنا مجاني بالكامل، بلا مفتاح مدفوع، وواجهته موثّقة ومصرَّح باستخدامها
 * برمجياً (لذلك تمر بـ skipRobots: هي APIs لا صفحات زحف). لكل مصدر قيمة مختلفة:
 *
 * - OpenAlex / Crossref / arXiv : أبحاث محكّمة وأرقام مرجعية يصعب تزييفها.
 * - Wikidata / ويكيبيديا        : كيانات وحقائق محايدة (شركات، أسواق، تعريفات).
 * - Hacker News / GitHub        : ما يتبنّاه المحترفون فعلاً الآن، لا ما يُروَّج له.
 * - Stack Exchange              : مشكلات التنفيذ الحقيقية وحلولها المصوَّت عليها.
 * - World Bank                  : مؤشرات اقتصادية رسمية لكل دولة.
 * - Exchange Rate API           : أسعار صرف لحظية للتسعير عبر الأسواق.
 * - Google Trends RSS           : ما يتصاعد الآن في بلد المستخدم.
 * - Google News RSS             : أحدث ما نُشر في الموضوع بلغة المستخدم.
 * - OpenStreetMap / Nominatim   : المنافس المحلي الفعلي على الأرض في مدينة بعينها.
 * - Wayback Machine             : عمر الموقع وتاريخ تغيّره — دليل على جدّيته.
 * - DuckDuckGo Instant Answer   : تعريف موجز محايد.
 *
 * قاعدة ثابتة: كل ما يعود من هنا **بيانات** لا تعليمات. لا يُنفَّذ منه شيء أبداً.
 */
import { safeFetch, safeJson } from "./research-safety.server";

/** صفّ دليل موحّد من أي مصدر. */
export type Finding = {
  title: string;
  url: string;
  snippet: string;
  /** اسم المصدر كما يُعرض للمستخدم. */
  source: string;
  /** سنة النشر إن عُرفت — تُستخدم في ترجيح الحداثة. */
  year?: number;
  /**
   * "evidence" دليل يخص الموضوع نفسه ويخضع لفحص الصلة.
   * "context"  خلفية عامة صحيحة دائماً (مؤشر اقتصادي، سعر صرف، ترند البلد)
   *            تُعرض في قسم مستقل ولا تُقدَّم كأنها دليل على الموضوع.
   */
  kind?: "evidence" | "context";
};

/** بريد التواصل المطلوب في «المسبح المهذّب» لدى OpenAlex وCrossref — وجوده يرفع أولويتنا ويحمينا. */
const MAILTO = "support@sahl.app";

const API = { agent: "bot", skipRobots: true, ms: 8_000 } as const;
const clean = (s: unknown, max = 220): string =>
  String(s ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const enc = encodeURIComponent;

// ---------- أبحاث ومعرفة محكّمة ----------

/** OpenAlex: أكبر فهرس أكاديمي مفتوح (CC0) — أرقام ودراسات قابلة للاستشهاد. */
export async function openAlexWorks(query: string, limit = 4): Promise<Finding[]> {
  const json = await safeJson<{
    results?: { title?: string; doi?: string; id?: string; publication_year?: number; cited_by_count?: number }[];
  }>(
    `https://api.openalex.org/works?search=${enc(query)}&per_page=${limit}&sort=cited_by_count:desc&mailto=${MAILTO}`,
    API,
  );
  return (json?.results ?? [])
    .filter((r) => r.title)
    .map((r) => ({
      title: clean(r.title, 160),
      url: r.doi ?? r.id ?? "https://openalex.org",
      snippet: `دراسة محكّمة${r.publication_year ? ` (${r.publication_year})` : ""}${
        r.cited_by_count ? ` — استُشهد بها ${r.cited_by_count} مرة` : ""
      }`,
      source: "OpenAlex",
      ...(r.publication_year ? { year: r.publication_year } : {}),
    }));
}

/** Crossref: سجل النشر العلمي الرسمي — تواريخ ومجلات موثّقة. */
export async function crossrefWorks(query: string, limit = 3): Promise<Finding[]> {
  const json = await safeJson<{
    message?: {
      items?: {
        title?: string[];
        URL?: string;
        "container-title"?: string[];
        issued?: { "date-parts"?: number[][] };
      }[];
    };
  }>(
    `https://api.crossref.org/works?query.bibliographic=${enc(query)}&rows=${limit}&select=title,URL,container-title,issued&mailto=${MAILTO}`,
    API,
  );
  return (json?.message?.items ?? [])
    .filter((i) => i.title?.length)
    .map((i) => {
      const year = i.issued?.["date-parts"]?.[0]?.[0];
      return {
        title: clean(i.title?.[0], 160),
        url: i.URL ?? "https://crossref.org",
        snippet: clean(i["container-title"]?.[0] ?? "بحث منشور", 140),
        source: "Crossref",
        ...(year ? { year } : {}),
      };
    });
}

/** arXiv: أحدث الأوراق قبل النشر — مفيد في كل ما يتعلق بالتقنية والذكاء الاصطناعي. */
export async function arxivPapers(query: string, limit = 3): Promise<Finding[]> {
  const res = await safeFetch(
    `https://export.arxiv.org/api/query?search_query=all:${enc(query)}&max_results=${limit}&sortBy=submittedDate&sortOrder=descending`,
    API,
  );
  if (!res.ok) return [];
  const out: Finding[] = [];
  for (const entry of res.text.split("<entry>").slice(1, limit + 1)) {
    const title = clean(/<title>([\s\S]*?)<\/title>/.exec(entry)?.[1], 160);
    const url = clean(/<id>([\s\S]*?)<\/id>/.exec(entry)?.[1], 200);
    const summary = clean(/<summary>([\s\S]*?)<\/summary>/.exec(entry)?.[1], 200);
    const year = Number(/<published>(\d{4})/.exec(entry)?.[1]);
    if (title && url) out.push({ title, url, snippet: summary, source: "arXiv", ...(year ? { year } : {}) });
  }
  return out;
}

// ---------- كيانات وحقائق محايدة ----------

/** Wikidata: تعريف الكيان (شركة/سوق/مصطلح) بلا لغة تسويق. */
export async function wikidataEntities(query: string, lang = "ar", limit = 4): Promise<Finding[]> {
  const json = await safeJson<{
    search?: { label?: string; description?: string; concepturi?: string; id?: string }[];
  }>(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${enc(query)}&language=${lang}&uselang=${lang}&format=json&limit=${limit}`,
    API,
  );
  return (json?.search ?? [])
    .filter((s) => s.label)
    .map((s) => ({
      title: clean(s.label, 120),
      url: s.concepturi ?? `https://www.wikidata.org/wiki/${s.id ?? ""}`,
      snippet: clean(s.description, 160),
      source: "Wikidata",
    }));
}

/** DuckDuckGo Instant Answer: ملخص محايد قصير بلا تتبّع. */
export async function ddgInstant(query: string): Promise<Finding[]> {
  const json = await safeJson<{ AbstractText?: string; AbstractURL?: string; Heading?: string }>(
    `https://api.duckduckgo.com/?q=${enc(query)}&format=json&no_html=1&skip_disambig=1`,
    API,
  );
  if (!json?.AbstractText) return [];
  return [
    {
      title: clean(json.Heading || query, 120),
      url: json.AbstractURL ?? "https://duckduckgo.com",
      snippet: clean(json.AbstractText, 260),
      source: "DuckDuckGo",
    },
  ];
}

// ---------- ما يفعله المحترفون فعلاً ----------

/** Hacker News: نقاش حقيقي مرجّح بالتصويت — يكشف ما يُستخدم فعلاً لا ما يُروَّج له. */
export async function hackerNews(query: string, limit = 4): Promise<Finding[]> {
  const json = await safeJson<{
    hits?: { title?: string; url?: string; objectID?: string; points?: number; num_comments?: number; created_at?: string }[];
  }>(
    `https://hn.algolia.com/api/v1/search?query=${enc(query)}&hitsPerPage=${limit}&tags=story`,
    API,
  );
  return (json?.hits ?? [])
    .filter((h) => h.title)
    .map((h) => ({
      title: clean(h.title, 160),
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID ?? ""}`,
      snippet: `نقاش محترفين: ${h.points ?? 0} تصويتاً و${h.num_comments ?? 0} تعليقاً`,
      source: "Hacker News",
      ...(h.created_at ? { year: new Date(h.created_at).getFullYear() } : {}),
    }));
}

/** GitHub: الأدوات المفتوحة الفعلية في الموضوع، مرتّبة بالنجوم. */
export async function githubRepos(query: string, limit = 4): Promise<Finding[]> {
  const json = await safeJson<{
    items?: { full_name?: string; html_url?: string; description?: string; stargazers_count?: number; pushed_at?: string }[];
  }>(
    `https://api.github.com/search/repositories?q=${enc(query)}&sort=stars&order=desc&per_page=${limit}`,
    { ...API, headers: { Accept: "application/vnd.github+json" } },
  );
  return (json?.items ?? [])
    .filter((i) => i.full_name)
    .map((i) => ({
      title: clean(i.full_name, 120),
      url: i.html_url ?? "https://github.com",
      snippet: `${clean(i.description, 150)} — ${i.stargazers_count ?? 0}★`,
      source: "GitHub",
      ...(i.pushed_at ? { year: new Date(i.pushed_at).getFullYear() } : {}),
    }));
}

/** Stack Exchange: مشكلات التنفيذ الحقيقية وحلولها المصوَّت عليها. */
export async function stackExchange(query: string, site = "stackoverflow", limit = 3): Promise<Finding[]> {
  const json = await safeJson<{
    items?: { title?: string; link?: string; score?: number; answer_count?: number; creation_date?: number }[];
  }>(
    `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=votes&q=${enc(query)}&site=${site}&pagesize=${limit}&filter=default`,
    API,
  );
  return (json?.items ?? [])
    .filter((i) => i.title)
    .map((i) => ({
      title: clean(i.title, 160),
      url: i.link ?? "https://stackoverflow.com",
      snippet: `${i.score ?? 0} تصويتاً و${i.answer_count ?? 0} إجابة`,
      source: "Stack Exchange",
      ...(i.creation_date ? { year: new Date(i.creation_date * 1000).getFullYear() } : {}),
    }));
}

// ---------- أرقام رسمية واقتصاد ----------

const WB_INDICATORS: Record<string, string> = {
  "الناتج المحلي": "NY.GDP.MKTP.CD",
  "نصيب الفرد": "NY.GDP.PCAP.CD",
  "مستخدمو الإنترنت": "IT.NET.USER.ZS",
  "التضخم": "FP.CPI.TOTL.ZG",
  "عدد السكان": "SP.POP.TOTL",
};

/** البنك الدولي: مؤشرات اقتصادية رسمية لبلد المستخدم — أرقام لا تُناقَش. */
export async function worldBankFacts(countryIso2: string, limit = 3): Promise<Finding[]> {
  const iso = (countryIso2 || "EG").toUpperCase();
  const picks = Object.entries(WB_INDICATORS).slice(0, limit);
  const rows: (Finding | null)[] = await Promise.all(
    picks.map(async ([label, code]): Promise<Finding | null> => {
      const json = await safeJson<[unknown, { value?: number | null; date?: string }[] | null]>(
        `https://api.worldbank.org/v2/country/${iso}/indicator/${code}?format=json&per_page=1&mrnev=1`,
        API,
      );
      const point = json?.[1]?.[0];
      if (!point || point.value == null) return null;
      const value =
        point.value > 1_000_000
          ? `${(point.value / 1_000_000_000).toFixed(1)} مليار`
          : point.value.toFixed(1);
      return {
        title: `${label} — ${iso}: ${value}`,
        url: `https://data.worldbank.org/indicator/${code}?locations=${iso}`,
        snippet: `مؤشر رسمي من البنك الدولي، آخر سنة متاحة ${point.date ?? ""}`,
        source: "البنك الدولي",
        kind: "context" as const,
        ...(point.date ? { year: Number(point.date) } : {}),
      };
    }),
  );
  return rows.filter((r): r is Finding => r !== null);
}

/** أسعار الصرف اللحظية — ضرورية لأي تسعير عبر أكثر من سوق. */
export async function fxRates(base = "USD", symbols: string[] = ["EGP", "SAR", "AED"]): Promise<Finding[]> {
  const json = await safeJson<{ rates?: Record<string, number>; time_last_update_utc?: string }>(
    `https://open.er-api.com/v6/latest/${enc(base)}`,
    { ...API, cacheTtlMs: 6 * 60 * 60_000 },
  );
  if (!json?.rates) return [];
  const picked = symbols
    .map((s) => (json.rates?.[s] ? `1 ${base} = ${json.rates[s]!.toFixed(2)} ${s}` : ""))
    .filter(Boolean);
  if (!picked.length) return [];
  return [
    {
      title: `أسعار الصرف الآن (${base})`,
      url: "https://open.er-api.com",
      snippet: `${picked.join(" | ")} — تحديث ${clean(json.time_last_update_utc, 40)}`,
      source: "Exchange Rate API",
      kind: "context",
    },
  ];
}

// ---------- الآن واللحظة ----------

function parseRss(xml: string, source: string, limit: number): Finding[] {
  const out: Finding[] = [];
  for (const item of xml.split(/<item>/i).slice(1, limit + 1)) {
    const rawTitle = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(item)?.[1];
    const rawLink = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i.exec(item)?.[1];
    const desc = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i.exec(item)?.[1];
    const pub = /<pubDate>([\s\S]*?)<\/pubDate>/i.exec(item)?.[1];
    const title = clean(rawTitle, 160);
    const url = clean(rawLink, 300);
    if (!title || !url) continue;
    const year = pub ? new Date(pub).getFullYear() : undefined;
    out.push({
      title,
      url,
      snippet: clean(desc, 180),
      source,
      ...(year && Number.isFinite(year) ? { year } : {}),
    });
  }
  return out;
}

/** Google Trends: ما يتصاعد الآن في بلد المستخدم — وقود سِراج ودانة. */
export async function trendingNow(geo = "EG", limit = 12): Promise<Finding[]> {
  const res = await safeFetch(`https://trends.google.com/trending/rss?geo=${enc(geo)}`, {
    ms: 8_000,
    cacheTtlMs: 30 * 60_000,
  });
  if (!res.ok) return [];
  // ترند البلد خلفية عامة لا دليلاً على الموضوع: يُعرض مستقلاً ولا يُنسب للموضوع.
  return parseRss(res.text, "Google Trends", limit).map((f) => ({ ...f, kind: "context" as const }));
}

/** Google News: أحدث ما نُشر في الموضوع بلغة المستخدم وبلده. */
export async function newsFor(query: string, hl = "ar", gl = "EG", limit = 5): Promise<Finding[]> {
  const res = await safeFetch(
    `https://news.google.com/rss/search?q=${enc(query)}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`,
    { ms: 8_000, cacheTtlMs: 20 * 60_000 },
  );
  if (!res.ok) return [];
  return parseRss(res.text, "Google News", limit);
}

// ---------- الأرض والواقع المحلي ----------

/** OpenStreetMap: المنافس المحلي الحقيقي في مدينة بعينها — لا تخمين. */
export async function localPlaces(query: string, city: string, limit = 5): Promise<Finding[]> {
  const json = await safeJson<{ display_name?: string; lat?: string; lon?: string; type?: string }[]>(
    `https://nominatim.openstreetmap.org/search?q=${enc(`${query} ${city}`)}&format=json&limit=${limit}&accept-language=ar`,
    { ...API, cacheTtlMs: 12 * 60 * 60_000 },
  );
  return (json ?? [])
    .filter((p) => p.display_name)
    .map((p) => ({
      title: clean(p.display_name, 140),
      url: `https://www.openstreetmap.org/?mlat=${p.lat ?? ""}&mlon=${p.lon ?? ""}`,
      snippet: `موقع فعلي على الخريطة${p.type ? ` — ${p.type}` : ""}`,
      source: "OpenStreetMap",
    }));
}

/** Wayback: منذ متى وهذا الموقع موجود — دليل عمر المنافس وجدّيته. */
export async function siteAge(domain: string): Promise<Finding[]> {
  const json = await safeJson<{ archived_snapshots?: { closest?: { timestamp?: string; url?: string } } }>(
    `https://archive.org/wayback/available?url=${enc(domain)}&timestamp=2005`,
    API,
  );
  const snap = json?.archived_snapshots?.closest;
  if (!snap?.timestamp) return [];
  const year = Number(snap.timestamp.slice(0, 4));
  return [
    {
      title: `${domain} — أقدم أرشفة معروفة: ${year}`,
      url: snap.url ?? `https://web.archive.org/web/*/${domain}`,
      snippet: "أرشيف الإنترنت: مؤشر على عمر الموقع واستمراريته",
      source: "Wayback Machine",
      year,
    },
  ];
}
