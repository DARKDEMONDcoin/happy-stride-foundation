import { createFileRoute } from "@tanstack/react-router";

import { secretsMatch } from "@/lib/timing-safe";

/**
 * ويبهوك تيليجرام: يستقبل رسائل صاحب البيزنس ويرد بمسودة أو بنتيجة الطلب.
 * يدعم وضعين: بوت خاص بكل مساحة عمل (‎?ws=…‎)، وبوت سهل المشترك (‎?shared=1‎)
 * حيث نستنتج مساحة العمل من المحادثة نفسها. الأمان: سرّ مشتق من توكن البوت.
 */
type TgUpdate = {
  message?: TgMessage;
  edited_message?: TgMessage;
  channel_post?: TgMessage;
  edited_channel_post?: TgMessage;
};
type TgMessage = {
  chat?: { id?: number; title?: string; username?: string; type?: string };
  from?: { id?: number };
  text?: string;
  caption?: string;
};

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const shared = params.get("shared") === "1";
        const wsParam = params.get("ws") ?? "";
        if (!shared && !/^[0-9a-f-]{36}$/i.test(wsParam)) {
          return new Response("bad request", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const {
          loadTelegramConfig,
          webhookSecret,
          telegramReply,
          platformBotToken,
          workspaceForChat,
        } = await import("@/lib/telegram.server");

        const provided = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        let botToken = "";
        if (shared) {
          botToken = await platformBotToken();
          if (!botToken) return new Response("not found", { status: 404 });
        } else {
          const config = await loadTelegramConfig(supabaseAdmin, wsParam);
          if (!config) return new Response("not found", { status: 404 });
          botToken = config.botToken;
        }
        if (!secretsMatch(provided, await webhookSecret(botToken))) {
          return new Response("forbidden", { status: 403 });
        }

        let update: TgUpdate;
        try {
          update = (await request.json()) as TgUpdate;
        } catch {
          return new Response("bad request", { status: 400 });
        }

        const message =
          update.message ??
          update.edited_message ??
          update.channel_post ??
          update.edited_channel_post;
        const chatId = message?.chat?.id;
        if (!message || typeof chatId !== "number") return Response.json({ ok: true });

        // مع بوت سهل المشترك نعرف صاحب المحادثة من قنوات التحكّم المسجّلة.
        let workspaceId = wsParam;
        if (shared) {
          const resolved = await workspaceForChat(supabaseAdmin, String(chatId));
          if (!resolved) {
            await telegramReply(
              botToken,
              chatId,
              "هذه المحادثة غير مربوطة بأي حساب في سهل — افتح الإعدادات ← تيليجرام واربطها أولاً.",
            ).catch(() => null);
            return Response.json({ ok: true });
          }
          workspaceId = resolved;
        }
        void workspaceId;

        const text = (message.text ?? message.caption ?? "").trim();
        try {
          if (!text) {
            await telegramReply(
              botToken,
              chatId,
              "أرسل طلبك نصاً من فضلك — أتعامل حالياً مع الرسائل النصية.",
            );
            return Response.json({ ok: true });
          }
          const { handleCommandMessage } = await import("@/lib/command-core.server");
          const reply = await handleCommandMessage(supabaseAdmin, {
            channel: "telegram",
            externalId: String(chatId),
            text,
          });
          await telegramReply(botToken, chatId, reply);
        } catch (e) {
          const detail = e instanceof Error ? e.message : "خطأ غير معروف";
          console.error("[telegram] handling failed:", detail);
          try {
            await telegramReply(botToken, chatId, `تعذّر تنفيذ الطلب: ${detail.slice(0, 300)}`);
          } catch {
            /* تجاهل فشل الإبلاغ */
          }
        }

        // تيليجرام يعيد الإرسال عند أي رد غير ناجح — نرد دائماً بنجاح بعد المعالجة.
        return Response.json({ ok: true });
      },
    },
  },
});
