/**
 * ذاكرة نور: استرجاع دلالي مجاني بالكامل بلا مزوّد embeddings مدفوع.
 * نستخدم تمثيل حروف/كلمات (n-grams) + وزن TF-IDF مبسّط + تشابه جيب التمام،
 * وهو ما يمنح استرجاعاً قريباً من الدلالي للعربية (يتحمّل اللواصق والتشكيل).
 */

const AR_DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;

/** تطبيع عربي: إزالة التشكيل وتوحيد الألف/الهمزة/التاء المربوطة/الياء. */
export function normalizeArabic(text: string): string {
  return text
    .toLowerCase()
    .replace(AR_DIACRITICS, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set([
  "في",
  "من",
  "على",
  "عن",
  "الى",
  "الي",
  "مع",
  "هذا",
  "هذه",
  "ذلك",
  "التي",
  "الذي",
  "او",
  "و",
  "ما",
  "هل",
  "كل",
  "بعد",
  "قبل",
  "كان",
  "يكون",
  "هو",
  "هي",
  "ثم",
  "لكن",
  "اي",
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
]);

/** بصمة نصية: كلمات + ثلاثيات حروف لتقاطع أعمق من المطابقة الحرفية. */
function features(text: string): Map<string, number> {
  const norm = normalizeArabic(text);
  const map = new Map<string, number>();
  const add = (t: string) => map.set(t, (map.get(t) ?? 0) + 1);
  const words = norm.split(" ").filter((w) => w.length > 1 && !STOP.has(w));
  for (const w of words) {
    add(`w:${w}`);
    // جذر تقريبي: إزالة "ال" واللواحق الشائعة
    const stem = w.replace(/^(ال|وال|بال|كال|فال)/, "").replace(/(ات|ون|ين|ية|يه|ها|هم)$/, "");
    if (stem.length > 2 && stem !== w) add(`w:${stem}`);
    for (let i = 0; i + 3 <= w.length; i += 1) add(`g:${w.slice(i, i + 3)}`);
  }
  for (let i = 0; i + 1 < words.length; i += 1) add(`b:${words[i]} ${words[i + 1]}`);
  return map;
}

function cosine(a: Map<string, number>, b: Map<string, number>, idf: Map<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [t, v] of a) {
    const w = (idf.get(t) ?? 1) * v;
    na += w * w;
    const bv = b.get(t);
    if (bv) dot += w * (idf.get(t) ?? 1) * bv;
  }
  for (const [t, v] of b) {
    const w = (idf.get(t) ?? 1) * v;
    nb += w * w;
  }
  if (!na || !nb) return 0;
  return dot / Math.sqrt(na * nb);
}

export type MemoryItem = { title: string; body?: string | null; kind?: string | null };

export type DurableMemory = { content: string; kind?: string | null };

/** يحول الذكريات الذرية إلى نفس شكل ذاكرة العلامة كي تشارك محرك الترتيب. */
export function durableMemoryItems(items: DurableMemory[]): MemoryItem[] {
  return items.map((item) => ({ title: item.content, kind: item.kind ?? "fact" }));
}

/** استخراج محافظ للحقائق التي صرّح المستخدم بأنها دائمة؛ لا يخمّن حقائق من الطلبات العادية. */
export function extractExplicitMemories(text: string): { kind: string; content: string }[] {
  const lines = text
    .split(/[\n.!؟]+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rules: Array<[RegExp, string]> = [
    [/^(?:تذكر|افتكر|احفظ|خلي بالك)(?:\s+(?:أن|ان))?\s*[:：-]?\s*(.+)$/i, "fact"],
    [/^(?:نفضل|أفضل|افضل|أحب|احب)\s+(.+)$/i, "preference"],
    [/^(?:ممنوع|لا تستخدم|لا تكتب)\s+(.+)$/i, "rule"],
    [/^(?:تصحيح|الصحيح هو)\s*[:：-]?\s*(.+)$/i, "correction"],
    [/^(?:قررنا|القرار هو)\s*[:：-]?\s*(.+)$/i, "decision"],
  ];
  const found: { kind: string; content: string }[] = [];
  for (const line of lines) {
    for (const [pattern, kind] of rules) {
      const match = line.match(pattern);
      if (match?.[1] && match[1].trim().length >= 4) {
        found.push({ kind, content: match[1].trim().slice(0, 500) });
        break;
      }
    }
  }
  return found.slice(0, 4);
}

export type RankedMemory = MemoryItem & { score: number };

/**
 * ترتيب عناصر الذاكرة حسب صلتها الدلالية بالطلب الحالي.
 * ترجع العناصر الأعلى صلة فقط، مع الإبقاء على العناصر الإلزامية (القواعد/النبرة) دائماً.
 */
export function rankMemories(items: MemoryItem[], query: string, limit = 8): RankedMemory[] {
  if (items.length <= limit) return items.map((i) => ({ ...i, score: 1 }));

  const docs = items.map((i) => features(`${i.title} ${i.body ?? ""} ${i.kind ?? ""}`));
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = new Map<string, number>();
  for (const [t, n] of df) idf.set(t, Math.log(1 + items.length / n));

  const q = features(query);
  const mandatory = /قاعدة|ممنوع|نبرة|إلزامي|الزامي/;

  const scored = items.map((item, i) => ({
    ...item,
    score: cosine(q, docs[i]!, idf),
    must: mandatory.test(`${item.title} ${item.body ?? ""}`),
  }));

  // القواعد الإلزامية تُحفظ دائماً (بحد أقصى 3) ولا تزاحم العناصر الأكثر صلة
  const musts = scored.filter((r) => r.must).slice(0, 3);
  const rest = scored
    .filter((r) => !r.must && r.score > 0.02)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit - musts.length));

  return [...musts, ...rest].map(({ must: _must, ...r }) => r);
}

/** نص جاهز للحقن في تعليمات النموذج. */
export function memoryBlock(items: MemoryItem[], query: string, limit = 8): string {
  return rankMemories(items, query, limit)
    .map((b) => `- [${b.kind ?? "note"}] ${b.title}${b.body ? `: ${b.body}` : ""}`)
    .join("\n");
}
