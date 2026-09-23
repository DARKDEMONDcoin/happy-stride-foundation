/**
 * كتابة المقالات الطويلة على مراحل.
 *
 * مقال عربي بـ٢٠٠٠ كلمة داخل حقل JSON واحد يتجاوز حد الرموز فيُقتطع الرد،
 * فيخسر المستخدم المقال كله ويبقى ملخصاً فقط. الحل: هيكل صغير أولاً، ثم كتابة
 * الأقسام كنص Markdown عادي (بلا JSON) في دفعات، ثم تجميعها في مقال واحد كامل.
 */
import { freeChat, parseJson } from "./nour-research.server";

type Outline = {
  title: string;
  meta_title?: string;
  meta_description?: string;
  keyword?: string;
  sections: { h2: string; points?: string[] }[];
  faq?: { q: string; a: string }[];
};

/** عدد الكلمات المطلوب في نص الطلب. */
export function requestedWords(message: string): number {
  const m = /(\d{3,5})\s*كلمة/.exec(message);
  return m?.[1] ? Math.min(6000, Number(m[1])) : 0;
}

/** هل الطلب مقال طويل يستحق الكتابة على مراحل؟ */
export function isLongArticleRequest(message: string): boolean {
  const words = requestedWords(message);
  return (
    (words >= 800 || /مقال\s*(سيو|شامل|كامل)|دليل شامل/.test(message)) &&
    !/تغريدة|منشور قصير/.test(message)
  );
}

const SECTIONS_PER_BATCH = 3;

async function buildOutline(
  apiKey: string,
  system: string,
  message: string,
  words: number,
): Promise<Outline | null> {
  const raw = await freeChat(
    apiKey,
    [
      { role: "system", content: system },
      {
        role: "user",
        content:
          `${message}\n\nأعد الآن هيكل المقال فقط (بلا نص المقال) بصيغة JSON:\n` +
          `{"title":"عنوان المقال","meta_title":"≤60 حرفاً","meta_description":"≤155 حرفاً","keyword":"الكلمة المفتاحية الرئيسية",` +
          `"sections":[{"h2":"عنوان القسم","points":["نقطة","نقطة"]}],"faq":[{"q":"سؤال","a":"إجابة موجزة"}]}\n` +
          `اجعل عدد الأقسام مناسباً لطول ${words || 1500} كلمة (٦ إلى ٩ أقسام)، وأضف ٥ أسئلة شائعة. اختصر النقاط جداً.`,
      },
    ],
    { json: true, timeoutMs: 50_000, maxTokens: 3000, budgetMs: 100_000 },
  );
  const parsed = parseJson<Outline>(raw);
  if (
    !Array.isArray(parsed?.sections) ||
    !parsed.sections.length ||
    typeof parsed.title !== "string"
  )
    return null;
  return parsed;
}

async function writeSections(
  apiKey: string,
  system: string,
  message: string,
  outline: Outline,
  batch: { h2: string; points?: string[] }[],
  wordsPerSection: number,
): Promise<string> {
  const list = batch
    .map(
      (s) =>
        `## ${String(s.h2 ?? "")}${Array.isArray(s.points) && s.points.length ? `\n   نقاط: ${s.points.map(String).join(" · ")}` : ""}`,
    )
    .join("\n");
  const text = await freeChat(
    apiKey,
    [
      { role: "system", content: system },
      {
        role: "user",
        content:
          `الطلب الأصلي: ${message}\nعنوان المقال: ${outline.title}\nالكلمة المفتاحية: ${outline.keyword ?? ""}\n\n` +
          `اكتب الآن أقسام المقال التالية فقط، بنص Markdown عادي (لا JSON ولا مقدمات ولا تعليق):\n${list}\n\n` +
          `التزم بعنوان ## لكل قسم كما هو، واستخدم ### للعناوين الفرعية، وحوالي ${wordsPerSection} كلمة لكل قسم، ` +
          `بعربية فصحى واضحة وأمثلة ملموسة، وأدرج جدول مقارنة Markdown في القسم المناسب إن كان مطلوباً.`,
      },
    ],
    { timeoutMs: 90_000, maxTokens: 5000, budgetMs: 140_000 },
  );
  return text.trim();
}

/** مقال كامل مقسّم إلى دفعات، مع الميتا والأسئلة الشائعة وسكيما FAQ. */
export async function generateLongArticle(
  apiKey: string,
  system: string,
  message: string,
): Promise<{ title: string; body: string } | null> {
  const words = requestedWords(message) || 1500;
  const outline = await buildOutline(apiKey, system, message, words).catch((error) => {
    console.warn("[longform] outline failed:", error instanceof Error ? error.message : error);
    return null;
  });
  if (!outline) return null;

  const sections = outline.sections.slice(0, 10);
  const wordsPerSection = Math.max(150, Math.round(words / sections.length));
  const batches: (typeof sections)[] = [];
  for (let i = 0; i < sections.length; i += SECTIONS_PER_BATCH)
    batches.push(sections.slice(i, i + SECTIONS_PER_BATCH));

  const parts = await Promise.all(
    batches.map((batch) =>
      writeSections(apiKey, system, message, outline, batch, wordsPerSection).catch((error) => {
        console.warn("[longform] batch failed:", error instanceof Error ? error.message : error);
        return "";
      }),
    ),
  );
  const bodyText = parts.filter(Boolean).join("\n\n");
  if (bodyText.length < 400) return null;

  const head = [
    `# ${outline.title}`,
    outline.meta_title ? `**Meta title:** ${outline.meta_title}` : "",
    outline.meta_description ? `**Meta description:** ${outline.meta_description}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const faq = outline.faq?.length
    ? `\n\n## الأسئلة الشائعة\n\n${outline.faq.map((f) => `**${f.q}**\n\n${f.a}`).join("\n\n")}` +
      `\n\n\`\`\`json\n${JSON.stringify(
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: outline.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        },
        null,
        2,
      )}\n\`\`\``
    : "";

  return { title: outline.title, body: `${head}\n\n${bodyText}${faq}` };
}
