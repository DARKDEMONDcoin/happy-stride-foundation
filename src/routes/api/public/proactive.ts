import { createFileRoute } from "@tanstack/react-router";
import { secretsMatch } from "@/lib/timing-safe";

/**
 * المجدول الاستباقي: يمرّ يومياً على كل مساحة عمل، يقرأ إشاراتها الحقيقية
 * (الطابور، الموافقات المتأخرة، غياب التقارير، الكلمات المتابَعة، الحسابات المربوطة)
 * ويحوّلها إلى مبادرات جاهزة للقبول. محمي بترويسة x-cron-secret.
 */
export const Route = createFileRoute("/api/public/proactive")({
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
            _name: "proactive",
            _token: provided,
          });
          authorized = valid === true;
        }
        if (!authorized) return new Response("unauthorized", { status: 401 });

        const { data: workspaces, error } = await supabaseAdmin.from("workspaces").select("id");
        if (error) return new Response(error.message, { status: 500 });

        const [{ refreshProposals }, { runLearningCycle }] = await Promise.all([
          import("@/lib/proactive.server"),
          import("@/lib/learning.server"),
        ]);
        const report: {
          workspaceId: string;
          added: number;
          closed: number;
          learning?: Awaited<ReturnType<typeof runLearningCycle>>;
          note?: string;
        }[] = [];

        for (const row of workspaces ?? []) {
          try {
            const [result, learning] = await Promise.all([
              refreshProposals(supabaseAdmin, row.id),
              runLearningCycle(supabaseAdmin, row.id),
            ]);
            report.push({
              workspaceId: row.id,
              added: result.added,
              closed: result.closed,
              learning,
            });
          } catch (e) {
            report.push({
              workspaceId: row.id,
              added: 0,
              closed: 0,
              note: String(e).slice(0, 160),
            });
          }
        }

        return Response.json({ ok: true, workspaces: report.length, report });
      },
    },
  },
});
