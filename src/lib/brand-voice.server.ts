/**
 * مستخرج صوت العلامة — مجاني ومفتوح المصدر بالكامل:
 * - جلب صفحات الموقع + استخراج المتن بـ `@mozilla/readability` (MIT) و`linkedom` (ISC)
 * - تحليل أسلوبي حتمي (بلا نموذج): طول الجمل، اللهجة، الإيموجي، أفعال الدعوة، المفردات المميزة
 *   مستوحى من نهج مشاريع «writing-style analyzer / stylometry» مفتوحة المصدر.
 * - ثم نموذج لغوي يحوّل الإحصاءات + العينات إلى «دليل صوت العلامة» منظّم يُحقن في كل الموظفين.
 */
import { parseHTML } from "linkedom";

import { normalizeArabic } from "./memory.server";
import { blockAwareText, extractArticle } from "./readability.server";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 SahlBot/1.0";

const timeout = (ms: number) => AbortSignal.timeout(ms);

export type StyleStats = {
  sampleWords: number;
  avgSentenceLength: number;
  shortSentenceRatio: number;
  questionRatio: number;
  exclamationRatio: number;
  emojiPerHundredWords: number;
  englishRatio: number;
  dialect: "egyptian" | "gulf" | "levantine" | "maghrebi" | "msa" | "mixed";
  dialectConfidence: number;
  addressing: "أنت" | "أنتم/حضراتكم" | "نحن" | "محايد";
  ctaVerbs: string[];
  topTerms: string[];
  topBigrams: string[];
  hasPrices: boolean;
  taglines: string[];
};

export type BrandVoiceProfile = {
  summary: string;
  personality: string[];
  tone: { formality: number; energy: number; warmth: number; humor: number };
  dialect: string;
  addressing: string;
  vocabulary: { use: string[]; avoid: string[] };
  signaturePhrases: string[];
  ctaStyle: string;
  emojiPolicy: string;
  formatting: string[];
  doList: string[];
  dontList: string[];
  perChannel: { channel: string; guidance: string }[];
  samples: { before: string; after: string }[];
};

export type BrandVoiceResult = {
  sourceUrls: string[];
  stats: StyleStats;
  profile: BrandVoiceProfile;
  rule: string;
};

/* ----------------------------- جلب المحتوى ----------------------------- */

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "ar,en;q=0.7", Accept: "text/html,*/*" },
      signal: timeout(9000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (type && !type.includes("html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** روابط داخلية واعدة (عنّا، خدمات، مدونة…) لتمثيل صوت العلامة بأمانة. */
function pickInternalLinks(html: string, base: string, max = 5): string[] {
  try {
    const { document } = parseHTML(html);
    const origin = new URL(base).origin;
    const prefer =
      /(about|عن|story|قصت|service|خدم|product|منتج|blog|مدون|faq|اسئل|pricing|اسعار|contact)/i;
    const seen = new Set<string>();
    const scored: { href: string; score: number }[] = [];
    for (const a of Array.from(document.querySelectorAll("a[href]"))) {
      const href = a.getAttribute("href") ?? "";
      if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) continue;
      let abs: URL;
      try {
        abs = new URL(href, base);
      } catch {
        continue;
      }
      if (abs.origin !== origin) continue;
      if (/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|zip)$/i.test(abs.pathname)) continue;
      abs.hash = "";
      const key = abs.toString().replace(/\/$/, "");
      if (seen.has(key) || key === base.replace(/\/$/, "")) continue;
      seen.add(key);
      const text = `${abs.pathname} ${a.textContent ?? ""}`;
      scored.push({
        href: key,
        score: (prefer.test(text) ? 2 : 0) + (abs.pathname.split("/").length <= 3 ? 1 : 0),
      });
    }
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, max)
      .map((s) => s.href);
  } catch {
    return [];
  }
}

function metaTexts(html: string): { title: string; description: string; headings: string[] } {
  try {
    const { document } = parseHTML(html);
    const title = document.querySelector("title")?.textContent?.trim() ?? "";
    const description =
      document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ??
      document.querySelector('meta[property="og:description"]')?.getAttribute("content")?.trim() ??
      "";
    const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
      .map((h) => (h.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter((t) => t.length > 3 && t.length < 120)
      .slice(0, 30);
    return { title, description, headings };
  } catch {
    return { title: "", description: "", headings: [] };
  }
}

function fallbackText(html: string): string {
  return blockAwareText(
    html
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " "),
  );
}

/**
 * كثير من المواقع الحديثة تُبنى بجافاسكريبت بالكامل، فالـHTML الخام يكاد يكون فارغاً.
 * في هذه الحالة نقرأ نسخة نصية مُصيَّرة من خدمة قارئ عامة قبل أن نستسلم.
 */
async function fetchRenderedText(url: string): Promise<string> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "User-Agent": UA, Accept: "text/plain" },
      signal: timeout(20_000),
    });
    if (!res.ok) return "";
    const raw = await res.text();
    return raw
      .replace(/^Title:.*$/m, "")
      .replace(/^URL Source:.*$/m, "")
      .replace(/^Markdown Content:\s*/m, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[ \t]+/g, " ")
      .trim()
      .slice(0, 16_000);
  } catch {
    return "";
  }
}

export async function collectSiteText(
  rawUrl: string,
): Promise<{ urls: string[]; text: string; headings: string[]; taglines: string[] }> {
  const home = normalizeUrl(rawUrl);
  const homeHtml = await fetchHtml(home);
  if (!homeHtml) {
    const rendered = await fetchRenderedText(home);
    return rendered.length > 200
      ? { urls: [home], text: rendered, headings: [], taglines: [] }
      : { urls: [], text: "", headings: [], taglines: [] };
  }

  const links = pickInternalLinks(homeHtml, home, 5);
  const pages = await Promise.all(links.map((l) => fetchHtml(l)));

  const urls = [home];
  const chunks: string[] = [];
  const headings: string[] = [];
  const taglines: string[] = [];

  const consume = (html: string, url: string) => {
    const m = metaTexts(html);
    if (m.title) taglines.push(m.title);
    if (m.description) taglines.push(m.description);
    headings.push(...m.headings);
    const article = extractArticle(html, url);
    const text = article?.text ?? fallbackText(html);
    if (text.length > 120) chunks.push(text.slice(0, 6000));
  };

  consume(homeHtml, home);
  pages.forEach((html, i) => {
    if (html) {
      urls.push(links[i]!);
      consume(html, links[i]!);
    }
  });

  let text = chunks.join("\n\n").slice(0, 24_000);
  // موقع يعتمد على جافاسكريبت: نكمل بنسخة مُصيَّرة بدل الفشل
  if (text.split(/\s+/).filter(Boolean).length < 60) {
    const rendered = await fetchRenderedText(home);
    if (rendered.length > 200) text = [text, rendered].filter(Boolean).join("\n\n");
  }

  return {
    urls,
    text: text.slice(0, 24_000),
    headings: [...new Set(headings)].slice(0, 40),
    taglines: [...new Set(taglines)].slice(0, 8),
  };
}

/* --------------------------- التحليل الأسلوبي --------------------------- */

const EMOJI_RE = /\p{Extended_Pictographic}/gu;

const DIALECT_MARKERS: Record<StyleStats["dialect"], RegExp[]> = {
  egyptian: [
    /\bإزاي\b|\bازاي\b/,
    /\bكده\b|\bكدة\b/,
    /\bدلوقتي\b/,
    /\bعايز/,
    /\bمش\b/,
    /\bليه\b/,
    /\bإحنا\b|\bاحنا\b/,
    /\bبتاع/,
    /\bخالص\b/,
    /\bأوي\b|\bاوي\b/,
    /\bجامد\b/,
    /\bهنا\b.*\bفي\b/,
  ],
  gulf: [
    /\bوايد\b/,
    /\bشلون/,
    /\bحياك/,
    /\bزين\b/,
    /\bأبي\b|\bابي\b/,
    /\bتبي\b|\bتبغى\b/,
    /\bالحين\b/,
    /\bعاد\b/,
    /\bمو\b/,
    /\bيبيله\b/,
    /\bكفو\b/,
  ],
  levantine: [
    /\bهلق\b|\bهلأ\b/,
    /\bشو\b/,
    /\bكتير\b/,
    /\bمنيح\b/,
    /\bبدي\b|\bبدك\b/,
    /\bهيك\b/,
    /\bليش\b/,
    /\bعنجد\b/,
  ],
  maghrebi: [
    /\bبزاف\b/,
    /\bواش\b/,
    /\bكيفاش\b/,
    /\bدابا\b/,
    /\bلاباس\b/,
    /\bشنو\b/,
    /\bغادي\b/,
    /\bديال/,
  ],
  msa: [
    /\bحيث\b/,
    /\bإن\b/,
    /\bلذلك\b/,
    /\bكما\b/,
    /\bالتي\b/,
    /\bالذي\b/,
    /\bنقدّم\b|\bنقدم\b/,
    /\bيمكنكم\b/,
    /\bتفضلوا\b/,
  ],
  mixed: [],
};

const CTA_VERBS = [
  "اطلب",
  "احجز",
  "تواصل",
  "اشترِ",
  "اشتري",
  "جرّب",
  "جرب",
  "سجّل",
  "سجل",
  "اكتشف",
  "ابدأ",
  "تسوق",
  "تسوّق",
  "حمّل",
  "حمل",
  "اتصل",
  "راسلنا",
  "كلمنا",
  "اشترك",
  "احصل",
  "زورنا",
  "شوف",
  "خلّي",
  "خلي",
  "استمتع",
  "اطّلع",
  "اعرف",
  "تعرف",
];

const STOP = new Set(
  "في من على عن الى الي مع هذا هذه ذلك التي الذي او و ما هل كل بعد قبل كان يكون هو هي ثم لكن اي ان أن إن لا نعم قد لم لن الا إلا كما حتى بين عند لدى ايضا أيضا او the and for with that this you your our are was were from have has not but can will all more".split(
    " ",
  ),
);

/** كلمات القوائم والفوتر التي تلوّث «المفردات المميزة» للعلامة. */
const BOILERPLATE =
  /^(مواعيد|العمل|العمليوميا|الرئيسيه|الصفحه|سياسه|الخصوصيه|الشروط|الاحكام|حقوق|محفوظه|تسجيل|الدخول|قائمه|التنقل|ملفات|الكوكيز|الاسئله|الشائعه|اتصل|بنا|عنا|جميع|ارسال|الاشتراك|النشره|السبت|الاحد|الاثنين|الثلاثاء|الاربعاء|الخميس|الجمعه|صباحا|مساء|الهاتف|الفاكس|البريد|العنوان)$/;

export function analyzeStyle(text: string, taglines: string[] = []): StyleStats {
  // نحافظ على أسطر الفقرات لأنها حدود جُمل حقيقية في صفحات الويب العربية
  const body = text.replace(/[ \t\u00a0]+/g, " ").trim();
  const raw = body.replace(/\s+/g, " ").trim();
  const words = raw.split(" ").filter(Boolean);
  const sentences = body
    .split(/(?<=[.!؟?…؛])\s+|\n+/)
    .flatMap((s) => (s.split(" ").length > 40 ? s.split(/،\s*/) : [s]))
    .map((s) => s.trim())
    .filter((s) => s.split(" ").length >= 2);
  const lens = sentences.map((s) => s.split(" ").length);
  const avg = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;

  const emojiCount = (raw.match(EMOJI_RE) ?? []).length;
  const englishWords = words.filter((w) => /^[A-Za-z][A-Za-z'’-]*$/.test(w)).length;

  // اللهجة
  const dialectScores = (Object.keys(DIALECT_MARKERS) as StyleStats["dialect"][]).map((d) => ({
    d,
    score: DIALECT_MARKERS[d].reduce(
      (acc, re) => acc + (raw.match(new RegExp(re.source, "g"))?.length ?? 0),
      0,
    ),
  }));
  dialectScores.sort((a, b) => b.score - a.score);
  const top = dialectScores[0]!;
  const second = dialectScores[1]!;
  const total = dialectScores.reduce((a, b) => a + b.score, 0) || 1;
  let dialect: StyleStats["dialect"] = top.score === 0 ? "msa" : top.d;
  // غياب أي مؤشر عامية دليل معقول على الفصحى، فلا تكون الثقة صفراً
  const conf = top.score === 0 ? 0.6 : top.score / total;
  if (
    top.d !== "msa" &&
    second.d !== "msa" &&
    second.score > 0 &&
    top.score / (second.score || 1) < 1.6
  )
    dialect = "mixed";

  // صيغة المخاطبة
  const you = (raw.match(/\b(أنت|انت|لك|ليك|عندك|تقدر|يمكنك|خلّيك|خليك|إنت)\b/g) ?? []).length;
  const plural = (raw.match(/\b(أنتم|انتم|لكم|عندكم|يمكنكم|حضراتكم|تفضلوا|تقدروا)\b/g) ?? [])
    .length;
  const we = (raw.match(/\b(نحن|إحنا|احنا|نقدم|نقدّم|فريقنا|بنقدم|عندنا|نوفر|نوفّر)\b/g) ?? [])
    .length;
  const addressing: StyleStats["addressing"] =
    Math.max(you, plural, we) === 0
      ? "محايد"
      : you >= plural && you >= we
        ? "أنت"
        : plural >= we
          ? "أنتم/حضراتكم"
          : "نحن";

  // الأفعال الدعوية
  const ctaVerbs = CTA_VERBS.filter((v) => new RegExp(`(^|\\s)${v}`).test(raw)).slice(0, 8);

  // مفردات مميزة
  const freq = new Map<string, number>();
  const norm = normalizeArabic(raw)
    .split(" ")
    .filter(
      (w) =>
        w.length > 2 &&
        w.length <= 18 &&
        !STOP.has(w) &&
        !/\d/.test(w) &&
        !BOILERPLATE.test(w),
    );
  for (const w of norm) freq.set(w, (freq.get(w) ?? 0) + 1);
  const topTerms = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 18)
    .map(([w]) => w);
  const bi = new Map<string, number>();
  for (let i = 0; i + 1 < norm.length; i += 1) {
    const k = `${norm[i]} ${norm[i + 1]}`;
    bi.set(k, (bi.get(k) ?? 0) + 1);
  }
  const topBigrams = [...bi.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w);

  return {
    sampleWords: words.length,
    avgSentenceLength: Math.round(avg * 10) / 10,
    shortSentenceRatio: lens.length
      ? Math.round((lens.filter((l) => l <= 8).length / lens.length) * 100) / 100
      : 0,
    questionRatio: sentences.length
      ? Math.round((sentences.filter((s) => /[؟?]$/.test(s)).length / sentences.length) * 100) / 100
      : 0,
    exclamationRatio: sentences.length
      ? Math.round((sentences.filter((s) => /!$/.test(s)).length / sentences.length) * 100) / 100
      : 0,
    emojiPerHundredWords: words.length ? Math.round((emojiCount / words.length) * 10000) / 100 : 0,
    englishRatio: words.length ? Math.round((englishWords / words.length) * 100) / 100 : 0,
    dialect,
    dialectConfidence: Math.round(conf * 100) / 100,
    addressing,
    ctaVerbs,
    topTerms,
    topBigrams,
    hasPrices: /(\d+\s?(ج\.?م|جنيه|ريال|ر\.?س|درهم|د\.?إ|دينار|\$|USD|SAR|EGP|AED))/.test(raw),
    taglines: taglines.slice(0, 6),
  };
}

export const dialectLabel: Record<StyleStats["dialect"], string> = {
  egyptian: "مصرية",
  gulf: "خليجية",
  levantine: "شامية",
  maghrebi: "مغاربية",
  msa: "فصحى مبسّطة",
  mixed: "مزيج فصحى وعامية",
};

/* ----------------------------- توليد الدليل ----------------------------- */

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

export async function synthesizeVoice(
  brand: { name: string; industry: string },
  stats: StyleStats,
  text: string,
  headings: string[],
): Promise<BrandVoiceProfile> {
  const { freeChat } = await import("./nour-research.server");
  const system = [
    "أنت خبير هوية لفظية (Verbal Identity) عربي متخصص في علامات مصر والخليج والمغرب العربي.",
    "مهمتك: تحويل عينات نصية حقيقية من موقع العلامة + إحصاءات أسلوبية إلى «دليل صوت العلامة» دقيق وقابل للتطبيق.",
    "قواعد صارمة: لا تخترع معلومات عن العلامة غير موجودة في العينات؛ استشهد بعبارات حقيقية من النص عند ذكر العبارات المميزة؛",
    "احترم اللهجة المكتشفة ولا تفرض الفصحى إن كانت العلامة عامية؛ أخرج JSON صالحاً فقط بلا أي نص خارج الكائن.",
  ].join(" ");

  const schema = `{
  "summary": "وصف صوت العلامة في جملتين",
  "personality": ["3-5 صفات شخصية"],
  "tone": {"formality": 0-10, "energy": 0-10, "warmth": 0-10, "humor": 0-10},
  "dialect": "اللهجة ونسبة الفصحى",
  "addressing": "كيف تخاطب العلامة القارئ (أنت/أنتم/نحن) ولماذا",
  "vocabulary": {"use": ["8-12 كلمة/عبارة تستخدمها العلامة فعلاً"], "avoid": ["6-10 كلمات لا تناسبها"]},
  "signaturePhrases": ["4-6 عبارات حرفية مميزة من النص"],
  "ctaStyle": "أسلوب الدعوة للفعل مع مثال",
  "emojiPolicy": "سياسة الإيموجي بدقة",
  "formatting": ["3-5 قواعد تنسيق: طول الجمل، القوائم، العناوين"],
  "doList": ["5 افعل"],
  "dontList": ["5 لا تفعل"],
  "perChannel": [{"channel":"إنستجرام","guidance":"..."},{"channel":"لينكدإن","guidance":"..."},{"channel":"مقال مدونة","guidance":"..."},{"channel":"رد على عميل","guidance":"..."}],
  "samples": [{"before":"جملة عامة باهتة","after":"نفس الجملة بصوت العلامة"}, {"before":"...","after":"..."}]
}`;

  const user = [
    `العلامة: ${brand.name} — المجال: ${brand.industry}`,
    "",
    "الإحصاءات الأسلوبية (محسوبة حتمياً من النص):",
    `- اللهجة المكتشفة: ${dialectLabel[stats.dialect]} (ثقة ${Math.round(stats.dialectConfidence * 100)}%)`,
    `- متوسط طول الجملة: ${stats.avgSentenceLength} كلمة · نسبة الجمل القصيرة: ${Math.round(stats.shortSentenceRatio * 100)}%`,
    `- أسئلة: ${Math.round(stats.questionRatio * 100)}% · تعجب: ${Math.round(stats.exclamationRatio * 100)}%`,
    `- إيموجي لكل 100 كلمة: ${stats.emojiPerHundredWords} · كلمات إنجليزية: ${Math.round(stats.englishRatio * 100)}%`,
    `- صيغة المخاطبة الغالبة: ${stats.addressing}`,
    `- أفعال الدعوة المستخدمة: ${stats.ctaVerbs.join("، ") || "لا شيء واضح"}`,
    `- مفردات متكررة: ${stats.topTerms.join("، ")}`,
    `- تعابير ثنائية متكررة: ${stats.topBigrams.join("، ") || "—"}`,
    `- شعارات/أوصاف: ${stats.taglines.join(" | ") || "—"}`,
    "",
    `عناوين الموقع: ${headings.slice(0, 25).join(" | ")}`,
    "",
    "عينات النص الحقيقية (مقتطفة):",
    text.slice(0, 9000),
    "",
    "أخرج JSON بهذا الشكل حرفياً:",
    schema,
  ].join("\n");

  const out = await freeChat("", [
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
  const parsed = extractJson<BrandVoiceProfile>(out);
  if (parsed && parsed.summary) return parsed;

  // احتياطي حتمي إن تعذّر التحليل بالنموذج
  return {
    summary: `صوت ${brand.name}: ${dialectLabel[stats.dialect]}، جمل بمتوسط ${stats.avgSentenceLength} كلمة، مخاطبة بصيغة «${stats.addressing}».`,
    personality: ["واضح", "قريب", "عملي"],
    tone: {
      formality: stats.dialect === "msa" ? 7 : 4,
      energy: stats.exclamationRatio > 0.1 ? 7 : 5,
      warmth: 6,
      humor: 3,
    },
    dialect: dialectLabel[stats.dialect],
    addressing: stats.addressing,
    vocabulary: {
      use: stats.topTerms.slice(0, 10),
      avoid: ["مصطلحات تقنية ثقيلة", "مبالغات تسويقية", "ترجمة حرفية"],
    },
    signaturePhrases: stats.taglines,
    ctaStyle: stats.ctaVerbs.length
      ? `أفعال مباشرة مثل: ${stats.ctaVerbs.join("، ")}`
      : "دعوة مباشرة وقصيرة في نهاية النص",
    emojiPolicy:
      stats.emojiPerHundredWords > 0.5
        ? "إيموجي خفيف (1-2) في السوشيال فقط"
        : "بلا إيموجي إلا نادرًا",
    formatting: ["جمل قصيرة", "فقرات من سطرين إلى ثلاثة", "قوائم عند تعدد النقاط"],
    doList: ["اذكر الفائدة قبل الميزة", "استخدم مفردات العلامة", "اختم بدعوة واحدة واضحة"],
    dontList: ["لا تخلط اللهجات", "لا تبالغ بالوعود", "لا تستخدم عبارات مترجمة حرفياً"],
    perChannel: [],
    samples: [],
  };
}

/** نص قاعدة إلزامية يُحفظ في عقل العلامة ويُحقن في كل موظف. */
export function voiceRuleText(profile: BrandVoiceProfile, stats: StyleStats): string {
  const t = profile.tone ?? { formality: 5, energy: 5, warmth: 5, humor: 3 };
  const lines = [
    `قاعدة نبرة إلزامية — صوت العلامة: ${profile.summary}`,
    `الشخصية: ${(profile.personality ?? []).join("، ")}`,
    `اللهجة: ${profile.dialect || dialectLabel[stats.dialect]} · المخاطبة: ${profile.addressing || stats.addressing}`,
    `النبرة (0-10): رسمية ${t.formality} · حيوية ${t.energy} · دفء ${t.warmth} · فكاهة ${t.humor}`,
    `مفردات نستخدمها: ${(profile.vocabulary?.use ?? []).join("، ")}`,
    `مفردات ممنوعة: ${(profile.vocabulary?.avoid ?? []).join("، ")}`,
    `عبارات مميزة: ${(profile.signaturePhrases ?? []).join(" | ")}`,
    `الدعوة للفعل: ${profile.ctaStyle}`,
    `الإيموجي: ${profile.emojiPolicy}`,
    `التنسيق: ${(profile.formatting ?? []).join("؛ ")}`,
    `افعل: ${(profile.doList ?? []).join("؛ ")}`,
    `لا تفعل: ${(profile.dontList ?? []).join("؛ ")}`,
  ];
  if (profile.perChannel?.length) {
    lines.push(
      `حسب القناة: ${profile.perChannel.map((c) => `${c.channel}: ${c.guidance}`).join(" || ")}`,
    );
  }
  return lines.join("\n");
}
