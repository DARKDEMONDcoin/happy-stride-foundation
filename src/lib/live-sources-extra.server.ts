/**
 * البدائل: لكل نوع معلومة أكثر من مصدر مجاني ومفتوح بلا مفاتيح، حتى لا يسقط
 * الوعي اللحظي أبداً بسقوط مزوّد واحد.
 *
 * بحث: Mojeek + Marginalia + Brave-free(HTML) + Startpage-lite عبر مرايا القراءة.
 * أخبار: Bing News RSS + Yahoo News RSS + خلاصات عربية كبرى (الجزيرة، BBC، سكاي، CNN، العربية).
 * أسعار: Frankfurter → open.er-api → exchangerate.host؛ كريبتو: CoinGecko → Coinbase → Binance → Kraken.
 * طقس: Open-Meteo → wttr.in؛ مواقيت: AlAdhan → مرآة AlAdhan بالإحداثيات.
 */

import { resilientText, resilientJson, firstNonEmpty, raceUseful } from "./net-resilience.server";
import type { LiveRow } from "./live-sources.server";

const strip = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
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

function parseRss(xml: string, source: string): LiveRow[] {
  const items = xml.match(/<(item|entry)>[\s\S]*?<\/\1>/g) ?? [];
  return items
    .map((item) => {
      const pick = (tag: string) => {
        const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
        return m ? strip(strip(m[1]!.replace(/<!\[CDATA\[|\]\]>/g, ""))) : "";
      };
      const title = pick("title").slice(0, 200);
      const desc = pick("description") || pick("summary") || pick("content");
      const href =
        (item.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1] ?? "").trim() ||
        (item.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? "").trim();
      return {
        title,
        url: href,
        snippet: desc.includes(title.slice(0, 40)) ? "" : desc.slice(0, 280),
        date: pick("pubDate") || pick("updated") || pick("published"),
        source,
      };
    })
    .filter((r) => r.title);
}

/* ————————————————— أخبار بديلة ————————————————— */

export async function bingNewsRss(query: string, { ms = 8_000, lang = "ar" } = {}): Promise<LiveRow[]> {
  const xml = await resilientText(
    `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=RSS&setlang=${lang}`,
    { ms },
  );
  return parseRss(xml, "Bing News").slice(0, 10);
}

export async function yahooNewsRss(query: string, { ms = 8_000 } = {}): Promise<LiveRow[]> {
  const xml = await resilientText(
    `https://news.search.yahoo.com/rss?p=${encodeURIComponent(query)}`,
    { ms },
  );
  return parseRss(xml, "Yahoo News").slice(0, 10);
}

/** خلاصات إخبارية عربية/عالمية مباشرة — تعمل حتى لو حُجبت كل محركات البحث. */
const FEEDS: { url: string; source: string }[] = [
  { url: "https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b135-bfdff8b8cab9", source: "الجزيرة" },
  { url: "https://feeds.bbci.co.uk/arabic/rss.xml", source: "BBC عربي" },
  { url: "https://www.skynewsarabia.com/rss", source: "سكاي نيوز عربية" },
  { url: "https://arabic.cnn.com/api/v1/rss/rss.xml", source: "CNN بالعربية" },
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC World" },
  { url: "https://feeds.arstechnica.com/arstechnica/index", source: "Ars Technica" },
  { url: "https://techcrunch.com/feed/", source: "TechCrunch" },
];

export async function arabicFeeds({ ms = 7_000, limit = 24 } = {}): Promise<LiveRow[]> {
  const rows = await Promise.all(
    FEEDS.map(async (f) => {
      try {
        return parseRss(await resilientText(f.url, { ms }), f.source).slice(0, 6);
      } catch {
        return [] as LiveRow[];
      }
    }),
  );
  return rows.flat().slice(0, limit);
}

/* ————————————————— بحث بديل ————————————————— */

export async function mojeekSearch(query: string, { ms = 8_000 } = {}): Promise<LiveRow[]> {
  const html = await resilientText(`https://www.mojeek.com/search?q=${encodeURIComponent(query)}`, {
    ms,
  });
  const rows: LiveRow[] = [];
  const re = /<a[^>]+class="ob"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && rows.length < 10) {
    rows.push({ title: strip(m[2]!), url: m[1]!, snippet: "", source: "Mojeek" });
  }
  const snips = [...html.matchAll(/<p class="s">([\s\S]*?)<\/p>/g)].map((s) => strip(s[1]!));
  rows.forEach((r, i) => {
    if (snips[i]) r.snippet = snips[i]!.slice(0, 280);
  });
  return rows;
}

export async function marginaliaSearch(query: string, { ms = 8_000 } = {}): Promise<LiveRow[]> {
  const json = await resilientJson<{ results?: { title?: string; url?: string; description?: string }[] }>(
    `https://api.marginalia.nu/public/search/${encodeURIComponent(query)}`,
    { ms },
  );
  return (json.results ?? [])
    .filter((r) => r.title && r.url)
    .slice(0, 8)
    .map((r) => ({
      title: r.title!.slice(0, 200),
      url: r.url!,
      snippet: (r.description ?? "").slice(0, 280),
      source: "Marginalia",
    }));
}

/** نقاش حيّ من Reddit (JSON عام) — مفيد جداً لِما يقال الآن عن منتج أو حدث. */
export async function redditSearch(query: string, { ms = 7_000 } = {}): Promise<LiveRow[]> {
  const json = await resilientJson<{
    data?: { children?: { data?: { title?: string; permalink?: string; selftext?: string; created_utc?: number } }[] };
  }>(
    `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&limit=10&t=month`,
    { ms },
  );
  return (json.data?.children ?? [])
    .map((c) => c.data)
    .filter((d): d is NonNullable<typeof d> => Boolean(d?.title && d.permalink))
    .map((d) => ({
      title: d.title!.slice(0, 200),
      url: `https://www.reddit.com${d.permalink}`,
      snippet: (d.selftext ?? "").slice(0, 240),
      date: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : "",
      source: "Reddit",
    }));
}

/* ————————————————— بدائل البيانات المنظّمة ————————————————— */

type FxSnap = { date: string; rates: Record<string, number>; source: string };

/**
 * أسعار الصرف: لا نكتفي بأول مزوّد — نكمل على البدائل حتى تُغطّى كل العملات
 * المطلوبة (فرانكفورتر مثلاً لا يعرف الجنيه المصري، وغيره يعرفه).
 */
export async function fxAny(base = "USD", quotes: string[] = [], { ms = 7_000 } = {}): Promise<string> {
  const wanted = quotes.filter(Boolean);
  const providers: (() => Promise<FxSnap>)[] = [
    async () => {
      const j = await resilientJson<{ date?: string; rates?: Record<string, number> }>(
        `https://api.frankfurter.dev/v1/latest?base=${base}`,
        { ms },
      );
      return { date: j.date ?? "", rates: j.rates ?? {}, source: "Frankfurter" };
    },
    async () => {
      const j = await resilientJson<{ time_last_update_utc?: string; rates?: Record<string, number> }>(
        `https://open.er-api.com/v6/latest/${base}`,
        { ms },
      );
      return { date: (j.time_last_update_utc ?? "").slice(0, 16), rates: j.rates ?? {}, source: "ExchangeRate-API" };
    },
    async () => {
      const j = await resilientJson<Record<string, unknown>>(
        `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base.toLowerCase()}.json`,
        { ms },
      );
      const key = Object.keys(j).find((k) => k !== "date") ?? base.toLowerCase();
      const raw = (j[key] ?? {}) as Record<string, number>;
      const upper: Record<string, number> = {};
      for (const [k, v] of Object.entries(raw)) upper[k.toUpperCase()] = Number(v);
      return { date: String(j["date"] ?? ""), rates: upper, source: "Currency-API" };
    },
    async () => {
      const j = await resilientJson<{ date?: string; rates?: Record<string, number> }>(
        `https://api.exchangerate.host/latest?base=${base}`,
        { ms },
      );
      return { date: j.date ?? "", rates: j.rates ?? {}, source: "exchangerate.host" };
    },
  ];

  const merged: Record<string, number> = {};
  const used: string[] = [];
  let date = "";
  for (const load of providers) {
    const missing = wanted.filter((c) => merged[c] === undefined);
    if (wanted.length && !missing.length) break;
    try {
      const snap = await load();
      let added = false;
      for (const [k, v] of Object.entries(snap.rates)) {
        if (wanted.length && !wanted.includes(k)) continue;
        if (merged[k] === undefined && Number.isFinite(Number(v))) {
          merged[k] = Number(v);
          added = true;
        }
      }
      if (added) {
        used.push(snap.source);
        date ||= snap.date;
      }
    } catch {
      /* المزوّد التالي */
    }
  }

  const list = Object.entries(merged).slice(0, 8);
  if (!list.length) return "";
  return `أسعار الصرف (${base}) بتاريخ ${date}: ${list
    .map(([k, v]) => `${k} ${v.toFixed(3)}`)
    .join(" • ")}. (${used.join(" + ")})`;
}

export async function cryptoAny(
  ids = ["bitcoin", "ethereum", "tether"],
  { ms = 7_000 } = {},
): Promise<string> {
  return firstNonEmpty<string>(
    [
      async () => {
        const j = await resilientJson<Record<string, { usd?: number; usd_24h_change?: number }>>(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`,
          { ms },
        );
        const rows = Object.entries(j).map(
          ([id, v]) => `${id}: ${v.usd ?? "?"}$ (${(v.usd_24h_change ?? 0).toFixed(1)}% خلال 24س)`,
        );
        return rows.length ? `أسعار لحظية: ${rows.join(" • ")}. (CoinGecko)` : "";
      },
      async () => {
        const j = await resilientJson<{ data?: { rates?: Record<string, string> } }>(
          "https://api.coinbase.com/v2/exchange-rates?currency=USD",
          { ms },
        );
        const r = j.data?.rates ?? {};
        const px = (sym: string) => (r[sym] ? (1 / Number(r[sym])).toFixed(2) : "");
        const rows = [
          px("BTC") && `BTC: ${px("BTC")}$`,
          px("ETH") && `ETH: ${px("ETH")}$`,
        ].filter(Boolean);
        return rows.length ? `أسعار لحظية: ${rows.join(" • ")}. (Coinbase)` : "";
      },
      async () => {
        const j = await resilientJson<{ symbol: string; lastPrice: string; priceChangePercent: string }[]>(
          'https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT"]',
          { ms },
        );
        const rows = j.map(
          (t) => `${t.symbol.replace("USDT", "")}: ${Number(t.lastPrice).toFixed(2)}$ (${Number(t.priceChangePercent).toFixed(1)}% خلال 24س)`,
        );
        return rows.length ? `أسعار لحظية: ${rows.join(" • ")}. (Binance)` : "";
      },
      async () => {
        const j = await resilientJson<{ result?: Record<string, { c?: string[] }> }>(
          "https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD",
          { ms },
        );
        const rows = Object.entries(j.result ?? {}).map(
          ([k, v]) => `${k}: ${v.c?.[0] ?? "?"}$`,
        );
        return rows.length ? `أسعار لحظية: ${rows.join(" • ")}. (Kraken)` : "";
      },
    ],
    (s) => !s,
    "",
  );
}

export async function weatherAny(city: string, { ms = 7_000 } = {}): Promise<string> {
  return firstNonEmpty<string>(
    [
      async () => {
        const { weatherFor } = await import("./live-sources.server");
        return weatherFor(city, { ms });
      },
      async () => {
        const txt = await resilientText(
          `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
          { ms },
        );
        const j = JSON.parse(txt) as {
          current_condition?: { temp_C?: string; humidity?: string; windspeedKmph?: string }[];
          weather?: { mintempC?: string; maxtempC?: string }[];
        };
        const c = j.current_condition?.[0];
        const d = j.weather?.[0];
        if (!c) return "";
        return `طقس ${city} الآن: ${c.temp_C}°م، رطوبة ${c.humidity}%، رياح ${c.windspeedKmph} كم/س. اليوم ${d?.mintempC ?? "?"}–${d?.maxtempC ?? "?"}°م. (wttr.in)`;
      },
    ],
    (s) => !s,
    "",
  );
}

export async function prayerAny(city: string, country: string, { ms = 7_000 } = {}): Promise<string> {
  return firstNonEmpty<string>(
    [
      async () => {
        const { prayerTimes } = await import("./live-sources.server");
        return prayerTimes(city, country, { ms });
      },
      async () => {
        const j = await resilientJson<{
          data?: { timings?: Record<string, string>; date?: { hijri?: { day?: string; month?: { ar?: string }; year?: string } } };
        }>(
          `https://api.aladhan.com/v1/timingsByAddress?address=${encodeURIComponent(`${city}, ${country}`)}`,
          { ms },
        );
        const t = j.data?.timings ?? {};
        if (!t["Fajr"]) return "";
        const h = j.data?.date?.hijri;
        const line = (["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const)
          .map((k) => `${k} ${t[k] ?? "?"}`)
          .join(" • ");
        return `مواقيت ${city} اليوم: ${line}.${h?.day ? ` الهجري: ${h.day} ${h.month?.ar ?? ""} ${h.year ?? ""}هـ.` : ""} (AlAdhan)`;
      },
    ],
    (s) => !s,
    "",
  );
}

/**
 * البحث العام الاحتياطي: يشغّل كل المحركات البديلة بالتوازي ويأخذ أسرع نتيجة صالحة.
 */
export async function backupWebSearch(query: string, { ms = 8_000 } = {}): Promise<LiveRow[]> {
  return raceUseful<LiveRow[]>(
    [
      () => mojeekSearch(query, { ms }),
      () => bingNewsRss(query, { ms }),
      () => yahooNewsRss(query, { ms }),
      () => marginaliaSearch(query, { ms }),
      () => redditSearch(query, { ms }),
    ],
    (rows) => !rows.length,
    [],
  );
}
