/**
 * فحص سيو مجاني للصفحة — بلا مفاتيح ولا اشتراكات:
 * - فحوصات on-page حتمية (عنوان/وصف/H1/صور/روابط/canonical/schema/hreflang/RTL) عبر `linkedom`
 *   قواعدها مستوحاة من أدوات مفتوحة المصدر مثل SEOnaut وUnlighthouse.
 * - سرعة وأداء من PageSpeed Insights API المجاني (Lighthouse) عند توفره.
 */
import { parseHTML } from "linkedom";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 SahlBot/1.0";

export type AuditCheck = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  fix?: string;
};

export type SeoAudit = {
  url: string;
  finalUrl: string;
  fetchedMs: number;
  score: number;
  checks: AuditCheck[];
  page: {
    title: string;
    description: string;
    h1: string[];
    wordCount: number;
    lang: string;
    dir: string;
    images: number;
    imagesMissingAlt: number;
    internalLinks: number;
    externalLinks: number;
    schemaTypes: string[];
  };
  speed: null | {
    strategy: "mobile";
    performance: number | null;
    seo: number | null;
    accessibility: number | null;
    lcp: string | null;
    cls: string | null;
    inp: string | null;
  };
};

const norm = (raw: string) =>
  /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;

export async function auditPage(rawUrl: string): Promise<SeoAudit> {
  const url = norm(rawUrl);
  const started = Date.now();
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "ar,en;q=0.7", Accept: "text/html,*/*" },
    signal: AbortSignal.timeout(12_000),
    redirect: "follow",
  });
  const fetchedMs = Date.now() - started;
  if (!res.ok) throw new Error(`تعذّر فتح الصفحة (HTTP ${res.status}).`);
  const html = await res.text();
  const finalUrl = res.url || url;
  const { document } = parseHTML(html);

  const q = (sel: string) => document.querySelector(sel);
  const qa = (sel: string) => Array.from(document.querySelectorAll(sel));
  const attr = (sel: string, a: string) => q(sel)?.getAttribute(a)?.trim() ?? "";

  const title = q("title")?.textContent?.trim() ?? "";
  const description = attr('meta[name="description"]', "content");
  const canonical = attr('link[rel="canonical"]', "href");
  const robots = attr('meta[name="robots"]', "content");
  const viewport = attr('meta[name="viewport"]', "content");
  const ogTitle = attr('meta[property="og:title"]', "content");
  const ogImage = attr('meta[property="og:image"]', "content");
  const lang = document.documentElement?.getAttribute("lang")?.trim() ?? "";
  const dir = document.documentElement?.getAttribute("dir")?.trim() ?? "";
  const h1 = qa("h1")
    .map((h) => (h.textContent ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const h2 = qa("h2").length;
  const imgs = qa("img");
  const imagesMissingAlt = imgs.filter((i) => !(i.getAttribute("alt") ?? "").trim()).length;
  const hreflang = qa('link[rel="alternate"][hreflang]').length;

  let origin = "";
  try {
    origin = new URL(finalUrl).origin;
  } catch {
    origin = "";
  }
  let internalLinks = 0;
  let externalLinks = 0;
  for (const a of qa("a[href]")) {
    const href = a.getAttribute("href") ?? "";
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) continue;
    try {
      const u = new URL(href, finalUrl);
      if (u.origin === origin) internalLinks += 1;
      else externalLinks += 1;
    } catch {
      /* ignore */
    }
  }

  const schemaTypes: string[] = [];
  for (const s of qa('script[type="application/ld+json"]')) {
    try {
      const j = JSON.parse(s.textContent ?? "") as unknown;
      const collect = (v: unknown) => {
        if (Array.isArray(v)) v.forEach(collect);
        else if (v && typeof v === "object") {
          const t = (v as Record<string, unknown>)["@type"];
          if (typeof t === "string") schemaTypes.push(t);
          if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && schemaTypes.push(x));
          const g = (v as Record<string, unknown>)["@graph"];
          if (g) collect(g);
        }
      };
      collect(j);
    } catch {
      /* ignore */
    }
  }

  for (const el of qa("script, style, noscript, template, svg")) el.remove();
  const bodyText = (document.body?.textContent ?? "").replace(/\s+/g, " ").trim();
  const wordCount = bodyText ? bodyText.split(" ").length : 0;
  const arabicRatio = bodyText
    ? (bodyText.match(/[\u0600-\u06FF]/g)?.length ?? 0) / bodyText.replace(/\s/g, "").length
    : 0;

  const checks: AuditCheck[] = [];
  const add = (c: AuditCheck) => checks.push(c);

  add(
    !title
      ? {
          id: "title",
          label: "عنوان الصفحة",
          status: "fail",
          detail: "لا يوجد <title>.",
          fix: "أضف عنوانًا فريدًا من ٣٠–٦٠ حرفًا يحتوي الكلمة المفتاحية.",
        }
      : title.length > 65 || title.length < 20
        ? {
            id: "title",
            label: "عنوان الصفحة",
            status: "warn",
            detail: `«${title}» (${title.length} حرفًا).`,
            fix: "اجعله بين ٣٠ و٦٠ حرفًا حتى لا يُقتطع في نتائج البحث.",
          }
        : {
            id: "title",
            label: "عنوان الصفحة",
            status: "pass",
            detail: `«${title}» (${title.length} حرفًا).`,
          },
  );
  add(
    !description
      ? {
          id: "desc",
          label: "الوصف التعريفي",
          status: "fail",
          detail: "لا يوجد meta description.",
          fix: "اكتب وصفًا من ٧٠–١٦٠ حرفًا يحفّز النقر ويذكر الفائدة.",
        }
      : description.length > 165 || description.length < 60
        ? {
            id: "desc",
            label: "الوصف التعريفي",
            status: "warn",
            detail: `${description.length} حرفًا.`,
            fix: "الطول المثالي ٧٠–١٦٠ حرفًا.",
          }
        : {
            id: "desc",
            label: "الوصف التعريفي",
            status: "pass",
            detail: `${description.length} حرفًا.`,
          },
  );
  add(
    h1.length === 0
      ? {
          id: "h1",
          label: "العنوان الرئيسي H1",
          status: "fail",
          detail: "لا يوجد H1.",
          fix: "أضف H1 واحدًا يصف الصفحة بوضوح.",
        }
      : h1.length > 1
        ? {
            id: "h1",
            label: "العنوان الرئيسي H1",
            status: "warn",
            detail: `${h1.length} عناوين H1.`,
            fix: "اترك H1 واحدًا فقط وحوّل الباقي إلى H2.",
          }
        : { id: "h1", label: "العنوان الرئيسي H1", status: "pass", detail: `«${h1[0]}»` },
  );
  add(
    h2 === 0 && wordCount > 300
      ? {
          id: "h2",
          label: "بنية العناوين",
          status: "warn",
          detail: "لا توجد عناوين H2 رغم طول المحتوى.",
          fix: "قسّم المحتوى بعناوين H2 كل ٢٠٠–٣٠٠ كلمة.",
        }
      : { id: "h2", label: "بنية العناوين", status: "pass", detail: `${h2} عنوان H2.` },
  );
  add(
    wordCount < 300
      ? {
          id: "words",
          label: "حجم المحتوى",
          status: "warn",
          detail: `${wordCount} كلمة تقريبًا.`,
          fix: "الصفحات التي تتصدر عادةً تتجاوز ٦٠٠ كلمة مفيدة.",
        }
      : { id: "words", label: "حجم المحتوى", status: "pass", detail: `${wordCount} كلمة تقريبًا.` },
  );
  add(
    imgs.length && imagesMissingAlt
      ? {
          id: "alt",
          label: "نصوص بديلة للصور",
          status: imagesMissingAlt / imgs.length > 0.5 ? "fail" : "warn",
          detail: `${imagesMissingAlt} من ${imgs.length} صورة بلا alt.`,
          fix: "أضف وصفًا عربيًا مختصرًا لكل صورة — يفيد البحث وإمكانية الوصول.",
        }
      : {
          id: "alt",
          label: "نصوص بديلة للصور",
          status: "pass",
          detail: `${imgs.length} صورة، جميعها موصوفة.`,
        },
  );
  add(
    !canonical
      ? {
          id: "canonical",
          label: "الرابط القياسي canonical",
          status: "warn",
          detail: "غير موجود.",
          fix: 'أضف <link rel="canonical"> لمنع تكرار المحتوى.',
        }
      : { id: "canonical", label: "الرابط القياسي canonical", status: "pass", detail: canonical },
  );
  add(
    /noindex/i.test(robots)
      ? {
          id: "robots",
          label: "قابلية الفهرسة",
          status: "fail",
          detail: `robots: ${robots}`,
          fix: "أزل noindex إن كنت تريد ظهور الصفحة في جوجل.",
        }
      : {
          id: "robots",
          label: "قابلية الفهرسة",
          status: "pass",
          detail: robots || "مسموح بالفهرسة.",
        },
  );
  add(
    !viewport
      ? {
          id: "viewport",
          label: "تهيئة الجوال",
          status: "fail",
          detail: "لا يوجد meta viewport.",
          fix: 'أضف <meta name="viewport" content="width=device-width, initial-scale=1">.',
        }
      : { id: "viewport", label: "تهيئة الجوال", status: "pass", detail: "موجود." },
  );
  add(
    !lang
      ? {
          id: "lang",
          label: "لغة الصفحة",
          status: "warn",
          detail: "لا توجد سمة lang.",
          fix: 'أضف <html lang="ar" dir="rtl"> للصفحات العربية.',
        }
      : arabicRatio > 0.4 && !/^ar/i.test(lang)
        ? {
            id: "lang",
            label: "لغة الصفحة",
            status: "warn",
            detail: `lang="${lang}" بينما المحتوى عربي.`,
            fix: 'غيّرها إلى lang="ar".',
          }
        : { id: "lang", label: "لغة الصفحة", status: "pass", detail: `lang="${lang}"` },
  );
  if (arabicRatio > 0.4) {
    add(
      dir.toLowerCase() !== "rtl"
        ? {
            id: "dir",
            label: "اتجاه RTL",
            status: "warn",
            detail: 'المحتوى عربي بلا dir="rtl".',
            fix: 'أضف dir="rtl" على <html>.',
          }
        : { id: "dir", label: "اتجاه RTL", status: "pass", detail: "مضبوط." },
    );
  }
  add(
    !ogTitle || !ogImage
      ? {
          id: "og",
          label: "بطاقة المشاركة (Open Graph)",
          status: "warn",
          detail: `${ogTitle ? "" : "og:title مفقود. "}${ogImage ? "" : "og:image مفقود."}`.trim(),
          fix: "أضف og:title وog:description وog:image حتى تظهر الروابط بشكل جذاب على واتساب وإكس ولينكدإن.",
        }
      : { id: "og", label: "بطاقة المشاركة (Open Graph)", status: "pass", detail: "مكتملة." },
  );
  add(
    schemaTypes.length === 0
      ? {
          id: "schema",
          label: "البيانات المنظّمة Schema",
          status: "warn",
          detail: "لا يوجد JSON-LD.",
          fix: "أضف Organization/LocalBusiness + Article أو Product أو FAQPage حسب الصفحة.",
        }
      : {
          id: "schema",
          label: "البيانات المنظّمة Schema",
          status: "pass",
          detail: [...new Set(schemaTypes)].join("، "),
        },
  );
  add(
    internalLinks < 3
      ? {
          id: "links",
          label: "الروابط الداخلية",
          status: "warn",
          detail: `${internalLinks} رابط داخلي.`,
          fix: "اربط الصفحة بـ ٣–١٠ صفحات ذات صلة بنصوص رابط وصفية.",
        }
      : {
          id: "links",
          label: "الروابط الداخلية",
          status: "pass",
          detail: `${internalLinks} داخلي · ${externalLinks} خارجي.`,
        },
  );
  add(
    !finalUrl.startsWith("https://")
      ? {
          id: "https",
          label: "HTTPS",
          status: "fail",
          detail: "الصفحة غير مشفّرة.",
          fix: "فعّل شهادة SSL — عامل ترتيب مباشر.",
        }
      : { id: "https", label: "HTTPS", status: "pass", detail: "مشفّر." },
  );
  if (hreflang)
    add({ id: "hreflang", label: "hreflang", status: "pass", detail: `${hreflang} بديل لغوي.` });
  add(
    fetchedMs > 2500
      ? {
          id: "ttfb",
          label: "زمن استجابة الخادم",
          status: "warn",
          detail: `${fetchedMs} ملّي ثانية.`,
          fix: "فعّل التخزين المؤقت أو CDN لخفض زمن الاستجابة تحت ٨٠٠ ملّي ثانية.",
        }
      : {
          id: "ttfb",
          label: "زمن استجابة الخادم",
          status: "pass",
          detail: `${fetchedMs} ملّي ثانية.`,
        },
  );

  const weight = { pass: 1, warn: 0.5, fail: 0 } as const;
  const score = Math.round(
    (checks.reduce((a, c) => a + weight[c.status], 0) / checks.length) * 100,
  );

  return {
    url,
    finalUrl,
    fetchedMs,
    score,
    checks,
    page: {
      title,
      description,
      h1,
      wordCount,
      lang,
      dir,
      images: imgs.length,
      imagesMissingAlt,
      internalLinks,
      externalLinks,
      schemaTypes: [...new Set(schemaTypes)],
    },
    speed: null,
  };
}

/** PageSpeed Insights (Lighthouse) — مجاني بلا مفتاح ضمن حدود الاستخدام. */
export async function pageSpeed(url: string): Promise<SeoAudit["speed"]> {
  try {
    const api = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    api.searchParams.set("url", url);
    api.searchParams.set("strategy", "mobile");
    for (const c of ["performance", "seo", "accessibility"]) api.searchParams.append("category", c);
    api.searchParams.set("locale", "ar");
    const key = process.env["PAGESPEED_API_KEY"];
    if (key) api.searchParams.set("key", key);
    const res = await fetch(api, { signal: AbortSignal.timeout(45_000) });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      lighthouseResult?: {
        categories?: Record<string, { score?: number }>;
        audits?: Record<string, { displayValue?: string }>;
      };
      loadingExperience?: { metrics?: Record<string, { percentile?: number }> };
    };
    const cat = j.lighthouseResult?.categories ?? {};
    const audits = j.lighthouseResult?.audits ?? {};
    const pct = (k: string) =>
      cat[k]?.score != null ? Math.round((cat[k]!.score ?? 0) * 100) : null;
    const inp = j.loadingExperience?.metrics?.["INTERACTION_TO_NEXT_PAINT"]?.percentile;
    return {
      strategy: "mobile",
      performance: pct("performance"),
      seo: pct("seo"),
      accessibility: pct("accessibility"),
      lcp: audits["largest-contentful-paint"]?.displayValue ?? null,
      cls: audits["cumulative-layout-shift"]?.displayValue ?? null,
      inp: inp != null ? `${inp} ms` : null,
    };
  } catch {
    return null;
  }
}
