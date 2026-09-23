import { createFileRoute } from "@tanstack/react-router";
import { secretsMatch } from "@/lib/timing-safe";

/**
 * مشغّل طابور النشر الاجتماعي: ينشر المنشورات التي حان موعدها على المنصات المربوطة.
 * محمي بترويسة x-cron-secret (LOVABLE_CRON_SECRET أو الرمز الداخلي في private.cron_tokens).
 */
export const Route = createFileRoute("/api/public/social-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (!provided) return new Response("unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const envSecret = process.env["LOVABLE_CRON_SECRET"];
        let authorized = secretsMatch(provided, envSecret);
        if (!authorized) {
          const { data: valid } = await supabaseAdmin.rpc("verify_cron_token", {
            _name: "social-queue",
            _token: provided,
          });
          authorized = valid === true;
        }
        if (!authorized) return new Response("unauthorized", { status: 401 });

        try {
          const { runDueSocialPosts } = await import("@/lib/social-queue.server");
          const report = await runDueSocialPosts(supabaseAdmin);
          return Response.json({ ran: report.length, report });
        } catch (e) {
          const message = e instanceof Error ? e.message : "فشل غير معروف";
          console.error("[social-queue] run failed:", message);
          return new Response(message, { status: 500 });
        }
      },
    },
  },
});
