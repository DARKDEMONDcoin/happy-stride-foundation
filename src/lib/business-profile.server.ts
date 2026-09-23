/**
 * ملف العلامة التلقائي: من رابط الموقع فقط نفهم النشاط كاملاً.
 *
 * إشارات مجانية بالكامل:
 * - JSON-LD (Organization / LocalBusiness / Product / Store) و Open Graph و <html lang>.
 * - روابط التواصل الاجتماعي، أرقام الهاتف/واتساب، البريد، العناوين.
 * - بصمة المنصة (WordPress / Shopify / Webflow / Salla / Zid / Wix …) → تقترح التكامل الصحيح.
 * - نصوص الصفحات الرئيسية (عنّا/الخدمات/الأسعار) عبر Readability.
 * - اللهجة (من مستخرج صوت العلامة).
 * ثم مرور واحد على النموذج يحوّل كل ذلك إلى ملف منظّم يقرأه الموظفون الستة.
 */
import { parseHTML } from "linkedom";

import { analyzeStyle, collectSiteText, dialectLabel } from "./brand-voice.server";

export type BusinessProfile = {
  name: string;
  industry: string;
  summary: string;
  products: string[];
  audience: string;
  usp: string;
  locations: string[];
  country: string | null;
  dialect: string;
  socials: string[];
  contacts: string[];
  platform: string | null;
  competitors: string[];
  suggestedTone: string;
  /** اقتراحات أول مهمة لكل موظف — مبنية على ما فُهم من الموقع. */
  firstTasks: { employeeId: string; title: string; prompt: string }[];
  /** التكاملات الأعلى قيمة لهذا النشاط تحديداً (بترتيب). */
  recommendedIntegrations: { provider: string; why: string }[];
  pagesRead: string[];
  confidence: "high" | "medium" | "low";
};

const UA = "Mozilla/5.0 (compatible; SahlBot/1.0; +https://sahl.app)";

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

async function fetchHtml(url: string): Promise<{ html: string; headers: Headers } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "ar,en;q=0.7", Accept: "text/html,*/*" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return { html: await res.text(), headers: res.headers };
  } catch {
    return null;
  }
}

const SOCIAL_HOSTS: [RegExp, string][] = [
  [/instagram\.com/i, "instagram"],
  [/facebook\.com|fb\.com/i, "facebook"],
  [/tiktok\.com/i, "tiktok"],
  [/(^|\.)x\.com|twitter\.com/i, "x"],
  [/linkedin\.com/i, "linkedin"],
  [/youtube\.com|youtu\.be/i, "youtube"],
  [/snapchat\.com/i, "snapchat"],
  [/pinterest\.com/i, "pinterest"],
  [/wa\.me|api\.whatsapp\.com|whatsapp\.com/i, "whatsapp"],
  [/t\.me|telegram\.me/i, "telegram"],
];

const PLATFORM_SIGNS: [RegExp, string, string][] = [
  [/wp-content|wp-includes|wordpress/i, "WordPress", "wordpress"],
  [/cdn\.shopify\.com|Shopify\.theme|myshopify/i, "Shopify", "shopify"],
  [/webflow\.com|data-wf-page/i, "Webflow", "webflow"],
  [/ghost\.io|ghost-url|content\/images\//i, "Ghost", "ghost"],
  [/salla\.sa|cdn\.salla|salla-app/i, "سلة", "salla"],
  [/zid\.store|zid\.sa|cdn\.zid/i, "زد", "zid"],
  [/wix\.com|wixstatic/i, "Wix", "wix"],
  [/squarespace/i, "Squarespace", "squarespace"],
  [/woocommerce/i, "WooCommerce", "wordpress"],
  [/magento/i, "Magento", "magento"],
  [/expandcart/i, "ExpandCart", "expandcart"],
];

const COUNTRY_HINTS: [RegExp, string][] = [
  [/\+20\b|\b01[0125]\d{8}\b|القاهرة|الإسكندرية|الجيزة|مصر\b|\.eg\b|EGP|جنيه/i, "مصر"],
  [/\+966|\b05\d{8}\b|الرياض|جدة|الدمام|السعودية|\.sa\b|ريال سعودي|SAR/i, "السعودية"],
  [/\+971|دبي|أبوظبي|الشارقة|الإمارات|\.ae\b|درهم|AED/i, "الإمارات"],
  [/\+965|الكويت|\.kw\b|KWD/i, "الكويت"],
  [/\+974|الدوحة|قطر|\.qa\b|QAR/i, "قطر"],
  [/\+973|المنامة|البحرين|\.bh\b|BHD/i, "البحرين"],
  [/\+968|مسقط|عُمان|عمان\b|\.om\b|OMR/i, "عُمان"],
  [/\+962|عمّان|الأردن|\.jo\b|JOD/i, "الأردن"],
  [/\+961|بيروت|لبنان|\.lb\b/i, "لبنان"],
  [/\+964|بغداد|أربيل|البصرة|العراق|\.iq\b|IQD/i, "العراق"],
  [/\+212|الدار البيضاء|الرباط|مراكش|المغرب|\.ma\b|MAD/i, "المغرب"],
  [/\+213|الجزائر|\.dz\b|DZD/i, "الجزائر"],
  [/\+216|تونس|\.tn\b|TND/i, "تونس"],
  [/\+249|الخرطوم|السودان|\.sd\b/i, "السودان"],
  [/\+967|صنعاء|عدن|اليمن|\.ye\b/i, "اليمن"],
  [/\+218|طرابلس|بنغازي|ليبيا|\.ly\b/i, "ليبيا"],
  [/\+970|فلسطين|رام الله|غزة|\.ps\b/i, "فلسطين"],
];

type Signals = {
  title: string;
  description: string;
  ogSiteName: string;
  lang: string;
  jsonld: Record<string, unknown>[];
  socials: string[];
  contacts: string[];
  platform: { label: string; provider: string } | null;
  country: string | null;
  addresses: string[];
};

function collectSignals(html: string, base: string, headers: Headers): Signals {
  const { document } = parseHTML(html);
  const meta = (sel: string) => document.querySelector(sel)?.getAttribute("content")?.trim() ?? "";
  const jsonld: Record<string, unknown>[] = [];
  for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const parsed = JSON.parse(s.textContent ?? "") as unknown;
      const flat = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of flat) {
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          const graph = obj["@graph"];
          if (Array.isArray(graph)) jsonld.push(...(graph as Record<string, unknown>[]));
          else jsonld.push(obj);
        }
      }
    } catch {
      /* تجاهل JSON-LD المعطوب */
    }
  }

  const socials = new Set<string>();
  const contacts = new Set<string>();
  for (const a of Array.from(document.querySelectorAll("a[href]"))) {
    const href = a.getAttribute("href") ?? "";
    if (/^mailto:/i.test(href))
      contacts.add(
        href
          .replace(/^mailto:/i, "")
          .split("?")[0]!
          .trim(),
      );
    else if (/^tel:/i.test(href)) contacts.add(href.replace(/^tel:/i, "").replace(/\s/g, ""));
    else {
      for (const [rx, key] of SOCIAL_HOSTS) {
        if (rx.test(href)) {
          try {
            const u = new URL(href, base);
            socials.add(`${key}:${u.origin}${u.pathname}`.replace(/\/$/, ""));
          } catch {
            /* رابط غير صالح */
          }
          break;
        }
      }
    }
  }
  // JSON-LD sameAs
  for (const obj of jsonld) {
    const same = obj["sameAs"];
    const list = Array.isArray(same) ? same : typeof same === "string" ? [same] : [];
    for (const s of list) {
      if (typeof s !== "string") continue;
      for (const [rx, key] of SOCIAL_HOSTS)
        if (rx.test(s)) socials.add(`${key}:${s.replace(/\/$/, "")}`);
    }
    const tel = obj["telephone"];
    if (typeof tel === "string") contacts.add(tel.replace(/\s/g, ""));
  }
  // أرقام واتساب/هاتف من النص
  const text = html.replace(/<[^>]+>/g, " ");
  for (const m of text.matchAll(/(\+?\d[\d\s\-()]{8,16}\d)/g)) {
    const digits = m[1]!.replace(/[^\d+]/g, "");
    if (digits.length >= 10 && digits.length <= 15 && contacts.size < 6) contacts.add(digits);
  }

  const gen = meta('meta[name="generator"]');
  const poweredBy = headers.get("x-powered-by") ?? "";
  const shopifyHeader = headers.get("x-shopid") || headers.get("x-shopify-stage");
  let platform: Signals["platform"] = null;
  if (shopifyHeader) platform = { label: "Shopify", provider: "shopify" };
  else {
    for (const [rx, label, provider] of PLATFORM_SIGNS) {
      if (rx.test(gen) || rx.test(poweredBy) || rx.test(html.slice(0, 200_000))) {
        platform = { label, provider };
        break;
      }
    }
  }

  const addresses: string[] = [];
  for (const obj of jsonld) {
    const addr = obj["address"] as Record<string, unknown> | string | undefined;
    if (typeof addr === "string") addresses.push(addr);
    else if (addr && typeof addr === "object") {
      const parts = ["streetAddress", "addressLocality", "addressRegion", "addressCountry"]
        .map((k) => (typeof addr[k] === "string" ? (addr[k] as string) : ""))
        .filter(Boolean);
      if (parts.length) addresses.push(parts.join("، "));
    }
  }

  const sample = `${base} ${text.slice(0, 40_000)} ${addresses.join(" ")} ${[...contacts].join(" ")}`;
  let country: string | null = null;
  let best = 0;
  for (const [rx, name] of COUNTRY_HINTS) {
    const hits = (sample.match(new RegExp(rx.source, "gi")) ?? []).length;
    if (hits > best) {
      best = hits;
      country = name;
    }
  }

  return {
    title: document.querySelector("title")?.textContent?.trim() ?? "",
    description: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
    ogSiteName: meta('meta[property="og:site_name"]'),
    lang: document.documentElement?.getAttribute("lang") ?? "",
    jsonld,
    socials: [...socials].slice(0, 10),
    contacts: [...contacts].slice(0, 6),
    platform,
    country,
    addresses: addresses.slice(0, 4),
  };
}

function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text) ?? "";
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const arr = (v: unknown, max = 8) =>
  Array.isArray(v)
    ? (v.filter((x) => typeof x === "string" && x.trim()) as string[])
        .map((s) => s.trim().slice(0, 80))
        .slice(0, max)
    : [];

/** يبني ملف العلامة كاملاً من رابط الموقع. */
export async function profileWebsite(rawUrl: string): Promise<BusinessProfile> {
  const home = normalizeUrl(rawUrl);
  const first = await fetchHtml(home);
  if (!first) throw new Error("تعذّر الوصول إلى الموقع — تأكد من الرابط أو جرّب لاحقاً.");

  const signals = collectSignals(first.html, home, first.headers);
  const site = await collectSiteText(home);
  const stats = analyzeStyle(site.text, site.taglines);
  const dialect = dialectLabel[stats.dialect];

  // منافسون محتملون من نتائج البحث الحية (مجاناً) — يُنقّحهم النموذج.
  let serpCompetitors: string[] = [];
  try {
    const { serpSearch } = await import("./seo-research.server");
    const ownHost = new URL(home).hostname.replace(/^www\./, "");
    const q = [
      signals.ogSiteName || signals.title.split(/[|\-–—]/)[0]?.trim(),
      signals.country ?? "",
    ]
      .filter(Boolean)
      .join(" ");
    if (q.length > 3) {
      const rows = await serpSearch(`${q} بديل OR منافس OR مثل`);
      serpCompetitors = [
        ...new Set(
          rows.map((r) => {
            try {
              return new URL(r.url).hostname.replace(/^www\./, "");
            } catch {
              return "";
            }
          }),
        ),
      ]
        .filter(
          (h) =>
            h &&
            h !== ownHost &&
            !/wikipedia|facebook|instagram|youtube|linkedin|twitter|tiktok|google|amazon|noon\.com/.test(
              h,
            ),
        )
        .slice(0, 6);
    }
  } catch {
    /* بلا منافسين من البحث */
  }

  const evidence = [
    `الرابط: ${home}`,
    signals.title ? `العنوان: ${signals.title}` : "",
    signals.ogSiteName ? `اسم الموقع: ${signals.ogSiteName}` : "",
    signals.description ? `الوصف: ${signals.description}` : "",
    signals.lang ? `لغة الصفحة: ${signals.lang}` : "",
    signals.platform ? `المنصة: ${signals.platform.label}` : "",
    signals.country ? `الدولة المرجّحة من الإشارات: ${signals.country}` : "",
    signals.addresses.length ? `عناوين: ${signals.addresses.join(" | ")}` : "",
    signals.contacts.length ? `وسائل تواصل: ${signals.contacts.join("، ")}` : "",
    signals.socials.length ? `حسابات تواصل: ${signals.socials.join("، ")}` : "",
    signals.jsonld.length
      ? `بيانات منظمة: ${JSON.stringify(signals.jsonld.slice(0, 4)).slice(0, 2500)}`
      : "",
    serpCompetitors.length ? `نطاقات ظهرت في بحث المنافسين: ${serpCompetitors.join("، ")}` : "",
    `اللهجة المكتشفة: ${dialect}`,
    site.headings.length ? `عناوين الصفحات: ${site.headings.slice(0, 30).join(" | ")}` : "",
    site.text ? `نص الموقع (مقتطف):\n${site.text.slice(0, 9000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const system = [
    "أنت محلل أعمال عربي يبني «ملف علامة» دقيقاً من موقعها الإلكتروني لفريق من 6 موظفين ذكاء اصطناعي (سيو، سوشيال، تصميم، مساعدة تنفيذية، مبيعات، تحليلات).",
    "قواعد: لا تخترع حقائق غير موجودة في الأدلة؛ إن غاب شيء اكتب سلسلة فارغة أو مصفوفة فارغة. اكتب بالعربية. أخرج JSON صالحاً فقط.",
    "المنافسون: اختر من النطاقات المذكورة ما يبدو منافساً حقيقياً فقط (نفس النشاط ونفس السوق)، ويمكنك إضافة منافسين مشهورين تعرفهم يقيناً في نفس الدولة.",
    "firstTasks: 6 مهام (واحدة لكل موظف: nour, sonny, dana, eva, sam, adam) محددة جداً باسم المنتج/المدينة الفعلية، كل prompt جملة أمر جاهزة للإرسال في المحادثة.",
    "recommendedIntegrations: 3-5 من هذه المعرّفات فقط بترتيب الأثر: instagram, facebook, tiktok, linkedin, x, youtube, google-business, gmail, calendar, whatsapp, hubspot, sheets, wordpress, shopify, webflow, ghost, search-console, analytics, meta-ads, google-ads. إن كانت المنصة Shopify فرشّح shopify، وإن كانت WordPress فرشّح wordpress.",
  ].join("\n");

  const schema = `{
  "name": "اسم العلامة",
  "industry": "المجال بكلمتين إلى أربع (مثال: مطعم أكل صحي، متجر عبايات، عيادة أسنان)",
  "summary": "ما يفعلون ولمن، في جملتين",
  "products": ["أهم 3-8 منتجات/خدمات"],
  "audience": "الجمهور المستهدف (من، أين، ما دافعه)",
  "usp": "ما يميزهم في جملة",
  "locations": ["مدن/فروع"],
  "country": "الدولة الرئيسية أو null",
  "competitors": ["نطاقات أو أسماء 2-5 منافسين"],
  "suggestedTone": "نبرة مقترحة بأربع كلمات",
  "firstTasks": [{"employeeId": "nour", "title": "…", "prompt": "…"}],
  "recommendedIntegrations": [{"provider": "instagram", "why": "سبب من 8 كلمات"}],
  "confidence": "high|medium|low"
}`;

  const { freeChat } = await import("./nour-research.server");
  let ai: Partial<BusinessProfile> | null = null;
  try {
    const raw = await freeChat(
      "",
      [
        { role: "system", content: system },
        { role: "user", content: `الأدلة:\n${evidence}\n\nأخرج JSON بهذا الشكل:\n${schema}` },
      ],
      { json: true, timeoutMs: 45_000, maxTokens: 1800 },
    );
    ai = extractJson<Partial<BusinessProfile>>(raw);
  } catch (error) {
    console.error("[profile] llm failed:", error);
  }

  const name =
    str(ai?.name, 80) ||
    signals.ogSiteName ||
    signals.title.split(/[|\-–—]/)[0]?.trim() ||
    new URL(home).hostname;
  const tasks = Array.isArray(ai?.firstTasks)
    ? (ai!.firstTasks as unknown[])
        .filter((t): t is { employeeId: string; title: string; prompt: string } =>
          Boolean(
            t &&
            typeof t === "object" &&
            typeof (t as Record<string, unknown>)["prompt"] === "string",
          ),
        )
        .map((t) => ({
          employeeId: str(t.employeeId, 10),
          title: str(t.title, 90),
          prompt: str(t.prompt, 400),
        }))
        .filter((t) => ["nour", "sonny", "dana", "eva", "sam", "adam"].includes(t.employeeId))
        .slice(0, 6)
    : [];
  const integrations = Array.isArray(ai?.recommendedIntegrations)
    ? (ai!.recommendedIntegrations as unknown[])
        .filter((i): i is { provider: string; why: string } =>
          Boolean(
            i &&
            typeof i === "object" &&
            typeof (i as Record<string, unknown>)["provider"] === "string",
          ),
        )
        .map((i) => ({ provider: str(i.provider, 30), why: str(i.why, 100) }))
        .slice(0, 5)
    : [];
  if (
    signals.platform &&
    ["wordpress", "shopify", "webflow", "ghost"].includes(signals.platform.provider) &&
    !integrations.some((i) => i.provider === signals.platform!.provider)
  ) {
    integrations.unshift({
      provider: signals.platform.provider,
      why: `موقعك مبني على ${signals.platform.label} — نور تنشر عليه مباشرة`,
    });
  }

  return {
    name,
    industry: str(ai?.industry, 60) || "عام",
    summary: str(ai?.summary, 400) || signals.description,
    products: arr(ai?.products),
    audience: str(ai?.audience, 300),
    usp: str(ai?.usp, 200),
    locations: arr(ai?.locations, 6).length ? arr(ai?.locations, 6) : signals.addresses,
    country: str(ai?.country, 30) || signals.country,
    dialect,
    socials: signals.socials,
    contacts: signals.contacts,
    platform: signals.platform?.label ?? null,
    competitors: arr(ai?.competitors, 5).length
      ? arr(ai?.competitors, 5)
      : serpCompetitors.slice(0, 4),
    suggestedTone: str(ai?.suggestedTone, 60),
    firstTasks: tasks,
    recommendedIntegrations: integrations,
    pagesRead: site.urls.length ? site.urls : [home],
    confidence:
      ai?.confidence === "high" || ai?.confidence === "low" ? ai.confidence : ai ? "medium" : "low",
  };
}
