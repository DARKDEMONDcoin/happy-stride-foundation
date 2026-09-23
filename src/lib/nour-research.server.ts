import {
  keywordExpansion,
  keywordMetrics,
  serpSearch,
  auditPage,
  competitorInventory,
  entityProfile,
  contentBrief,
  type SerpResult,
} from "./seo-research.server";
import { nowAnchorLine } from "./time-awareness.server";
import { gscSnapshotFor } from "./gsc.functions";
import { ga4SnapshotFor } from "./ga4.functions";

export type ResearchPlan = {
  keywords?: string[];
  searches?: string[];
  urls?: string[];
  competitors?: string[];
  useSearchConsole?: boolean;
};

const OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";
const GEMINI = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const LOVABLE = "https://ai.gateway.lovable.dev/v1/chat/completions";

/** نماذج بوابة Lovable المدمجة (لا تحتاج مفتاحاً من المستخدم) — الأقوى أولاً ثم الاحتياطي. */
export const LOVABLE_MODELS = ["openai/gpt-5.6-sol", "google/gemini-3.8-flash"];

/** عائلة GPT-5 ترفض max_tokens وتحتاج مهلة أطول؛ حدّ الطول يُذكر في التعليمات بدلاً منه. */
const isGpt5 = (model: string) => /(^|\/)gpt-5/.test(model);

/**
 * خدمة الأولوية على بوابة Lovable: زمن استجابة أقل لنماذج gpt-5.6 —
 * تُطلب فقط على بوابة Lovable ومع هذه النماذج، وتُتجاهل تلقائياً إن لم تكن متاحة.
 */
const priorityFields = (endpoint: string, model: string) =>
  endpoint === LOVABLE && isGpt5(model) ? { service_tier: "priority" as const } : {};

/** نماذج Google AI Studio (المزوّد الأساسي) بالترتيب. */
// flash-lite أولاً: يردّ في ~7 ثوانٍ بجودة قريبة، بينما 3.6-flash يتجاوز 50 ثانية
// ويُقطع بمهلة الطلب (30 ثانية) فيُهدر الوقت قبل الاحتياطي.
export const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];

/**
 * أفضل النماذج المجانية على OpenRouter بترتيب مُختبَر (جودة عربية + سرعة + توافر)،
 * تُستخدم كاحتياطي عند فشل Gemini.
 */
export const FREE_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "minimax/minimax-m3:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "minimax/minimax-m2.7:free",
  "z-ai/glm-5.2:free",
];

export type ChatOptions = {
  json?: boolean;
  /** عمق استدلال النموذج: منخفض للدردشة، عالٍ للمخرجات الاستراتيجية. */
  reasoningEffort?: "low" | "medium" | "high";
  /** مهلة كل نموذج بالمللي ثانية (تمنع التعليق نهائياً). */
  timeoutMs?: number;
  maxTokens?: number;
  /** عدد النماذج التي نجربها قبل الاستسلام. */
  attempts?: number;
  /** نجرّب أول نموذجين بالتوازي: أول رد يفوز — أسرع زمن وصول ممكن. */
  race?: boolean;
  /** الميزانية الزمنية الإجمالية لكل المزوّدات (افتراضياً 120 ثانية أو ضعف مهلة النموذج). */
  budgetMs?: number;
  /** المنطقة الزمنية للعلامة — تضبط «اللحظة الآن» المحقونة في كل نداء. */
  timeZone?: string;
  /** تعطيل حقن مرساة الزمن (لا يُستخدم عملياً — النماذج بلا ساعة). */
  noTimeAnchor?: boolean;
};

/**
 * مرساة الزمن: كل نداء نموذج في المنصة — مهما كان مصدره (شات، أوتوبايلوت، بريفنج،
 * واتساب، قرارات، جدولة) — يخرج ومعه اللحظة الحالية محسوبةً على الخادم. النماذج لا
 * تملك ساعة، وبدون هذا السطر تخمّن التاريخ من بيانات تدريبها وتخطئ دائماً.
 */
function withNowAnchor(
  messages: { role: string; content: string }[],
  options: ChatOptions,
): { role: string; content: string }[] {
  if (options.noTimeAnchor) return messages;
  let anchor = "";
  try {
    // استيراد متزامن غير ممكن هنا، لذا نحسب السطر محلياً عبر الوحدة المحمّلة مسبقاً.
    anchor = nowAnchorLine(options.timeZone ?? "Asia/Riyadh");
  } catch {
    return messages;
  }
  if (!anchor) return messages;
  const index = messages.findIndex((m) => m.role === "system");
  if (index === -1) return [{ role: "system", content: anchor }, ...messages];
  if (messages[index]!.content.includes("اللحظة الآن")) return messages;
  return messages.map((m, i) =>
    i === index ? { ...m, content: `${anchor}\n\n${m.content}` } : m,
  );
}

/** خطأ حد الاستخدام اليومي المجاني على مستوى الحساب — لا فائدة من تجربة نماذج أخرى. */
export class DailyFreeLimitError extends Error {
  constructor(resetAt?: number) {
    super(
      `استُهلك الحد اليومي المجاني على OpenRouter (50 طلباً/يوم).${
        resetAt
          ? ` يتجدّد في ${new Date(resetAt).toISOString().replace("T", " ").slice(0, 16)} UTC.`
          : ""
      } أضف 10 أرصدة لرفع الحد إلى 1000 طلب/يوم، أو انتظر التجديد.`,
    );
    this.name = "DailyFreeLimitError";
  }
}

/** نماذج ترفضنا نهائياً (مثل المتاحة لأدوات agentic فقط) — نستبعدها لبقية العملية. */
const unavailable = new Set<string>();

async function callModel(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  options: ChatOptions,
): Promise<string> {
  const res = await fetch(OPENROUTER, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://happy-stride-project.lovable.app",
      "X-Title": "Sahl AI Team",
    },
    body: JSON.stringify({
      model,
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
      max_tokens: options.maxTokens ?? 1800,
      messages,
    }),
    signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
  });
  if (res.status === 401) throw new Error("مفتاح OpenRouter غير صالح.");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429 && text.includes("free-models-per-day")) {
      let resetAt: number | undefined;
      try {
        const parsed = JSON.parse(text) as {
          error?: { metadata?: { headers?: Record<string, string> } };
        };
        const raw = parsed.error?.metadata?.headers?.["X-RateLimit-Reset"];
        if (raw) resetAt = Number(raw);
      } catch {
        /* تجاهل */
      }
      throw new DailyFreeLimitError(resetAt);
    }
    if (res.status === 403 && text.includes("agentic harnesses")) unavailable.add(model);
    throw new Error(`${model}: ${res.status}`);
  }
  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error(`${model}: رد فارغ`);
  return content;
}

/** نداء نموذج Gemini عبر واجهة Google المتوافقة مع OpenAI. */
async function callOpenAICompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  options: ChatOptions,
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      // بدون هذا يستهلك gemini-3.6-flash دقائق في "التفكير" ويقطع الرد.
      reasoning_effort: options.reasoningEffort ?? "low",
      ...priorityFields(endpoint, model),
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
      ...(isGpt5(model) ? {} : { max_tokens: options.maxTokens ?? 1800 }),
      messages,
    }),
    signal: AbortSignal.timeout(
      isGpt5(model) ? Math.max(options.timeoutMs ?? 0, 90_000) : (options.timeoutMs ?? 30_000),
    ),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${model}: ${res.status} ${text.slice(0, 200)}`);
  }
  const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error(`${model}: رد فارغ`);
  return content;
}

/**
 * نداء النموذج: Gemini (Google AI Studio) كخيار أول،
 * ثم نماذج OpenRouter المجانية كاحتياطي تلقائي.
 */
export async function freeChat(
  keyHint: string,
  messages: { role: string; content: string }[],
  options: ChatOptions = {},
): Promise<string> {
  const { limitLlm } = await import("./limiter.server");
  return limitLlm(() => freeChatInner(keyHint, withNowAnchor(messages, options), options));
}

async function freeChatInner(
  keyHint: string,
  messages: { role: string; content: string }[],
  options: ChatOptions = {},
): Promise<string> {
  let lastError = "";
  const started = Date.now();
  /** ميزانية زمنية إجمالية: بعدها لا نجرّب مزوّداً جديداً حتى لا يعلّق الطلب دقائق. */
  const budgetMs = options.budgetMs ?? Math.max(120_000, (options.timeoutMs ?? 30_000) * 2);
  const remaining = () => budgetMs - (Date.now() - started);
  const scoped = (): ChatOptions => ({
    ...options,
    timeoutMs: Math.max(5_000, Math.min(options.timeoutMs ?? 30_000, remaining())),
  });
  const outOfBudget = () => remaining() < 8_000;

  const { providerKeys } = await import("./provider-keys.server");
  const keys = await providerKeys();
  const apiKey = keys.openrouter || keyHint;

  /** ضغط الطلبات المتوازية يرجع 429/503 مؤقتاً — نعيد المحاولة بتأخير متصاعد
   *  قبل الانتقال لمزوّد آخر، حتى لا يرى المستخدم فشلاً بلا سبب.
   *  المهلة المنتهية لا تُعاد على نفس النموذج: ستنتهي مجدداً وتُهدر الوقت. */
  const transient = (m: string) =>
    m.includes("429") ||
    m.includes("503") ||
    m.includes("502") ||
    m.includes("overloaded") ||
    m.includes("UNAVAILABLE");
  const timedOut = (m: string) => m.includes("timed out") || m.includes("aborted");

  async function withRetry(fn: () => Promise<string>, tries = 4): Promise<string> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = (error as Error).message;
        if (error instanceof DailyFreeLimitError) throw error;
        if (attempt >= tries - 1 || timedOut(lastError) || !transient(lastError) || outOfBudget())
          throw error;
        await new Promise((r) => setTimeout(r, 1200 * 2 ** attempt + Math.random() * 900));
      }
    }
  }

  if (keys.lovable) {
    // المخرجات الطويلة (مقال كامل): GPT-5 يتجاوز 90 ثانية ولا يقبل حدّ الطول — نبدأ بالنموذج السريع.
    const long = (options.maxTokens ?? 1800) > 2500;
    const order = long
      ? [...LOVABLE_MODELS].sort((a, b) => Number(isGpt5(a)) - Number(isGpt5(b)))
      : LOVABLE_MODELS;
    for (const model of order) {
      if (outOfBudget()) break;
      if (long && isGpt5(model) && remaining() < 90_000) continue;
      try {
        return await withRetry(() =>
          callOpenAICompatible(LOVABLE, keys.lovable!, model, messages, scoped()),
        );
      } catch {
        /* المزوّد التالي */
      }
    }
  }

  const geminiKey = keys.gemini;
  if (geminiKey) {
    for (const model of GEMINI_MODELS) {
      if (outOfBudget()) break;
      try {
        return await withRetry(() =>
          callOpenAICompatible(GEMINI, geminiKey, model, messages, scoped()),
        );
      } catch {
        /* المزوّد التالي */
      }
    }
  }
  if (outOfBudget())
    throw new Error(`تعذّر توليد الرد في الوقت المتاح (${lastError || "المزوّدات بطيئة"}).`);

  if (!apiKey) throw new Error(`تعذّر توليد الرد (${lastError || "لا يوجد مزوّد مهيأ"}).`);

  const pool = FREE_MODELS.filter((m) => !unavailable.has(m)).slice(
    0,
    options.attempts ?? FREE_MODELS.length,
  );

  if (options.race !== false && pool.length > 1) {
    // أول نموذجين بالتوازي: يقلّل زمن الانتظار إلى أسرع نموذج متاح لحظياً.
    try {
      return await Promise.any(
        pool.slice(0, 2).map((m) => callModel(apiKey, m, messages, scoped())),
      );
    } catch (error) {
      const errors = ((error as AggregateError).errors ?? []) as Error[];
      const fatal = errors.find(
        (e) => e instanceof DailyFreeLimitError || e.message.includes("مفتاح OpenRouter"),
      );
      if (fatal) throw fatal;
      lastError = errors[0]?.message ?? "فشل النموذجان الأسرع";
    }
  }

  for (const model of pool.slice(options.race === false ? 0 : 2)) {
    if (outOfBudget()) break;
    try {
      return await withRetry(() => callModel(apiKey, model, messages, scoped()), 3);
    } catch (error) {
      // حد يومي أو مفتاح خاطئ: التوقف فوراً بدل استنزاف الوقت في نماذج ستفشل بنفس السبب.
      if (error instanceof DailyFreeLimitError) throw error;
      const message = (error as Error).message;
      if (message.includes("مفتاح OpenRouter")) throw error;
      lastError = message;
    }
  }
  throw new Error(`تعذّر توليد الرد من النماذج المجانية (${lastError}).`);
}

/** نداء متدفّق (SSE) لواجهة متوافقة مع OpenAI — يسلّم كل دفعة نصية لحظة وصولها. */
async function callStream(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  options: ChatOptions,
  onDelta: (chunk: string) => void,
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: true,
      reasoning_effort: options.reasoningEffort ?? "low",
      ...priorityFields(endpoint, model),
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
      ...(isGpt5(model) ? {} : { max_tokens: options.maxTokens ?? 1800 }),
      messages,
    }),
    signal: AbortSignal.timeout(
      isGpt5(model) ? Math.max(options.timeoutMs ?? 0, 90_000) : (options.timeoutMs ?? 30_000),
    ),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`${model}: ${res.status} ${text.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
        };
        const piece = parsed.choices?.[0]?.delta?.content;
        if (piece) {
          full += piece;
          onDelta(piece);
        }
      } catch {
        /* دفعة غير مكتملة — تُهمل */
      }
    }
  }
  if (!full.trim()) throw new Error(`${model}: رد فارغ`);
  return full;
}

/**
 * نفس منطق freeChat لكن بتدفّق حقيقي: يسلّم النص وهو يُكتب.
 * عند فشل كل المزوّدات المتدفّقة يرجع تلقائياً إلى النداء العادي (بلا تدفّق).
 */
export async function freeChatStream(
  keyHint: string,
  messages: { role: string; content: string }[],
  options: ChatOptions = {},
  handlers: { onDelta: (chunk: string) => void; onRestart?: () => void } = {
    onDelta: () => {},
  },
): Promise<string> {
  const { limitLlm } = await import("./limiter.server");
  const { providerKeys } = await import("./provider-keys.server");
  const keys = await providerKeys();
  const tries: { endpoint: string; key: string; model: string }[] = [
    ...(keys.lovable
      ? LOVABLE_MODELS.map((model) => ({ endpoint: LOVABLE, key: keys.lovable!, model }))
      : []),
    ...(keys.gemini
      ? GEMINI_MODELS.map((model) => ({ endpoint: GEMINI, key: keys.gemini!, model }))
      : []),
  ];
  messages = withNowAnchor(messages, options);
  let emitted = false;
  for (const attempt of tries) {
    try {
      return await limitLlm(() =>
        callStream(attempt.endpoint, attempt.key, attempt.model, messages, options, (chunk) => {
          emitted = true;
          handlers.onDelta(chunk);
        }),
      );
    } catch (error) {
      console.warn(
        "[stream] provider failed:",
        attempt.model,
        error instanceof Error ? error.message : error,
      );
      if (emitted) {
        emitted = false;
        handlers.onRestart?.();
      }
    }
  }
  if (emitted) handlers.onRestart?.();
  return freeChat(keyHint, messages, options);
}

export function parseJson<T>(raw: string): T | null {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** المرحلة الأولى: يقرر النموذج ما يحتاجه من بيانات حقيقية قبل الإجابة. */
export async function planResearch(
  apiKey: string,
  brand: { name: string; industry: string },
  message: string,
): Promise<ResearchPlan> {
  const raw = await freeChat(
    apiKey,
    [
      {
        role: "system",
        content: [
          "أنت مخطِّط بحث لخبيرة سيو عربية. حدّد فقط البيانات الحقيقية اللازمة للإجابة على طلب المستخدم.",
          'أعد JSON فقط: {"keywords":["كلمة بذرية"],"searches":["استعلام بحث"],"urls":["رابط لتحليله"],"competitors":["نطاق منافس"],"useSearchConsole":true|false}',
          "قواعد: 0-3 كلمات بذرية، 0-3 استعلامات بحث، 0-2 روابط (فقط إن ذكر المستخدم رابطاً)، 0-2 نطاقات منافسة (فقط إن ذُكرت)، واستخدم useSearchConsole=true إذا كان السؤال عن أداء الموقع/الترتيب/النقرات.",
          "إن كان الطلب عاماً أو محادثة بسيطة، أعد كل الحقول فارغة.",
        ].join("\n"),
      },
      { role: "user", content: `العلامة: ${brand.name} (${brand.industry})\nالطلب: ${message}` },
    ],
    { json: true, timeoutMs: 9_000, maxTokens: 300, attempts: 3 },
  );
  const plan = parseJson<ResearchPlan>(raw) ?? {};
  const clean = (arr: unknown, max: number) =>
    Array.isArray(arr)
      ? arr.filter((v): v is string => typeof v === "string" && v.trim().length > 1).slice(0, max)
      : [];
  return {
    keywords: clean(plan.keywords, 3),
    searches: clean(plan.searches, 3),
    urls: clean(plan.urls, 2).filter((u) => /^https?:\/\//.test(u)),
    competitors: clean(plan.competitors, 2),
    useSearchConsole: plan.useSearchConsole === true,
  };
}

export type Evidence = { block: string; sources: string[]; used: string[] };

/** المرحلة الثانية: تنفيذ البحث من مصادر مجانية وبناء كتلة أدلة للنموذج. */
export async function gatherEvidence(plan: ResearchPlan, workspaceId: string): Promise<Evidence> {
  const [keywordSets, metricSets, serpSets, audits, inventories, gsc, ga4, brief, entities] =
    await Promise.all([
      Promise.all((plan.keywords ?? []).map((k) => keywordExpansion(k))),
      Promise.all((plan.keywords ?? []).slice(0, 3).map((k) => keywordMetrics(k))),
      Promise.all((plan.searches ?? []).map(async (q) => ({ q, results: await serpSearch(q) }))),
      Promise.all((plan.urls ?? []).map((u) => auditPage(u))),
      Promise.all((plan.competitors ?? []).map((d) => competitorInventory(d))),
      plan.useSearchConsole ? gscSnapshotFor(workspaceId) : Promise.resolve(null),
      plan.useSearchConsole ? ga4SnapshotFor(workspaceId) : Promise.resolve(null),
      (plan.searches ?? [])[0]
        ? contentBrief((plan.searches ?? [])[0]!, (plan.urls ?? [])[0])
        : Promise.resolve(null),
      Promise.all((plan.keywords ?? []).slice(0, 2).map((k) => entityProfile(k))),
    ]);

  const parts: string[] = [];
  const sources: string[] = [];
  const used: string[] = [];

  for (const set of keywordSets) {
    if (!set.suggestions.length) continue;
    used.push(`اقتراحات بحث: ${set.seed}`);
    parts.push(
      [
        `### كلمات يبحث عنها الناس فعلاً حول «${set.seed}» (اقتراحات Google/Bing)`,
        `- عبارات: ${set.suggestions.join(" | ")}`,
        set.informational.length ? `- نية معلوماتية: ${set.informational.join(" | ")}` : "",
        set.commercial.length ? `- نية مقارنة: ${set.commercial.join(" | ")}` : "",
        set.transactional.length ? `- نية شرائية: ${set.transactional.join(" | ")}` : "",
        set.local.length ? `- نية محلية: ${set.local.join(" | ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (metricSets.length) {
    used.push("مقاييس كلمات مجانية");
    parts.push(
      [
        "### مقاييس الكلمات المفتاحية (مصادر مجانية — تقديرية وموصوفة بصراحة)",
        ...metricSets.map((m) =>
          [
            `- «${m.keyword}»: مؤشر طلب ${m.demandScore}/100 (عمق اقتراحات ${m.suggestionDepth}${m.autocompleted ? "، تظهر في الإكمال التلقائي" : ""})`,
            m.difficultyScore !== null
              ? `  صعوبة تقديرية ${m.difficultyScore}/100 | نطاقات متصدرة: ${m.topDomains.join(", ")}`
              : "  صعوبة: غير متاحة الآن (لا تخمين)",
            m.wikipediaMonthlyViews !== null
              ? `  اهتمام مقيس: مقال ويكيبيديا «${m.wikipediaArticle}» ≈ ${m.wikipediaMonthlyViews} مشاهدة/شهر`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
        ),
        "ملاحظة إلزامية: لا تقدّم هذه الأرقام كحجم بحث شهري من أداة مدفوعة، بل كمؤشرات نسبية للمقارنة والترتيب.",
      ].join("\n"),
    );
  }

  const knownEntities = (entities ?? []).filter((e): e is NonNullable<typeof e> => !!e);
  if (knownEntities.length) {
    used.push("ربط الكيانات (ويكي بيانات)");
    parts.push(
      [
        "### الكيانات المعرّفة رسمياً (ويكي بيانات — تُستخدم في sameAs والبيانات المنظمة وGEO)",
        ...knownEntities.map((e) =>
          [
            `- «${e.term}» ← ${e.label} (${e.id})${e.description ? ` — ${e.description}` : ""}`,
            e.aliases.length ? `  صيغ أخرى يبحث بها الناس: ${e.aliases.join(" | ")}` : "",
            e.officialSite ? `  الموقع الرسمي: ${e.officialSite}` : "",
            e.wikipediaAr ? `  ويكيبيديا العربية: ${e.wikipediaAr}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        ),
        "استخدم هذه الصيغ الرسمية في العنوان والمتن والبيانات المنظمة، ولا تخترع روابط sameAs غير المذكورة هنا.",
      ].join("\n"),
    );
  }

  for (const { q, results } of serpSets) {
    if (!results.length) continue;
    used.push(`نتائج بحث: ${q}`);
    parts.push(
      [
        `### نتائج البحث الحقيقية لـ «${q}»`,
        ...results.map((r: SerpResult) => `${r.rank}. ${r.title} — ${r.url}\n   ${r.snippet}`),
      ].join("\n"),
    );
    sources.push(...results.slice(0, 5).map((r) => r.url));
  }

  for (const a of audits) {
    used.push(`تحليل صفحة: ${a.url}`);
    parts.push(
      a.error
        ? `### تحليل ${a.url}\n- تعذّر الجلب: ${a.error}`
        : [
            `### تحليل تقني للصفحة ${a.url}`,
            `- الحالة: ${a.status} | اللغة: ${a.lang || "غير محددة"} | عدد الكلمات: ${a.wordCount}`,
            `- العنوان: ${a.title || "(مفقود)"} (${a.title.length} حرف)`,
            `- وصف ميتا: ${a.metaDescription || "(مفقود)"} (${a.metaDescription.length} حرف)`,
            `- H1: ${a.h1.join(" | ") || "(مفقود)"}`,
            `- H2: ${a.h2.join(" | ") || "(لا يوجد)"}`,
            `- canonical: ${a.hasCanonical ? "موجود" : "مفقود"} | بيانات منظمة: ${a.hasSchema ? "موجودة" : "مفقودة"}`,
            `- صور بلا alt: ${a.imagesWithoutAlt} | روابط داخلية: ${a.internalLinks}`,
          ].join("\n"),
    );
    if (!a.error) sources.push(a.url);
  }

  for (const inv of inventories) {
    used.push(`جرد منافس: ${inv.domain}`);
    parts.push(
      inv.error
        ? `### جرد ${inv.domain}\n- ${inv.error}`
        : [
            `### جرد محتوى المنافس ${inv.domain} (من خريطة الموقع)`,
            `- عدد الصفحات المكتشفة: ${inv.urlCount}`,
            `- أكثر الكلمات تكراراً في عناوين الروابط: ${inv.topics.join(" | ")}`,
            `- نماذج صفحات: ${inv.samples
              .map((s) => s.slug || s.url)
              .slice(0, 15)
              .join(" | ")}`,
          ].join("\n"),
    );
    if (!inv.error) sources.push(inv.domain);
  }

  if (gsc) {
    used.push("بيانات Search Console");
    const fmt = (rows: typeof gsc.queries) =>
      rows
        .slice(0, 15)
        .map(
          (r) =>
            `- ${r.key}: نقرات ${r.clicks} | ظهور ${r.impressions} | CTR ${(r.ctr * 100).toFixed(1)}% | متوسط الترتيب ${r.position.toFixed(1)}`,
        )
        .join("\n");
    parts.push(
      [
        `### بيانات Search Console الحقيقية للموقع ${gsc.site} (${gsc.range.start} → ${gsc.range.end})`,
        "أعلى الاستعلامات:",
        fmt(gsc.queries) || "- لا بيانات",
        "أعلى الصفحات:",
        fmt(gsc.pages) || "- لا بيانات",
      ].join("\n"),
    );
  }

  if (ga4) {
    used.push("بيانات Google Analytics 4");
    parts.push(
      [
        `### بيانات GA4 الحقيقية (خاصية ${ga4.property}، ${ga4.range.start} → ${ga4.range.end})`,
        `الإجمالي: جلسات ${ga4.totals.sessions} | مستخدمون ${ga4.totals.users} | جلسات متفاعلة ${ga4.totals.engagedSessions}`,
        "القنوات:",
        ga4.channels.map((c) => `- ${c.channel}: ${c.sessions} جلسة`).join("\n") || "- لا بيانات",
        "أعلى صفحات الهبوط من البحث العضوي:",
        ga4.organicLandingPages.map((p) => `- ${p.page}: ${p.sessions} جلسة`).join("\n") ||
          "- لا بيانات",
      ].join("\n"),
    );
  }

  if (brief && brief.analyzed > 0) {
    used.push(`موجز محتوى تنافسي: ${brief.query}`);
    parts.push(
      [
        `### موجز محتوى مبني على الصفحات المتصدرة فعلاً لـ «${brief.query}» (${brief.analyzed} صفحة محلّلة)`,
        `- طول المحتوى الوسيط: ${brief.medianWordCount} كلمة | الطول المستهدف للتفوّق: ${brief.targetWordCount} كلمة`,
        `- نسبة استخدام البيانات المنظمة بين المتصدرين: ${brief.schemaCoverage}%`,
        brief.commonTerms.length
          ? `- مصطلحات/كيانات يغطيها المتصدرون: ${brief.commonTerms.map((t) => `${t.term} (${t.pages})`).join(" | ")}`
          : "",
        brief.entityGaps.length
          ? `- فجوات في صفحتك يجب تغطيتها: ${brief.entityGaps.join(" | ")}`
          : "",
        brief.headingIdeas.length
          ? `- عناوين فرعية مستخدمة فعلاً: ${brief.headingIdeas.slice(0, 12).join(" | ")}`
          : "",
        `- المنافسون: ${brief.competitors.map((c) => `${c.url} (${c.words} كلمة، ${c.h2} عنوان فرعي)`).join(" | ")}`,
        ...brief.notes.map((n) => `- ملاحظة: ${n}`),
      ]
        .filter(Boolean)
        .join("\n"),
    );
    sources.push(...brief.competitors.map((c) => c.url));
  }

  return { block: parts.join("\n\n"), sources: Array.from(new Set(sources)), used };
}
