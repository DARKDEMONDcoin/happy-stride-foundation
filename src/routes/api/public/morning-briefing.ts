import { createFileRoute } from "@tanstack/react-router";
import { secretsMatch } from "@/lib/timing-safe";

/**
 * كرون الإحاطة الصباحية لأمَل: يبني إحاطة اليوم لكل مساحة عمل لم تُبنَ بعد.
 * محدود العدد (25 لكل تشغيل) ومحمي بترويسة x-cron-secret.
 */
export const Route = createFileRoute("/api/public/morning-briefing")({
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
            _name: "morning-briefing",
            _token: provided,
          });
          authorized = valid === true;
        }
        if (!authorized) return new Response("unauthorized", { status: 401 });

        try {
          const { runMorningBriefings } = await import("@/lib/briefing.server");
          const report = await runMorningBriefings(supabaseAdmin);
          return Response.json({ built: report.filter((r) => r.ok).length, report });
        } catch (e) {
          const message = e instanceof Error ? e.message : "فشل غير معروف";
          console.error("[morning-briefing] failed:", message);
          return new Response(message, { status: 500 });
        }
      },
    },
  },
});
