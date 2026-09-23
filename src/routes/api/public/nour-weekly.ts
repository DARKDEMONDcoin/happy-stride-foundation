import { createFileRoute } from "@tanstack/react-router";
import { secretsMatch } from "@/lib/timing-safe";
import { gscSnapshotFor } from "@/lib/gsc.functions";

/**
 * حلقة القياس الأسبوعية لنور: تقرأ بيانات Search Console الحقيقية لكل مساحة عمل
 * موصولة، وتحوّلها إلى مهام تحسين ملموسة (فرص ترتيب، ضعف CTR، صفحات متراجعة).
 * تُستدعى تلقائياً كل اثنين عبر pg_cron، ومحمية بترويسة x-cron-secret
 * (إما LOVABLE_CRON_SECRET أو الرمز الداخلي المخزَّن في private.cron_tokens).
 */
export const Route = createFileRoute("/api/public/nour-weekly")({
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
            _name: "nour-weekly",
            _token: provided,
          });
          authorized = valid === true;
        }
        if (!authorized) return new Response("unauthorized", { status: 401 });

        const { data: connected, error } = await supabaseAdmin
          .from("integrations")
          .select("workspace_id")
          .eq("provider", "search-console")
          .eq("status", "connected");
        if (error) return new Response(error.message, { status: 500 });

        const report: { workspaceId: string; created: number; note?: string }[] = [];

        for (const row of connected ?? []) {
          const workspaceId = row.workspace_id;
          let created = 0;
          try {
            const snap = await gscSnapshotFor(workspaceId, 28);
            if (!snap) {
              report.push({ workspaceId, created: 0, note: "لا يوجد موقع مُختار" });
              continue;
            }

            // 1) فرص الترتيب: مراكز 5-20 وانطباعات معتبرة → تحسين محتوى مستهدف
            const opportunities = snap.queries
              .filter((q) => q.position >= 5 && q.position <= 20 && q.impressions >= 50)
              .sort((a, b) => b.impressions - a.impressions)
              .slice(0, 5);

            // 2) ضعف نسبة النقر: مركز جيد (أقل من 10) لكن CTR أقل من 2%
            const lowCtr = snap.queries
              .filter((q) => q.position < 10 && q.ctr < 0.02 && q.impressions >= 100)
              .sort((a, b) => b.impressions - a.impressions)
              .slice(0, 5);

            // 3) صفحات بانطباعات عالية ونقرات شبه صفرية → مراجعة محتوى/نية
            const weakPages = snap.pages
              .filter((p) => p.impressions >= 100 && p.clicks <= 2)
              .sort((a, b) => b.impressions - a.impressions)
              .slice(0, 5);

            const rows: {
              workspace_id: string;
              employee_id: string;
              title: string;
              detail: string;
              channel: string;
              kind: string;
              status: string;
            }[] = [];

            const fmt = (n: number) => n.toLocaleString("ar-EG");

            for (const q of opportunities)
              rows.push({
                workspace_id: workspaceId,
                employee_id: "nour",
                title: `فرصة ترتيب: «${q.key}» في المركز ${q.position.toFixed(1)}`,
                detail: `${fmt(q.impressions)} انطباع و${fmt(q.clicks)} نقرة خلال 28 يوماً على ${snap.site}. الإجراء: توسيع المحتوى المستهدف لهذه العبارة، إضافة قسم أسئلة، وربط داخلي من صفحات ذات صلة.`,
                channel: "search-console",
                kind: "تحسين",
                status: "review",
              });

            for (const q of lowCtr)
              rows.push({
                workspace_id: workspaceId,
                employee_id: "nour",
                title: `ضعف نسبة النقر: «${q.key}» (CTR ${(q.ctr * 100).toFixed(1)}%)`,
                detail: `مركز ${q.position.toFixed(1)} مع ${fmt(q.impressions)} انطباع. الإجراء: إعادة كتابة عنوان الصفحة والوصف التعريفي بوعد أوضح ورقم/فائدة ملموسة.`,
                channel: "search-console",
                kind: "عنوان ووصف",
                status: "review",
              });

            for (const p of weakPages)
              rows.push({
                workspace_id: workspaceId,
                employee_id: "nour",
                title: `صفحة بانطباعات بلا نقرات: ${p.key}`,
                detail: `${fmt(p.impressions)} انطباع مقابل ${fmt(p.clicks)} نقرة ومركز ${p.position.toFixed(1)}. الإجراء: مطابقة نية البحث، تحديث المقدمة، وإضافة عناوين فرعية تجيب على السؤال الرئيسي.`,
                channel: "search-console",
                kind: "مراجعة صفحة",
                status: "review",
              });

            if (rows.length) {
              // منع التكرار: لا نضيف مهمة بنفس العنوان أُنشئت خلال 7 أيام
              const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
              const { data: recent } = await supabaseAdmin
                .from("tasks")
                .select("title")
                .eq("workspace_id", workspaceId)
                .eq("channel", "search-console")
                .gte("created_at", since);
              const seen = new Set((recent ?? []).map((t) => t.title));
              const fresh = rows.filter((r) => !seen.has(r.title));
              if (fresh.length) {
                const { error: insertError } = await supabaseAdmin.from("tasks").insert(fresh);
                if (insertError) throw new Error(insertError.message);
                created = fresh.length;
              }
            }

            report.push({ workspaceId, created });
          } catch (e) {
            report.push({ workspaceId, created, note: String(e).slice(0, 160) });
          }
        }

        return Response.json({ ok: true, workspaces: report.length, report });
      },
    },
  },
});
