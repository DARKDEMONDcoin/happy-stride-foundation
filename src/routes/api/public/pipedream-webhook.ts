/**
 * مستقبل أحداث Pipedream Connect (نجاح الربط / فشله / حذف الحساب).
 * الحماية: مفتاح سري في مسار الاستدعاء (?token=) يُطابق PIPEDREAM_WEBHOOK_SECRET في app_secrets.
 */
import { createFileRoute } from "@tanstack/react-router";
import { secretsMatch } from "@/lib/timing-safe";

import { pipedreamApps } from "@/data/pipedream-apps";

type Event = {
  event?: string;
  event_type?: string;
  account?: {
    id?: string;
    name?: string | null;
    healthy?: boolean;
    dead?: boolean;
    external_id?: string;
    app?: { name_slug?: string } | string;
  };
  external_user_id?: string;
  error?: string;
};

export const Route = createFileRoute("/api/public/pipedream-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: secret } = await supabaseAdmin
          .from("app_secrets")
          .select("value")
          .eq("name", "PIPEDREAM_WEBHOOK_SECRET")
          .maybeSingle();
        const expected = secret?.value ?? process.env["PIPEDREAM_WEBHOOK_SECRET"] ?? "";
        // مقارنة ثابتة الزمن من مصدر واحد يشترك فيه الويبهوك والكرون.
        const sameSecret = secretsMatch(token, expected);
        if (!sameSecret) return new Response("Unauthorized", { status: 401 });

        const payload = (await request.json()) as Event;
        const externalUserId = payload.external_user_id ?? payload.account?.external_id ?? "";
        const workspaceId = externalUserId.startsWith("ws_") ? externalUserId.slice(3) : "";
        const accountId = payload.account?.id ?? "";
        const slug =
          typeof payload.account?.app === "string"
            ? payload.account.app
            : (payload.account?.app?.name_slug ?? "");
        const provider = pipedreamApps.find((a) => a.slug === slug)?.provider;

        if (!workspaceId || !accountId || !provider) return new Response("ok");

        const kind = (payload.event ?? payload.event_type ?? "").toUpperCase();

        // منع التكرار: إعادة إرسال نفس الحدث من الوسيط لا تُنفَّذ مرتين.
        const { recordIntegrationEvent, fingerprint } = await import(
          "@/lib/integration-events.server"
        );
        const fresh = await recordIntegrationEvent(supabaseAdmin, {
          workspaceId,
          provider,
          eventKey: fingerprint([
            "pipedream",
            kind,
            accountId,
            payload.account?.dead === true ? "dead" : "live",
            payload.error ?? "",
          ]),
          action: `pipedream:${kind || "UPDATE"}`,
          detail: { accountId, slug },
        });
        if (!fresh) return new Response("ok (duplicate)");

        if (kind.includes("DELET") || kind.includes("DISCONNECT")) {
          const { error: deleteError } = await supabaseAdmin
            .from("pipedream_accounts")
            .delete()
            .eq("workspace_id", workspaceId)
            .eq("provider", provider)
            .eq("account_id", accountId);
          if (deleteError) {
            console.error("[pipedream-webhook] account delete failed", deleteError);
            return new Response("Temporary failure", { status: 500 });
          }
          await supabaseAdmin
            .from("integrations")
            .update({ status: "disconnected", account: null })
            .eq("workspace_id", workspaceId)
            .eq("provider", provider);
          return new Response("ok");
        }

        // `healthy` لدى الوسيط يتأخر؛ الحساب معطّل فعلاً فقط عند dead أو حدث خطأ صريح.
        const healthy = payload.account?.dead !== true && !kind.includes("ERROR");
        const { error: upsertError } = await supabaseAdmin.from("pipedream_accounts").upsert(
          {
            workspace_id: workspaceId,
            provider,
            app_slug: slug,
            account_id: accountId,
            account_name: payload.account?.name ?? null,
            status: healthy ? "connected" : "error",
            healthy,
            last_error: payload.error ?? null,
          },
          { onConflict: "workspace_id,provider,account_id" },
        );
        if (upsertError) {
          console.error("[pipedream-webhook] account upsert failed", upsertError);
          return new Response("Temporary failure", { status: 500 });
        }
        await supabaseAdmin
          .from("integrations")
          .update({
            status: healthy ? "connected" : "error",
            account: payload.account?.name ?? slug,
          })
          .eq("workspace_id", workspaceId)
          .eq("provider", provider);

        return new Response("ok");
      },
    },
  },
});
