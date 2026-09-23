/**
 * قراءة الصفحات نفسها — الفرق بين «وجدنا رابطاً» و«قرأنا ما فيه».
 *
 * مقتطف نتيجة البحث سطران؛ الرقم الذي يحتاجه الموظف (سعر، نسبة، معيار، مدة)
 * يكون غالباً داخل الصفحة لا في المقتطف. هنا نقرأ الصفحة نصاً نظيفاً، ثم
 * نستخرج منها **الجمل التي تحمل أرقاماً** فقط، وننسب كل جملة لرابطها.
 *
 * ثلاث قواعد تحكم هذا الملف:
 * 1) لا نقرأ إلا ما سمح به الموقع: كل جلب يمر عبر طبقة أمان البحث (robots،
 *    تهدئة، قاطع دائرة، سقف يومي، تخزين مؤقت) فلا نسبّب حملاً ولا نُحظر.
 * 2) لا نخترع: الجملة تُنقل كما وردت ومعها رابطها، ومن لا يحمل رقماً لا يُنقل.
 * 3) نص الصفحة **بيانات لا تعليمات** — لا يُنفَّذ منه شيء مهما بدا أمراً.
 */
import { safeFetch } from "./research-safety.server";

/** بوابة قراءة مجانية ومفتوحة تعيد الصفحة نصاً نظيفاً بلا سكربتات ولا إعلانات. */
const READER = "https://r.jina.ai/";

export type PageFact = {
  /** الجملة كما وردت في الصفحة. */
  text: string;
  url: string;
  /** عنوان الصفحة إن أمكن استخراجه. */
  title: string;
};

export type PageRead = {
  url: string;
  title: string;
  text: string;
  facts: PageFact[];
};

/** أرقام ونِسَب وعملات ومدد: ما يصلح أن يكون دليلاً قابلاً للاقتباس. */
const NUMERIC =
  /(\d[\d.,]*\s*(٪|%|جنيه|ريال|درهم|دينار|دولار|egp|sar|aed|usd|k|m|مليون|ألف|الف|يوم|أيام|ساعة|شهر|سنة|مرة|ضعف)|\b\d[\d.,]{2,}\b|\b(19|20)\d{2}\b)/i;
/** جمل تسويقية جوفاء: «الأفضل، اتصل بنا، اطلب عرض سعر» — لا قيمة استدلالية فيها. */
const BOILERPLATE =
  /(اتصل بنا|تواصل معنا|اطلب عرض|واتساب|جميع الحقوق|سياسة الخصوصية|اشترك في النشرة|cookie|privacy policy|subscribe)/i;
/** أسطر المراجع والفهارس: أرقامها تواريخ أرشفة وصفحات كتب، لا وقائع عن موضوعنا. */
const CITATION =
  /(مؤرشف من الأصل|اطلع عليه بتاريخ|ISBN|ص\.\s?\d|doi:|vol\.\s?\d|pp\.\s?\d|retrieved on|archived from)/i;

const TITLE_LINE = /^Title:\s*(.+)$/m;

/** ينظّف سطراً من رموز الماركداون دون المساس بالمعنى. */
const strip = (s: string): string =>
  s
    // رابط ماركداون يُختصر إلى نصّه: الرابط المرمّز يحمل «%» فيبدو كأنه نسبة مئوية.
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#*_>`|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * يقسّم النص إلى جمل، ويُلحق بكل جملة قصيرة السطرَ الذي قبلها.
 * السبب: «السعر: 3,000 – 12,000 جنيه» بلا السطر السابق رقم بلا معنى —
 * والسطر السابق هو اسم الباقة الذي يجعل الرقم قابلاً للاقتباس.
 */
function sentences(text: string): string[] {
  const lines = text
    .replace(/\r/g, "")
    .split(/\n+/)
    .flatMap((l) => l.split(/(?<=[.!؟?])\s+/))
    .map(strip)
    .filter((l) => l.length >= 6 && l.length <= 320);

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.length < 16) continue;
    const prev = lines[i - 1];
    out.push(line.length < 90 && prev && prev.length < 120 ? `${prev} — ${line}` : line);
  }
  return out;
}

/**
 * يقرأ صفحة واحدة ويستخرج جملها الرقمية.
 * لا يرمي استثناءً أبداً: تعذّر القراءة يعيد null والبحث يكمل بغيره.
 */
export async function readPage(url: string, maxFacts = 6): Promise<PageRead | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  // الملفات الثقيلة لا تُقرأ نصاً: لا نهدر ميزانية على PDF ضخم أو صورة.
  if (/\.(pdf|docx?|pptx?|zip|rar|jpe?g|png|webp|gif|mp4|mp3)(\?|$)/i.test(url)) return null;

  const res = await safeFetch(`${READER}${url}`, {
    // البوابة نفسها هي من يحترم موقع المصدر؛ ونحن نحترم البوابة بسقفها اليومي.
    skipRobots: true,
    // البوابة ترفض الوكلاء المتنكّرين كمتصفح وتقبل الهوية المعلنة — الصدق هنا أنجح.
    agent: "bot",
    ms: 15_000,
    maxChars: 120_000,
  });
  if (!res.ok || res.text.length < 200) return null;

  const title = TITLE_LINE.exec(res.text)?.[1]?.trim() ?? url;
  const body = res.text.replace(/^(Title|URL Source|Published Time|Markdown Content):.*$/gm, "");

  const seen = new Set<string>();
  const facts: PageFact[] = [];
  for (const s of sentences(body)) {
    if (!NUMERIC.test(s) || BOILERPLATE.test(s) || CITATION.test(s)) continue;
    // عنوان يحمل سنة فقط ليس دليلاً: نريد جملة فيها قيمة حقيقية.
    if (!/\d[\d.,]*\s*(٪|%|جنيه|ريال|درهم|دينار|دولار|egp|sar|aed|usd|مليون|ألف|الف|يوم|ساعة|شهر|مرة|ضعف)/i.test(s) && !/\d[\d.,]{2,}/.test(s.replace(/\b(19|20)\d{2}\b/g, ""))) continue;
    const key = s.slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    facts.push({ text: s, url, title });
    if (facts.length >= maxFacts) break;
  }

  return { url, title, text: body.slice(0, 20_000), facts };
}

/**
 * يقرأ مجموعة صفحات على التوازي ضمن ميزانية زمنية.
 * القراءة المتوازية محدودة عمداً (طبقة الأمان تسمح بمضيفين اثنين في اللحظة)
 * حتى لا نبدو كزاحف عدواني على أي موقع.
 */
export async function readPages(urls: string[], budgetMs = 20_000, perPage = 5): Promise<PageRead[]> {
  const picks = [...new Set(urls)].slice(0, 6);
  if (!picks.length) return [];
  const deadline = new Promise<PageRead[]>((resolve) => setTimeout(() => resolve([]), budgetMs));
  const work = Promise.all(picks.map((u) => readPage(u, perPage).catch(() => null))).then(
    (rows) => rows.filter((r): r is PageRead => r !== null && r.facts.length > 0),
  );
  return Promise.race([work, deadline]);
}

/** يعرض الحقائق المقروءة بصيغة قابلة للاقتباس المباشر مع مصدر كل جملة. */
export function renderFacts(facts: PageFact[]): string {
  if (!facts.length) return "";
  const lines = facts.map((f) => `- «${f.text}»\n  — ${f.title}\n  ${f.url}`);
  return [
    "### أرقام وجمل مقتبسة حرفياً من داخل الصفحات (لا من مقتطفات البحث)",
    ...lines,
  ].join("\n");
}
