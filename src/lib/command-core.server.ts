/**
 * نواة التحكّم بالمحادثة (واتساب الآن، تيليجرام لاحقاً):
 * صاحب البيزنس يرسل طلباً نصياً → سِراج يجهّز مسودة منشور → المالك يرد «انشر» فيُنشر فعلياً.
 * لا نشر بلا موافقة صريحة، ولا نشر على منصة غير مربوطة.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { PUBLISHABLE, providerLabel, requestedPublishTargets } from "./platforms";
import { adaptForProvider, sanitizePostBody } from "./post-format";
import { liveFactsBlock, needsLiveFacts, timezoneForCountry } from "./live-context.server";

type Admin = SupabaseClient<Database>;

export type IncomingCommand = {
  channel: "whatsapp" | "telegram";
  /** رقم المرسل (واتساب) أو معرّف الدردشة (تيليجرام). */
  externalId: string;
  text: string;
};

const APPROVE = /^(انشر|أنشر|نشر|انشرها|تمام|موافق|اعتمد|ok|okay|yes|✅|1)$/i;
const CANCEL = /^(الغاء|إلغاء|الغِ|لا|cancel|stop|0)$/i;
const EDIT = /^(عدل|عدّل|تعديل|غير|غيّر|edit)\b/i;

/** توجيه الطلب للموظف المناسب من الاسم أو من موضوع الطلب. */
const EMPLOYEE_MATCHERS: { id: string; name: string; re: RegExp }[] = [
  { id: "sonny", name: "سِراج", re: /سراج|سِراج|سونى|sonny|بوست|منشور|سوشيال|انستا|فيس|تويتر|إكس|لينكد|تيليجرام/i },
  { id: "nour", name: "نور", re: /نور\b|مقال|سيو|seo|بحث|ابحث|كلمات مفتاحية|مدونة|ووردبريس/i },
  { id: "sam", name: "سالم", re: /سالم|مبيعات|عميل|عرض سعر|فاتور|crm|صفقة|متابعة عملاء/i },
  { id: "dana", name: "دانة", re: /دانة|دانه|تصميم|هوية|لوجو|شعار|بوستر|جرافيك/i },
  { id: "adam", name: "آدم", re: /آدم|ادم\b|تحليل|أرقام|إحصاء|احصاء|تقرير أداء|analytics/i },
  { id: "eva", name: "أمَل", re: /أمل|امل\b|موعد|اجتماع|ذكّرني|ذكرني|مهمة|جدول/i },
];

function routeEmployee(text: string): { id: string; name: string } {
  for (const m of EMPLOYEE_MATCHERS) {
    if (m.re.test(text)) return { id: m.id, name: m.name };
  }
  return { id: "sonny", name: "سِراج" };
}

/** رد موظف غير سِراج: يجيب بالعربية بلا أي إجراء خارجي. */
async function answerAsEmployee(
  admin: Admin,
  workspaceId: string,
  employee: { id: string; name: string },
  request: string,
): Promise<string> {
  const { data: ws } = await admin
    .from("workspaces")
    .select("name, industry, tone, country")
    .eq("id", workspaceId)
    .maybeSingle();
  const { getMember } = await import("@/data/team");
  const member = getMember(employee.id);
  const { timezoneForCountry, liveFactsBlock, needsLiveFacts } = await import(
    "./live-context.server"
  );
  const timeZone = timezoneForCountry(ws?.country);
  const facts = needsLiveFacts(request)
    ? await liveFactsBlock(request, 20_000, { country: ws?.country ?? null, timeZone })
    : "";
  const system = [
    `أنت ${member?.name ?? employee.name}، ${member?.role ?? "عضو في فريق سهل"}، ترد بالعربية باختصار وعملية.`,
    ws?.name ? `العلامة: ${ws.name}${ws.industry ? ` · ${ws.industry}` : ""}` : "",
    ws?.tone ? `النبرة: ${ws.tone}` : "",
    "لا تنفّذ أي إجراء خارجي؛ اقترح الخطوة التالية بوضوح واطلب موافقة صاحب العمل قبل أي نشر أو إرسال.",
    facts,
  ]
    .filter(Boolean)
    .join("\n");

  const { freeChat } = await import("./nour-research.server");
  const raw = await freeChat(employee.id, [
    { role: "system", content: system },
    { role: "user", content: request },
  ], { maxTokens: 700, timeoutMs: 60_000, timeZone });
  return `👤 ${member?.name ?? employee.name}:\n${raw.trim()}`;
}

/** المنصات المربوطة فعلياً في مساحة العمل. */
async function connectedProviders(admin: Admin, workspaceId: string): Promise<string[]> {
  const [{ data: linked }, { data: direct }, { data: meta }, { data: telegramCredential }] = await Promise.all([
    admin
      .from("pipedream_accounts")
      .select("provider")
      .eq("workspace_id", workspaceId)
      .eq("status", "connected"),
    admin
      .from("integrations")
      .select("provider")
      .eq("workspace_id", workspaceId)
      .eq("status", "connected"),
    admin
      .from("meta_connections")
      .select("kind")
      .eq("workspace_id", workspaceId)
      .eq("status", "connected"),
    admin
      .from("integration_credentials")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("provider", "telegram")
      .maybeSingle(),
  ]);
  const set = new Set<string>([
    ...(linked ?? []).map((r) => r.provider).filter((provider) => provider !== "telegram"),
    ...(direct ?? []).map((r) => r.provider).filter((provider) => provider !== "telegram"),
  ]);
  if (telegramCredential) set.add("telegram");
  for (const row of meta ?? []) {
    if (row.kind === "instagram") set.add("instagram");
    else set.add("facebook");
  }
  return [...set].filter((p) => (PUBLISHABLE as readonly string[]).includes(p));
}

/** يولّد نص المنشور بأسلوب سِراج وبصوت العلامة. */
async function draftPost(
  admin: Admin,
  workspaceId: string,
  request: string,
  previous?: { body: string; instruction: string },
): Promise<string> {
  const [{ data: ws }, { data: brain }] = await Promise.all([
    admin
      .from("workspaces")
      .select("name, industry, tone, banned_words, country, website")
      .eq("id", workspaceId)
      .maybeSingle(),
    admin
      .from("brain_items")
      .select("title, body")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const brand = [
    ws?.name ? `اسم العلامة: ${ws.name}` : "",
    ws?.industry ? `المجال: ${ws.industry}` : "",
    ws?.tone ? `النبرة: ${ws.tone}` : "",
    ws?.country ? `السوق: ${ws.country}` : "",
    ws?.banned_words?.length ? `كلمات ممنوعة: ${ws.banned_words.join("، ")}` : "",
    (brain ?? []).map((b) => `- ${b.title}: ${(b.body ?? "").slice(0, 200)}`).join("\n"),
  ]
    .filter(Boolean)
    .join("\n");

  const timeZone = timezoneForCountry(ws?.country);
  const liveFacts = needsLiveFacts(request)
    ? await liveFactsBlock(request, 20_000, { country: ws?.country ?? null, timeZone })
    : "";
  const system = [
    "أنت سِراج، مدير سوشيال ميديا عربي محترف.",
    "اكتب منشوراً واحداً جاهزاً للنشر فقط: بلا مقدمات، بلا شرح، بلا Markdown، بلا عناوين أقسام، بلا خيارات متعددة.",
    "ابدأ بهوك قوي، اجعل النص قصيراً ومقروءاً، أضف دعوة فعل واضحة، ثم ٣–٥ هاشتاجات عربية مناسبة في السطر الأخير.",
    "لا تخترع أرقاماً ولا عروضاً لم يذكرها صاحب العمل.",
    brand ? `سياق العلامة:\n${brand}` : "",
    liveFacts,
  ]
    .filter(Boolean)
    .join("\n");

  const messages: { role: string; content: string }[] = [
    { role: "system", content: system },
    { role: "user", content: request },
  ];
  if (previous) {
    messages.push({ role: "assistant", content: previous.body });
    messages.push({ role: "user", content: `عدّل المنشور كما يلي: ${previous.instruction}` });
  }

  const { freeChat } = await import("./nour-research.server");
  const raw = await freeChat("sonny", messages, {
    maxTokens: 700,
    timeoutMs: 60_000,
    timeZone,
  });
  return sanitizePostBody(raw) || raw.trim();
}

function draftMessage(body: string, providers: string[], imageNote?: string | null): string {
  const targets = providers.length
    ? providers.map(providerLabel).join(" + ")
    : "لا توجد منصة مربوطة";
  return [
    "✍️ مسودة المنشور:",
    "",
    body,
    "",
    ...(imageNote ? [imageNote, ""] : []),
    `📤 سيُنشر على: ${targets}`,
    "رد بـ «انشر» للنشر الآن، أو «عدّل …» لتعديله، أو «إلغاء».",
  ].join("\n");
}

/** ينشر المسودة المعتمدة على كل منصة مستهدفة ويعيد ملخصاً نصياً. */
async function publishDraft(
  admin: Admin,
  draft: {
    id: string;
    workspace_id: string;
    body: string;
    providers: string[];
    image_url: string | null;
  },
): Promise<string> {
  const { publishQueuedPost } = await import("./social-queue.server");
  const lines: string[] = [];
  let anyOk = false;

  for (const provider of draft.providers) {
    try {
      const { data: row, error } = await admin
        .from("social_posts")
        .insert({
          workspace_id: draft.workspace_id,
          employee_id: "sonny",
          provider,
          body: adaptForProvider(provider, draft.body),
          image_url: draft.image_url,
          scheduled_at: new Date().toISOString(),
          status: "scheduled",
          locked_at: new Date().toISOString(),
          meta: { source: "command" },
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const result = await publishQueuedPost(admin, row.id);
      if (result.status === "published") {
        anyOk = true;
        lines.push(`✅ ${providerLabel(provider)} — تم النشر`);
      } else {
        lines.push(`⚠️ ${providerLabel(provider)} — ${result.error ?? "تعذّر النشر"}`);
      }
    } catch (e) {
      lines.push(
        `⚠️ ${providerLabel(provider)} — ${e instanceof Error ? e.message : "تعذّر النشر"}`,
      );
    }
  }

  await admin
    .from("command_drafts")
    .update({
      status: anyOk ? "published" : "failed",
      last_error: anyOk ? null : lines.join(" | "),
    })
    .eq("id", draft.id);

  return lines.join("\n") || "لم تُحدَّد منصة للنشر.";
}

/**
 * يعالج رسالة واردة ويعيد نص الرد المناسب.
 * المعالجة كاملة هنا حتى تُعاد استخدامها لتيليجرام بلا تكرار.
 */
export async function handleCommandMessage(
  admin: Admin,
  incoming: IncomingCommand,
): Promise<string> {
  const text = incoming.text.trim();
  if (!text) return "أرسل لي طلبك نصاً، مثال: «اكتب بوست عن عرض خصم ٥٠٪ لليوم فقط».";

  const { data: link } = await admin
    .from("command_links")
    .select("id, workspace_id, status")
    .eq("channel", incoming.channel)
    .eq("external_id", incoming.externalId)
    .maybeSingle();

  // ربط الرقم بمساحة العمل عبر كود مؤقت يولّده المالك من الإعدادات.
  if (!link || link.status !== "active") {
    const code = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length === 6) {
      const { data: row } = await admin
        .from("command_link_codes")
        .select("code, workspace_id, role, label, expires_at, used_at")
        .eq("code", code)
        .eq("channel", incoming.channel)
        .maybeSingle();
      if (!row) return "الكود غير صحيح. اطلب كوداً جديداً من إعدادات التطبيق.";
      if (row.used_at) return "هذا الكود مستخدم من قبل. اطلب كوداً جديداً.";
      if (new Date(row.expires_at) < new Date()) return "انتهت صلاحية الكود. اطلب كوداً جديداً.";

      await admin.from("command_links").upsert(
        {
          workspace_id: row.workspace_id,
          channel: incoming.channel,
          external_id: incoming.externalId,
          role: row.role,
          label: row.label,
          status: "active",
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "channel,external_id" },
      );
      await admin
        .from("command_link_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("code", row.code);

      return [
        "✅ تم ربط رقمك بمساحة عملك.",
        "اكتب طلبك مباشرة، مثال:",
        "«يا سِراج اكتب بوست عن فوز الفريق واعمل عرض خصم ٥٠٪ حتى منتصف الليل».",
        "سأرسل لك المسودة، وترد «انشر» لأنشرها فعلياً.",
      ].join("\n");
    }
    return incoming.channel === "telegram"
      ? "أهلاً 👋 حسابك غير مربوط بعد. افتح صفحة التكاملات في التطبيق ← تيليجرام واطلب كود ربط، ثم أرسله لي هنا."
      : "أهلاً 👋 رقمك غير مربوط بعد. افتح الإعدادات في التطبيق ← «التحكّم عبر واتساب» واطلب كود ربط، ثم أرسله لي هنا.";
  }

  await admin
    .from("command_links")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", link.id);

  const workspaceId = link.workspace_id;

  const { data: pending } = await admin
    .from("command_drafts")
    .select("id, workspace_id, body, providers, image_url, request")
    .eq("channel", incoming.channel)
    .eq("external_id", incoming.externalId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pending && CANCEL.test(text)) {
    await admin.from("command_drafts").update({ status: "cancelled" }).eq("id", pending.id);
    return "تمام، ألغيت المسودة. ابعت طلب جديد وقت ما تحب.";
  }

  if (pending && APPROVE.test(text)) {
    if (!pending.providers.length) {
      return "لا توجد منصة مربوطة للنشر — اربط منصة من صفحة التكاملات ثم أعد المحاولة.";
    }
    return await publishDraft(admin, pending);
  }

  if (pending && EDIT.test(text)) {
    const instruction = text.replace(EDIT, "").trim() || "حسّن الصياغة واختصرها.";
    const body = await draftPost(admin, workspaceId, pending.request, {
      body: pending.body,
      instruction,
    });
    await admin.from("command_drafts").update({ body }).eq("id", pending.id);
    return draftMessage(body, pending.providers, pending.image_url ? "🖼️ الصورة الحالية مرفقة" : null);
  }

  // طلب جديد: أي مسودة معلّقة سابقة تُلغى حتى لا تختلط الموافقات.
  if (pending) {
    await admin.from("command_drafts").update({ status: "cancelled" }).eq("id", pending.id);
  }

  // توجيه الطلب لغير سِراج (نور، سالم، دانة، آدم، أمَل): رد استشاري بلا نشر.
  const employee = routeEmployee(text);
  if (employee.id !== "sonny") {
    return await answerAsEmployee(admin, workspaceId, employee, text);
  }

  const connected = await connectedProviders(admin, workspaceId);
  const asked = requestedPublishTargets(text).filter((p) => connected.includes(p));
  const providers = asked.length ? asked : connected;

  const body = await draftPost(admin, workspaceId, text);

  // صورة: حقيقية عن الحدث أولاً، وإلا مولّدة — فقط حين يستدعي الطلب صورة.
  let image: { url: string; note: string } | null = null;
  const { wantsImage, resolvePostImage } = await import("./command-image.server");
  if (wantsImage(text)) {
    const { data: ws } = await admin
      .from("workspaces")
      .select("industry, country")
      .eq("id", workspaceId)
      .maybeSingle();
    const found = await resolvePostImage(admin, workspaceId, text, {
      industry: ws?.industry ?? null,
      country: ws?.country ?? null,
    });
    if (found) image = { url: found.url, note: found.note };
  }

  await admin.from("command_drafts").insert({
    workspace_id: workspaceId,
    channel: incoming.channel,
    external_id: incoming.externalId,
    employee_id: "sonny",
    providers,
    request: text.slice(0, 4000),
    body,
    image_url: image?.url ?? null,
    status: "pending",
  });

  if (!providers.length) {
    return `${draftMessage(body, providers, image?.note ?? null)}\n\nملاحظة: لا توجد منصة مربوطة بعد — اربط منصة من صفحة التكاملات لأتمكن من النشر.`;
  }
  return draftMessage(body, providers, image?.note ?? null);
}
