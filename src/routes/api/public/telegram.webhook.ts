import { createFileRoute } from "@tanstack/react-router";

import { secretsMatch } from "@/lib/timing-safe";

/**
 * ويبهوك تيليجرام: يستقبل رسائل صاحب البيزنس ويرد بمسودة أو بنتيجة الطلب.
 * يدعم وضعين: بوت خاص بكل مساحة عمل (‎?ws=…‎)، وبوت سهل المشترك (‎?shared=1‎)
 * حيث نستنتج مساحة العمل من المحادثة نفسها. الأمان: سرّ مشتق من توكن البوت.
 */
type TgUpdate = {
  update_id?: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  channel_post?: TgMessage;
  edited_channel_post?: TgMessage;
};
type TgMessage = {
  chat?: { id?: number; title?: string; username?: string; type?: string };
  from?: { id?: number };
  message_id?: number;
  text?: string;
  caption?: string;
  voice?: { file_id: string; duration?: number; mime_type?: string };
  audio?: { file_id: string; duration?: number; mime_type?: string; file_name?: string };
  video_note?: { file_id: string; duration?: number };
  photo?: { file_id: string; file_size?: number }[];
  document?: { file_id: string; mime_type?: string; file_name?: string; file_size?: number };
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

        const text = (message.text ?? message.caption ?? "").trim();

        // مع بوت سهل المشترك نعرف صاحب المحادثة من قنوات التحكّم المسجّلة.
        let workspaceId = wsParam;
        if (shared) {
          const resolved = await workspaceForChat(supabaseAdmin, String(chatId));
          if (!resolved) {
            // فرصة لربط المحادثة: هل الرسالة كود ربط مكوّن من 6 رموز؟
            const code = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
            if (code.length === 6) {
              const { data: row } = await supabaseAdmin
                .from("command_link_codes")
                .select("code, workspace_id, role, label, expires_at, used_at")
                .eq("code", code)
                .eq("channel", "telegram")
                .maybeSingle();
              if (row && !row.used_at && new Date(row.expires_at) >= new Date()) {
                await supabaseAdmin.from("command_links").upsert(
                  {
                    workspace_id: row.workspace_id,
                    channel: "telegram",
                    external_id: String(chatId),
                    role: row.role,
                    label: row.label,
                    status: "active",
                    last_seen_at: new Date().toISOString(),
                  },
                  { onConflict: "channel,external_id" },
                );
                await supabaseAdmin
                  .from("command_link_codes")
                  .update({ used_at: new Date().toISOString() })
                  .eq("code", row.code);
                await telegramReply(
                  botToken,
                  chatId,
                  [
                    "✅ تم ربط محادثتك بحسابك في سهل.",
                    "اكتب طلبك مباشرة، مثال:",
                    "«يا سِراج اكتب بوست عن فوز الفريق واعمل عرض خصم ٥٠٪ حتى منتصف الليل».",
                    "أو استخدم الأوامر: /siraj /nour /dana /adam /eva /sam و /team.",
                  ].join("\n"),
                ).catch(() => null);
                return Response.json({ ok: true });
              }
              await telegramReply(
                botToken,
                chatId,
                "الكود غير صحيح أو انتهت صلاحيته. اطلب كوداً جديداً من إعدادات سهل ← تيليجرام.",
              ).catch(() => null);
              return Response.json({ ok: true });
            }
            await telegramReply(
              botToken,
              chatId,
              "هذه المحادثة غير مربوطة بأي حساب في سهل — افتح سهل ← الإعدادات ← تيليجرام، اضغط «أنشئ كود ربط»، ثم أرسل الكود هنا.",
            ).catch(() => null);
            return Response.json({ ok: true });
          }
          workspaceId = resolved;
        }
        void workspaceId;

        try {
          // محادثة المالك الخاصة: فريق سهل كامل (نص/صوت/صور/ملفات) بعقل الموقع نفسه.
          // منشورات القنوات والمحادثات غير المربوطة تبقى على المسار القديم.
          const isChannel = Boolean(update.channel_post ?? update.edited_channel_post);
          if (!isChannel && !update.edited_message) {
            const { handleTelegramTeam } = await import("@/lib/telegram-team.server");
            const handled = await handleTelegramTeam(supabaseAdmin, {
              botToken,
              chatId,
              ...(typeof update.update_id === "number" ? { updateId: update.update_id } : {}),
              message,
            });
            if (handled) return Response.json({ ok: true });
          }
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
