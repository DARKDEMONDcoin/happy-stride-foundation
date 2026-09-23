/**
 * «رفع جودة المنشور» — إعادة كتابة حتمية الهدف: نأخذ نص المنشور الحالي،
 * نقيسه بمقياس الجودة (post-quality)، ونعطي النموذج قائمة الإصلاحات المطلوبة
 * بالضبط، ثم نعيد القياس ونحتفظ بالأفضل. لا شيء تجميلي: إن لم ترتفع الدرجة
 * نُبقي النص الأصلي.
 */
import { getSecret } from "./secrets.server";
import { sanitizePostBody } from "./post-format";
import { scorePost, type QualityReport } from "./post-quality";
import { PROVIDER_LABEL } from "./platforms";

export type ImproveInput = {
  text: string;
  provider: string;
  hasMedia?: boolean | undefined;
  bannedWords?: string[] | undefined;
  tone?: string | undefined;
  industry?: string | undefined;
  city?: string | undefined;
  /** عدد النسخ البديلة المطلوبة (١–٣). */
  variants?: number | undefined;
};

export type ImproveVariant = {
  text: string;
  score: number;
  grade: QualityReport["grade"];
  angle: string;
};

export type ImproveResult = {
  before: { score: number; grade: QualityReport["grade"] };
  variants: ImproveVariant[];
  fixed: string[];
};

const ANGLES = [
  "زاوية «الهوك بسؤال/رقم صادم» ثم فائدة ملموسة",
  "زاوية «قصة قصيرة من الواقع» بضمير المتكلم",
  "زاوية «قائمة نقاط سريعة» سهلة القراءة على الجوال",
];

function rulesFor(report: QualityReport, input: ImproveInput): string {
  const musts = report.checks
    .filter((c) => c.severity !== "pass")
    .map((c) => `- ${c.label}: ${c.hint}`);
  return [
    `المنصة: ${PROVIDER_LABEL[input.provider] ?? input.provider}`,
    input.tone ? `نبرة العلامة: ${input.tone}` : "",
    input.industry ? `المجال: ${input.industry}` : "",
    input.city ? `السوق/المدينة: ${input.city}` : "",
    input.bannedWords?.length ? `كلمات ممنوعة تماماً: ${input.bannedWords.join("، ")}` : "",
    musts.length ? `إصلاحات إلزامية:\n${musts.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const SYSTEM = [
  "أنت كاتب محتوى سوشيال عربي من الطراز الأول.",
  "هدفك تحويل النص إلى منشور عالمي الجودة: هوك قوي، وعد قيمة واضح، جمهور محدد، إثبات ثقة، قابلية حفظ/مشاركة، وCTA عملي.",
  "تعيد الكتابة بنفس المعنى والحقائق دون اختراع أي معلومة جديدة (لا أسعار ولا أرقام ولا مواعيد لم ترد في الأصل).",
  "ممنوع تماماً: Markdown (** ## - جداول)، أكواد، JSON، روابط صور، أي كلام موجّه لصاحب الحساب.",
  "المخرج = نصوص منشورات فقط، جاهزة للنسخ واللصق في المنصة، بأسطر قصيرة وفقرات مفصولة.",
].join(" ");

const GATEWAY_RESPONSES = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";
const VARIANT_SEPARATOR = "---نسخة---";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function userFacingGatewayError(status: number, raw: string): string {
  let message = raw.trim();
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string };
    message = parsed.error?.message ?? parsed.message ?? message;
  } catch {
    /* النص كما هو */
  }
  if (status === 401) return "إعداد Lovable AI غير مكتمل. أعد المحاولة بعد ضبط مفتاح الذكاء الاصطناعي.";
  if (status === 402) return message || "رصيد Lovable AI غير كافٍ حالياً. أضف رصيداً ثم أعد المحاولة.";
  if (status === 403) return message || "Lovable AI غير متاح لهذه المساحة حالياً. راجع إعدادات المساحة.";
  if (status === 429) return message || "الطلبات كثيرة الآن. انتظر قليلاً ثم أعد المحاولة.";
  return message || `تعذّر تحسين المنشور الآن (${status}).`;
}

function extractCompletedText(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const direct = (response as { output_text?: unknown }).output_text;
  if (typeof direct === "string" && direct.trim()) return direct;
  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";
  return output
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const content = (item as { content?: unknown }).content;
      return Array.isArray(content) ? content : [];
    })
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const text = (part as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .join("");
}

async function readResponsesStream(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("تعذّر قراءة رد Lovable AI.");

  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let reasoningFallback = "";

  async function consume(line: string) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    let parsed: {
      type?: string;
      delta?: unknown;
      response?: unknown;
      error?: { message?: string };
    };
    try {
      parsed = JSON.parse(payload) as typeof parsed;
    } catch {
      return;
    }
    if (parsed.type === "response.output_text.delta" && typeof parsed.delta === "string") {
      text += parsed.delta;
    }
    if (parsed.type === "response.reasoning_summary_text.delta" && typeof parsed.delta === "string") {
      reasoningFallback += parsed.delta;
    }
    if (parsed.type === "response.completed") {
      const completed = extractCompletedText(parsed.response);
      if (completed.trim()) text = completed;
    }
    if (parsed.type === "response.failed" || parsed.type === "error") {
      throw new Error(parsed.error?.message ?? "فشل تحسين المنشور عبر Lovable AI.");
    }
  }

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) await consume(line);
  }
  if (buffer) await consume(buffer);
  return (text.trim() || reasoningFallback.trim()).trim();
}

async function callLovableRewrite(messages: ChatMessage[]): Promise<string> {
  const key = await getSecret("LOVABLE_API_KEY");
  if (!key) throw new Error("إعداد Lovable AI غير مكتمل. أعد المحاولة بعد تفعيل المفتاح.");

  const body = JSON.stringify({
    model: MODEL,
    input: messages.map((message) => ({
      role: message.role,
      content: [{ type: message.role === "assistant" ? "output_text" : "input_text", text: message.content }],
    })),
    stream: true,
    store: false,
    reasoning: { effort: "low", summary: "auto" },
    include: ["reasoning.encrypted_content"],
  });

  let lastError = "";
  let waitMs = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    const res = await fetch(GATEWAY_RESPONSES, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body,
    });

    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      lastError = userFacingGatewayError(res.status, raw);
      if (res.status !== 429 && res.status < 500) throw new Error(lastError);
      const retryAfter = Number(res.headers.get("Retry-After") ?? "");
      waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 900 * 2 ** attempt;
      continue;
    }
    const out = await readResponsesStream(res);
    if (!out) throw new Error("لم يرجع Lovable AI نصاً قابلاً للاستخدام الآن.");
    return out;
  }

  throw new Error(lastError || "Lovable AI مشغول الآن. أعد المحاولة بعد قليل.");
}

function splitVariants(raw: string, count: number): string[] {
  const cleaned = raw
    .replace(/```(?:text|markdown)?/gi, "")
    .replace(/```/g, "")
    .trim();
  const bySeparator = cleaned
    .split(VARIANT_SEPARATOR)
    .map((part) => sanitizePostBody(part.replace(/^نسخة\s*\d+\s*[:：-]?/imu, "")))
    .filter((part) => part.length >= 30);
  if (bySeparator.length) return bySeparator.slice(0, count);
  const byHeading = cleaned
    .split(/(?:^|\n)\s*(?:نسخة|النسخة)\s*\d+\s*[:：-]?\s*/imu)
    .map((part) => sanitizePostBody(part))
    .filter((part) => part.length >= 30);
  return (byHeading.length ? byHeading : [sanitizePostBody(cleaned)]).slice(0, count);
}

/** يعيد نسخاً محسّنة مرتبة بالدرجة، مع الاحتفاظ بالأصل إن كان أفضل. */
export async function improvePost(input: ImproveInput): Promise<ImproveResult> {
  const original = sanitizePostBody(input.text) || input.text.trim();
  const base = scorePost({
    text: original,
    provider: input.provider,
    hasMedia: input.hasMedia ?? false,
    bannedWords: input.bannedWords ?? [],
  });

  const count = Math.min(3, Math.max(1, input.variants ?? 2));
  const rules = rulesFor(base, input);

  const raw = await callLovableRewrite(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          `اكتب ${count} نسخ مختلفة فقط.`,
          `افصل بين كل نسخة والتي بعدها بسطر يحتوي بالضبط: ${VARIANT_SEPARATOR}`,
          "لا تكتب عناوين ولا شرحاً ولا ترقيماً خارج نصوص المنشورات.",
          "ضع الهاشتاقات في آخر النص فقط، ولا تضف معلومة غير موجودة في الأصل.",
          "اختر من هذه الزوايا بالترتيب:",
          ...ANGLES.slice(0, count).map((angle, index) => `${index + 1}. ${angle}`),
          "",
          rules,
          "",
          `درجة النص الحالية: ${base.score}/100 (${base.grade}). الهدف العملي: ارفع الدرجة بقدر ممكن مع الحفاظ على الحقيقة والمعنى.`,
          "",
          "المنشور الأصلي:",
          original,
        ].join("\n"),
      },
    ],
  );

  const drafts = splitVariants(raw, count).map((text, index) => {
    const report = scorePost({
      text,
      provider: input.provider,
      hasMedia: input.hasMedia ?? false,
      bannedWords: input.bannedWords ?? [],
    });
    return {
      text,
      score: report.score,
      grade: report.grade,
      angle: ANGLES[index] ?? "نسخة محسّنة",
    } satisfies ImproveVariant;
  });

  const variants = drafts
    .filter((v, index, all) => all.findIndex((item) => item.text === v.text) === index)
    .filter((v) => v.score >= Math.max(55, base.score - 5))
    .sort((a, b) => b.score - a.score);

  const best = variants[0];
  const fixed = best
    ? base.checks
        .filter((c) => c.severity !== "pass")
        .filter((c) => {
          const after = scorePost({
            text: best.text,
            provider: input.provider,
            hasMedia: input.hasMedia ?? false,
            bannedWords: input.bannedWords ?? [],
          }).checks.find((x) => x.id === c.id);
          return after?.severity === "pass";
        })
        .map((c) => c.label)
    : [];

  return { before: { score: base.score, grade: base.grade }, variants, fixed };
}
