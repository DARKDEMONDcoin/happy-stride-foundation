/**
 * فريق سهل كامل على تيليجرام — نفس عقل الموقع بالظبط.
 *
 * الرسالة (نص / صوت / صورة / ملف) → الموظف المختار → runEmployeeTurn نفسه الذي
 * يخدم شات الموقع (بحث عميق، ذاكرة العلامة وصوتها، أدوات، فحص جودة) → الرد
 * يُنسّق ويُرسل على تيليجرام. المحادثة تُحفظ في حساب العميل وتظهر في الموقع.
 * مسار المسودة والموافقة القديم (handleCommandMessage) باقٍ كما هو لطلبات النشر.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { tg } from "./telegram.server";
import {
  byId,
  guessEmployee,
  isPublishRequest,
  markdownToTelegramHtml,
  parseTelegramText,
  splitForTelegram,
  teamCard,
} from "./telegram-format";

type Admin = SupabaseClient<Database>;

export type TgFile = { file_id: string; file_size?: number; mime_type?: string; file_name?: string; duration?: number };
export type TgIncoming = {
  message_id?: number;
  chat?: { id?: number };
  text?: string;
  caption?: string;
  voice?: TgFile;
  audio?: TgFile;
  video_note?: TgFile;
  photo?: TgFile[];
  document?: TgFile;
};

const MAX_VOICE_SECONDS = 300;
const MAX_FILE_BYTES = 20 * 1024 * 1024; // حد تنزيل Bot API

async function send(botToken: string, chatId: number, markdown: string) {
  const html = markdownToTelegramHtml(markdown);
  for (const part of splitForTelegram(html)) {
    try {
      await tg(botToken, "sendMessage", {
        chat_id: chatId,
        text: part,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    } catch {
      // HTML غير صالح لأي سبب → نص عادي بدل خسارة الرد.
      await tg(botToken, "sendMessage", { chat_id: chatId, text: part.replace(/<[^>]+>/g, "") });
    }
  }
}

async function downloadFile(botToken: string, fileId: string): Promise<{ bytes: ArrayBuffer; path: string }> {
  const info = await tg<{ file_path?: string; file_size?: number }>(botToken, "getFile", { file_id: fileId });
  if (!info.file_path) throw new Error("تعذّر الوصول للملف.");
  if ((info.file_size ?? 0) > MAX_FILE_BYTES) throw new Error("الملف أكبر من 20 ميجا.");
  const res = await fetch(`https://api.telegram.org/file/bot${botToken}/${info.file_path}`);
  if (!res.ok) throw new Error(`تعذّر تنزيل الملف [${res.status}]`);
  return { bytes: await res.arrayBuffer(), path: info.file_path };
}

/** رسالة صوتية → نص عبر Lovable AI (نموذج التفريغ المخصص). */
async function transcribe(bytes: ArrayBuffer, mime: string, name: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("خدمة تحويل الصوت غير مهيّأة.");
  const form = new FormData();
  form.append("model", "google/gemini-3.5-transcribe");
  form.append("file", new File([bytes], name, { type: mime }), name);
  form.append("response_format", "json");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`[telegram] transcription failed [${res.status}]: ${body.slice(0, 300)}`);
    if (res.status === 402) throw new Error("رصيد الذكاء الاصطناعي خلص — اشحن الرصيد وجرب تاني.");
    if (res.status === 429) throw new Error("ضغط كبير دلوقتي — ابعت الرسالة الصوتية تاني بعد دقيقة.");
    throw new Error("ماقدرتش أسمع الرسالة الصوتية — جرب تبعتها تاني أو اكتبها.");
  }
  try {
    return String((JSON.parse(body) as { text?: string }).text ?? "").trim();
  } catch {
    return body.trim();
  }
}

/** يرفع مرفقاً إلى تخزين الوسائط ويعيد رابطاً موقّعاً يقرأه الموظف. */
async function storeAttachment(
  admin: Admin,
  workspaceId: string,
  bytes: ArrayBuffer,
  name: string,
  mime: string,
): Promise<string> {
  const safe = name.replace(/[^\w.-]+/g, "_").slice(-80) || "file";
  const key = `${workspaceId}/telegram/${Date.now()}-${safe}`;
  const bucket = admin.storage.from("nour-media");
  const { error } = await bucket.upload(key, bytes, { contentType: mime, upsert: false });
  if (error) throw new Error(`تعذّر حفظ المرفق: ${error.message}`);
  const { data } = await bucket.createSignedUrl(key, 60 * 60 * 24 * 365);
  if (!data?.signedUrl) throw new Error("تعذّر إنشاء رابط المرفق.");
  return data.signedUrl;
}

async function ensureConversation(
  admin: Admin,
  workspaceId: string,
  employeeId: string,
  ids: Record<string, string>,
  fresh: boolean,
): Promise<string> {
  const existing = ids[employeeId];
  if (existing && !fresh) {
    const { data } = await admin.from("conversations").select("id").eq("id", existing).eq("workspace_id", workspaceId).maybeSingle();
    if (data) return existing;
  }
  const { data, error } = await admin
    .from("conversations")
    .insert({ workspace_id: workspaceId, employee_id: employeeId, title: "محادثة تيليجرام" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`تعذّر بدء المحادثة: ${error?.message ?? ""}`);
  return data.id;
}

/**
 * يعالج رسالة المالك على تيليجرام. يعيد false لو المحادثة غير مربوطة
 * (فيتولاها المسار القديم: كود الربط ورسائل الترحيب).
 */
export async function handleTelegramTeam(
  admin: Admin,
  args: { botToken: string; chatId: number; updateId?: number; message: TgIncoming },
): Promise<boolean> {
  const { botToken, chatId, message } = args;
  const { data: link } = await admin
    .from("command_links")
    .select("id, workspace_id, status, active_employee, conversation_ids, last_update_id")
    .eq("channel", "telegram")
    .eq("external_id", String(chatId))
    .maybeSingle();
  if (!link || link.status !== "active") return false;

  // تيليجرام يعيد إرسال التحديث لو تأخر الرد — لا ننفّذ الطلب مرتين.
  if (typeof args.updateId === "number") {
    if (link.last_update_id && args.updateId <= Number(link.last_update_id)) return true;
    await admin.from("command_links").update({ last_update_id: args.updateId, last_seen_at: new Date().toISOString() }).eq("id", link.id);
  }

  const workspaceId = link.workspace_id;
  const ids = (link.conversation_ids ?? {}) as Record<string, string>;
  let raw = (message.text ?? message.caption ?? "").trim();

  // ── الصوت ──
  const voice = message.voice ?? message.audio ?? message.video_note;
  if (voice) {
    if ((voice.duration ?? 0) > MAX_VOICE_SECONDS) {
      await send(botToken, chatId, "الرسالة الصوتية أطول من 5 دقايق — قسّمها أو اكتب الطلب.");
      return true;
    }
    await tg(botToken, "sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => null);
    const { bytes, path } = await downloadFile(botToken, voice.file_id);
    const mime = voice.mime_type || (message.video_note ? "video/mp4" : "audio/ogg");
    const heard = await transcribe(bytes, mime, path.split("/").pop() || "voice.ogg");
    if (!heard) {
      await send(botToken, chatId, "ماقدرتش أفهم الرسالة الصوتية — جرب تاني بصوت أوضح أو اكتبها.");
      return true;
    }
    await send(botToken, chatId, `🎙️ سمعتك: «${heard.slice(0, 600)}»`);
    raw = raw ? `${raw}\n${heard}` : heard;
  }

  // ── صور وملفات ──
  const attachments: { url: string; type: "image" | "file"; mime?: string; size?: number; alt?: string }[] = [];
  const photo = message.photo?.length ? message.photo[message.photo.length - 1] : undefined;
  const doc = message.document;
  for (const f of [photo, doc].filter(Boolean) as TgFile[]) {
    try {
      const { bytes, path } = await downloadFile(botToken, f.file_id);
      const isImage = f === photo || /^image\//.test(f.mime_type ?? "");
      const mime = f.mime_type || (isImage ? "image/jpeg" : "application/octet-stream");
      const name = f.file_name || path.split("/").pop() || (isImage ? "photo.jpg" : "file");
      const url = await storeAttachment(admin, workspaceId, bytes, name, mime);
      attachments.push({ url, type: isImage ? "image" : "file", mime, size: bytes.byteLength, alt: name.slice(0, 200) });
    } catch (e) {
      await send(botToken, chatId, `⚠️ ${e instanceof Error ? e.message : "تعذّر استلام المرفق."}`);
    }
  }

  const parsed = parseTelegramText(raw);

  // ── الأوامر ──
  if (parsed.kind === "command") {
    if (parsed.command === "new") {
      const emp = link.active_employee || "sonny";
      const conv = await ensureConversation(admin, workspaceId, emp, ids, true);
      await admin.from("command_links").update({ conversation_ids: { ...ids, [emp]: conv } }).eq("id", link.id);
      await send(botToken, chatId, `✨ بدأنا محادثة جديدة مع ${byId(emp)?.name ?? "الفريق"}.`);
      return true;
    }
    await tg(botToken, "sendMessage", { chat_id: chatId, text: teamCard(link.active_employee), parse_mode: "HTML" });
    return true;
  }

  const employeeId = parsed.employeeId ?? link.active_employee ?? guessEmployee(parsed.text);
  const member = byId(employeeId) ?? byId("sonny")!;
  let text = parsed.text;

  if (!text && !attachments.length) {
    await admin.from("command_links").update({ active_employee: member.id }).eq("id", link.id);
    await send(botToken, chatId, `تمام، انت دلوقتي مع **${member.name}** — ابعت طلبك.`);
    return true;
  }
  if (!text) text = "بص على المرفق وقولّي رأيك واقتراحك.";

  // ── مسار المسودة والموافقة القديم: ردود على مسودة معلّقة، وطلبات النشر الصريحة ──
  const { APPROVE, CANCEL, EDIT, handleCommandMessage } = await import("./command-core.server");
  const { data: pending } = await admin
    .from("command_drafts")
    .select("id")
    .eq("channel", "telegram")
    .eq("external_id", String(chatId))
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  const draftReply = pending && (APPROVE.test(text) || CANCEL.test(text) || EDIT.test(text));
  if (draftReply || (member.id === "sonny" && isPublishRequest(text))) {
    await admin.from("command_links").update({ active_employee: member.id }).eq("id", link.id);
    const reply = await handleCommandMessage(admin, {
      channel: "telegram",
      externalId: String(chatId),
      text: draftReply ? text : `يا سِراج ${text}`,
    });
    await send(botToken, chatId, reply);
    return true;
  }

  // ── عقل الموظف الكامل (نفس شات الموقع) ──
  const conversationId = await ensureConversation(admin, workspaceId, member.id, ids, false);
  await admin
    .from("command_links")
    .update({ active_employee: member.id, conversation_ids: { ...ids, [member.id]: conversationId } })
    .eq("id", link.id);

  const status = await tg<{ message_id: number }>(botToken, "sendMessage", {
    chat_id: chatId,
    text: `⏳ ${member.working}…`,
  }).catch(() => null);
  const typing = setInterval(() => {
    void tg(botToken, "sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => null);
  }, 4_000);
  void tg(botToken, "sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => null);

  try {
    const { runEmployeeTurn } = await import("./ai.functions");
    const result = await runEmployeeTurn(
      {
        workspaceId,
        employeeId: member.id,
        message: text.slice(0, 4000),
        conversationId,
        ...(attachments.length ? { attachments } : {}),
      },
      { supabase: admin },
    );
    clearInterval(typing);
    if (status) await tg(botToken, "deleteMessage", { chat_id: chatId, message_id: status.message_id }).catch(() => null);

    const reply = String(result?.reply ?? "").trim() || "خلصت 👌";
    await send(botToken, chatId, `**${member.name}:**\n${reply}`);
    if (result?.imageUrl) {
      await tg(botToken, "sendPhoto", { chat_id: chatId, photo: result.imageUrl }).catch(async () => {
        await send(botToken, chatId, `🖼️ الصورة: ${result.imageUrl}`);
      });
    }
    if (result?.needsConnection) {
      await send(botToken, chatId, "🔌 الطلب ده محتاج ربط منصة — افتح صفحة التكاملات في سهل.");
    }
  } catch (e) {
    clearInterval(typing);
    if (status) await tg(botToken, "deleteMessage", { chat_id: chatId, message_id: status.message_id }).catch(() => null);
    throw e;
  }
  return true;
}
