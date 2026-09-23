import { createFileRoute } from "@tanstack/react-router";
import { secretsMatch } from "@/lib/timing-safe";

/**
 * ويبهوك واتساب للأعمال: يستقبل رسائل صاحب البيزنس ويرد بمسودة المنشور،
 * وينشر فعلياً بعد موافقته الصريحة. الأمان: كلمة تحقق مخزّنة لكل مساحة عمل + معرّف رقم الإرسال.
 */
type WaChange = {
  value?: {
    metadata?: { phone_number_id?: string };
    messages?: { from?: string; type?: string; text?: { body?: string } }[];
  };
};

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token") ?? "";
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        if (mode !== "subscribe") return new Response("bad request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { verifyTokenMatches } = await import("@/lib/whatsapp.server");
        if (!(await verifyTokenMatches(supabaseAdmin, token))) {
          return new Response("forbidden", { status: 403 });
        }
        return new Response(challenge, { headers: { "Content-Type": "text/plain" } });
      },

      POST: async ({ request }) => {
        const raw = await request.text();

        // التحقق من توقيع ميتا (X-Hub-Signature-256) قبل تنفيذ أي أمر.
        const { getSecrets } = await import("@/lib/secrets.server");
        const { META_APP_SECRET } = await getSecrets(["META_APP_SECRET"] as const);
        const appSecret = META_APP_SECRET?.trim();
        if (appSecret) {
          const header = request.headers.get("x-hub-signature-256") ?? "";
          const provided = header.startsWith("sha256=") ? header.slice(7) : "";
          const key = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(appSecret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"],
          );
          const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
          const expected = Array.from(new Uint8Array(mac))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          // مقارنة ثابتة الزمن من المصدر الموحّد؛ حلقة every كانت تتوقف عند أول
          // اختلاف فيتسرّب طول التطابق.
          const ok = secretsMatch(provided.toLowerCase(), expected.toLowerCase());
          if (!ok) return new Response("forbidden", { status: 403 });
        }

        let payload: { entry?: { changes?: WaChange[] }[] };
        try {
          payload = JSON.parse(raw) as typeof payload;
        } catch {
          return new Response("bad request", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { workspaceByPhoneNumberId, sendWhatsapp } = await import("@/lib/whatsapp.server");
        const { handleCommandMessage } = await import("@/lib/command-core.server");

        for (const entry of payload.entry ?? []) {
          for (const change of entry.changes ?? []) {
            const phoneNumberId = change.value?.metadata?.phone_number_id;
            const message = change.value?.messages?.[0];
            if (!phoneNumberId || !message?.from) continue;

            const match = await workspaceByPhoneNumberId(supabaseAdmin, phoneNumberId);
            if (!match) continue;

            const text = message.type === "text" ? (message.text?.body ?? "") : "";
            try {
              const reply = text
                ? await handleCommandMessage(supabaseAdmin, {
                    channel: "whatsapp",
                    externalId: message.from,
                    text,
                  })
                : "أرسل طلبك نصاً من فضلك — أتعامل حالياً مع الرسائل النصية.";
              await sendWhatsapp(match.creds, message.from, reply);
            } catch (e) {
              const detail = e instanceof Error ? e.message : "خطأ غير معروف";
              console.error("[whatsapp] handling failed:", detail);
              try {
                await sendWhatsapp(
                  match.creds,
                  message.from,
                  `تعذّر تنفيذ الطلب: ${detail.slice(0, 300)}`,
                );
              } catch {
                /* تجاهل فشل الإبلاغ */
              }
            }
          }
        }

        // واتساب يعيد الإرسال عند أي رد غير 200 — نرد دائماً بنجاح بعد المعالجة.
        return Response.json({ ok: true });
      },
    },
  },
});
