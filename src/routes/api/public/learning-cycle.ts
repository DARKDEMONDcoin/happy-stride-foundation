import { createFileRoute } from "@tanstack/react-router";
import { secretsMatch } from "@/lib/timing-safe";

/** دورة يومية تقيس دروس الموظفين وترقّي النافع وتتراجع عن الضار. */
export const Route = createFileRoute("/api/public/learning-cycle")({
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
            _name: "learning-cycle",
            _token: provided,
          });
          authorized = valid === true;
        }
        if (!authorized) return new Response("unauthorized", { status: 401 });

        const { data: workspaces, error } = await supabaseAdmin.from("workspaces").select("id");
        if (error) return new Response(error.message, { status: 500 });
        const { runLearningCycle } = await import("@/lib/learning.server");
        const report = [];
        for (const workspace of workspaces ?? []) {
          try {
            report.push({
              workspaceId: workspace.id,
              ...(await runLearningCycle(supabaseAdmin, workspace.id)),
            });
          } catch (error) {
            report.push({
              workspaceId: workspace.id,
              error: error instanceof Error ? error.message.slice(0, 160) : "failed",
            });
          }
        }
        return Response.json({ ok: true, workspaces: report.length, report });
      },
    },
  },
});
