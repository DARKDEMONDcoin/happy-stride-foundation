/**
 * مصادر الحقائق اللحظية — كلها مجانية ومفتوحة وبلا مفاتيح، وتعمل بـ fetch فقط
 * (متوافقة مع بيئة Cloudflare Worker). لا يوجد مصدر واحد موثوق دائماً، لذا نشغّلها
 * بالتوازي ونأخذ أول ما ينجح، ونعيد قائمة فارغة بدل اختلاق أي معلومة.
 *
 * البحث العام: SearXNG (AGPL) + DuckDuckGo HTML/Lite + ويكيبيديا.
 * الأخبار: Google News RSS + GDELT DOC 2.0 + Hacker News (Algolia).
 * بيانات منظّمة: Open-Meteo (طقس) + Frankfurter (عملات) + CoinGecko (كريبتو)
 *              + TheSportsDB (رياضة) + AlAdhan (هجري ومواقيت).
 */

export type LiveRow = { title: string; url: string; snippet: string; source: string; date?: string };

const UA =
  "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0 (+sahl-live-context)";

// كل نداء يمرّ بطبقة الصمود: إعادة محاولة + مرايا قراءة عامة + ذاكرة مؤقتة.
async function getText(url: string, ms: number, headers: Record<string, string> = {}) {
  const { resilientText } = await import("./net-resilience.server");
  return resilientText(url, { ms, headers: { "User-Agent": UA, ...headers } });
}

async function getJson<T>(url: string, ms: number, headers: Record<string, string> = {}) {
  const text = await getText(url, ms, { Accept: "application/json", ...headers });
  return JSON.parse(text) as T;
}

const strip = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* ————————————————— أخبار ————————————————— */

/** أخبار جوجل RSS — بلا مفتاح، بلغة وسوق الجمهور. */
export async function googleNewsSearch(
  query: string,
  { lang = "ar", country = "EG", ms = 8_000 } = {},
): Promise<LiveRow[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    query,
  )}&hl=${lang}&gl=${country}&ceid=${country}:${lang}`;
  const xml = await getText(url, ms);
  return parseRss(xml, "Google News").slice(0, 10);
}

/** أخبار عاجلة عامة (بلا استعلام) — لِما يحدث الآن في سوق العلامة. */
export async function googleNewsTop({ lang = "ar", country = "EG", ms = 8_000 } = {}): Promise<
  LiveRow[]
> {
  const xml = await getText(
    `https://news.google.com/rss?hl=${lang}&gl=${country}&ceid=${country}:${lang}`,
    ms,
  );
  return parseRss(xml, "Google News").slice(0, 10);
}

function parseRss(xml: string, source: string): LiveRow[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return items
    .map((item) => {
      const pick = (tag: string) => {
        const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
        // وصف RSS يأتي غالباً بـ HTML مُرمَّز داخل CDATA: ننظّف مرتين حتى يبقى نص خالص.
        return m ? strip(strip(m[1]!.replace(/<!\[CDATA\[|\]\]>/g, ""))) : "";
      };
      const title = pick("title").slice(0, 200);
      const description = pick("description");
      return {
        title,
        url: (item.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1] ?? "").trim(),
        snippet: description.includes(title.slice(0, 40)) ? "" : description.slice(0, 280),
        date: pick("pubDate"),
        source,
      };
    })
    .filter((r) => r.title);
}

/** GDELT DOC 2.0: مراقبة أخبار العالم خلال آخر 3 أشهر — JSON بلا مفتاح. */
export async function gdeltNews(query: string, { ms = 8_000, hours = 48 } = {}): Promise<LiveRow[]> {
  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc?" +
    new URLSearchParams({
      query,
      mode: "ArtList",
      format: "json",
      maxrecords: "20",
      sort: "DateDesc",
      timespan: `${hours}h`,
    }).toString();
  const json = await getJson<{
    articles?: { title?: string; url?: string; seendate?: string; domain?: string }[];
  }>(url, ms);
  return (json.articles ?? [])
    .filter((a) => a.title && a.url)
    .map((a) => ({
      title: a.title!.slice(0, 200),
      url: a.url!,
      snippet: "",
      date: a.seendate ?? "",
      source: `GDELT/${a.domain ?? ""}`,
    }))
    .slice(0, 10);
}

/** هاكر نيوز عبر Algolia — الأفضل لأخبار التقنية والمنتجات، JSON مجاني بلا مفتاح. */
export async function hackerNewsSearch(query: string, { ms = 7_000 } = {}): Promise<LiveRow[]> {
  const json = await getJson<{
    hits?: { title?: string; story_title?: string; url?: string; objectID: string; created_at?: string }[];
  }>(
    `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=10`,
    ms,
  );
  return (json.hits ?? [])
    .map((h) => ({
      title: (h.title ?? h.story_title ?? "").slice(0, 200),
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      snippet: "",
      date: h.created_at ?? "",
      source: "Hacker News",
    }))
    .filter((r) => r.title);
}

/* ————————————————— بحث عام ————————————————— */

/** DuckDuckGo بصيغة HTML الخفيفة — بلا مفتاح، مع تجاوز صفحات التحدي. */
export async function duckSearch(query: string, { ms = 8_000 } = {}): Promise<LiveRow[]> {
  const endpoints = [
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=xa-ar`,
    `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
  ];
  for (const url of endpoints) {
    try {
      const html = await getText(url, ms, { Referer: "https://duckduckgo.com/" });
      const rows: LiveRow[] = [];
      const linkRe =
        /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      let m: RegExpExecArray | null;
      while ((m = linkRe.exec(html)) && rows.length < 10) {
        rows.push({ title: strip(m[2]!), url: cleanDdgUrl(m[1]!), snippet: "", source: "DuckDuckGo" });
      }
      if (!rows.length) {
        const liteRe = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        while ((m = liteRe.exec(html)) && rows.length < 10) {
          rows.push({
            title: strip(m[2]!),
            url: cleanDdgUrl(m[1]!),
            snippet: "",
            source: "DuckDuckGo",
          });
        }
      }
      const snippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)].map((s) =>
        strip(s[1]!),
      );
      rows.forEach((r, i) => {
        if (snippets[i]) r.snippet = snippets[i]!.slice(0, 280);
      });
      if (rows.length) return rows;
    } catch {
      /* نجرّب النقطة التالية */
    }
  }
  return [];
}

function cleanDdgUrl(href: string): string {
  try {
    const raw = href.startsWith("//") ? `https:${href}` : href;
    const u = new URL(raw, "https://duckduckgo.com");
    return u.searchParams.get("uddg") ?? u.toString();
  } catch {
    return href;
  }
}

/** ويكيبيديا العربية ثم الإنجليزية — مصدر مستقر للحقائق الثابتة. */
export async function wikipediaSearch(query: string, { ms = 7_000 } = {}): Promise<LiveRow[]> {
  for (const lang of ["ar", "en"]) {
    try {
      const json = await getJson<{ query?: { search?: { title?: string; snippet?: string }[] } }>(
        `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
          query,
        )}&srlimit=6&format=json&origin=*`,
        ms,
      );
      const rows = (json.query?.search ?? [])
        .filter((r) => r.title)
        .map((r) => ({
          title: r.title!,
          url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(r.title!.replace(/ /g, "_"))}`,
          snippet: strip(r.snippet ?? "").slice(0, 280),
          source: `Wikipedia/${lang}`,
        }));
      if (rows.length) return rows;
    } catch {
      /* اللغة التالية */
    }
  }
  return [];
}

/* ————————————————— بيانات منظّمة ————————————————— */

/** طقس اليوم والغد لمدينة — Open-Meteo مجاني بلا مفتاح. */
export async function weatherFor(city: string, { ms = 7_000 } = {}): Promise<string> {
  const geo = await getJson<{
    results?: { latitude: number; longitude: number; name: string; country?: string; timezone?: string }[];
  }>(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ar&format=json`,
    ms,
  );
  const place = geo.results?.[0];
  if (!place) return "";
  const w = await getJson<{
    current?: { temperature_2m?: number; wind_speed_10m?: number; relative_humidity_2m?: number };
    daily?: { time?: string[]; temperature_2m_max?: number[]; temperature_2m_min?: number[] };
  }>(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&forecast_days=2&timezone=auto`,
    ms,
  );
  const cur = w.current ?? {};
  const max = w.daily?.temperature_2m_max ?? [];
  const min = w.daily?.temperature_2m_min ?? [];
  return `طقس ${place.name}${place.country ? ` (${place.country})` : ""} الآن: ${cur.temperature_2m ?? "?"}°م، رطوبة ${cur.relative_humidity_2m ?? "?"}%، رياح ${cur.wind_speed_10m ?? "?"} كم/س. اليوم ${min[0] ?? "?"}–${max[0] ?? "?"}°م، غداً ${min[1] ?? "?"}–${max[1] ?? "?"}°م. (Open-Meteo)`;
}

/** أسعار الصرف الرسمية من بنوك مركزية — Frankfurter مجاني ومفتوح. */
export async function fxRates(base = "USD", quotes: string[] = [], { ms = 7_000 } = {}): Promise<string> {
  const url =
    `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}` +
    (quotes.length ? `&symbols=${quotes.join(",")}` : "");
  const json = await getJson<{ date?: string; base?: string; rates?: Record<string, number> }>(url, ms);
  const rates = Object.entries(json.rates ?? {}).slice(0, 8);
  if (!rates.length) return "";
  return `أسعار الصرف (${json.base ?? base}) بتاريخ ${json.date ?? ""}: ${rates
    .map(([k, v]) => `${k} ${v}`)
    .join(" • ")}. (Frankfurter/بنوك مركزية)`;
}

/** أسعار العملات الرقمية والذهب الرمزي — CoinGecko العام بلا مفتاح. */
export async function cryptoPrices(ids = ["bitcoin", "ethereum", "tether"], { ms = 7_000 } = {}) {
  const json = await getJson<Record<string, { usd?: number; usd_24h_change?: number }>>(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`,
    ms,
  );
  const rows = Object.entries(json).map(
    ([id, v]) =>
      `${id}: ${v.usd ?? "?"}$ (${(v.usd_24h_change ?? 0).toFixed(1)}% خلال 24س)`,
  );
  return rows.length ? `أسعار لحظية: ${rows.join(" • ")}. (CoinGecko)` : "";
}

/** آخر ونتائج مباريات فريق — TheSportsDB بالمفتاح التجريبي المجاني 3. */
export async function teamMatches(team: string, { ms = 8_000 } = {}): Promise<string> {
  const search = await getJson<{ teams?: { idTeam: string; strTeam: string }[] }>(
    `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(team)}`,
    ms,
  );
  const found = search.teams?.[0];
  if (!found) return "";
  const [last, next] = await Promise.all([
    getJson<{ results?: { strEvent?: string; dateEvent?: string; intHomeScore?: string; intAwayScore?: string }[] }>(
      `https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id=${found.idTeam}`,
      ms,
    ).catch(() => ({ results: [] })),
    getJson<{ events?: { strEvent?: string; dateEvent?: string; strTime?: string }[] }>(
      `https://www.thesportsdb.com/api/v1/json/3/eventsnext.php?id=${found.idTeam}`,
      ms,
    ).catch(() => ({ events: [] })),
  ]);
  const lastLines = (last.results ?? [])
    .slice(0, 3)
    .map((e) => `- ${e.dateEvent ?? ""}: ${e.strEvent ?? ""} — ${e.intHomeScore ?? "?"}:${e.intAwayScore ?? "?"}`);
  const nextLines = (next.events ?? [])
    .slice(0, 2)
    .map((e) => `- قادمة ${e.dateEvent ?? ""} ${e.strTime ?? ""}: ${e.strEvent ?? ""}`);
  const all = [...lastLines, ...nextLines];
  return all.length ? `مباريات ${found.strTeam} (TheSportsDB):\n${all.join("\n")}` : "";
}

/** مواقيت الصلاة والتاريخ الهجري الرسمي — AlAdhan مجاني ومفتوح. */
export async function prayerTimes(city: string, country: string, { ms = 7_000 } = {}): Promise<string> {
  const json = await getJson<{
    data?: {
      timings?: Record<string, string>;
      date?: { hijri?: { date?: string; month?: { ar?: string }; year?: string; day?: string } };
    };
  }>(
    `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`,
    ms,
  );
  const t = json.data?.timings ?? {};
  const h = json.data?.date?.hijri;
  const keys = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
  const line = keys.map((k) => `${k} ${t[k] ?? "?"}`).join(" • ");
  if (!t["Fajr"]) return "";
  return `مواقيت ${city} اليوم: ${line}.${
    h?.day ? ` الهجري: ${h.day} ${h.month?.ar ?? ""} ${h.year ?? ""}هـ.` : ""
  } (AlAdhan)`;
}
