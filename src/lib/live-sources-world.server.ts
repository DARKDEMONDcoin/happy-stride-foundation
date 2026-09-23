/**
 * مصادر عالمية إضافية — كلها مجانية، بلا مفاتيح، مفتوحة أو عامة، وتعمل بـ fetch فقط:
 * Lobsters + Mastodon (نبض اجتماعي/تقني)، LibreY (بحث بديل)، USGS (زلازل)،
 * Nager.Date (أعياد رسمية)، Wikidata SPARQL (حقائق منظّمة)، ESPN (نتائج مباريات).
 *
 * كل دالة تعيد فراغاً عند الفشل — لا تكسر أي مسار، وتُستدعى بالتوازي كطبقة بدائل.
 */

import type { LiveRow } from "./live-sources.server";

const UA = "Mozilla/5.0 (compatible; sahl-live-context/1.0; +https://lovable.dev)";

async function jsonOf<T>(url: string, ms: number): Promise<T> {
  const { resilientText } = await import("./net-resilience.server");
  const text = await resilientText(url, {
    ms,
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  return JSON.parse(text) as T;
}

const clean = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Lobsters — أخبار تقنية مُصفّاة بجودة عالية، JSON عام بلا مفتاح. */
export async function lobsters({ ms = 6_000 } = {}): Promise<LiveRow[]> {
  try {
    const rows = await jsonOf<
      { title: string; url: string; created_at: string; description_plain?: string }[]
    >("https://lobste.rs/newest.json", ms);
    return rows.slice(0, 10).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: clean(r.description_plain ?? ""),
      source: "Lobsters",
      date: r.created_at,
    }));
  } catch {
    return [];
  }
}

/** Mastodon — تايملاين عام/وسم من نسخ مفتوحة، نبض لحظي لما يُقال الآن. */
export async function mastodonTag(tag: string, { ms = 6_000 } = {}): Promise<LiveRow[]> {
  const hosts = ["mastodon.social", "mstdn.social", "fosstodon.org"];
  const slug = encodeURIComponent(tag.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 40));
  if (!slug) return [];
  const each = Math.max(1_500, Math.floor(ms / hosts.length));
  for (const host of hosts) {
    try {
      const rows = await jsonOf<
        { content: string; url: string; created_at: string; account?: { acct?: string } }[]
      >(`https://${host}/api/v1/timelines/tag/${slug}?limit=10`, each);
      const out = rows
        .map((r) => ({
          title: clean(r.content).slice(0, 140),
          url: r.url,
          snippet: clean(r.content).slice(0, 240),
          source: `Mastodon/${host}`,
          date: r.created_at,
        }))
        .filter((r) => r.title);
      if (out.length) return out;
    } catch {
      /* نجرّب النسخة التالية */
    }
  }
  return [];
}

/** LibreY — واجهة بحث مفتوحة المصدر بنتائج JSON، بديل إضافي عند حجب غيرها. */
export async function libreySearch(query: string, { ms = 7_000 } = {}): Promise<LiveRow[]> {
  const hosts = ["libre.whateveritworks.org", "search.davidovski.xyz", "librey.org"];
  const each = Math.max(1_500, Math.floor(ms / hosts.length));
  for (const host of hosts) {
    try {
      const rows = await jsonOf<{ title: string; url: string; description: string }[]>(
        `https://${host}/api.php?q=${encodeURIComponent(query)}&p=0`,
        each,
      );
      const out = (Array.isArray(rows) ? rows : [])
        .filter((r) => r?.title && r?.url)
        .slice(0, 8)
        .map((r) => ({
          title: clean(r.title),
          url: r.url,
          snippet: clean(r.description ?? ""),
          source: `LibreY/${host}`,
        }));
      if (out.length) return out;
    } catch {
      /* نجرّب النسخة التالية */
    }
  }
  return [];
}

/** USGS — زلازل آخر يوم، بيانات رسمية لحظية بلا مفتاح. */
export async function earthquakes({ ms = 6_000, minMag = 4.5 } = {}): Promise<string> {
  try {
    const data = await jsonOf<{
      features: { properties: { mag: number; place: string; time: number } }[];
    }>("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson", ms);
    const items = (data.features ?? [])
      .filter((f) => (f.properties?.mag ?? 0) >= minMag)
      .slice(0, 5)
      .map(
        (f) =>
          `${f.properties.mag} ريختر — ${f.properties.place} (${new Date(f.properties.time).toISOString().slice(0, 16).replace("T", " ")}Z)`,
      );
    return items.length ? `زلازل آخر ٢٤ ساعة (USGS رسمي): ${items.join(" • ")}` : "";
  } catch {
    return "";
  }
}

/** Nager.Date — الأعياد الرسمية للدولة، لمعرفة «هل اليوم إجازة؟» بيقين. */
export async function publicHolidays(country: string, { ms = 6_000 } = {}): Promise<string> {
  const code = (country || "EG").toUpperCase();
  const year = new Date().getUTCFullYear();
  try {
    const rows = await jsonOf<{ date: string; localName: string; name: string }[]>(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/${code}`,
      ms,
    );
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = rows
      .filter((r) => r.date >= today)
      .slice(0, 4)
      .map((r) => `${r.localName || r.name} (${r.date})`);
    const isToday = rows.find((r) => r.date === today);
    return [
      isToday ? `اليوم إجازة رسمية: ${isToday.localName || isToday.name}.` : "",
      upcoming.length ? `أقرب الإجازات الرسمية في ${code}: ${upcoming.join(" • ")}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  } catch {
    return "";
  }
}

/** Wikidata SPARQL — حقيقة منظّمة مؤكدة (مثل: من يشغل منصباً الآن). */
export async function wikidataFact(label: string, { ms = 7_000 } = {}): Promise<string> {
  const term = label.trim().slice(0, 60);
  if (!term) return "";
  const sparql = `SELECT ?itemLabel ?desc WHERE {
    SERVICE wikibase:mwapi { bd:serviceParam wikibase:endpoint "www.wikidata.org";
      wikibase:api "EntitySearch"; mwapi:search "${term.replace(/"/g, "")}"; mwapi:language "ar".
      ?item wikibase:apiOutputItem mwapi:item. }
    OPTIONAL { ?item schema:description ?desc FILTER(LANG(?desc)="ar") }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "ar,en". }
  } LIMIT 3`;
  try {
    const data = await jsonOf<{
      results: { bindings: { itemLabel?: { value: string }; desc?: { value: string } }[] };
    }>(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`, ms);
    const rows = (data.results?.bindings ?? [])
      .map((b) => [b.itemLabel?.value, b.desc?.value].filter(Boolean).join(" — "))
      .filter(Boolean);
    return rows.length ? `ويكي بيانات: ${rows.join(" • ")}` : "";
  } catch {
    return "";
  }
}

/** ESPN — نتائج مباريات اليوم (غير رسمي لكنه مجاني وبلا مفتاح). */
export async function espnScores(league = "soccer/eng.1", { ms = 6_000 } = {}): Promise<string> {
  try {
    const data = await jsonOf<{
      events?: { name: string; date: string; status?: { type?: { detail?: string } } }[];
    }>(`https://site.api.espn.com/apis/site/v2/sports/${league}/scoreboard`, ms);
    const items = (data.events ?? [])
      .slice(0, 5)
      .map((e) => `${e.name} — ${e.status?.type?.detail ?? ""} (${e.date.slice(0, 10)})`);
    return items.length ? `مباريات (ESPN): ${items.join(" • ")}` : "";
  } catch {
    return "";
  }
}
