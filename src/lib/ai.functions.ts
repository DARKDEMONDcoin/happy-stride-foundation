import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { freeChat } from "@/lib/nour-research.server";
import { actionTruthRules, sanitizeActionClaims } from "@/lib/action-claims";
import { dedupeParagraphs, dropEchoedSection, extractPostText } from "@/lib/post-format";
import {
  craft,
  evidenceRules,
  executeSkill,
  personas,
  qualityCriteria,
  researchFor,
} from "@/lib/nour-run.server";
import { employeeDirectory, sharedSystemBlocks, type EmployeeId } from "@/lib/team-knowledge";
import { governanceBlocks } from "@/lib/team-knowledge";
import { scopeBoundaryBlock } from "@/lib/scope-boundaries";
import { employeeEdgeBlock } from "@/lib/employee-edge";
import { frontierEdgeBlock } from "@/lib/frontier-edge";
import { playbookFor } from "@/lib/playbooks";
import { answerPolicyBlock } from "./answer-policy";
import { reasoningDepthBlock, effortFor } from "./reasoning-depth";
import { replyStructureBlock } from "@/lib/reply-structure";
import { buildBrandContext } from "@/lib/brand-context.server";

type Deliverable = {
  title?: string;
  kind?: string;
  channel?: string;
  body?: string;
  scheduled?: string;
  image_prompt?: string | null;
};

type NeedsConnection = { provider: string; reason: string } | null;

/** ترجمة مفاتيح JSON الشائعة إلى عناوين عربية عند عرض مخرج غير مطابق للبنية. */
const KEY_LABELS: Record<string, string> = {
  day: "اليوم",
  date: "التاريخ",
  title: "العنوان",
  content_pillar: "محور المحتوى",
  pillar: "المحور",
  channel: "المنصة",
  platform: "المنصة",
  body: "النص",
  caption: "النص",
  text: "النص",
  hashtags: "الهاشتاجات",
  scheduled: "موعد النشر",
  best_time: "أفضل وقت",
  time: "الوقت",
  metrics_to_measure: "مؤشرات القياس",
  metrics: "المؤشرات",
  kpis: "المؤشرات",
  call_to_action: "دعوة لاتخاذ إجراء",
  cta: "دعوة لاتخاذ إجراء",
  instagram_post: "منشور إنستجرام",
  x_post: "تغريدة إكس",
  linkedin_post: "منشور لينكدإن",
  facebook_post: "منشور فيسبوك",
  notes: "ملاحظات",
  summary: "ملخص",
};

/** مفاتيح تقنية لا تُعرض للمستخدم داخل النص. */
const HIDDEN_KEYS = new Set(["image_prompt", "needs_connection", "kind", "provider", "reason"]);

const labelFor = (key: string) => KEY_LABELS[key] ?? key.replace(/_/g, " ");

/** يحوّل أي بنية JSON غير متوقعة إلى Markdown عربي مقروء بدل عرض JSON خام. */
function jsonToMarkdown(node: unknown, depth = 0): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string") return node.replace(/\\n/g, "\n").trim();
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (Array.isArray(node)) {
    return node
      .map((item) => {
        const rendered = jsonToMarkdown(item, depth + 1);
        if (!rendered) return "";
        return typeof item === "object" && item !== null ? rendered : `- ${rendered}`;
      })
      .filter(Boolean)
      .join(depth === 0 ? "\n\n---\n\n" : "\n");
  }
  if (typeof node === "object") {
    const entries = Object.entries(node as Record<string, unknown>).filter(
      ([k, v]) => !HIDDEN_KEYS.has(k) && v !== null && v !== undefined && v !== "",
    );
    return entries
      .map(([key, value]) => {
        const rendered = jsonToMarkdown(value, depth + 1);
        if (!rendered) return "";
        const heading = "#".repeat(Math.min(depth + 2, 6));
        if (typeof value === "object") return `${heading} ${labelFor(key)}\n\n${rendered}`;
        if (rendered.includes("\n")) return `**${labelFor(key)}:**\n\n${rendered}`;
        return `**${labelFor(key)}:** ${rendered}`;
      })
      .filter(Boolean)
      .join("\n\n");
  }
  return "";
}

/** يلتقط المخرجات الجاهزة من أي بنية JSON متداخلة (خطة أسبوع، عدة منشورات…). */
function harvestDeliverables(node: unknown, out: Deliverable[] = [], depth = 0): Deliverable[] {
  if (out.length >= 24 || depth > 5 || !node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) harvestDeliverables(item, out, depth + 1);
    return out;
  }
  const obj = node as Record<string, unknown>;
  const text = ["body", "caption", "text", "content", "post"]
    .map((k) => obj[k])
    .find((v): v is string => typeof v === "string" && v.trim().length > 30);
  if (text) {
    const extras = [obj["hashtags"], obj["call_to_action"], obj["cta"]]
      .map((v) => (Array.isArray(v) ? v.join(" ") : typeof v === "string" ? v : ""))
      .filter(Boolean)
      .join("\n\n");
    const str = (k: string) => (typeof obj[k] === "string" ? (obj[k] as string) : undefined);
    const channel = str("channel") ?? str("platform");
    const scheduled = str("scheduled") ?? str("best_time");
    const imagePrompt = str("image_prompt");
    out.push({
      title: str("title") ?? str("day") ?? "مخرج جاهز",
      body: extras ? `${text.replace(/\\n/g, "\n")}\n\n${extras}` : text.replace(/\\n/g, "\n"),
      ...(channel ? { channel } : {}),
      ...(scheduled ? { scheduled } : {}),
      ...(imagePrompt ? { image_prompt: imagePrompt } : {}),
    });
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") harvestDeliverables(value, out, depth + 1);
  }
  return out;
}

/**
 * متى نشغّل البحث العميق (جولات متتابعة + قراءة داخل الصفحات + رصد التناقض)؟
 * حين يطلبه المستخدم بلفظه، أو حين يكون المطلوب دراسة/تقريراً/مقارنة سوق —
 * أي حين تكون كلفة الوقت أرخص من كلفة رقم خاطئ.
 */
const DEEP_RESEARCH_RE =
  /(بحث عميق|ابحث بعمق|بعمق|ديب سيرش|deep\s*search|deep\s*research|دراسة سوق|تقرير مفصل|تقرير شامل|تحليل شامل|بحث موسع|بحث موسّع|ابحث كويس)/i;

export const askEmployeeInput = z.object({
  workspaceId: z.string().uuid(),
  employeeId: z.string().min(1),
  message: z.string().min(1).max(4000),
  conversationId: z.string().uuid(),
  /** وسائط وملفات أرفقها المستخدم — تُحفظ داخل رسالته وتُعرض في المحادثة. */
  attachments: z
    .array(
      z.object({
        url: z.string().url().max(2000),
        type: z.enum(["image", "video", "file"]).default("image"),
        alt: z.string().max(200).optional(),
        mime: z.string().max(160).optional(),
        size: z.number().int().nonnegative().optional(),
      }),
    )
    .max(10)
    .superRefine((items, ctx) => {
      if (items.filter((item) => item.type === "video").length > 4)
        ctx.addIssue({ code: "custom", message: "الحد الأقصى ٤ فيديوهات." });
      if (items.filter((item) => item.type === "file").length > 6)
        ctx.addIssue({ code: "custom", message: "الحد الأقصى ٦ ملفات." });
      items.forEach((item, index) => {
        const max = item.type === "file" ? 25 * 1024 * 1024 : 50 * 1024 * 1024;
        if (item.size && item.size > max)
          ctx.addIssue({ code: "custom", path: [index, "size"], message: "حجم المرفق يتجاوز الحد المسموح." });
      });
    })
    .optional(),
  /** تحكّم المستخدم في الصورة التلقائية: تلقائي · إيقاف · وصف يكتبه بنفسه. */
  imageMode: z.enum(["auto", "off", "manual"]).optional(),
  imagePrompt: z.string().max(900).optional(),
  imageAspect: z.enum(["square", "portrait", "landscape", "story"]).optional(),
  /** طول المنشور المطلوب (اختياري) — «تلقائي» يترك القرار للموظف حسب المنصة. */
  postLength: z.enum(["auto", "short", "medium", "long"]).optional(),
});

/** الموظفون الذين تُولَّد لهم صورة فعلية عند وجود وصف بصري في الرد. */
const VISUAL_EMPLOYEES = new Set(["dana", "sonny", "nour"]);

/** أنواع مخرجات نصّية بحتة لا تُرفَق بصورة أبداً في التوليد التلقائي. */
const NON_VISUAL_KINDS =
  /(ميتا|meta|وصف\s*الصفحة|عنوان\s*الصفحة|كلمات\s*مفتاحية|keyword|تدقيق|audit|تقرير|report|تحليل|خطة|استراتيجي|بريد|إيميل|email|رسالة\s*متابعة|قائمة|جدول|سكربت\s*اتصال|schema|بيانات\s*منظمة|روابط\s*داخلية)/i;

/**
 * هل يستحق هذا المخرج صورة؟ التوليد التلقائي كان يُشعل صورة لأي مخرج من موظف
 * بصري، فتُولَّد صورة لوصف ميتا أو قائمة كلمات — وقت وتكلفة بلا فائدة.
 */
function deliverableWantsVisual(items: Deliverable[]): boolean {
  if (!items.length) return true;
  if (items.some((d) => typeof d.image_prompt === "string" && d.image_prompt.trim().length > 30))
    return true;
  return !items.every((d) => NON_VISUAL_KINDS.test(`${d.kind ?? ""} ${d.title ?? ""}`));
}

/**
 * شبكة أمان أخيرة ضد الفراغات النائبة: القوس الذي يطلب اسم العلامة أو رابطها أو
 * قائمة خدماتها يُستبدل بالحقيقة من ملف العلامة، وما لا حقيقة له يُحذف مع سطره
 * كاملاً حتى لا يبقى سطر مبتور أو نقطة معلّقة في المخرج.
 */
export function fillPlaceholders(
  text: string,
  brand: string,
  website?: string | null,
  products?: string[],
): string {
  if (!text.includes("[")) return text;
  const DROP = "\u0000";
  const nameRe = /اسم\s*(المنصة|العلامة|الشركة|المتجر|البراند|النشاط|المشروع)/;
  const linkRe = /(الرابط|رابط|الموقع|اللينك)/;
  const listRe = /(قائمة|تفاصيل|قدرات|خصائص|ميزات|منتجات|خدمات)/;
  const list = (products ?? []).filter(Boolean).slice(0, 6).join("، ");
  const replaced = text.replace(
    /\[([^[\]\n]{1,120})\](\()?/g,
    (whole, inner: string, paren: string | undefined) => {
      // روابط ماركداون الحقيقية [نص](رابط) لا تُلمس إطلاقاً.
      if (paren) return whole;
      if (/^https?:/.test(inner)) return whole;
      if (nameRe.test(inner)) return brand;
      if (/^وسم/.test(inner.trim())) return `#${brand.replace(/\s+/g, "_")}`;
      if (linkRe.test(inner)) return website ?? "الرابط في البايو";
      if (/^[\d٠-٩]+$/.test(inner.trim())) return inner.trim();
      if (listRe.test(inner) && list) return list;
      // أي فراغ نائب آخر لا حقيقة تقابله: يسقط مع سطره كاملاً.
      return DROP;
    },
  );
  return (
    replaced
      .split("\n")
      .filter((line) => !line.includes(DROP))
      .join("\n")
      .replace(/\(\s*[،,؛-]*\s*\)/g, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/ ([،.!؟])/g, "$1")
      // سطر انتهى بنقطتين لأن قائمته سقطت: نحوّله إلى جملة مكتملة.
      .replace(/[:：]\s*(?=\n\s*\n|\n?$)/g, ".")
      .replace(/\n{3,}/g, "\n\n")
  );
}

/** حدث تقدّم حقيقي يُبثّ للمستخدم أثناء تنفيذ الطلب. */
export type TurnEvent =
  { type: "step"; label: string } | { type: "delta"; text: string } | { type: "reset" };

export type TurnEmit = (event: TurnEvent) => void;

/** مستقبل أحداث صامت: المسار العادي بلا بثّ. */
const noEmit: TurnEmit = () => {};
export type AskEmployeeInput = z.infer<typeof askEmployeeInput>;
export type TurnContext = { supabase: SupabaseClient<Database> };

export const askEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => askEmployeeInput.parse(data))
  .handler(async ({ data, context }) =>
    runEmployeeTurn(data, context as unknown as TurnContext, noEmit),
  );

/**
 * دورة عمل الموظف الكاملة. تُستخدم من الشات العادي (بلا بثّ)
 * ومن مسار البثّ الحقيقي (emit يسلّم مراحل التنفيذ والنص وهو يُكتب).
 */
export async function runEmployeeTurn(
  data: AskEmployeeInput,
  context: TurnContext,
  emit: TurnEmit = noEmit,
) {
  {
    // المفاتيح تُقرأ داخل freeChat من جدول app_secrets في Supabase.
    const apiKey = "";

    const supabase = context.supabase;
    const persona = personas[data.employeeId];
    if (!persona) throw new Error("موظف غير معروف.");

    const [
      { data: workspace },
      { data: conversation },
      { data: brain },
      { data: durable },
      { data: history },
      { data: linked },
      { data: direct },
      { data: recentTasks },
    ] = await Promise.all([
      supabase.from("workspaces").select("*").eq("id", data.workspaceId).maybeSingle(),
      supabase
        .from("conversations")
        .select("id, title")
        .eq("id", data.conversationId)
        .eq("workspace_id", data.workspaceId)
        .eq("employee_id", data.employeeId)
        .maybeSingle(),
      supabase.from("brain_items").select("title, body, kind").eq("workspace_id", data.workspaceId),
      supabase
        .from("brand_memories")
        .select("content, kind")
        .eq("workspace_id", data.workspaceId)
        .is("superseded_by", null)
        .or(`valid_until.is.null,valid_until.gt.${new Date().toISOString()}`)
        .order("updated_at", { ascending: false })
        .limit(80),
      supabase
        .from("messages")
        .select("role, body")
        .eq("workspace_id", data.workspaceId)
        .eq("employee_id", data.employeeId)
        .eq("conversation_id", data.conversationId)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("pipedream_accounts")
        .select("provider")
        .eq("workspace_id", data.workspaceId)
        .eq("status", "connected"),
      supabase
        .from("integrations")
        .select("provider")
        .eq("workspace_id", data.workspaceId)
        .eq("status", "connected"),
      // ما أنجزه الزملاء مؤخراً — حتى يعرف كل موظف ما يجري في الفريق.
      supabase
        .from("tasks")
        .select("employee_id, title, status, created_at")
        .eq("workspace_id", data.workspaceId)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    // حالة الربط الحقيقية تُحقن في التعليمات حتى لا يدّعي الموظف نشراً مستحيلاً.
    const connected = [
      ...new Set([
        ...(linked ?? []).map((a) => a.provider),
        ...(direct ?? []).map((i) => i.provider),
      ]),
    ];

    if (!workspace) throw new Error("مساحة العمل غير موجودة.");
    if (!conversation) throw new Error("المحادثة غير موجودة.");
    const ws = workspace as typeof workspace & {
      profile?: unknown;
      website?: string | null;
      country?: string | null;
    };

    // منتجات العلامة من ملفها — تُستخدم لتعبئة أي فراغ نائب في المخرج بحقيقة.
    const brandProducts = ((): string[] => {
      const p = ws.profile as Record<string, unknown> | null | undefined;
      const raw = p && typeof p === "object" ? p["products"] : null;
      return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
    })();

    // وسائط المستخدم تُحفظ داخل نص رسالته لتظهر في المحادثة وتبقى في السجل.
    const attachments = data.attachments ?? [];
    // الأسماء تُنظَّف من الأقواس وفواصل الأسطر حتى لا تنكسر صيغة المرفق عند عرضه.
    const safeAlt = (alt: string | undefined, fallback: string) =>
      (alt ?? "").replace(/[[\]()\n\r]/g, " ").trim() || fallback;
    const attachmentsMarkdown = attachments
      .map((a) =>
        a.type === "video"
          ? `\n\n🎬 [${safeAlt(a.alt, "فيديو مرفق")}](${a.url})`
          : a.type === "file"
            ? `\n\n📎 [${safeAlt(a.alt, "ملف مرفق")}](${a.url})`
            : `\n\n![${safeAlt(a.alt, "صورة مرفقة")}](${a.url})`,
      )
      .join("");

    const { data: userRow, error: insertUserError } = await supabase
      .from("messages")
      .insert({
        workspace_id: data.workspaceId,
        employee_id: data.employeeId,
        role: "user",
        body: `${data.message}${attachmentsMarkdown}`,
        conversation_id: data.conversationId,
      })
      .select("id")
      .single();

    if (insertUserError) throw new Error(insertUserError.message);

    const { coworkerVoiceBlock, shortTopic } = await import("./coworker-voice");
    const turnTopic = shortTopic(data.message);
    emit({
      type: "step",
      label: (history ?? []).length
        ? `رجعت لآخر ما اتفقنا عليه وقرأت طلبك عن «${turnTopic}»`
        : `قرأت طلبك عن «${turnTopic}» وذاكرة علامتك`,
    });

    const { durableMemoryItems, extractExplicitMemories } = await import("./memory.server");
    const brandContext = buildBrandContext(
      workspace,
      [...(brain ?? []), ...durableMemoryItems(durable ?? [])],
      data.message,
      10,
    );
    const extracted = extractExplicitMemories(data.message);
    if (extracted.length) {
      await supabase.from("brand_memories").insert(
        extracted.map((item) => ({
          workspace_id: data.workspaceId,
          conversation_id: data.conversationId,
          employee_id: data.employeeId,
          source_message_id: userRow?.id ?? null,
          kind: item.kind,
          content: item.content,
          confidence: 1,
        })),
      );
    }
    if (conversation.title === "محادثة جديدة") {
      const cleanTitle = data.message
        .replace(/https?:\/\/\S+/g, "")
        .replace(/[\n\r]+/g, " ")
        .replace(/^[\s،,:؛.!؟-]+|[\s،,:؛.!؟-]+$/g, "")
        .replace(/\s+/g, " ")
        .trim();
      await supabase
        .from("conversations")
        .update({
          title: cleanTitle.slice(0, 55) || "محادثة جديدة",
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.conversationId);
    } else {
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", data.conversationId);
    }

    const longForm =
      /مقال|خطة\s*(سيو|محتوى|تسويق)|\d{3,4}\s*كلمة|صفحة هبوط|دليل شامل|حملة كاملة/.test(
        data.message,
      ) || data.message.length > 220;

    // نيّة الرسالة: عمل (مخرج جاهز) أم سؤال/دردشة يُجاب عليها فقط بلا فرض خدمات.
    const { chatIntent, intentBlock, wantsImageRequest, refusesImageRequest } =
      await import("./chat-intent");
    const intent = chatIntent(data.message);
    /** رفض صريح للصورة: «بدون صورة» يمنع أي توليد مهما كان الموظف أو المخرج. */
    const imageRefused = refusesImageRequest(data.message);
    /** طلب صورة صريح من المستخدم: تُولَّد صورة فعلية أياً كان الموظف. */
    const explicitImage = intent === "work" && !imageRefused && wantsImageRequest(data.message);
    /** البثّ الحقيقي للطلبات الصريحة فقط — الأسئلة والدردشة تُجاب فوراً بلا بثّ. */
    const streaming = emit !== noEmit && intent === "work";
    // عقل الخبير: عمق التخصص + سؤال واحد بخيارات عند الغموض الجوهري فقط.
    const { expertMindBlock } = await import("./expert-mind");

    // الوعي اللحظي: الزمن الدقيق دائماً + بحث حيّ عن الأحداث الجارية عند الحاجة.
    const { nowBlock, needsLiveFacts, liveFactsBlock, timezoneForCountry } =
      await import("./live-context.server");
    const timezone =
      (workspace as { timezone?: string | null }).timezone ?? timezoneForCountry(ws.country);

    // بوابة نية البحث: تلتقط «ابحث/قارن/معايير السوق/منافس/ترند» لكل الموظفين،
    // لا الكلمات الزمنية وحدها — فلا يجيب موظف عن واقع السوق من معرفة مخزّنة.
    const { researchIntent } = await import("./research-intent");
    const wantsResearch = researchIntent(data.message);

    // «هات صورة من النت»: نجلب صوراً حقيقية بالتوازي مع البحث بدل توليد صورة.
    const webImageMod = await import("./web-images.server");
    const wantsWeb =
      !imageRefused && data.imageMode !== "off" && webImageMod.wantsWebImage(data.message);
    if (wantsWeb) emit({ type: "step", label: "أبحث عن صور حقيقية على الإنترنت" });
    // سياق الإحالة: «هات صورة له/ليها/للموضوع ده» تعود لآخر رسالة من المستخدم.
    const lastUserTopic =
      (history ?? []).find((m) => m.role === "user" && m.body && m.body !== data.message)?.body ?? "";
    const webImagesTask = wantsWeb
      ? webImageMod.webImageSearch(data.message, 4, lastUserTopic).catch(() => [])
      : Promise.resolve([] as Awaited<ReturnType<typeof webImageMod.webImageSearch>>);

    emit({ type: "step", label: `أجمع أدلة وأرقاماً حقيقية عن «${turnTopic}»` });
    const [research, liveBlock, ownFieldResearch] = await Promise.all([
      researchFor(
        data.employeeId,
        apiKey,
        { name: workspace.name, industry: workspace.industry },
        data.message,
        data.workspaceId,
        // الطلبات الكبيرة تستحق أدلة أكمل (مقاييس + نتائج بحث + موجز منافسين).
        longForm ? 15_000 : 8_000,
      ),
      needsLiveFacts(data.message)
        ? liveFactsBlock(data.message, longForm ? 12_000 : 9_000, {
            country: ws.country,
            city: (ws as { city?: string | null }).city ?? null,
            timeZone: timezone,
          }).catch(() => "")
        : Promise.resolve(""),
      // بحث كل موظف بمصادر مجاله (آدم/سام/دانة/إيفا/سِراج، ونور كشبكة أمان).
      wantsResearch.wanted
        ? (async () => {
            const opts = {
              industry: workspace.industry,
              city: (ws as { city?: string | null }).city ?? undefined,
              country: ws.country ?? undefined,
              budgetMs: longForm ? 12_000 : 8_000,
            };
            // بحث عميق: جولات متتابعة تقرأ داخل الصفحات وتستخرج الأرقام بمصادرها.
            // يُشغَّل حين يطلبه المستخدم صراحةً أو حين يكون المطلوب تقريراً/دراسة.
            if (DEEP_RESEARCH_RE.test(data.message)) {
              const m = await import("./deep-research.server");
              return m.deepResearch(data.employeeId, wantsResearch.topic, {
                ...opts,
                deepBudgetMs: 35_000,
              });
            }
            const m = await import("./employee-research.server");
            return m.employeeResearch(data.employeeId, wantsResearch.topic, opts);
          })().catch(() => ({ block: "", used: [] as string[] }))
        : Promise.resolve({ block: "", used: [] as string[] }),
    ]);

    /** أدلة مجال الموظف، أو قاعدة صدق صريحة إن طلب المستخدم بحثاً ولم يصل شيء. */
    const fieldResearchBlock = ownFieldResearch.block
      ? ownFieldResearch.block
      : wantsResearch.explicit && !research.block && !liveBlock
        ? (await import("./employee-research.server")).noResearchHonestyBlock(wantsResearch.topic)
        : "";

    // المنصة التي سمّاها المستخدم بنفسه — تُحترم حرفياً ولا تُبدَّل بغيرها.
    const { requestedPublishTargets, providerLabel } = await import("./platforms");
    const askedTargets = requestedPublishTargets(data.message);
    const askedBlock = askedTargets.length
      ? `## المنصة التي طلبها المستخدم صراحةً\nالمستخدم طلب: ${askedTargets.map((p) => `${providerLabel(p)} (${p})`).join("، ")}. ` +
        `اجعل "channel" في المخرج هو "${askedTargets[0]}" حرفياً، وكيّف النص لقواعد هذه المنصة (الطول، النبرة، الهاشتاقات). ` +
        `لا تقترح منصة أخرى بدلاً منها. ` +
        (askedTargets.some((p) => !connected.includes(p))
          ? `تنبيه: ${askedTargets
              .filter((p) => !connected.includes(p))
              .map(providerLabel)
              .join(
                " و",
              )} غير مربوط بعد — أنجز المخرج كاملاً، وضع في needs_connection المنصة "${askedTargets.find((p) => !connected.includes(p))}" بسبب قصير.`
          : `هذه المنصة مربوطة — أنجز المخرج جاهزاً للنشر عليها مباشرة.`)
      : "";

    // تنفيذ فعلي لقدرات الأقسام من داخل الشات (فحص سيو، ترتيب، تقويم، أفكار، أداء).
    emit({ type: "step", label: "أفتح أدوات المنصة وأشغّل الفحص والتحليل بنفسي" });
    let toolBlocks: { block: string; footer: string; tool: string }[] = [];
    let toolsFailed = false;
    try {
      const { runChatTools } = await import("./chat-tools.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      toolBlocks = await runChatTools(supabaseAdmin, {
        workspaceId: data.workspaceId,
        employeeId: data.employeeId,
        message: data.message,
        website: ws.website,
        country: ws.country,
        connected,
        targets: askedTargets,
        industry: workspace.industry,
        brand: workspace.name,
      });
    } catch (e) {
      toolsFailed = true;
      console.warn("[chat-tools] skipped:", e instanceof Error ? e.message : e);
    }
    if (toolBlocks.length) {
      emit({
        type: "step",
        label: `خلصت: ${toolBlocks
          .map((t) => t.tool)
          .slice(0, 3)
          .join("، ")}`,
      });
    }
    const toolsBlock = toolBlocks.length
      ? `## نتائج نفّذتها فعلاً الآن من أقسام المنصة (حقيقية — استخدمها حرفياً)\n${toolBlocks.map((t) => t.block).join("\n\n")}`
      : toolsFailed
        ? "## تنبيه: أدوات المنصة لم تستجب الآن\nحاولت تشغيل أدوات الفحص/البيانات ولم تستجب في هذه الرسالة. ممنوع اختلاق أي رقم أو نتيجة فحص أو بيانات أداء. اعتمد على معرفتك وأدلة العلامة، وسلّم المخرج كاملاً، واذكر في سطر واحد فقط أن الأرقام الحيّة غير متاحة الآن وأنك ستحدّثها عند توفّرها."
        : "";

    // ---- الإجراءات الحقيقية لهذا الموظف على تكاملاته المربوطة ----
    // الموظف لا «يقترح» فقط: يملأ إجراءً حقيقياً (إرسال بريد، حجز موعد، إضافة صفقة،
    // نشر مقال، رسالة سلاك…) ويعرضه على المالك للاعتماد بضغطة واحدة.
    let allowedActions: {
      id: string;
      provider: string;
      label: string;
      inputs: { name: string; label: string; required?: boolean }[];
    }[] = [];
    try {
      const { actionsFor } = await import("./employee-actions.server");
      allowedActions = actionsFor(data.employeeId)
        .filter((a) => connected.includes(a.provider))
        .map((a) => ({ id: a.id, provider: a.provider, label: a.label, inputs: a.inputs }));
    } catch (e) {
      console.warn("[actions] catalog skipped:", e instanceof Error ? e.message : e);
    }
    const actionsBlock = allowedActions.length
      ? [
          "## إجراءات حقيقية تقدر تنفّذها الآن بتكاملاتك المربوطة",
          "هذه ليست اقتراحات: كل إجراء هنا يُنفَّذ فعلياً على حساب العميل بعد اعتماده بضغطة واحدة تحت ردك.",
          ...allowedActions
            .slice(0, 40)
            .map(
              (a) =>
                `- \`${a.id}\` — ${a.label} (${a.provider}) | الحقول: ${a.inputs
                  .map((i) => `${i.name}${i.required ? "*" : ""}=${i.label}`)
                  .join("، ")}`,
            ),
          'إن كان طلب المستخدم يحتاج تنفيذ أحد هذه الإجراءات، املأ الحقل "action" هكذا: {"id": "معرّف الإجراء", "values": {"اسم الحقل": "القيمة الجاهزة"}} — واكتب القيم كاملة جاهزة للإرسال (نص البريد كاملاً، التاريخ بصيغة ISO، البريد الصحيح…) لا فراغات ولا أقواس مربّعة.',
          "اذكر في ردك بجملة واحدة أنك جهّزت الإجراء وأن اعتماده بضغطة واحدة تحت الرد، ولا تدّعِ أنك نفّذته قبل أن يعتمده المالك.",
          'إن لم يكن الطلب بحاجة إلى إجراء منفّذ، اجعل "action" القيمة null.',
        ].join("\n")
      : "";

    const teamActivity = (recentTasks ?? [])
      .map((t) => {
        const who = employeeDirectory[t.employee_id as EmployeeId]?.name ?? t.employee_id;
        return `- ${who}: ${t.title} (${t.status === "done" ? "منشور/منجز" : t.status === "review" ? "بانتظار الاعتماد" : t.status})`;
      })
      .join("\n");

    // صاحب العمل: اسمه الأول ومسمّاه — حتى يخاطبه الموظف كزميل يعرفه لا كمستخدم مجهول.
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("full_name, job_title, dialect")
      .eq("id", workspace.owner_id)
      .maybeSingle();
    // اللهجة التي اختارها المالك في إعدادات حسابه تتقدّم على اللهجة المستنتجة من الدولة.
    const wsProfileDialect =
      ws.profile &&
      typeof ws.profile === "object" &&
      typeof (ws.profile as { dialect?: unknown }).dialect === "string"
        ? ((ws.profile as { dialect?: string }).dialect ?? "").trim()
        : "";
    const ownerDialect = (ownerProfile?.dialect ?? "").trim() || wsProfileDialect || null;
    const ownerFirstName =
      (ownerProfile?.full_name ?? "").trim().split(/\s+/).filter(Boolean)[0] ?? null;

    // «اليوم الأول»: هل تحدّث معه هذا الموظف من قبل إطلاقاً في هذه المساحة؟
    let firstEverTurn = false;
    if ((history ?? []).length === 0) {
      const { count: priorCount } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", data.workspaceId)
        .eq("employee_id", data.employeeId)
        .eq("role", "assistant");
      firstEverTurn = (priorCount ?? 0) === 0;
    }

    // ذاكرة سِراج التشغيلية: صوت العلامة + قواعد مستخلصة من أداء الحساب + المجدول القادم.
    let sirajMemory = "";
    if (data.employeeId === "sonny") {
      try {
        const { sirajContext } = await import("./siraj-context.server");
        sirajMemory = await sirajContext(supabase as never, data.workspaceId);
      } catch (error) {
        console.error("[siraj] operational context failed:", error);
      }
    }

    // ذاكرة نور التشغيلية: أرقام Search Console الحقيقية + الكلمات المتتبَّعة + ما نشرته + قنوات النشر.
    // ذاكرة القرارات: ما اتفقتم عليه سابقاً يُحقن دائماً كي لا يتناقض الموظف مع نفسه.
    let decisionsMemory = "";
    try {
      const { decisionsBlock } = await import("./decisions.server");
      decisionsMemory = await decisionsBlock(supabase as never, data.workspaceId, data.message, 6);
    } catch (error) {
      console.error("[decisions] context failed:", error);
    }

    let nourMemory = "";
    if (data.employeeId === "nour") {
      try {
        const { nourContext } = await import("./nour-context.server");
        nourMemory = await nourContext(supabase as never, data.workspaceId);
      } catch (error) {
        console.error("[nour] operational context failed:", error);
      }
    }

    // الذاكرة التشغيلية لبقية الفريق (أمَل، سالم، دانة، آدم): أرقام أدائهم الحقيقية وأمثلتهم المعتمدة.
    let genericMemory = "";
    if (!["sonny", "nour"].includes(data.employeeId)) {
      try {
        const { opsMemory } = await import("./ops-memory.server");
        genericMemory = await opsMemory(supabase as never, data.workspaceId, data.employeeId);
      } catch (error) {
        console.error("[ops-memory] context failed:", error);
      }
    }

    let learning = { block: "", lessonIds: [] as string[] };
    try {
      const { learningBlock } = await import("./learning.server");
      learning = await learningBlock(supabase as never, data.workspaceId, data.employeeId);
    } catch (error) {
      console.warn("[learning] context skipped:", error instanceof Error ? error.message : error);
    }

    const system = [
      `أنت ${persona.name}، ${persona.role}`,
      `تعمل داخل منصة «سهل» لصالح العلامة المسجلة في المرجع الموحّد أدناه.`,
      // الحاكمان أولاً: سلّم السلطة ثم الالتزام القانوني — كل ما بعدهما محكوم بهما.
      ...governanceBlocks(data.employeeId),
      nowBlock(timezone, ws.country),
      intentBlock(intent),
      answerPolicyBlock(data.employeeId, intent),
      reasoningDepthBlock(data.employeeId as EmployeeId, intent),
      coworkerVoiceBlock({
        employeeId: data.employeeId,
        firstEver: firstEverTurn,
        employeeName: persona.name,
        role: persona.role,
        userName: ownerFirstName,
        userTitle: ownerProfile?.job_title ?? null,
        intent,
        firstMessage: (history ?? []).length === 0,
        teamActivity,
      }),
      expertMindBlock(data.employeeId, intent),
      // كتل التميّز تُحقن للعمل وللأسئلة الاستشارية معاً (كما في مسار المهام التلقائية)،
      // وتُستثنى الدردشة وحدها. قبلها كان السؤال الاستشاري يخسر عمقاً تحصل عليه الأتمتة.
      intent !== "smalltalk" ? employeeEdgeBlock(data.employeeId) : "",
      // ملف الحِرفة والدليل الميداني ثقيلان ويتعارضان مع أمر «رد قصير بلا بنية»
      // في الدردشة، فلا يُحقنان في التحيات والمجاملات.
      intent !== "smalltalk" && craft[data.employeeId]
        ? `## معايير حِرفتك\n${craft[data.employeeId]}`
        : "",
      // معايير الصناعة ودليل التشغيل مكتوبان لمخرجات العمل (خطة نشر، هيكل مقال).
      // حقنهما في سؤال معرفي يناقض أمر «أجب في ثلاثة أسطر بلا مخرج عمل».
      intent === "work" ? frontierEdgeBlock(data.employeeId as EmployeeId) : "",
      intent === "work" ? playbookFor(data.employeeId, data.message) : "",
      scopeBoundaryBlock(data.employeeId, data.message),
      sirajMemory,
      nourMemory,
      genericMemory,
      decisionsMemory,
      learning.block,
      qualityCriteria[data.employeeId]?.length
        ? `## معايير قبول الرد (راجعها بنداً بنداً قبل أن تكتب، ثم مرة أخيرة قبل التسليم)\n${(qualityCriteria[data.employeeId] ?? []).map((criterion, index) => `${index + 1}) ${criterion}`).join("\n")}`
        : "",
      ...sharedSystemBlocks({
        employeeId: data.employeeId,
        connected,
        profile: ws.profile,
        website: ws.website,
        country: ws.country,
        dialect: ownerDialect,
      }),
      brandContext,
      teamActivity ? `## آخر ما أنجزه الفريق\n${teamActivity}` : "",
      research.block ? `${evidenceRules}\n\n## أدلة ميدانية (لحظية)\n${research.block}` : "",
      // بحث الموظف في مجاله (أو قاعدة الصدق إن تعذّر البحث).
      fieldResearchBlock
        ? `${research.block ? "" : `${evidenceRules}\n\n`}${fieldResearchBlock}`
        : "",
      // الحقائق اللحظية آخر ما يقرأه النموذج قبل الكتابة: أعلى أولوية وتتقدّم على أي قاعدة تحفّظ.
      liveBlock
        ? `${liveBlock}\n\nهذه الكتلة المرتبة ٢ في سلّم السلطة (يعلوها الالتزام القانوني وحده): أي رقم أو تاريخ فيها مؤكد ورسمي، اذكره كما هو بالحرف، وهي تتقدّم على أي قاعدة أسلوب أو حِرفة أو ذاكرة. ممنوع قول «لا يوجد رقم مؤكد» عن رقم مذكور هنا.`
        : "",
      actionTruthRules,
      // تعليمات المنصة المطلوبة وأدوات المنصة تخص التسليم: في السؤال والدردشة
      // تناقض أمر «لا تذكر الربط ولا النشر ولا تسلّم مخرجاً».
      intent === "work" ? askedBlock : "",
      intent === "work" ? toolsBlock : "",
      intent === "work" ? actionsBlock : "",
      "## أسلوب المحادثة",
      "فكّر داخلياً بالترتيب: افهم الهدف، تحقق من الأدلة، اختر الإجراء، ثم سلّم النتيجة. لا تعرض خطوات تفكيرك.",
      "راجع الإجابة قبل تسليمها: الدقة، الاكتمال، ملاءمة السوق العربي، صدق ما تم تنفيذه، وخطوة تالية واحدة.",
      "أجب دائماً بالعربية. التحية والأسئلة القصيرة: رد قصير ودافئ بجملة أو اثنتين بلا إضافات لم تُطلب. طلبات العمل: مخرج كامل جاهز مباشرة.",
      "## تنسيق الرد (إلزامي)",
      // العناوين والقوائم والجداول تخص مخرج العمل وحده: سياسة الرد تمنعها في
      // الدردشة والسؤال، فحقنها بلا شرط كان أمرين متناقضين في نفس التعليمات.
      intent === "work"
        ? "ابدأ بسطر خلاصة واحد يقول النتيجة أو الرقم الأهم بخط عريض، ثم التفاصيل تحته."
        : "اكتب نصاً متصلاً قصيراً بلا عناوين ولا قوائم ولا جداول.",
      intent === "work"
        ? "استخدم عناوين `###` قصيرة لكل محور، وقوائم نقطية من سطر واحد لكل نقطة، وأبرز الأرقام والكلمات المفتاحية بخط عريض."
        : "",
      "الفقرة لا تتجاوز ثلاثة أسطر. لا تكرر نفس المعلومة في أكثر من مكان، ولا تكتب مقدمات إنشائية ولا اعتذارات.",
      intent === "work"
        ? "البيانات المقارنة (كلمات بحث، منافسون، صفحات، أرقام أداء) تُعرض في جدول Markdown بأعمدة واضحة لا كقائمة طويلة."
        : "",
      intent === "work"
        ? "اختم بقسم `### الخطوة التالية` فيه إجراء واحد محدد قابل للتنفيذ اليوم."
        : "لا تضف قسم «الخطوة التالية» ولا اقتراحات خدمات في هذا الرد.",
      "ممنوع في الرد: JSON أو أقواس تقنية أو أسماء أدوات داخلية أو روابط خام مكررة أو نص إنجليزي غير ضروري أو رموز تعبيرية أكثر من واحد في القسم.",
      // بنية سِراج ونور صارت في reply-structure.ts مع بقية الفريق (مصدر واحد
      // يستخدمه مسار المحادثة ومسار المهام التلقائية معاً). لا تُحقن خارج طلبات العمل:
      // في الدردشة والأسئلة تمنع سياسة الرد العناوين و«الخطوة التالية»، فحقنها تناقض صريح.
      intent === "work" ? replyStructureBlock(data.employeeId) : "",

      intent === "work"
        ? "افترض ما ينقص افتراضاً مهنياً ونفّذ فوراً؛ لا تسأل أكثر من سؤال واحد وواضح، ولا تؤجّل المخرج بسبب معلومة ناقصة — اذكر افتراضك في سطر واحد وأكمل."
        : "",

      intent === "work"
        ? "إن كان طلب المستخدم يحتاج صورة (تصميم، منشور بصري، صورة مقال، كرييتف) فاكتب وصفاً بصرياً إنجليزياً دقيقاً في الحقل image_prompt — وستُولَّد الصورة فعلياً وتُعرض للمستخدم؛ لا تكتفِ بوصفها في النص."
        : "",
      explicitImage
        ? [
            "## طلب صورة صريح (إلزامي في هذه الرسالة)",
            "المستخدم طلب صورة/تصميماً فعلياً. الصورة **ستُولَّد وتُعرض له تحت ردك تلقائياً** من الحقل image_prompt.",
            "اكتب في image_prompt وصفاً إنجليزياً واحداً غنياً وقابلاً للتنفيذ (الموضوع، الأسلوب، التكوين، الإضاءة، الألوان، الخلفية، نسبة الأبعاد، وأي نص يظهر داخل الصورة إن طلبه) بما يطابق طلبه ونبرة العلامة.",
            "ردّك النصي يبقى قصيراً: سطر يقول ما الذي صُمِّم ولماذا هذه الزاوية، وسطر «نص بديل:» بالعربية. ممنوع تماماً أن تكتب للمستخدم أنك «لا تستطيع توليد الصور» أو أن تعطيه البرومبت الإنجليزي في النص أو أن تصف الصورة في فقرات طويلة بدل توليدها.",
            'إن لم يكن هناك منشور مطلوب فاجعل "deliverable" هكذا: {"title": "عنوان الصورة", "kind": "صورة", "channel": null, "body": "سطر عربي واحد يصف ما تظهره الصورة", "scheduled": null, "image_prompt": "…English prompt…"}.',
          ].join("\n")
        : "",
      'أعد ردك بصيغة JSON فقط بالشكل: {"reply": "نص ردك للمستخدم بصيغة Markdown", "deliverable": {"title": "عنوان المخرج", "kind": "نوع المخرج", "channel": "المنصة", "body": "نص المخرج الجاهز", "scheduled": "متى يُنفّذ", "image_prompt": "English visual prompt or null"} , "needs_connection": {"provider": "معرّف المنصة مثل instagram أو wordpress أو search-console", "reason": "سبب من 8 كلمات مرتبط بهذه المهمة"}, "action": {"id": "معرّف إجراء من القائمة أعلاه", "values": {"اسم الحقل": "قيمته الجاهزة"}} }',
      'ممنوع تماماً ابتكار بنية JSON أخرى. إن طلب المستخدم عدة مخرجات (خطة أسبوع، عدة منشورات، عدة منصات) فاستخدم مصفوفة "deliverables": [ {نفس حقول deliverable}, … ] بدل deliverable، واجعل "reply" ملخصاً بالعربية للخطة (المحاور، التوزيع، مؤشرات القياس) — ولا تضع JSON داخل reply أو داخل body إطلاقاً.',
      "قاعدة إلزامية للخطط: عنصر واحد في deliverables لكل منشور فعلي (يوم × منصة). خطة 3 أيام على 3 منصات = 9 عناصر، لكل عنصر channel صحيح (instagram / linkedin / x) وtitle يذكر اليوم والمنصة وbody يحتوي نص ذلك المنشور وحده مع هاشتاجاته وscheduled بأفضل وقت نشر. ممنوع وضع ملخص الخطة داخل body أو الاكتفاء بمخرج واحد.",
      "حقل body يجب أن يكون نص المنشور/المقال الجاهز للنشر كما يقرأه الجمهور فقط — بلا مفاتيح ولا أقواس ولا وصف الصورة. ووصف الصورة الإنجليزي يوضع في image_prompt وحده ولا يظهر للمستخدم.",
      'إن لم يطلب المستخدم مخرجاً جاهزاً للنشر أو الإرسال، اجعل "deliverable" القيمة null. واجعل "needs_connection" القيمة null إلا إذا كانت هذه المهمة تحديداً تحتاج حساباً غير مربوط لتنفيذها فعلياً (نشر/إرسال/قراءة بيانات حقيقية).',
      `المنصة الافتراضية لك هي ${persona.channel} ونوع مخرجك الشائع ${persona.kind}.`,
      // قاعدة «صفر فراغات نائبة» معرّفة مرة واحدة في masteryStandard أعلاه؛
      // هنا سطر تطبيقي واحد فقط يربطها باسم العلامة وحقول JSON.
      `تطبيق قاعدة صفر الفراغات: اسم العلامة «${workspace.name}» يُكتب حرفياً في reply وbody والهاشتاقات؛ وعند غياب رابط اكتب «الرابط في البايو»، وعند غياب مدينة خاطب الجمهور العربي عموماً، وحدّد يوماً وساعة فعليين للنشر في حقل scheduled وحده — لا داخل body.`,
    ]
      .filter(Boolean)
      .join("\n");

    const priorMessages = (history ?? [])
      .slice()
      .reverse()
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.body }));

    // قراءة فعلية لكل الوسائط: صور وفيديوهات ومستندات، بنفس المسار لكل الموظفين.
    let mediaRead = "";
    if (attachments.length) {
      try {
        const { describeUserMedia } = await import("./media-vision.server");
        mediaRead = await describeUserMedia(attachments);
      } catch {
        mediaRead = "";
      }
    }

    // نُعلم الموظف بوسائط المستخدم وبقراره حول الصورة حتى يبني عليها بدل تجاهلها.
    const mediaNote = [
      attachments.length
        ? `(المستخدم أرفق ${attachments.filter((a) => a.type === "image").length} صورة و${attachments.filter((a) => a.type === "video").length} فيديو و${attachments.filter((a) => a.type === "file").length} ملف مع الطلب — افهم محتواها المقروء أدناه ونفّذ المطلوب، ولا تدّعِ معرفة جزء تعذّر تحليله.)`
        : "",
      mediaRead
        ? `(محتوى وسائط وملفات المستخدم كما قرأها النظام حرفياً — اعتمد عليه ونفّذ ما طلبه منه مباشرة، وحلّله إن سُئلت عنه: ${mediaRead.slice(0, 12_000)})`
        : "",
      data.imageMode === "off" ? "(المستخدم أوقف توليد الصور — لا تكتب image_prompt.)" : "",
      data.imageMode === "manual" && data.imagePrompt
        ? `(المستخدم كتب وصف الصورة بنفسه: ${data.imagePrompt.slice(0, 300)} — لا تغيّره.)`
        : "",
      data.postLength && data.postLength !== "auto"
        ? `(طول المنشور المطلوب: ${
            data.postLength === "short"
              ? "قصير جداً ٣٠–٦٠ كلمة"
              : data.postLength === "medium"
                ? "متوسط ٨٠–١٢٠ كلمة"
                : "مطوّل ١٥٠–٢٢٠ كلمة"
          } — التزم بهذا المدى ولا تتجاوزه.)`
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    const userTurn = mediaNote ? `${data.message}\n\n${mediaNote}` : data.message;

    // خطة ضخمة (عدة أيام × عدة منصات): تُولَّد على دفعات — نداء واحد ضخم يتجاوز مهلة المزوّد.
    let campaign: { reply: string; deliverables: Record<string, unknown>[] } | null = null;
    if (askedTargets.length >= 2) {
      try {
        const { isCampaignRequest, generateCampaign } = await import("./campaign-plan.server");
        if (isCampaignRequest(data.message, askedTargets)) {
          campaign = await generateCampaign(apiKey, system, data.message, askedTargets);
        }
      } catch (error) {
        console.warn("[campaign] failed:", error instanceof Error ? error.message : error);
      }
    }

    // مقال طويل: يُكتب على مراحل — نص المقال داخل JSON واحد يُقتطع فيضيع المقال كله.
    if (!campaign && longForm) {
      try {
        const { isLongArticleRequest, generateLongArticle } = await import("./longform.server");
        if (isLongArticleRequest(data.message)) {
          const article = await generateLongArticle(apiKey, system, data.message);
          if (article) {
            campaign = {
              reply: `جهّزت لك المقال كاملاً: **${article.title}** — نصه الكامل بالأسفل، ومعه الميتا والأسئلة الشائعة وسكيما FAQ جاهزة.`,
              deliverables: [
                { title: article.title, kind: "مقال", channel: "wordpress", body: article.body },
              ],
            };
          }
        }
      } catch (error) {
        console.warn("[longform] failed:", error instanceof Error ? error.message : error);
      }
    }

    emit({ type: "step", label: "أكتب المخرج الآن كلمة بكلمة" });

    const chatMessages = [
      { role: "system", content: system },
      ...priorMessages,
      { role: "user", content: userTurn },
    ];
    // طلبات المقالات/الخطط الكاملة تحتاج مخرجاً طويلاً ومهلة أطول — مع سقف زمني إجمالي حتى لا يعلّق الشات.
    // عمق الاستدلال يتغيّر حسب ثقل الطلب: دردشة سريعة بلا تفكير طويل، ومخرج
    // استراتيجي بتفكير أعمق — ذكاء أعلى حيث يستحق، وسرعة حيث لا يضيف التفكير شيئاً.
    const effort = effortFor(intent, data.message, longForm);
    const chatOptions = longForm
      ? {
          json: true,
          timeoutMs: 75_000,
          maxTokens: 6000,
          budgetMs: 130_000,
          reasoningEffort: effort,
        }
      : {
          json: true,
          // التفكير الأعمق يحتاج وقتاً أطول قبل أوّل حرف — بلا هذا تُقطع الردود الاستراتيجية.
          timeoutMs: effort === "high" ? 70_000 : 40_000,
          maxTokens: 1800,
          budgetMs: effort === "high" ? 125_000 : 100_000,
          reasoningEffort: effort,
        };

    let raw: string;
    if (campaign) {
      raw = JSON.stringify({ reply: campaign.reply, deliverables: campaign.deliverables });
    } else if (streaming) {
      // بثّ حقيقي: نص الرد يُسلَّم للمستخدم وهو يُكتب فعلياً من النموذج.
      const { freeChatStream } = await import("./nour-research.server");
      const { createReplyStreamer } = await import("./stream-reply");
      const streamer = createReplyStreamer((text) => emit({ type: "delta", text }));
      raw = await freeChatStream(apiKey, chatMessages, chatOptions, {
        onDelta: (chunk) => streamer.push(chunk),
        onRestart: () => {
          streamer.reset();
          emit({ type: "reset" });
        },
      });
    } else {
      raw = await freeChat(apiKey, chatMessages, chatOptions);
    }

    let reply = raw;
    let deliverables: Deliverable[] = [];
    let needsConnection: NeedsConnection = null;
    /** إجراء حقيقي جاهز للاعتماد بضغطة واحدة تحت الرد. */
    let pendingAction: {
      id: string;
      provider: string;
      label: string;
      inputs: { name: string; label: string; required?: boolean }[];
      values: Record<string, string>;
    } | null = null;

    // محاولة إصلاح واحدة فقط للمخرجات الطويلة التي لم تُرجع JSON صالحاً أو مخرجاً كاملاً.
    if (longForm && (!raw.trim().startsWith("{") || !/"reply"\s*:/.test(raw))) {
      try {
        raw = await freeChat(
          apiKey,
          [
            { role: "system", content: system },
            { role: "user", content: data.message },
            { role: "assistant", content: raw },
            {
              role: "user",
              content:
                "راجع المسودة مرة واحدة وفق معايير القبول، وأصلح النقص أو القطع فقط. أعد JSON صالحاً كاملاً بنفس البنية المطلوبة دون شرح خارجي.",
            },
          ],
          { json: true, timeoutMs: 40_000, maxTokens: 6000, budgetMs: 55_000 },
        );
      } catch (error) {
        console.warn("[chat] repair pass skipped:", error instanceof Error ? error.message : error);
      }
    }

    try {
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const parsed: unknown = JSON.parse(cleaned);
      // النموذج قد يعيد كائناً واحداً أو مصفوفة كائنات — نتعامل مع الحالتين.
      const items = (Array.isArray(parsed) ? parsed : [parsed]).filter(
        (
          x,
        ): x is {
          reply?: string;
          deliverable?: Deliverable | null;
          deliverables?: Deliverable[] | null;
          needs_connection?: NeedsConnection;
          action?: { id?: string; values?: Record<string, unknown> } | null;
        } => Boolean(x) && typeof x === "object",
      );
      // إجراء حقيقي اختاره الموظف: نقبله فقط إن كان ضمن إجراءاته وتكاملاته المربوطة.
      const act = items.map((x) => x.action).find((a) => a && typeof a?.id === "string");
      if (act?.id) {
        const def = allowedActions.find((a) => a.id === act.id);
        if (def) {
          const values: Record<string, string> = {};
          for (const [k, val] of Object.entries(act.values ?? {})) {
            if (val === null || val === undefined) continue;
            values[k] = typeof val === "string" ? val : JSON.stringify(val);
          }
          pendingAction = { ...def, values };
        }
      }
      const replies = items
        .map((x) => (typeof x.reply === "string" ? x.reply.trim() : ""))
        .filter(Boolean);
      deliverables = items
        .flatMap((x) => [x.deliverable, ...(Array.isArray(x.deliverables) ? x.deliverables : [])])
        .filter((d): d is Deliverable => Boolean(d?.title && d.body))
        // لا نفرض المنصة إلا على مخرج بلا منصة، حتى لا تُدمج خطة متعددة المنصات في منصة واحدة.
        .map((d) => (d.channel ? d : askedTargets[0] ? { ...d, channel: askedTargets[0] } : d));
      // النموذج قد يعيد بنية خاصة به (خطة أسبوع، عدة منشورات) — نلتقط المخرجات منها بدل عرض JSON خام.
      if (!deliverables.length)
        deliverables = harvestDeliverables(parsed)
          .slice(0, 14)
          // نفس قاعدة المنصة تُطبَّق على المخرجات المُلتقطة، وإلا نُسبت لمنصة الموظف الافتراضية خطأً.
          .map((d) => (d.channel ? d : askedTargets[0] ? { ...d, channel: askedTargets[0] } : d));

      const nc = items
        .map((x) => x.needs_connection)
        .find((n) => n && typeof n === "object" && typeof n.provider === "string");
      // لا نعرض زر ربط لحساب مربوط فعلاً أو لمنصة لا تخص هذا الموظف.
      if (nc && !connected.includes(nc.provider)) {
        const allowed = employeeDirectory[data.employeeId as EmployeeId]?.integrations.some(
          (i) => i.provider === nc.provider,
        );
        if (allowed)
          needsConnection = {
            provider: nc.provider,
            reason: String(nc.reason ?? "").slice(0, 160),
          };
      }
      // إن طلب المستخدم منصة غير مربوطة ولم يذكرها النموذج، نطلب ربطها نحن.
      const askedMissing = askedTargets.find((p) => !connected.includes(p));
      if (!needsConnection && askedMissing && deliverables.length) {
        needsConnection = {
          provider: askedMissing,
          reason: `طلبت النشر على ${providerLabel(askedMissing)}`,
        };
      }
      if (replies.length) {
        reply = replies.join("\n\n");
      } else if (deliverables.length) {
        reply = deliverables.map((d) => `### ${d.title}\n\n${d.body}`).join("\n\n---\n\n");
      } else {
        // بنية غير متوقعة تماماً: نعرضها كنص عربي مقروء بدل JSON خام.
        const markdown = jsonToMarkdown(parsed);
        if (markdown.trim().length > 20) reply = markdown;
      }
    } catch {
      deliverables = [];
      // JSON مقطوع (ردّ طويل): ننقذ نص reply بدل عرض JSON خام للمستخدم.
      const m = raw.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)/);
      if (m?.[1]) {
        try {
          reply = JSON.parse(`"${m[1]}"`);
        } catch {
          reply = m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
        }
      } else {
        // لا يوجد حقل reply أصلاً: ننظّف أي بقايا JSON قبل العرض حتى لا يرى المستخدم بنية تقنية.
        const stripped = raw
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/```\s*$/i, "")
          .replace(/^\s*[{[]\s*/, "")
          .replace(/\s*[}\]]\s*$/, "")
          .replace(/^\s*"[a-z_]+"\s*:\s*/gim, "")
          .replace(/",?\s*$/gm, "")
          .replace(/\\n/g, "\n")
          .replace(/\\"/g, '"')
          .trim();
        if (stripped.length > 20) reply = stripped;
      }
    }

    // وعد بلا تسليم: الموظف يقول «جهّزت لك…» ثم لا يُرجع أي مخرج، فيضيع النص كله
    // ولا تظهر مهمة في الموافقات. محاولة إصلاح واحدة تطلب المخرج نفسه حرفياً.
    const promisedOnly =
      intent === "work" &&
      !deliverables.length &&
      !needsConnection &&
      !pendingAction &&
      reply.trim().length < 700 &&
      /(جهّزت|جهزت|أعددت|اعددت|كتبت|حضّرت|حضرت|صغت|بالأسفل|فيما يلي)/.test(reply);
    if (promisedOnly) {
      try {
        const repaired = await freeChat(
          apiKey,
          [
            { role: "system", content: system },
            { role: "user", content: userTurn },
            { role: "assistant", content: reply },
            {
              role: "user",
              content:
                'وعدت بمخرج ولم تُسلّمه. أعد الآن JSON صالحاً فقط بالبنية: {"reply":"سطر واحد يقدّم المخرج","deliverable":{"title":"عنوان قصير","kind":"نوع المخرج","channel":"القناة","body":"نص المخرج الكامل جاهزاً للنسخ بلا أي شرح أو وعود"}} — لا تعتذر ولا تشرح، النص الكامل داخل body.',
            },
          ],
          { json: true, timeoutMs: 40_000, maxTokens: 1800, budgetMs: 55_000 },
        );
        const parsedFix = JSON.parse(
          repaired
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim(),
        ) as { reply?: string; deliverable?: Deliverable | null };
        const fixed = parsedFix?.deliverable;
        if (fixed?.title && fixed.body) {
          deliverables = [
            fixed.channel
              ? fixed
              : askedTargets[0]
                ? { ...fixed, channel: askedTargets[0] }
                : fixed,
          ];
          if (typeof parsedFix.reply === "string" && parsedFix.reply.trim())
            reply = parsedFix.reply.trim();
        }
      } catch (error) {
        console.warn(
          "[chat] deliverable repair skipped:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    // في المحادثة الحرة (سؤال/دردشة) لا مخرجات ولا طلبات ربط — إجابة فقط.
    if (intent !== "work") {
      deliverables = [];
      needsConnection = null;
      pendingAction = null;
    }

    // فحص جودة حتمي لكل منشور من أي موظف (هوك، طول المنصة، دعوة، هاشتاقات، حشو، بقايا تنسيق)
    // وإعادة كتابة موجّهة لأي منشور ضعيف قبل عرضه — بطاقة النشر مشتركة بين كل الموظفين،
    // فيجب أن تكون معايير جودة المنشور واحدة لهم جميعاً لا لسِراج وحده.
    if (deliverables.length) {
      try {
        const { autofixPosts } = await import("./post-autofix.server");
        const before = deliverables.map((d) => d.body ?? "");
        const fixed = (await autofixPosts(apiKey, deliverables as Record<string, unknown>[], {
          bannedWords: workspace.banned_words ?? [],
          // اللهجة الحقيقية (اختيار المالك أو المستنتجة) لا نبرة العلامة —
          // تمرير النبرة هنا كان يطلب من المصلّح الكتابة بلهجة اسمها «ودود ومحترف».
          ...(ownerDialect ? { dialect: ownerDialect } : {}),

          // وسائط حقيقية فقط: مرفقات المستخدم أو صورة ستُولَّد فعلاً.
          hasMedia: Boolean(data.attachments?.length) || (data.imageMode ?? "auto") !== "off",
        })) as typeof deliverables;

        // نُبقي نص المحادثة متطابقاً مع المخرج المحسّن بدل عرض نسختين مختلفتين.
        fixed.forEach((d, i) => {
          const old = before[i] ?? "";
          if (old && d.body && d.body !== old && reply.includes(old))
            reply = reply.replace(old, d.body);
        });
        deliverables = fixed;
      } catch (error) {
        console.warn("[chat] autofix skipped:", error instanceof Error ? error.message : error);
      }
    }

    // الصور تُولَّد فعلياً — لا يبقى المستخدم مع «برومبت» مكتوب فقط.
    // والمستخدم هو صاحب القرار: إيقاف · تلقائي · وصف يكتبه بنفسه (يُترجم حرفياً بلا إضافة).
    const imageMode = data.imageMode ?? "auto";
    const userImagePrompt = data.imagePrompt?.trim() ?? "";
    const webImages = await webImagesTask;
    const wantsImage =
      webImages.length === 0 &&
      (imageMode === "manual"
        ? userImagePrompt.length > 2
        : imageMode !== "off" &&
          intent === "work" &&
          !imageRefused &&
          // لا توليد تلقائي أبداً: الصورة تُنتَج فقط حين يطلبها المستخدم صراحةً.
          explicitImage &&
          attachments.every((a) => a.type !== "image"));
    // توليد الصورة يبدأ الآن ويسير بالتوازي مع مراجعة الجودة.
    const imageTask: Promise<string | null> = !wantsImage
      ? Promise.resolve(null)
      : (async (): Promise<string | null> => {
          let imageUrl: string | null = null;
          try {
            const { ownedHeroImage, extractImagePrompt, imageBrief, literalBrief, aspectSize } =
              await import("./image-gen.server");
            const fromField = deliverables
              .map((d) => d.image_prompt)
              .find((p) => typeof p === "string" && p.trim().length > 30);
            const draft =
              (fromField ? fromField.trim() : null) ??
              extractImagePrompt(`${reply}\n${deliverables.map((d) => d.body ?? "").join("\n")}`);
            // لا تُولَّد صورة إلا بطلب صريح أو وصف كتبه المستخدم بنفسه.
            const wantsVisual = imageMode === "manual" || explicitImage;
            if (wantsVisual) {
              emit({
                type: "step",
                label:
                  imageMode === "manual" || explicitImage
                    ? "أولّد الصورة المطلوبة الآن"
                    : "أجهّز صورة مرافقة للمخرج",
              });
              // وصف المستخدم يُحترم حرفياً؛ وإلا يُشتق الوصف من طلبه ومن المخرج نفسه.
              const prompt =
                imageMode === "manual"
                  ? await literalBrief(userImagePrompt)
                  : await imageBrief({
                      request: data.message,
                      title: deliverables[0]?.title ?? null,
                      body: deliverables[0]?.body ?? reply,
                      brand: {
                        name: workspace?.name,
                        industry: workspace?.industry,
                        country: workspace?.country ?? null,
                      },
                      draft,
                    });
              imageUrl = await ownedHeroImage(
                supabase as unknown as Parameters<typeof ownedHeroImage>[0],
                data.workspaceId,
                prompt,
                aspectSize(data.imageAspect ?? "landscape"),
              );
            }
          } catch (error) {
            console.error("[chat] image generation failed:", error);
          }
          return imageUrl;
        })();

    // مخرج واحد جاهز للنشر: ما يراه المالك في المحادثة هو نص المنشور نفسه لا غير —
    // بلا مقدمة «جهّزت لك…» ولا أقسام التوقيت والخطوة التالية، حتى لا يختلط كلام
    // الموظف بنص المنشور ولا تلتقط لوحة النشر الجزء الخطأ.
    if (deliverables.length === 1) {
      const postBody = (deliverables[0]?.body ?? "").trim();
      if (postBody.length > 60) reply = postBody;
    }

    reply = fillPlaceholders(reply, workspace.name, ws.website ?? null, brandProducts);
    reply = sanitizeActionClaims(reply, connected);
    // منع التكرار: أحياناً يعيد النموذج نفس الفقرة مرتين (ملخص + مخرج) — نُبقي أول ظهور فقط.
    reply = dropEchoedSection(dedupeParagraphs(reply));

    // حَكَم الجودة يعمل بالتوازي مع توليد الصورة: مراجعة إلزامية للمخرجات الطويلة
    // وإصلاح واحد موجّه عند الرسوب، بلا إضافة أي انتظار فوق زمن الصورة.
    const originalReply = reply;
    // المخرجات القصيرة (منشور، بريد، ردّ جاهز) كانت تمرّ بلا مراجعة — والآن تُراجَع أيضاً،
    // فجودة المخرج القصير لا تقلّ أهمية عن التقرير الطويل.
    const shouldJudge = intent === "work" && reply.length > 120;

    if (shouldJudge) emit({ type: "step", label: "أراجع جودة المخرج قبل تسليمه لك" });
    const judgeTask = !shouldJudge
      ? Promise.resolve(null)
      : import("./quality-judge.server")
          .then(({ judgeAndImprove }) =>
            judgeAndImprove({
              employeeId: data.employeeId,
              request: data.message,
              output: reply,
              criteria: qualityCriteria[data.employeeId] ?? [],
              bannedWords: workspace.banned_words ?? [],
            }),
          )
          .catch((error: unknown) => {
            console.warn("[judge] skipped:", error instanceof Error ? error.message : error);
            return null;
          });

    const [imageUrl, verdict] = await Promise.all([imageTask, judgeTask]);
    const qualityScore: number | null = verdict?.score || null;
    if (verdict?.revised) {
      // مخرج واحد فقط: نجعل المهمة المحفوظة مطابقة تماماً لما يظهر في المحادثة.
      if (deliverables.length === 1 && deliverables[0]?.body) {
        deliverables[0]!.body = verdict.output;
      }
      reply = verdict.output;
    }

    // المخرجات المتعددة (حملة، جدول أسبوعي، عدة منصات) كانت تُسلَّم بلا مراجعة فردية:
    // الحَكَم يرى النص المجمّع فقط. الآن يُفحص كل مخرج حتمياً، وما يسقط منها يُعاد إصلاحه.
    if (deliverables.length > 1) {
      try {
        const { auditOutput } = await import("./output-quality");
        const { judgeAndImprove } = await import("./quality-judge.server");
        const weak = deliverables
          .map((d, index) => ({ index, body: d.body ?? "" }))
          .filter(
            (d) =>
              d.body.length > 60 &&
              auditOutput({
                text: d.body,
                employeeId: data.employeeId,
                request: data.message,
                bannedWords: workspace.banned_words ?? [],
              }).penalty > 0,
          )
          .slice(0, 4); // سقف يمنع تأخير الرد على الحملات الكبيرة

        const fixes = await Promise.all(
          weak.map((d) =>
            judgeAndImprove({
              employeeId: data.employeeId,
              request: data.message,
              output: d.body,
              criteria: qualityCriteria[data.employeeId] ?? [],
              bannedWords: workspace.banned_words ?? [],
            }).catch(() => null),
          ),
        );

        fixes.forEach((fix, i) => {
          const target = weak[i];
          if (!fix?.revised || !target) return;
          const old = target.body;
          deliverables[target.index]!.body = fix.output;
          if (old && reply.includes(old)) reply = reply.replace(old, fix.output);
        });
      } catch (error) {
        console.warn(
          "[judge] per-deliverable skipped:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    // بعد حَكَم الجودة أيضاً: لا يخرج أي فراغ نائب إلى المستخدم.
    reply = fillPlaceholders(reply, workspace.name, ws.website ?? null, brandProducts);
    for (const d of deliverables) {
      d.body = fillPlaceholders(d.body ?? "", workspace.name, ws.website ?? null, brandProducts);
    }
    if (deliverables.length === 1) {
      // حارس أخير بعد المراجعة الآلية: حتى لو أعادت المراجعة مقدمة أو تذييل قياس،
      // يبقى الرد القابل للنشر هو متن المخرج المنظم وحده.
      const postBody = extractPostText(deliverables[0]?.body ?? reply);
      if (postBody) {
        deliverables[0]!.body = postBody;
        reply = postBody;
      }
    }

    const footers = toolBlocks.map((t) => t.footer).filter(Boolean);
    if (footers.length) reply = `${reply.trim()}\n\n> ${footers.join(" · ")}`;

    if (webImages.length) {
      const list = webImages
        .map((img) => `![${img.title.replace(/[[\]]/g, "")}](${img.url})\n[المصدر: ${img.source}](${img.page})`)
        .join("\n\n");
      reply = `${reply.trim()}\n\n**صور حقيقية من الإنترنت:**\n\n${list}`;
    } else if (imageUrl) {
      const alt = (deliverables[0]?.title ?? "الصورة المولّدة").slice(0, 120);
      const note = wantsWeb ? "\n\n> لم أجد صورة حقيقية مناسبة على الإنترنت، فولّدت لك صورة بدلاً منها." : "";
      reply = `${reply.trim()}${note}\n\n![${alt}](${imageUrl})`;
    } else if (explicitImage) {
      // طلب صورة صريح ولم ينجح التوليد: نصرّح بذلك بدل ترك المستخدم مع وصف نصي فقط.
      reply = `${reply.trim()}\n\n> تعذّر توليد الصورة الآن. أعد الطلب بعد لحظات أو اكتب وصف الصورة بنفسك من زر الصورة في مربع الإرسال.`;
    }

    if (research.used.length) {
      reply = `${reply.trim()}\n\n— استندتُ إلى بيانات حقيقية: ${research.used.join(" · ")}`;
    }

    // عدة مخرجات: كل مخرج مستقل — نوجّه المستخدم إليها بدل محرّر واحد.
    if (deliverables.length > 1) {
      // «منشورات» كلمة سِراج وحده: ردود سام وإيفا تحمل قناة أيضاً وكانت تُوصف خطأً بأنها منشورات.
      const allPosts = data.employeeId === "sonny" && deliverables.every((d) => Boolean(d.channel));
      // تسمية المخرجات بنوعها الحقيقي: رسائل بريد لا تُسمّى «منشورات».
      const kinds = new Set(deliverables.map((d) => (d.kind ?? "").trim()).filter(Boolean));
      const oneKind = kinds.size === 1 ? [...kinds][0]! : "";
      const label = allPosts
        ? "منشورات"
        : oneKind
          ? /رسال|بريد|إيميل|ايميل|mail/i.test(oneKind)
            ? "رسائل"
            : /مقال|تدوين/i.test(oneKind)
              ? "مقالات"
              : /تصميم|صورة|بصري/i.test(oneKind)
                ? "تصاميم"
                : "مخرجات"
          : "مخرجات";
      reply = `${reply.trim()}\n\n📋 جهّزت **${deliverables.length} ${label}** منفصلة، كل واحدة بنصها الكامل — راجعها واعتمدها من [المخرجات والمهام](/app/tasks).`;
    }

    // صور من موقع المستخدم: اختيارية تماماً — تظهر فقط حين يطلبها في رسالته.
    const wantsSiteImages =
      /(?=.*(?:موقعي|الموقع|موقعنا|website|site))(?=.*(?:صور?|فيديوهات?|image|photo|video))|(?:صور|فيديوهات?)\s+موقع|(?:من|استخدم)\s+(?:صور|فيديوهات?)\s+(?:من\s+)?موقعي/iu.test(
        data.message ?? "",
      );
    let siteSuggestions: { url: string; alt: string; pageUrl: string }[] = [];
    if (wantsSiteImages)
      try {
        const { data: stored } = await supabase
          .from("site_assets")
          .select("url, alt, page_url, weight, kind")
          .eq("workspace_id", data.workspaceId)
          .order("weight", { ascending: false })
          .limit(120);

        let pool = (stored ?? []).map((a) => ({
          url: a.url,
          alt: a.alt ?? "",
          pageUrl: a.page_url ?? "",
          weight: a.weight ?? 0,
          kind: a.kind === "video" ? ("video" as const) : ("image" as const),
        }));

        // أول مرة: نلتقط صور الموقع الآن ثم نحفظها للمرات القادمة.
        if (!pool.length && workspace?.website) {
          const { harvestSiteAssets } = await import("./brand-assets.server");
          const found = await harvestSiteAssets(workspace.website, 16);
          if (found.length) {
            await supabase.from("site_assets").upsert(
              found.map((a) => ({
                workspace_id: data.workspaceId,
                url: a.url,
                page_url: a.pageUrl,
                alt: a.alt || null,
                weight: a.weight,
                source: "website",
                kind: a.kind,
              })),
              { onConflict: "workspace_id,url" },
            );
            pool = found.map((a) => ({
              url: a.url,
              alt: a.alt,
              pageUrl: a.pageUrl,
              weight: a.weight,
              kind: a.kind,
            }));
          }
        }

        if (pool.length) {
          const { rankAssets } = await import("./brand-assets.server");
          const query = `${data.message}\n${deliverables.map((d) => `${d.title ?? ""} ${d.body ?? ""}`).join("\n")}`;
          siteSuggestions = rankAssets(query, pool.filter((a) => a.kind === "image"), 6).map((a) => ({
            url: a.url,
            alt: a.alt,
            pageUrl: a.pageUrl,
          }));
        }
      } catch (e) {
        console.error("[site-assets] suggestion failed:", e);
      }

    if (siteSuggestions.length) {
      const gallery = siteSuggestions
        .map((s, i) => {
          const label = s.alt?.trim() || `صورة من موقعك ${i + 1}`;
          const page = s.pageUrl ? ` — [مصدرها](${s.pageUrl})` : "";
          return `![${label}](${s.url})\n*${label}*${page}`;
        })
        .join("\n\n");
      reply = `${reply.trim()}\n\n### 📸 صور من موقعك تصلح لهذا المحتوى\n\n${gallery}\n\nاختر أي صورة منها بدل الصورة المولّدة — كلها صور حقيقية من موقعك.`;
    }

    emit({ type: "step", label: "أحفظ الرد والمخرجات في مساحتك" });

    // ذاكرة القرارات تُستخلص بالتوازي مع الحفظ بدل أن تُضاف إلى زمن انتظار المستخدم.
    const decisionsTask: Promise<number> =
      reply.length > 200
        ? import("./decisions.server")
            .then(async ({ extractDecisions, recordDecisions }) =>
              recordDecisions(supabase as never, {
                workspaceId: data.workspaceId,
                employeeId: data.employeeId,
                conversationId: data.conversationId,
                drafts: await extractDecisions(data.message, reply),
              }),
            )
            .catch((error: unknown) => {
              console.warn(
                "[decisions] capture skipped:",
                error instanceof Error ? error.message : error,
              );
              return 0;
            })
        : Promise.resolve(0);

    // صورة المخرج: المولّدة، وإلا صورة أرفقها المستخدم فقط — لا نُلصق صور الموقع تلقائياً.
    const mediaUrl =
      imageUrl ??
      attachments.find((a) => a.type === "image")?.url ??
      (wantsSiteImages ? (siteSuggestions[0]?.url ?? null) : null);

    // الرسالة والمخرجات تُحفظ في دفعة واحدة متوازية — خطة من ١٢ منشوراً كانت
    // تنتظر ١٢ رحلة متسلسلة إلى قاعدة البيانات.
    const [messageInsert, taskRows, savedDecisions] = await Promise.all([
      supabase
        .from("messages")
        .insert({
          workspace_id: data.workspaceId,
          employee_id: data.employeeId,
          role: "assistant",
          body: reply,
          conversation_id: data.conversationId,
        })
        .select()
        .single(),
      Promise.all(
        deliverables.map(async (deliverable) => {
          const output = mediaUrl
            ? `![${deliverable.title}](${mediaUrl})\n\n${deliverable.body!}`
            : deliverable.body!;
          const { data: task } = await supabase
            .from("tasks")
            .insert({
              workspace_id: data.workspaceId,
              employee_id: data.employeeId,
              title: deliverable.title!,
              detail: reply.slice(0, 400),
              kind: deliverable.kind ?? persona.kind,
              channel: deliverable.channel ?? persona.channel,
              status: "review",
              output,
              scheduled: deliverable.scheduled ?? "بانتظار اعتمادك",
              steps: [
                { label: "فهم الطلب", state: "done" },
                { label: "التنفيذ", state: "done" },
                { label: "مراجعتك", state: "active" },
                { label: "النشر", state: "todo" },
              ],
            })
            .select("id")
            .single();
          return task?.id ?? null;
        }),
      ),
      decisionsTask,
    ]);
    const { data: assistantRow, error: assistantError } = messageInsert;
    if (assistantError) throw new Error(assistantError.message);
    const createdTaskId = taskRows.find((id): id is string => Boolean(id)) ?? null;

    try {
      const { recordEmployeeRun } = await import("./learning.server");
      await recordEmployeeRun(supabase as never, {
        workspaceId: data.workspaceId,
        employeeId: data.employeeId,
        conversationId: data.conversationId,
        messageId: assistantRow.id,
        taskId: createdTaskId,
        capability: intent,
        request: data.message,
        originalOutput: originalReply,
        finalOutput: reply,
        qualityScore,
        issues: verdict?.issues ?? [],
        revised: verdict?.revised ?? false,
        lessonIds: learning.lessonIds,
      });
    } catch (error) {
      console.warn("[learning] run skipped:", error instanceof Error ? error.message : error);
    }

    return {
      qualityScore,
      savedDecisions,
      reply,
      messageId: assistantRow.id,
      createdTaskId,
      needsConnection,
      action: pendingAction,
      imageUrl,
      siteSuggestions,
    };
  }
}

const skillInput = z.object({
  workspaceId: z.string().uuid(),
  employeeId: z.string().min(1),
  skillId: z.string().min(1),
  values: z.record(z.string(), z.string()),
  conversationId: z.string().uuid(),
});

/** تشغيل قدرة محددة: يخرج مخرجاً جاهزاً ويحفظه كمهمة بانتظار الاعتماد. */
export const runSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => skillInput.parse(data))
  .handler(async ({ data, context }) => {
    const run = await executeSkill(context.supabase, {
      workspaceId: data.workspaceId,
      employeeId: data.employeeId,
      skillId: data.skillId,
      values: data.values,
      conversationId: data.conversationId,
    });
    return { output: run.output, messageId: run.messageId, taskId: run.taskId };
  });
