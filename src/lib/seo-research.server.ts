/**
 * مصادر بحث مجانية بالكامل (بدون أي مفاتيح مدفوعة):
 * - اقتراحات جوجل/بينج: أسئلة وكلمات يبحث عنها الناس فعلاً.
 * - نتائج DuckDuckGo HTML: عناوين ووصف الصفحات المنافسة الحقيقية.
 * - قارئ صفحات: عنوان/وصف/عناوين فرعية/عدد كلمات لأي رابط.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const timeout = (ms: number) => AbortSignal.timeout(ms);

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x?([0-9a-f]+);/gi, (_m, code: string) =>
      String.fromCharCode(/^x/i.test(_m.slice(2, 3)) ? parseInt(code, 16) : Number(code)),
    );
}

const strip = (html: string) =>
  decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

/** اقتراحات بحث حقيقية من جوجل (مجاني، بلا مفتاح). */
export async function googleSuggest(query: string, hl = "ar", gl = "sa"): Promise<string[]> {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=${hl}&gl=${gl}&q=${encodeURIComponent(query)}`;
    const { safeJson } = await import("./research-safety.server");
    const data = await safeJson<[string, string[]]>(url, { ms: 8000, cacheTtlMs: 60 * 60_000 });
    return (data?.[1] ?? []).slice(0, 12);
  } catch {
    return [];
  }
}

/** اقتراحات بينج كمصدر مكمّل (مجاني، بلا مفتاح). */
export async function bingSuggest(query: string, market = "ar-SA"): Promise<string[]> {
  try {
    const url = `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}&market=${market}`;
    const { safeJson } = await import("./research-safety.server");
    const data = await safeJson<[string, string[]]>(url, { ms: 8000, cacheTtlMs: 60 * 60_000 });
    return (data?.[1] ?? []).slice(0, 10);
  } catch {
    return [];
  }
}

export type KeywordExpansion = {
  seed: string;
  suggestions: string[];
  informational: string[];
  commercial: string[];
  transactional: string[];
  local: string[];
};

/**
 * توسيع الكلمة المفتاحية من اقتراحات Google/Bing الحقيقية، مع تصنيف النية:
 * معلوماتية / مقارنة / شرائية / محلية — مجاني بالكامل.
 */
export async function keywordExpansion(seed: string): Promise<KeywordExpansion> {
  const prefixes = ["طريقة", "أفضل", "سعر", "كم سعر", "شركة", "مقارنة", "أرخص", "هل يجوز"];
  const suffixes = ["", " ", " في", " بال"];
  const batches = await Promise.all([
    googleSuggest(seed),
    bingSuggest(seed),
    ...prefixes.map((p) => googleSuggest(`${p} ${seed}`)),
    ...suffixes.map((s) => googleSuggest(`${seed}${s}`)),
  ]);

  const unique = Array.from(
    new Set(
      batches
        .flat()
        .map((s) => s.replace(/\s+/g, " ").trim())
        .filter((s) => s.length > 2),
    ),
  );

  const has = (s: string, words: string[]) => words.some((w) => s.includes(w));
  const informational = unique.filter((s) =>
    has(s, ["كيف", "طريقة", "ما هو", "ماهو", "لماذا", "هل", "خطوات", "فوائد", "أضرار", "معنى"]),
  );
  const commercial = unique.filter(
    (s) =>
      !informational.includes(s) &&
      has(s, ["أفضل", "افضل", "مقارنة", "مقابل", "أم", "تقييم", "مراجعة"]),
  );
  const transactional = unique.filter(
    (s) =>
      !informational.includes(s) &&
      !commercial.includes(s) &&
      has(s, [
        "سعر",
        "أسعار",
        "اسعار",
        "كم",
        "شراء",
        "أرخص",
        "ارخص",
        "عرض",
        "خصم",
        "شركة",
        "رقم",
        "حجز",
      ]),
  );
  const local = unique.filter((s) =>
    has(s, [
      "الرياض",
      "جدة",
      "مكة",
      "المدينة",
      "الدمام",
      "الخبر",
      "القاهرة",
      "الإسكندرية",
      "دبي",
      "أبوظبي",
      "الكويت",
      "الدوحة",
      "مسقط",
      "المنامة",
      "عمان",
      "قريب",
      "قرب",
    ]),
  );

  return {
    seed,
    suggestions: unique.slice(0, 40),
    informational: informational.slice(0, 15),
    commercial: commercial.slice(0, 15),
    transactional: transactional.slice(0, 15),
    local: local.slice(0, 15),
  };
}

export type SerpResult = { rank: number; title: string; url: string; snippet: string };

/** بصمات متصفح متعددة: تقلّل حجب محركات البحث المجانية عند تتابع الطلبات. */
const AGENTS = [
  UA,
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
];
let agentIndex = 0;

/**
 * كل جلب خارجي في هذا الملف يمر عبر طبقة أمان البحث: تهدئة لكل مضيف، سقف تزامن،
 * قاطع دائرة يغلق أي محرك يرفضنا (429/403) بدل الإلحاح عليه، واحترام Retry-After.
 * هذه هي الحماية التي تمنع الحظر الدائم لمحركات السكرابينج (Brave/Bing/Startpage…).
 */
async function getText(url: string, ms = 7_000): Promise<string> {
  const { safeFetch } = await import("./research-safety.server");
  const r = await safeFetch(url, {
    ms,
    // صفحات نتائج البحث تُخزَّن ربع ساعة: يقلّل الضغط على المحرك ويسرّع الرد.
    cacheTtlMs: 15 * 60_000,
    headers: { Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8" },
  });
  return r.ok ? r.text : "";
}

/**
 * نتائج بحث عامة (أفضل جهد) من مصادر مجانية بلا مفاتيح.
 * إن رفضت كل المصادر الطلب تُعيد قائمة فارغة، وتعتمد نور على المصادر الأخرى بدل اختلاق نتائج.
 */
const serpCache = new Map<string, SerpResult[]>();
let serpQueue: Promise<unknown> = Promise.resolve();

/** طابور تسلسلي مع تباعد زمني: يمنع رفض محركات البحث للطلبات المتوازية. */
function queued<T>(fn: () => Promise<T>, spacingMs = 250): Promise<T> {
  const run = serpQueue.then(async () => {
    const value = await fn();
    await new Promise((r) => setTimeout(r, spacingMs));
    return value;
  });
  serpQueue = run.catch(() => undefined);
  return run;
}

/** مدة صلاحية نتائج البحث المحفوظة: يوم واحد (يخفّف الضغط ويمنع الحجب 429). */
const SERP_TTL_MS = 24 * 60 * 60 * 1000;

async function serpFromDb(query: string): Promise<SerpResult[] | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("serp_cache")
      .select("payload, created_at")
      .eq("cache_key", `serp:${query}`)
      .maybeSingle();
    if (!data) return null;
    if (Date.now() - new Date(data.created_at).getTime() > SERP_TTL_MS) return null;
    const payload = data.payload as { results?: SerpResult[] } | null;
    return payload?.results?.length ? payload.results : null;
  } catch {
    return null;
  }
}

async function serpToDb(query: string, results: SerpResult[]): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("serp_cache").upsert(
      {
        cache_key: `serp:${query}`,
        payload: { results } as unknown as never,
        created_at: new Date().toISOString(),
      },
      { onConflict: "cache_key" },
    );
  } catch {
    // التخزين المؤقت اختياري — لا يعطّل البحث
  }
}

export async function serpSearch(query: string): Promise<SerpResult[]> {
  const cached = serpCache.get(query);
  if (cached) return cached;

  const stored = await serpFromDb(query);
  if (stored) {
    serpCache.set(query, stored);
    return stored;
  }

  // تحت الضغط المتوازي تخنق المحركات المجانية الطلبات وترجع صفراً؛ نعيد المحاولة
  // مرتين بتباعد متزايد حتى لا يعود بحث حقيقي فارغاً بسبب اختناق لحظي.
  let results = await queued(() => serpSearchOnce(query, false), 250);
  for (let attempt = 0; !results.length && attempt < 2; attempt++) {
    await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
    // المحاولة الأخيرة فقط تسمح بالملاذ الأخير (ويكيبيديا) حتى لا يطغى على نتائج الويب.
    results = await queued(() => serpSearchOnce(query, attempt === 1), 250);
  }
  if (results.length) {
    serpCache.set(query, results);
    await serpToDb(query, results);
  }
  return results;
}

/**
 * مستخرج روابط عام يُستخدم كشبكة أمان عندما يتغيّر HTML المحرك ويفشل التعبير الخاص،
 * فيبقى البحث الحقيقي يعمل بدل أن يعود فارغاً.
 */
/** يفكّ روابط تحويل Bing (‎/ck/a?…u=a1<base64>) إلى الرابط الحقيقي. */
function unwrapRedirect(url: string): string {
  const enc = /[?&]u=a1([A-Za-z0-9_-]+)/.exec(url);
  if (!enc?.[1]) return url;
  try {
    const decoded = Buffer.from(enc[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    );
    return /^https?:\/\//.test(decoded) ? decoded : url;
  } catch {
    return url;
  }
}

function genericLinks(html: string, excludeHosts: string[]): SerpResult[] {
  const out: SerpResult[] = [];
  const seen = new Set<string>();
  const rx = /<a[^>]+href="(https?:\/\/[^"#]+)"[^>]*>([\s\S]{0,400}?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(html)) && out.length < 12) {
    const href = decodeEntities(m[1] ?? "");
    const title = strip(decodeEntities(m[2] ?? "")).slice(0, 200);
    if (title.length < 12) continue;
    let host = "";
    try {
      host = new URL(href).hostname;
    } catch {
      continue;
    }
    if (excludeHosts.some((h) => host === h || host.endsWith(`.${h}`))) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    out.push({ rank: out.length + 1, title, url: href, snippet: "" });
  }
  return out;
}

async function serpSearchOnce(query: string, allowWiki = true): Promise<SerpResult[]> {
  const attempts: (() => Promise<SerpResult[]>)[] = [
    // 0) مجمّع SearXNG الديناميكي (عشرات النسخ المفتوحة بدل قائمة ثابتة)
    async () => {
      const { searxPoolSearch } = await import("./searx-pool.server");
      const rows = await searxPoolSearch(query);
      return rows.map((r, i) => ({ rank: i + 1, title: r.title, url: r.url, snippet: r.snippet }));
    },
    // 1) Brave Search (نتائج عربية حقيقية بلا مفتاح)
    async () => {
      const html = await getText(
        `https://search.brave.com/search?q=${encodeURIComponent(query)}`,
        7_000,
      );
      const out: SerpResult[] = [];
      const seen = new Set<string>();
      const rx = /<a href="(https?:\/\/[^"]+)"[^>]*>([\s\S]{0,4000}?)<\/a>/g;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(html)) && out.length < 10) {
        const href = decodeEntities(m[1] ?? "");
        const block = m[2] ?? "";
        if (/(^|\.)brave\.com/.test(new URL(href).hostname)) continue;
        const titleMatch =
          /class="title[^"]*"[^>]*>([^<]{3,200})</.exec(block) ??
          /title="([^"]{3,200})"/.exec(block);
        const title = strip(decodeEntities(titleMatch?.[1] ?? ""));
        if (!title) continue;
        const keyUrl = href.split("#")[0]!;
        if (seen.has(keyUrl)) continue;
        seen.add(keyUrl);
        out.push({ rank: out.length + 1, title: title.slice(0, 200), url: keyUrl, snippet: "" });
      }
      return out;
    },
    // 2) SearXNG عام (JSON) — تدوير بين عدة نسخ مجانية مفتوحة المصدر
    async () => {
      const instances = [
        "https://search.inetol.net",
        "https://searx.tiekoetter.com",
        "https://searx.be",
        "https://opnxng.com",
        "https://paulgo.io",
      ];
      for (const base of instances) {
        const raw = await getText(
          `${base}/search?q=${encodeURIComponent(query)}&format=json&language=ar`,
          6_000,
        );
        if (!raw.trim().startsWith("{")) continue;
        try {
          const data = JSON.parse(raw) as {
            results?: { title?: string; url?: string; content?: string }[];
          };
          const rows = (data.results ?? [])
            .filter((r) => r.url && r.title)
            .slice(0, 10)
            .map((r, i) => ({
              rank: i + 1,
              title: strip(r.title ?? "").slice(0, 200),
              url: r.url!,
              snippet: strip(r.content ?? "").slice(0, 300),
            }));
          if (rows.length) return rows;
        } catch {
          continue;
        }
      }
      return [];
    },
    // 3) Bing (روابط مشفّرة base64 داخل روابط التحويل)
    async () => {
      const html = await getText(
        `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=ar`,
        7_000,
      );
      const out: SerpResult[] = [];
      const seen = new Set<string>();
      // نقسّم على بطاقات النتائج بدل تعبير واحد ضخم — أثبت مقاومة لتغيّر قالب Bing.
      const chunks = html.split(/<li class="b_algo"/).slice(1);
      for (const chunk of chunks) {
        if (out.length >= 10) break;
        const h2 = /<h2[^>]*>([\s\S]{0,600}?)<\/h2>/.exec(chunk);
        const title = strip(decodeEntities(h2?.[1] ?? "")).slice(0, 200);
        const enc = /[?&]u=a1([A-Za-z0-9_-]+)/.exec(chunk);
        let href = "";
        if (enc?.[1]) {
          try {
            href = Buffer.from(enc[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
              "utf8",
            );
          } catch {
            href = "";
          }
        }
        if (!href) {
          const direct = /<h2[^>]*>\s*<a[^>]+href="(https?:\/\/[^"]+)"/.exec(chunk);
          href = direct?.[1] ? decodeEntities(direct[1]) : "";
        }
        if (!/^https?:\/\//.test(href) || !title || seen.has(href)) continue;
        seen.add(href);
        out.push({ rank: out.length + 1, title, url: href, snippet: "" });
      }
      return out.length ? out : genericLinks(html, ["bing.com", "microsoft.com", "msn.com"]);
    },
    // 4) Startpage (نتائج جوجل عبر وسيط مجاني)
    async () => {
      const html = await getText(
        `https://www.startpage.com/sp/search?query=${encodeURIComponent(query)}`,
        7_000,
      );
      const out: SerpResult[] = [];
      const seen = new Set<string>();
      const rx =
        /<a[^>]+class="[^"]*result-link[^"]*"[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]{0,600}?)<\/a>/g;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(html)) && out.length < 10) {
        const href = decodeEntities(m[1] ?? "");
        const title = strip(decodeEntities(m[2] ?? "")).slice(0, 200);
        if (!title || seen.has(href)) continue;
        seen.add(href);
        out.push({ rank: out.length + 1, title, url: href, snippet: "" });
      }
      return out.length ? out : genericLinks(html, ["startpage.com", "startmail.com"]);
    },
    // 5) DuckDuckGo Lite
    async () => {
      const html = await getText(
        `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}&kl=xa-ar`,
      );
      const out: SerpResult[] = [];
      const rx = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(html)) && out.length < 10) {
        let href = decodeEntities(m[1] ?? "");
        const uddg = /[?&]uddg=([^&]+)/.exec(href);
        if (uddg?.[1]) href = decodeURIComponent(uddg[1]);
        if (!/^https?:\/\//.test(href)) continue;
        out.push({
          rank: out.length + 1,
          title: strip(m[2] ?? "").slice(0, 200),
          url: href,
          snippet: "",
        });
      }
      return out.length ? out : genericLinks(html, ["duckduckgo.com"]);
    },
    // 6) Mojeek (محرك مستقل يسمح بالقراءة)
    async () => {
      const html = await getText(`https://www.mojeek.com/search?q=${encodeURIComponent(query)}`);
      const out: SerpResult[] = [];
      const rx = /<a[^>]+class="title"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(html)) && out.length < 10) {
        const href = decodeEntities(m[1] ?? "");
        if (!/^https?:\/\//.test(href)) continue;
        out.push({
          rank: out.length + 1,
          title: strip(m[2] ?? "").slice(0, 200),
          url: href,
          snippet: "",
        });
      }
      return out.length ? out : genericLinks(html, ["mojeek.com"]);
    },
    // 7) Marginalia (فهرس مستقل مفتوح المصدر) — احتياطي أخير
    async () => {
      const html = await getText(
        `https://search.marginalia.nu/search?query=${encodeURIComponent(query)}`,
        6_000,
      );
      return genericLinks(html, ["marginalia.nu", "memex.marginalia.nu"]);
    },
  ];

  // فلتر صلة عام: أي نتيجة لا تشترك مع الاستعلام في أي كلمة دالة تُستبعد،
  // لأن بعض المحركات ترد بنتائج مخزَّنة غير مرتبطة عند حجب الطلب.
  // تطبيع عربي (الهمزات/الياء/التاء المربوطة/التشكيل) حتى لا نُسقط نتائج صحيحة بسبب اختلاف الإملاء.
  const norm = (t: string) =>
    t
      .replace(/[\u064B-\u0652\u0640]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .toLowerCase();
  const tokens = query
    .split(/\s+/)
    .map((t) =>
      norm(t)
        .replace(/^(ال|افضل|في|من)/, "")
        .trim(),
    )
    .filter((t) => t.length > 2);
  const relevantOnly = (rows: SerpResult[]) =>
    tokens.length
      ? rows.filter((r) => {
          let url = r.url;
          try {
            url = decodeURIComponent(r.url);
          } catch {
            /* روابط بترميز تالف تُقرأ كما هي */
          }
          const hay = norm(`${r.title} ${url} ${r.snippet}`);
          return tokens.some((t) => hay.includes(t));
        })
      : rows;

  // كل المحركات تعمل بالتوازي وأول نتيجة صالحة تفوز — أسرع بكثير من التجربة بالتتابع.
  const clean = (rows: SerpResult[]) =>
    relevantOnly(rows.map((r) => ({ ...r, url: unwrapRedirect(r.url) }))).map((r, i) => ({
      ...r,
      rank: i + 1,
    }));

  const settled: SerpResult[][] = [];
  const race = attempts.map(async (attempt, i) => {
    try {
      const rows = clean(await attempt());
      if (!rows.length) throw new Error("empty");
      settled.push(rows);
      return rows;
    } catch (error) {
      if (process.env["NOUR_DEBUG_SERP"]) {
        console.error(`serp engine ${i}:`, (error as Error).message);
      }
      throw error;
    }
  });

  /**
   * دمج نتائج عدة محركات بترتيب متبادل (RRF): الرابط الذي يظهر في أكثر من محرك
   * يصعد للأعلى، والمقتطفات تُكمَّل من أي محرك يوفّرها — تغطية أوسع وأدق من
   * الاكتفاء بأول محرك يرد.
   */
  const fuse = (sets: SerpResult[][]): SerpResult[] => {
    const byUrl = new Map<string, { row: SerpResult; score: number; engines: number }>();
    for (const set of sets) {
      for (const [i, row] of set.entries()) {
        const key = row.url.replace(/[#?].*$/, "").replace(/\/$/, "");
        const prev = byUrl.get(key);
        const gain = 1 / (10 + i);
        if (prev) {
          prev.score += gain;
          prev.engines += 1;
          if (!prev.row.snippet && row.snippet) prev.row.snippet = row.snippet;
          if (row.title.length > prev.row.title.length) prev.row.title = row.title;
        } else {
          byUrl.set(key, { row: { ...row }, score: gain, engines: 1 });
        }
      }
    }
    return [...byUrl.values()]
      .sort((a, b) => b.engines - a.engines || b.score - a.score)
      .slice(0, 12)
      .map((v, i) => ({ ...v.row, rank: i + 1 }));
  };

  try {
    const first = await withBudget(Promise.any(race), 13_000, [] as SerpResult[]);
    if (first.length) {
      // نافذة قصيرة نلتقط فيها ما ينهيه بقية المحركات ثم ندمج — بلا تأخير محسوس.
      await withBudget(
        Promise.allSettled(race).then(() => undefined),
        2_500,
        undefined,
      );
      const fused = fuse(settled.length ? settled : [first]);
      return fused.length ? fused : first;
    }
  } catch {
    // كل المحركات فشلت — ننتقل للملاذ الأخير
  }
  if (!allowWiki) return [];
  // ملاذ أخير: ويكيبيديا العربية (نتائج حقيقية مستقرة، أفضل من إرجاع فراغ)
  const { wikipediaSearch } = await import("./searx-pool.server");
  const wiki = clean(
    (await wikipediaSearch(query)).map((r, i) => ({
      rank: i + 1,
      title: r.title,
      url: r.url,
      snippet: r.snippet,
    })),
  );
  return wiki;
}

/** ينفّذ وعداً بميزانية زمنية صارمة ويعيد بديلاً عند التجاوز — يمنع تعليق الردود. */
export async function withBudget<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type CompetitorInventory = {
  domain: string;
  sitemaps: string[];
  urlCount: number;
  samples: { url: string; slug: string }[];
  topics: string[];
  error?: string;
};

/** جرد محتوى منافس من robots.txt وخرائط الموقع — مجاني ودقيق. */
export async function competitorInventory(domainOrUrl: string): Promise<CompetitorInventory> {
  const base = (() => {
    try {
      const u = new URL(/^https?:\/\//.test(domainOrUrl) ? domainOrUrl : `https://${domainOrUrl}`);
      return `${u.protocol}//${u.host}`;
    } catch {
      return "";
    }
  })();
  if (!base)
    return {
      domain: domainOrUrl,
      sitemaps: [],
      urlCount: 0,
      samples: [],
      topics: [],
      error: "نطاق غير صالح",
    };

  const robots = await getText(`${base}/robots.txt`, 8000);
  let sitemaps = [...robots.matchAll(/Sitemap:\s*(\S+)/gi)]
    .map((m) => m[1]!)
    .filter((s) => /^https?:\/\//.test(s))
    .slice(0, 3);
  if (!sitemaps.length) sitemaps = [`${base}/sitemap.xml`];

  const urls: string[] = [];
  const seen = new Set<string>();
  const queue = [...sitemaps];
  let fetched = 0;
  while (queue.length && urls.length < 120 && fetched < 6) {
    const next = queue.shift()!;
    if (seen.has(next)) continue;
    seen.add(next);
    const xml = await getText(next, 10_000);
    fetched += 1;
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]!);
    for (const loc of locs) {
      if (/\.xml(\.gz)?$/i.test(loc)) {
        if (queue.length < 6) queue.push(loc);
      } else if (urls.length < 120) {
        urls.push(loc);
      }
    }
  }

  const slugOf = (u: string) => {
    try {
      const path = decodeURIComponent(new URL(u).pathname);
      return path.split("/").filter(Boolean).pop()?.replace(/[-_]+/g, " ").slice(0, 120) ?? "";
    } catch {
      return "";
    }
  };
  const samples = urls.slice(0, 40).map((u) => ({ url: u, slug: slugOf(u) }));
  const words = new Map<string, number>();
  for (const s of samples) {
    for (const w of s.slug.split(/\s+/)) {
      if (w.length > 2) words.set(w, (words.get(w) ?? 0) + 1);
    }
  }
  const topics = [...words.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([w, c]) => `${w} (${c})`);

  return {
    domain: base,
    sitemaps,
    urlCount: urls.length,
    samples: samples.slice(0, 20),
    topics,
    ...(urls.length ? {} : { error: "لم أجد خريطة موقع مقروءة" }),
  };
}

export type PageAudit = {
  url: string;
  status: number;
  title: string;
  metaDescription: string;
  h1: string[];
  h2: string[];
  wordCount: number;
  /** عدد كلمات الصفحة كاملة قبل استبعاد القوائم/الفوتر. */
  rawWordCount?: number;
  /** متن المقال المستخرج بـReadability (مفيد لتحليل المصطلحات والفجوات). */
  mainText?: string;
  excerpt?: string;

  lang: string;
  hasCanonical: boolean;
  hasSchema: boolean;
  imagesWithoutAlt: number;
  internalLinks: number;
  error?: string;
};

/**
 * قارئ احتياطي مجاني للصفحات التي تعتمد على JavaScript (تيك توك، يوتيوب، متاجر SPA…):
 * يعيد نصاً نظيفاً بصيغة Markdown بلا مفتاح. لا يتجاوز جدران تسجيل الدخول (فيسبوك/إنستغرام).
 */
async function readerFallback(url: string): Promise<{ title: string; text: string } | null> {
  try {
    const { safeFetch } = await import("./research-safety.server");
    const res = await safeFetch(`https://r.jina.ai/${url}`, {
      ms: 25_000,
      cacheTtlMs: 6 * 60 * 60_000,
      headers: { Accept: "text/plain, text/markdown, */*" },
    });
    if (!res.ok) return null;
    const raw = res.text;
    if (!raw || raw.length < 80) return null;

    const title = /^Title:\s*(.+)$/m.exec(raw)?.[1]?.trim() ?? "";
    const body = raw
      .replace(/^Title:.*$/m, "")
      .replace(/^URL Source:.*$/m, "")
      .replace(/^Markdown Content:/m, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (body.split(/\s+/).length < 25) return null;
    return { title, text: body.slice(0, 12_000) };
  } catch {
    return null;
  }
}

/** قراءة أي صفحة وتحليلها تقنياً — مجاني (زحف مباشر + قارئ احتياطي للصفحات الديناميكية). */
export async function auditPage(url: string): Promise<PageAudit> {
  const empty: PageAudit = {
    url,
    status: 0,
    title: "",
    metaDescription: "",
    h1: [],
    h2: [],
    wordCount: 0,
    lang: "",
    hasCanonical: false,
    hasSchema: false,
    imagesWithoutAlt: 0,
    internalLinks: 0,
  };
  try {
    const target = new URL(url);
    if (!/^https?:$/.test(target.protocol)) return { ...empty, error: "رابط غير مدعوم" };
    const { safeFetch } = await import("./research-safety.server");
    const res = await safeFetch(target.toString(), { ms: 15_000, cacheTtlMs: 60 * 60_000 });
    const html = res.text.slice(0, 900_000);
    const pick = (re: RegExp) => strip(re.exec(html)?.[1] ?? "");
    const all = (re: RegExp, limit = 12) => {
      const out: string[] = [];
      let m: RegExpExecArray | null;
      const rx = new RegExp(re.source, "gi");
      while ((m = rx.exec(html)) && out.length < limit) {
        const t = strip(m[1] ?? "");
        if (t) out.push(t.slice(0, 160));
      }
      return out;
    };
    const body = strip(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<nav[\s\S]*?<\/nav>/gi, " "),
    );
    const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
    const links = html.match(/<a\b[^>]*href="([^"]+)"/gi) ?? [];
    // متن المقال الحقيقي عبر Readability (مفتوح المصدر) — يستبعد القوائم والفوتر
    // فيصبح عدّ الكلمات وتحليل المصطلحات مطابقاً للمحتوى الفعلي لا لهيكل الصفحة.
    const { extractArticle } = await import("./readability.server");
    const article = extractArticle(html, target.toString());
    const rawWords = body ? body.split(/\s+/).length : 0;
    let mainText = article?.text.slice(0, 12_000) ?? "";
    let wordCount = article?.wordCount || rawWords;
    let title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
    // صفحات تعتمد JavaScript (تيك توك، يوتيوب، متاجر SPA) تعود شبه فارغة من الزحف المباشر:
    // نقرأها عبر قارئ نصي مجاني بدل تسليم تحليل فارغ.
    if (wordCount < 120) {
      const reader = await readerFallback(target.toString());
      if (reader && reader.text.split(/\s+/).length > wordCount) {
        mainText = reader.text;
        wordCount = reader.text.split(/\s+/).length;
        title = title || reader.title;
      }
    }
    return {
      url: target.toString(),
      status: res.status,
      title,
      metaDescription:
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(html)?.[1] ?? "",
      h1: all(/<h1[^>]*>([\s\S]*?)<\/h1>/i, 5),
      h2: all(/<h2[^>]*>([\s\S]*?)<\/h2>/i, 15),
      wordCount,
      rawWordCount: rawWords,
      mainText,
      excerpt: article?.excerpt ?? "",
      lang: /<html[^>]+lang=["']([^"']+)["']/i.exec(html)?.[1] ?? "",
      hasCanonical: /rel=["']canonical["']/i.test(html),
      hasSchema: /application\/ld\+json/i.test(html),
      imagesWithoutAlt: imgs.filter((t) => !/\balt=/i.test(t)).length,
      internalLinks: links.filter((a) => {
        const href = /href="([^"]+)"/i.exec(a)?.[1] ?? "";
        return href.startsWith("/") || href.includes(target.host);
      }).length,
    };
  } catch (error) {
    const reader = await readerFallback(url);
    if (reader) {
      return {
        ...empty,
        status: 200,
        title: reader.title,
        mainText: reader.text,
        wordCount: reader.text.split(/\s+/).length,
      };
    }
    return { ...empty, error: error instanceof Error ? error.message : "تعذّر جلب الصفحة" };
  }
}

export type KeywordMetric = {
  keyword: string;
  /** 0-100: مؤشر طلب تقديري مبني على عمق اقتراحات جوجل/بينج الحقيقية. */
  demandScore: number;
  /** عدد الاقتراحات التي يعرضها محرك البحث لهذه العبارة. */
  suggestionDepth: number;
  /** هل العبارة نفسها تظهر ضمن اقتراحات محرك البحث (دليل طلب فعلي). */
  autocompleted: boolean;
  /** 0-100: صعوبة تقديرية مبنية على قوة النطاقات في نتائج البحث الحقيقية. */
  difficultyScore: number | null;
  /** نطاقات تتصدر النتائج فعلاً. */
  topDomains: string[];
  /** متوسط مشاهدات شهرية لمقال ويكيبيديا العربي الأقرب (اهتمام حقيقي مُقاس). */
  wikipediaMonthlyViews: number | null;
  wikipediaArticle: string | null;
  notes: string[];
};

const STRONG_DOMAINS = [
  "wikipedia.org",
  "youtube.com",
  "amazon.",
  "noon.com",
  "aljazeera.net",
  "alarabiya.net",
  "reddit.com",
  "quora.com",
  "linkedin.com",
  "facebook.com",
  "gov.sa",
  "gov.ae",
  "moe.gov",
];

/** مشاهدات شهرية حقيقية لأقرب مقال ويكيبيديا عربي (Wikimedia REST — مجاني بلا مفتاح). */
async function wikipediaInterest(
  keyword: string,
): Promise<{ article: string; monthlyViews: number } | null> {
  try {
    const search = await getText(
      `https://ar.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(keyword)}&format=json&srlimit=1&origin=*`,
      8000,
    );
    if (!search.trim().startsWith("{")) return null;
    const title = (JSON.parse(search) as { query?: { search?: { title: string }[] } }).query
      ?.search?.[0]?.title;
    if (!title) return null;

    const end = new Date();
    const start = new Date(end.getTime() - 365 * 86_400_000);
    const fmt = (d: Date) => `${d.toISOString().slice(0, 10).replace(/-/g, "")}00`;
    const raw = await getText(
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/ar.wikipedia/all-access/user/${encodeURIComponent(title.replace(/ /g, "_"))}/monthly/${fmt(start)}/${fmt(end)}`,
      9000,
    );
    if (!raw.trim().startsWith("{")) return null;
    const items = (JSON.parse(raw) as { items?: { views: number }[] }).items ?? [];
    if (!items.length) return null;
    const avg = Math.round(items.reduce((s, i) => s + i.views, 0) / items.length);
    return { article: title, monthlyViews: avg };
  } catch {
    return null;
  }
}

/**
 * مقاييس كلمات مفتاحية من مصادر مجانية بالكامل وبلا اختلاق:
 * عمق الاقتراحات الحقيقية + ظهور العبارة في الإكمال التلقائي + قوة نطاقات النتائج
 * + مشاهدات ويكيبيديا العربية المقيسة. كل رقم موصوف كتقديري أو مقيس بوضوح.
 */
export async function keywordMetrics(keyword: string): Promise<KeywordMetric> {
  const seed = keyword.trim();
  const notes: string[] = [];
  const [google, bing, wiki, serp] = await Promise.all([
    googleSuggest(seed),
    bingSuggest(seed),
    wikipediaInterest(seed),
    serpSearch(seed),
  ]);

  const suggestions = Array.from(new Set([...google, ...bing]));
  const autocompleted = suggestions.some((s) => s.trim() === seed);
  const suggestionDepth = suggestions.length;

  let demandScore = Math.min(100, suggestionDepth * 5 + (autocompleted ? 25 : 0));
  if (wiki)
    demandScore = Math.min(100, demandScore + Math.min(25, Math.round(wiki.monthlyViews / 200)));
  if (!suggestionDepth)
    notes.push("لا اقتراحات من محركات البحث لهذه العبارة — طلب ضعيف أو صياغة غير شائعة.");

  const topDomains = Array.from(
    new Set(
      serp
        .map((r) => {
          try {
            return new URL(r.url).host.replace(/^www\./, "");
          } catch {
            return "";
          }
        })
        .filter(Boolean),
    ),
  ).slice(0, 8);

  let difficultyScore: number | null = null;
  if (topDomains.length) {
    const strong = topDomains.filter((d) => STRONG_DOMAINS.some((s) => d.includes(s))).length;
    difficultyScore = Math.min(100, 25 + Math.round((strong / topDomains.length) * 65));
  } else {
    notes.push("تعذّر قراءة نتائج البحث الحيّة الآن، فلا تقدير للصعوبة (بدون تخمين).");
  }

  notes.push("مؤشرات الطلب والصعوبة تقديرية من مصادر مجانية، وليست أرقام حجم بحث من أداة مدفوعة.");

  return {
    keyword: seed,
    demandScore,
    suggestionDepth,
    autocompleted,
    difficultyScore,
    topDomains,
    wikipediaMonthlyViews: wiki?.monthlyViews ?? null,
    wikipediaArticle: wiki?.article ?? null,
    notes,
  };
}

export type ContentBrief = {
  query: string;
  analyzed: number;
  medianWordCount: number;
  targetWordCount: number;
  headingIdeas: string[];
  commonTerms: { term: string; pages: number }[];
  entityGaps: string[];
  schemaCoverage: number;
  competitors: { url: string; title: string; words: number; h2: number }[];
  notes: string[];
};

const AR_STOP = new Set([
  "في",
  "من",
  "على",
  "عن",
  "الى",
  "إلى",
  "مع",
  "هذا",
  "هذه",
  "ذلك",
  "التي",
  "الذي",
  "كل",
  "بعد",
  "قبل",
  "هو",
  "هي",
  "أو",
  "او",
  "ما",
  "لا",
  "إن",
  "ان",
  "كما",
  "بين",
  "حتى",
  "عند",
  "لكن",
  "قد",
  "كان",
  "يكون",
  "the",
  "and",
  "for",
  "with",
  "you",
  "your",
]);

function terms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !AR_STOP.has(w));
}

/**
 * موجز محتوى مبني على أفضل النتائج الحقيقية للاستعلام (بديل مجاني لأدوات مثل Surfer SEO):
 * يقيس طول المحتوى المتصدر، العناوين الفرعية المتكررة، المصطلحات/الكيانات التي يغطيها المنافسون،
 * ونسبة استخدام البيانات المنظمة — كلها من زحف مباشر بلا أي API مدفوع.
 */
export async function contentBrief(query: string, ownUrl?: string): Promise<ContentBrief> {
  const notes: string[] = [];
  const serp = await serpSearch(query);
  // نستثني المنصات العامة (موسوعات/فيديو/شبكات) لأنها ليست منافساً محتوائياً قابلاً للقياس
  const EXCLUDE = [
    "wikipedia.org",
    "youtube.com",
    "pinterest.",
    "facebook.com",
    "instagram.com",
    "tiktok.com",
    "x.com",
    "twitter.com",
    "reddit.com",
    "linkedin.com",
  ];
  const filtered = serp.filter((r) => {
    try {
      const h = new URL(r.url).hostname;
      return !EXCLUDE.some((d) => h.includes(d));
    } catch {
      return false;
    }
  });
  const top = (filtered.length ? filtered : []).slice(0, 6);
  if (!top.length) {
    return {
      query,
      analyzed: 0,
      medianWordCount: 0,
      targetWordCount: 0,
      headingIdeas: [],
      commonTerms: [],
      entityGaps: [],
      schemaCoverage: 0,
      competitors: [],
      notes: ["تعذّر قراءة نتائج البحث الحيّة الآن — لا موجز محتوى (بدون تخمين)."],
    };
  }

  const audits = await Promise.all(top.map((r) => auditPage(r.url)));
  const ok = audits.filter((a) => !a.error && a.wordCount > 150);
  if (!ok.length) {
    notes.push("النتائج المتصدرة منعت الزحف، فالموجز مبني على العناوين والمقتطفات فقط.");
  }

  const words = ok.map((a) => a.wordCount).sort((a, b) => a - b);
  const medianWordCount = words.length ? (words[Math.floor(words.length / 2)] ?? 0) : 0;
  const targetWordCount = medianWordCount ? Math.round((medianWordCount * 1.15) / 50) * 50 : 0;

  const headingIdeas = Array.from(
    new Set(
      ok
        .flatMap((a) => a.h2)
        .map((h) => h.trim())
        .filter((h) => h.length > 8 && h.length < 90),
    ),
  ).slice(0, 20);

  const freq = new Map<string, Set<string>>();
  for (const a of ok) {
    const bag = new Set(
      terms(
        [a.title, a.metaDescription, ...a.h1, ...a.h2, (a.mainText ?? "").slice(0, 6000)].join(" "),
      ),
    );

    for (const t of bag) {
      if (!freq.has(t)) freq.set(t, new Set());
      freq.get(t)!.add(a.url);
    }
  }
  const commonTerms = Array.from(freq.entries())
    .map(([term, urls]) => ({ term, pages: urls.size }))
    .filter((t) => t.pages >= Math.max(2, Math.ceil(ok.length / 2)))
    .sort((a, b) => b.pages - a.pages)
    .slice(0, 25);

  let entityGaps: string[] = [];
  if (ownUrl) {
    const mine = await auditPage(ownUrl);
    if (!mine.error) {
      const own = new Set(
        terms([mine.title, mine.metaDescription, ...mine.h1, ...mine.h2].join(" ")),
      );
      entityGaps = commonTerms
        .filter((t) => !own.has(t.term))
        .map((t) => t.term)
        .slice(0, 15);
    } else {
      notes.push(`تعذّر تحليل صفحتك (${mine.error}) فلا مقارنة فجوات.`);
    }
  }

  const schemaCoverage = ok.length
    ? Math.round((ok.filter((a) => a.hasSchema).length / ok.length) * 100)
    : 0;

  notes.push("الأرقام مقيسة من الصفحات المتصدرة فعلاً، وليست تقديرات أداة مدفوعة.");

  return {
    query,
    analyzed: ok.length,
    medianWordCount,
    targetWordCount,
    headingIdeas,
    commonTerms,
    entityGaps,
    schemaCoverage,
    competitors: ok.map((a) => ({
      url: a.url,
      title: a.title,
      words: a.wordCount,
      h2: a.h2.length,
    })),
    notes,
  };
}

/* ────────────── ربط الكيانات بويكي بيانات (مجاني، بلا مفتاح) ──────────────
 * ما تغفله أدوات السيو العالمية: تحويل الكلمة إلى «كيان» معرّف رسمياً.
 * محركات البحث ومساعدات الذكاء الاصطناعي تقتبس المصادر المرتبطة بكيانات واضحة،
 * وهذا يعطي نور قيم sameAs الحقيقية للبيانات المنظمة بدل تخمينها.
 */
export type EntityProfile = {
  term: string;
  id: string;
  label: string;
  description: string;
  aliases: string[];
  officialSite: string | null;
  wikipediaAr: string | null;
};

export async function entityProfile(term: string): Promise<EntityProfile | null> {
  try {
    const { safeJson } = await import("./research-safety.server");
    const found = await safeJson<{ search?: { id?: string }[] }>(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=ar&uselang=ar&limit=1&search=${encodeURIComponent(term)}`,
      { ms: 7000, agent: "bot", cacheTtlMs: 12 * 60 * 60_000 },
    );
    const id = found?.search?.[0]?.id;
    if (!id) return null;

    const body = await safeJson<{
      entities?: Record<
        string,
        {
          labels?: Record<string, { value?: string }>;
          descriptions?: Record<string, { value?: string }>;
          aliases?: Record<string, { value?: string }[]>;
          claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>;
          sitelinks?: Record<string, { title?: string }>;
        }
      >;
    }>(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&languages=ar|en&props=labels|descriptions|aliases|claims|sitelinks&ids=${id}`,
      { ms: 8000, agent: "bot", cacheTtlMs: 12 * 60 * 60_000 },
    );
    const e = body?.entities?.[id];
    if (!e) return null;
    const site = e.claims?.["P856"]?.[0]?.mainsnak?.datavalue?.value;
    const arTitle = e.sitelinks?.["arwiki"]?.title;
    return {
      term,
      id,
      label: e.labels?.["ar"]?.value ?? e.labels?.["en"]?.value ?? term,
      description: e.descriptions?.["ar"]?.value ?? e.descriptions?.["en"]?.value ?? "",
      aliases: (e.aliases?.["ar"] ?? [])
        .map((a) => a.value ?? "")
        .filter(Boolean)
        .slice(0, 6),
      officialSite: typeof site === "string" ? site : null,
      wikipediaAr: arTitle
        ? `https://ar.wikipedia.org/wiki/${encodeURIComponent(arTitle.replace(/ /g, "_"))}`
        : null,
    };
  } catch {
    return null;
  }
}
