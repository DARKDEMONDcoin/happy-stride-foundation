/**
 * فحص ترتيب حقيقي لكلمة واحدة — بترتيب الموثوقية:
 *  1) Google Search Console (إن كان مربوطاً): متوسط الترتيب الفعلي + نقرات + ظهور + الصفحة — بيانات جوجل نفسها.
 *  2) صفحة نتائج جوجل الحقيقية للسوق (gl/hl) — نبحث عن نطاقك في أول 100 نتيجة.
 *  3) محركات بديلة (Bing/Brave/DDG) كتقدير مُعلَّم بوضوح أنه ليس جوجل.
 * لا نُرجع رقماً مُختلقاً أبداً: إن لم نجد النطاق فالنتيجة «خارج أول 100» صراحةً.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export type RankSource = "search-console" | "google" | "search-engines";

export type RankResult = {
  source: RankSource;
  position: number | null;
  url: string | null;
  clicks?: number;
  impressions?: number;
  /** أول 5 نتائج منافسة (نطاق + رابط) لنعرف من يسبقك. */
  competitors: { host: string; url: string; position: number }[];
  note?: string | undefined;
};

const marketToGoogle: Record<string, { gl: string; hl: string; domain: string }> = {
  EG: { gl: "eg", hl: "ar", domain: "google.com.eg" },
  SA: { gl: "sa", hl: "ar", domain: "google.com.sa" },
  AE: { gl: "ae", hl: "ar", domain: "google.ae" },
  KW: { gl: "kw", hl: "ar", domain: "google.com.kw" },
  QA: { gl: "qa", hl: "ar", domain: "google.com.qa" },
  BH: { gl: "bh", hl: "ar", domain: "google.com.bh" },
  OM: { gl: "om", hl: "ar", domain: "google.com.om" },
  JO: { gl: "jo", hl: "ar", domain: "google.jo" },
  LB: { gl: "lb", hl: "ar", domain: "google.com.lb" },
  IQ: { gl: "iq", hl: "ar", domain: "google.iq" },
  MA: { gl: "ma", hl: "ar", domain: "google.co.ma" },
  DZ: { gl: "dz", hl: "ar", domain: "google.dz" },
  TN: { gl: "tn", hl: "ar", domain: "google.tn" },
  LY: { gl: "ly", hl: "ar", domain: "google.com.ly" },
  SD: { gl: "sd", hl: "ar", domain: "google.com" },
  PS: { gl: "ps", hl: "ar", domain: "google.ps" },
  SY: { gl: "sy", hl: "ar", domain: "google.com" },
  YE: { gl: "ye", hl: "ar", domain: "google.com" },
};

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};
const isMine = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/* ---------- 1) Search Console ---------- */

type GscSite = { siteUrl: string; permissionLevel?: string };
type GscRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

async function gscSiteFor(workspaceId: string, domain: string): Promise<string | null> {
  const { googleDataRequest } = await import("./google-data.server");
  const res = await googleDataRequest<{ siteEntry?: GscSite[] }>(
    workspaceId,
    "search-console",
    "https://www.googleapis.com/webmasters/v3/sites",
  );
  const sites = (res.siteEntry ?? []).filter((s) => s.permissionLevel !== "siteUnverifiedUser");
  const domainProp = sites.find((s) => s.siteUrl === `sc-domain:${domain}`);
  if (domainProp) return domainProp.siteUrl;
  const prefix = sites.find((s) => {
    const h = hostOf(s.siteUrl);
    return h && isMine(h, domain);
  });
  return prefix?.siteUrl ?? null;
}

export async function rankViaSearchConsole(
  workspaceId: string,
  keyword: string,
  domain: string,
  market: string,
): Promise<RankResult | null> {
  const siteUrl = await gscSiteFor(workspaceId, domain);
  if (!siteUrl) return null;
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 2); // بيانات GSC تتأخر يومين
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const { googleDataRequest } = await import("./google-data.server");
  const country = market.length === 3 ? market : iso3(market);
  const res = await googleDataRequest<{ rows?: GscRow[] }>(
    workspaceId,
    "search-console",
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      body: {
        startDate: fmt(start),
        endDate: fmt(end),
        dimensions: ["query", "page"],
        dimensionFilterGroups: [
          {
            filters: [
              { dimension: "query", operator: "equals", expression: keyword },
              ...(country
                ? [{ dimension: "country", operator: "equals", expression: country }]
                : []),
            ],
          },
        ],
        rowLimit: 5,
      },
    },
  );
  const rows = (res.rows ?? []).sort((a, b) => b.impressions - a.impressions);
  const best = rows[0];
  if (!best) {
    return {
      source: "search-console",
      position: null,
      url: null,
      clicks: 0,
      impressions: 0,
      competitors: [],
      note: "لم تظهر لهذه الكلمة في جوجل خلال 28 يوماً (بيانات Search Console).",
    };
  }
  return {
    source: "search-console",
    position: Math.round(best.position),
    url: best.keys[1] ?? null,
    clicks: rows.reduce((s, r) => s + r.clicks, 0),
    impressions: rows.reduce((s, r) => s + r.impressions, 0),
    competitors: [],
  };
}

function iso3(a2: string): string {
  const m: Record<string, string> = {
    EG: "egy",
    SA: "sau",
    AE: "are",
    KW: "kwt",
    QA: "qat",
    BH: "bhr",
    OM: "omn",
    JO: "jor",
    LB: "lbn",
    IQ: "irq",
    MA: "mar",
    DZ: "dza",
    TN: "tun",
    LY: "lby",
    SD: "sdn",
    PS: "pse",
    SY: "syr",
    YE: "yem",
    MR: "mrt",
    SO: "som",
    DJ: "dji",
    KM: "com",
  };
  return m[a2.toUpperCase()] ?? "";
}

/* ---------- 2) Google SERP الحقيقي ---------- */

export async function rankViaGoogleSerp(
  keyword: string,
  domain: string,
  market: string,
): Promise<RankResult | null> {
  const g = marketToGoogle[market.toUpperCase()] ?? { gl: "eg", hl: "ar", domain: "google.com" };
  const url = `https://www.${g.domain}/search?q=${encodeURIComponent(keyword)}&num=100&hl=${g.hl}&gl=${g.gl}&pws=0&safe=off`;
  let html = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": `${g.hl},en;q=0.7`, Accept: "text/html" },
      signal: AbortSignal.timeout(9000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }
  if (/consent\.google|\/sorry\/index|unusual traffic|captcha/i.test(html) || !/<html/i.test(html))
    return null;

  const seen = new Set<string>();
  const organic: string[] = [];
  const re = /<a[^>]+href="(\/url\?q=|)(https?:\/\/[^"&]+)[^"]*"[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && organic.length < 100) {
    const href = decodeURIComponent(m[2] ?? "");
    const host = hostOf(href);
    if (
      !host ||
      /(^|\.)(google\.[a-z.]+|gstatic\.com|youtube\.com\/results|googleusercontent\.com)$/.test(
        host,
      )
    )
      continue;
    // نتيجة لكل نطاق (كما يجمّع جوجل الروابط الفرعية للنطاق نفسه)
    if (seen.has(host)) continue;
    seen.add(host);
    organic.push(href);
  }
  if (organic.length < 5) return null; // صفحة غير مكتملة — لا نثق بها

  const idx = organic.findIndex((u) => isMine(hostOf(u), domain));
  return {
    source: "google",
    position: idx >= 0 ? idx + 1 : null,
    url: idx >= 0 ? organic[idx]! : null,
    competitors: organic.slice(0, 5).map((u, i) => ({ host: hostOf(u), url: u, position: i + 1 })),
    note: idx >= 0 ? undefined : `خارج أول ${organic.length} نتيجة في جوجل ${g.gl.toUpperCase()}`,
  };
}

/* ---------- 3) محركات بديلة ---------- */

export async function rankViaEngines(keyword: string, domain: string): Promise<RankResult> {
  const { serpSearch } = await import("./seo-research.server");
  const results = await serpSearch(keyword);
  const hit = results.find((r) => isMine(hostOf(r.url), domain));
  return {
    source: "search-engines",
    position: hit?.rank ?? null,
    url: hit?.url ?? null,
    competitors: results
      .slice(0, 5)
      .map((r, i) => ({ host: hostOf(r.url), url: r.url, position: r.rank ?? i + 1 })),
    note: "تقدير من محركات بديلة (Bing/Brave) — اربط Search Console لأرقام جوجل الفعلية.",
  };
}

/** يجرّب المصادر بالترتيب ويعيد أول نتيجة موثوقة. */
export async function checkRank(params: {
  workspaceId: string;
  keyword: string;
  domain: string;
  market: string;
  gscConnected: boolean;
}): Promise<RankResult> {
  if (params.gscConnected) {
    try {
      const r = await rankViaSearchConsole(
        params.workspaceId,
        params.keyword,
        params.domain,
        params.market,
      );
      if (r) {
        // نُكمل المنافسين من SERP الحقيقي إن أمكن (GSC لا يعطي المنافسين)
        const serp = await rankViaGoogleSerp(params.keyword, params.domain, params.market).catch(
          () => null,
        );
        if (serp) r.competitors = serp.competitors;
        return r;
      }
    } catch (e) {
      console.warn("[rank] GSC failed, falling back:", e instanceof Error ? e.message : e);
    }
  }
  const g = await rankViaGoogleSerp(params.keyword, params.domain, params.market).catch(() => null);
  if (g) return g;
  return rankViaEngines(params.keyword, params.domain);
}
