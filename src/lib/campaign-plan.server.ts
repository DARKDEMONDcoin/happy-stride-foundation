/**
 * توليد خطط النشر الضخمة (عدة أيام × عدة منصات) على دفعات.
 *
 * نداء واحد ضخم يطلب ٣٥ منشوراً يتجاوز مهلة أي مزوّد ويعود بخطأ أو بنص مقطوع،
 * لذلك نقسّم العمل: هيكل الخطة أولاً (سريع وصغير)، ثم كتابة المنشورات في دفعات
 * صغيرة متوازية — فيصل المستخدم على كل منشور كاملاً بدل رسالة «تعذّر توليد الرد».
 */
import { freeChat, parseJson } from "./nour-research.server";

export type PlanDeliverable = {
  title: string;
  kind?: string | undefined;
  channel?: string | undefined;
  body: string;
  scheduled?: string | undefined;
  image_prompt?: string | null | undefined;
};

type Slot = { day: number; channel: string; angle: string; time?: string | undefined };

/** عدد الأيام المطلوب في نص الطلب (أسبوع = ٧، شهر = ٣٠). */
export function requestedDays(message: string): number {
  const explicit = /(\d{1,2})\s*(?:يوم|أيام)/.exec(message);
  if (explicit?.[1]) return Math.min(30, Math.max(1, Number(explicit[1])));
  if (/أسبوعين/.test(message)) return 14;
  if (/أسبوع/.test(message)) return 7;
  if (/شهر/.test(message)) return 30;
  return 1;
}

/** هل الطلب خطة ضخمة تستحق التوليد على دفعات؟ */
export function isCampaignRequest(message: string, targets: string[]): boolean {
  const days = requestedDays(message);
  return days >= 2 && targets.length >= 2 && days * targets.length >= 6;
}

const MAX_SLOTS = 30;
const CHUNK = 3;

/** توزيع احتياطي: يوم × منصة، يُستخدم إذا لم يعد النموذج بهيكل صالح. */
function fallbackSlots(days: number, targets: string[]): Slot[] {
  const slots: Slot[] = [];
  for (let d = 1; d <= days; d += 1)
    for (const channel of targets) {
      if (slots.length >= MAX_SLOTS) return slots;
      slots.push({ day: d, channel, angle: "" });
    }
  return slots;
}

/** هيكل الخطة: ملخص عربي + قائمة (يوم × منصة × زاوية) بلا نصوص كاملة. */
async function planSkeleton(
  apiKey: string,
  system: string,
  message: string,
  days: number,
  targets: string[],
): Promise<{ reply: string; slots: Slot[] }> {
  const expected = Math.min(MAX_SLOTS, days * targets.length);
  const raw = await freeChat(
    apiKey,
    [
      { role: "system", content: system },
      {
        role: "user",
        content:
          `${message}\n\n` +
          `أعد الآن هيكل الخطة فقط (بلا نصوص منشورات) بصيغة JSON:\n` +
          `{"reply":"ملخص عربي موجز للخطة: المحاور، التوزيع على الأيام، مؤشرات القياس بعد 48 ساعة","slots":[{"day":1,"channel":"${targets[0]}","angle":"زاوية المنشور في ٨ كلمات","time":"وقت النشر"}]}\n` +
          `عدد الأيام: ${days}. المنصات: ${targets.join("، ")}. اجعل عدد العناصر ${expected} بالضبط (لكل يوم عنصر لكل منصة)، ` +
          `وزوايا مختلفة لا تتكرر، واجعل كل "angle" و"time" قصيرين جداً حتى لا يُقتطع الرد.`,
      },
    ],
    { json: true, timeoutMs: 50_000, maxTokens: 5000, budgetMs: 100_000 },
  );
  const parsed = parseJson<{ reply?: string; slots?: Slot[] }>(raw);
  const reply = String(parsed?.reply ?? "").trim();
  const clean = (parsed?.slots ?? [])
    .filter((s) => s && typeof s.channel === "string")
    .slice(0, MAX_SLOTS)
    .map((s) => ({
      day: Number(s.day) || 1,
      channel: targets.includes(s.channel) ? s.channel : (targets[0] as string),
      angle: String(s.angle ?? "").slice(0, 220),
      time: s.time ? String(s.time).slice(0, 60) : undefined,
    }));
  // هيكل ناقص أو مقطوع: نكمل التوزيع بأنفسنا حتى لا يخسر المستخدم الخطة.
  const slots = clean.length >= expected * 0.7 ? clean : fallbackSlots(days, targets);
  return { reply, slots };
}

/** كتابة دفعة منشورات كاملة (نص جاهز للنشر لكل عنصر). */
async function writeChunk(
  apiKey: string,
  system: string,
  message: string,
  slots: Slot[],
): Promise<PlanDeliverable[]> {
  const list = slots
    .map(
      (s, i) =>
        `${i + 1}) اليوم ${s.day} — ${s.channel} — الزاوية: ${s.angle}${s.time ? ` — الوقت: ${s.time}` : ""}`,
    )
    .join("\n");
  const raw = await freeChat(
    apiKey,
    [
      { role: "system", content: system },
      {
        role: "user",
        content:
          `الطلب الأصلي: ${message}\n\nاكتب الآن المنشورات التالية كاملة:\n${list}\n\n` +
          `أعد JSON فقط: {"posts":[{"title":"اليوم N — اسم المنصة — موضوع المنشور","channel":"معرّف المنصة","kind":"منشور","body":"نص المنشور الجاهز للنشر كما يقرأه الجمهور مع الهاشتاقات، بلا أقواس ولا شرح","scheduled":"اليوم N — الوقت","image_prompt":"English visual prompt"}]}\n` +
          `التزم بعدد العناصر وترتيبها، وبطول ونبرة كل منصة، ولا تضع ملخص الخطة داخل body.`,
      },
    ],
    { json: true, timeoutMs: 60_000, maxTokens: 5000, budgetMs: 110_000 },
  );
  const parsed = parseJson<{ posts?: Record<string, unknown>[] }>(raw);
  // النموذج قد يعيد body كمصفوفة أسطر أو كائن أقسام — نحوّله دائماً إلى نص.
  const asText = (v: unknown): string => {
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v.map(asText).filter(Boolean).join("\n");
    if (v && typeof v === "object") return Object.values(v).map(asText).filter(Boolean).join("\n");
    return "";
  };
  return (parsed?.posts ?? [])
    .map((p, i) => ({ p, i, body: asText(p?.["body"]).trim() }))
    .filter(({ body }) => body.length > 20)
    .map(({ p, i, body }) => ({
      title: (asText(p["title"]) || `اليوم ${slots[i]?.day ?? i + 1} — ${slots[i]?.channel ?? ""}`)
        .replace(/الزاوية\s*:\s*/g, "")
        .slice(0, 180),
      kind: asText(p["kind"]) || "منشور",
      channel:
        typeof p["channel"] === "string" && slots.some((s) => s.channel === p["channel"])
          ? (p["channel"] as string)
          : slots[i]?.channel,
      body,
      scheduled: asText(p["scheduled"]) || slots[i]?.time || `اليوم ${slots[i]?.day ?? i + 1}`,
      image_prompt: typeof p["image_prompt"] === "string" ? p["image_prompt"] : null,
    }));
}

/**
 * الخطة كاملة: ملخص + منشور مستقل لكل (يوم × منصة).
 * ترجع null إذا فشل الهيكل، فيعود النداء العادي كخطة بديلة.
 */
export async function generateCampaign(
  apiKey: string,
  system: string,
  message: string,
  targets: string[],
): Promise<{ reply: string; deliverables: PlanDeliverable[] } | null> {
  const days = requestedDays(message);
  const skeleton = await planSkeleton(apiKey, system, message, days, targets).catch((error) => {
    console.warn("[campaign] skeleton failed:", error instanceof Error ? error.message : error);
    return { reply: "", slots: fallbackSlots(days, targets) };
  });
  if (!skeleton.slots.length) return null;

  const chunks: Slot[][] = [];
  for (let i = 0; i < skeleton.slots.length; i += CHUNK)
    chunks.push(skeleton.slots.slice(i, i + CHUNK));

  const write = (chunk: Slot[]) =>
    writeChunk(apiKey, system, message, chunk).catch((error) => {
      console.warn("[campaign] chunk failed:", error instanceof Error ? error.message : error);
      return [] as PlanDeliverable[];
    });

  const results = await Promise.all(chunks.map(write));
  // دفعة فشلت = يوم كامل ناقص من الخطة: نعيد محاولتها مرة واحدة.
  const retryIndexes = results.flatMap((r, i) => (r.length ? [] : [i]));
  if (retryIndexes.length) {
    const retried = await Promise.all(retryIndexes.map((i) => write(chunks[i] as Slot[])));
    retryIndexes.forEach((idx, k) => {
      results[idx] = retried[k] as PlanDeliverable[];
    });
  }
  const deliverables = results.flat();
  if (!deliverables.length) return null;

  const summary =
    skeleton.reply ||
    `جهّزت خطة نشر لمدة ${days} ${days > 10 ? "يوماً" : "أيام"} على ${targets.length} منصات، ` +
      `بمنشور مستقل لكل يوم ولكل منصة (${deliverables.length} منشوراً) مع موعد النشر المقترح لكل واحد.`;
  return { reply: summary, deliverables };
}
