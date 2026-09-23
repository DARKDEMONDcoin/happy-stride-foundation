/**
 * دوال الخادم لربط تيليجرام: حفظ بوت العميل، اختبار القناة، توليد كود التحكّم، وفكّ الربط.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertOwner(
  supabase: {
    rpc: (
      fn: "owns_workspace",
      args: { _workspace_id: string },
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  },
  workspaceId: string,
) {
  const { data, error } = await supabase.rpc("owns_workspace", { _workspace_id: workspaceId });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Forbidden: لا تملك هذه مساحة العمل.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const wsInput = z.object({ workspaceId: z.string().uuid() });

/** حالة قناة تيليجرام: البوت، القناة، ومن يحقّ له التحكّم. */
export const telegramStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => wsInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const { loadTelegramConfig, platformBot } = await import("./telegram.server");
    const [config, { data: links }, platform] = await Promise.all([
      loadTelegramConfig(admin, data.workspaceId),
      admin
        .from("command_links")
        .select("id, external_id, label, role, last_seen_at")
        .eq("workspace_id", data.workspaceId)
        .eq("channel", "telegram")
        .order("created_at", { ascending: true }),
      platformBot(),
    ]);
    return {
      connected: Boolean(config?.botToken),
      usesSharedBot: Boolean(config?.shared),
      botUsername: config?.botUsername ?? "",
      chatId: config?.chatId ?? "",
      chatTitle: config?.chatTitle ?? "",
      sharedBotAvailable: Boolean(platform),
      sharedBotUsername: platform?.username ?? "",
      links: links ?? [],
    };
  });

/** ربط بوت العميل (أو بوت سهل الجاهز) بقناته: تحقق فوري ثم تسجيل الويبهوك. */
export const connectTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        /** فارغ = استخدام بوت سهل الجاهز. */
        botToken: z
          .string()
          .trim()
          .default("")
          .refine(
            (v) => v === "" || /^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(v),
            "توكن البوت غير صحيح — انسخه كاملاً من BotFather.",
          ),
        chatId: z.string().trim().min(2).max(120),
        sendTest: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const { tg, saveTelegramConfig, registerWebhook, platformBotToken, ensureCommandLink } =
      await import("./telegram.server");

    const shared = data.botToken === "";
    const botToken = shared ? await platformBotToken() : data.botToken;
    if (!botToken) {
      throw new Error("بوت سهل الجاهز غير مُفعّل حالياً — اربط بوت شركتك من BotFather.");
    }

    const me = await tg<{ username?: string; first_name?: string }>(botToken, "getMe");

    // معرّف القناة: @username أو رقم (-100…)
    const chatId = data.chatId.startsWith("@") ? data.chatId : data.chatId.replace(/\s+/g, "");
    const chat = await tg<{ id: number; title?: string; username?: string; type?: string }>(
      botToken,
      "getChat",
      { chat_id: chatId },
    );

    const member = await tg<{ status?: string; can_post_messages?: boolean }>(
      botToken,
      "getChatMember",
      { chat_id: chat.id, user_id: Number(botToken.split(":")[0]) },
    ).catch(() => ({ status: undefined, can_post_messages: undefined }));
    if (
      chat.type !== "private" &&
      member.status !== "administrator" &&
      member.status !== "creator"
    ) {
      throw new Error("أضف البوت مشرفاً في القناة/المجموعة بصلاحية نشر الرسائل ثم أعد المحاولة.");
    }

    const chatTitle = chat.title ?? (chat.username ? `@${chat.username}` : String(chat.id));
    await saveTelegramConfig(admin, data.workspaceId, {
      botToken: shared ? "" : botToken,
      shared,
      botUsername: me.username ?? "",
      chatId: String(chat.id),
      chatTitle,
    });
    await registerWebhook(data.workspaceId, botToken, shared);
    // القناة المربوطة تُسجَّل تلقائياً كقناة تحكّم حتى تظهر «مربوطة» بلا خطوات إضافية.
    await ensureCommandLink(admin, data.workspaceId, String(chat.id), chatTitle);

    // لا تُرسَل أي رسالة تأكيد إلى القناة: متابعو العميل يجب ألا يروا رسائل النظام.
    // التحقق من الصلاحية تمّ أعلاه عبر getChat/getChatMember بلا أي أثر في القناة.


    return {
      ok: true as const,
      botUsername: me.username ?? "",
      chatTitle,
      chatId: String(chat.id),
      shared,
    };
  });

/** فحص سريع للربط الحالي. */
export const testTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => wsInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const { loadTelegramConfig, tg, registerWebhook } = await import("./telegram.server");
    const config = await loadTelegramConfig(admin, data.workspaceId);
    if (!config) throw new Error("تيليجرام غير مربوط بعد.");
    const chat = await tg<{ title?: string; username?: string }>(config.botToken, "getChat", {
      chat_id: config.chatId,
    });
    // إعادة تسجيل الويبهوك تضمن استمرار وصول الرسائل بعد أي انقطاع.
    await registerWebhook(data.workspaceId, config.botToken, Boolean(config.shared));
    await tg(config.botToken, "sendMessage", {
      chat_id: config.chatId,
      text: "✅ اختبار ناجح — تيليجرام مربوط وفريق سهل جاهز للنشر.",
    });
    return {
      ok: true as const,
      chatTitle: chat.title ?? (chat.username ? `@${chat.username}` : config.chatId),
    };
  });

/** فكّ الربط: إيقاف الويبهوك وحذف التوكن المخزّن. */
export const disconnectTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => wsInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const { loadTelegramConfig, tg } = await import("./telegram.server");
    const config = await loadTelegramConfig(admin, data.workspaceId);
    // بوت سهل المشترك يخدم عملاء آخرين — لا نوقف ويبهوكه عند فكّ ربط مساحة عمل واحدة.
    if (config && !config.shared) {
      try {
        await tg(config.botToken, "deleteWebhook", { drop_pending_updates: true });
      } catch (error) {
        console.error("[telegram] deleteWebhook failed:", error);
      }
    }
    await admin
      .from("integration_credentials")
      .delete()
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "telegram");
    await admin
      .from("command_links")
      .delete()
      .eq("workspace_id", data.workspaceId)
      .eq("channel", "telegram");
    await admin
      .from("integrations")
      .update({ status: "disconnected", account: null })
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "telegram");
    return { ok: true as const };
  });

/** يكتشف القنوات/المحادثات المتاحة لبوت العميل ليختار منها بدل كتابة المعرّف يدوياً. */
export const discoverTelegramChats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        botToken: z.string().trim().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const { discoverChats, loadTelegramConfig } = await import("./telegram.server");
    const saved = await loadTelegramConfig(admin, data.workspaceId);
    const token = data.botToken || (saved?.shared ? "" : (saved?.botToken ?? ""));
    if (!token) {
      throw new Error(
        "مع بوت سهل الجاهز اكتب معرّف القناة مباشرة (مثل ‎@mychannel) بعد إضافة البوت مشرفاً فيها.",
      );
    }
    const chats = await discoverChats(token);
    return { chats };
  });
