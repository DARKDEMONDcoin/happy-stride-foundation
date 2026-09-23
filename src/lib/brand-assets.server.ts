/**
 * مكتبة صور العلامة: نلتقط الصور الحقيقية من موقع المستخدم (وصفحاته الداخلية)
 * ثم نرشّح أنسبها لطلبه فيقترحها الموظف داخل الرد نفسه.
 *
 * تحليل HTML بلا مكتبات خارجية ليعمل داخل بيئة الخادم الحافّية.
 */
export type SiteAsset = {
  url: string;
  alt: string;
  pageUrl: string;
  weight: number;
};

const UA =
  "Mozilla/5.0 (compatible; SahlBot/1.0; +https://sahl.app) AppleWebKit/537.36 Chrome/124 Safari/537.36";

/** روابط لا تصلح كصورة محتوى: أيقونات، شعارات صغيرة، بيكسل تتبّع، SVG واجهة. */
const JUNK =
  /(sprite|icon|favicon|logo|placeholder|avatar|pixel|spacer|blank|loader|badge|flag|1x1)/i;

export function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const u = new URL(withScheme);
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

async function getHtml(url: string, timeoutMs = 12000): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return null;
    return (await res.text()).slice(0, 900_000);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function bestFromSrcset(srcset: string): string | null {
  const parts = srcset
    .split(",")
    .map((p) => p.trim().split(/\s+/))
    .filter((p) => p[0]);
  if (!parts.length) return null;
  // الأعرض غالباً هي نسخة المحتوى الكاملة.
  const scored = parts.map((p) => ({
    url: p[0]!,
    w: Number((p[1] ?? "").replace(/[^\d]/g, "")) || 0,
  }));
  scored.sort((a, b) => b.w - a.w);
  return scored[0]!.url;
}

/** يقرأ خصائص وسم HTML واحد بلا أي مكتبة خارجية (متوافق مع بيئة الحافة). */
function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) {
    out[m[1]!.toLowerCase()] = (m[3] ?? m[4] ?? m[5] ?? "").trim();
  }
  return out;
}

function allTags(html: string, name: string): Record<string, string>[] {
  const re = new RegExp(`<${name}\\b[^>]*>`, "gi");
  return (html.match(re) ?? []).map(attrs);
}

function metaContent(
  html: string,
  key: "property" | "name" | "rel",
  value: string,
): string | undefined {
  const list = key === "rel" ? allTags(html, "link") : allTags(html, "meta");
  const hit = list.find((a) => (a[key] ?? "").toLowerCase() === value.toLowerCase());
  return hit?.["content"] ?? hit?.["href"];
}

function pageTitle(html: string): string {
  return (html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)?.[1] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function collectFromPage(html: string, pageUrl: string): SiteAsset[] {
  const out: SiteAsset[] = [];
  const title = pageTitle(html);
  const push = (raw: string | undefined, alt: string, weight: number) => {
    if (!raw) return;
    const abs = (() => {
      try {
        return new URL(raw, pageUrl).toString();
      } catch {
        return null;
      }
    })();
    if (!abs || !/^https?:/i.test(abs)) return;
    if (/\.svg(\?|$)/i.test(abs)) return;
    if (JUNK.test(abs)) return;
    out.push({ url: abs, alt: alt.trim().slice(0, 200), pageUrl, weight });
  };

  // صور المشاركة الاجتماعية: أعلى جودة وأكثرها تمثيلاً للصفحة.
  push(metaContent(html, "property", "og:image"), title, 60);
  push(metaContent(html, "name", "twitter:image"), title, 55);
  push(metaContent(html, "rel", "image_src"), title, 40);

  for (const a of allTags(html, "img")) {
    const srcset = a["srcset"] ?? a["data-srcset"];
    const src =
      a["src"] ??
      a["data-src"] ??
      a["data-lazy-src"] ??
      (srcset ? (bestFromSrcset(srcset) ?? undefined) : undefined);
    const alt = a["alt"] ?? a["title"] ?? "";
    const w = Number(a["width"] ?? 0);
    const h = Number(a["height"] ?? 0);
    if ((w && w < 200) || (h && h < 200)) continue;
    push(src, alt, alt ? 18 : 8);
  }

  // صور منظمة داخل بيانات JSON-LD (منتجات، مقالات).
  const ld = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const block of ld ?? []) {
    const text = block.replace(/^[\s\S]*?>/, "").replace(/<\/script>$/i, "");
    if (!text || text.length > 200_000) continue;
    try {
      const json: unknown = JSON.parse(text);
      const walk = (n: unknown, depth = 0) => {
        if (depth > 6 || !n) return;
        if (Array.isArray(n)) return n.forEach((x) => walk(x, depth + 1));
        if (typeof n !== "object") return;
        const o = n as Record<string, unknown>;
        const img = o["image"];
        const nm = typeof o["name"] === "string" ? (o["name"] as string) : "";
        if (typeof img === "string") push(img, nm, 45);
        if (Array.isArray(img)) img.forEach((x) => typeof x === "string" && push(x, nm, 45));
        if (img && typeof img === "object" && typeof (img as { url?: string }).url === "string")
          push((img as { url: string }).url, nm, 45);
        Object.values(o).forEach((v) => walk(v, depth + 1));
      };
      walk(json);
    } catch {
      /* تجاهل JSON التالف */
    }
  }

  return out;
}

function internalLinks(html: string, baseUrl: string, limit: number): string[] {
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const good: string[] = [];
  const preferred =
    /(product|shop|store|menu|blog|news|service|gallery|work|portfolio|about|منتج|متجر|مدونة|خدمات|أعمال)/i;
  for (const a of allTags(html, "a")) {
    const href = a["href"];
    if (!href || href.startsWith("#")) continue;
    let u: URL;
    try {
      u = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (u.hostname !== base.hostname) continue;
    if (/\.(pdf|jpg|png|zip|mp4|webp)$/i.test(u.pathname)) continue;
    u.hash = "";
    const key = u.toString();
    if (seen.has(key) || key === baseUrl) continue;
    seen.add(key);
    if (preferred.test(u.pathname)) good.unshift(key);
    else good.push(key);
  }
  return good.slice(0, limit);
}

/** يجمع صور الموقع من الصفحة الرئيسية وحتى 5 صفحات داخلية مهمة. */
export async function harvestSiteImages(rawUrl: string, maxPages = 6): Promise<SiteAsset[]> {
  const home = normalizeUrl(rawUrl);
  if (!home) return [];
  const html = await getHtml(home);
  if (!html) return [];

  const assets: SiteAsset[] = collectFromPage(html, home);
  const pages = internalLinks(html, home, maxPages - 1);

  const rest = await Promise.all(
    pages.map(async (p) => {
      const h = await getHtml(p, 9000);
      return h ? collectFromPage(h, p) : [];
    }),
  );
  for (const list of rest) assets.push(...list);

  const byUrl = new Map<string, SiteAsset>();
  for (const a of assets) {
    const prev = byUrl.get(a.url);
    if (!prev || a.weight > prev.weight) byUrl.set(a.url, a);
  }
  return [...byUrl.values()].sort((a, b) => b.weight - a.weight).slice(0, 60);
}

const STOP = new Set([
  "على",
  "في",
  "من",
  "عن",
  "الى",
  "إلى",
  "مع",
  "هذا",
  "هذه",
  "التي",
  "الذي",
  "يا",
  "او",
  "أو",
  "و",
  "ال",
  "اكتب",
  "اعمل",
  "سوّي",
  "سوي",
  "منشور",
  "بوست",
  "صورة",
  "صور",
  "محتوى",
  "لي",
  "لنا",
  "عن",
  "the",
  "a",
  "an",
  "for",
  "with",
  "and",
  "of",
  "to",
  "post",
  "image",
  "write",
  "make",
  "create",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/[ةه]/g, "ه")
    .replace(/[ىي]/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOP.has(t));
}

/** ترتيب صور الموقع حسب صلتها بنص الطلب (النص البديل + اسم الملف + مسار الصفحة). */
export function rankAssets(query: string, assets: SiteAsset[], limit = 3): SiteAsset[] {
  const q = new Set(tokens(query));
  if (!assets.length) return [];
  const scored = assets.map((a) => {
    const hay = tokens(`${a.alt} ${decodeURIComponent(a.url)} ${decodeURIComponent(a.pageUrl)}`);
    let hits = 0;
    for (const t of hay) if (q.has(t)) hits += 1;
    return { asset: a, score: hits * 25 + a.weight / 10 };
  });
  scored.sort((a, b) => b.score - a.score);
  // لا نقترح صوراً بلا أي صلة إلا إذا لم توجد أي مطابقة إطلاقاً (نرجع الأقوى تمثيلاً).
  const relevant = scored.filter((s) => s.score >= 25);
  return (relevant.length ? relevant : scored).slice(0, limit).map((s) => s.asset);
}
