import { createFileRoute } from "@tanstack/react-router";
import { secretsMatch } from "@/lib/timing-safe";

/**
 * مشغّل الجدولة التلقائية لنور: يقرأ الجدولات المستحقة وينفّذها بنفس نواة التنفيذ اليدوية،
 * ثم يحسب الموعد القادم، ويرسل المخرج مسودةً للمنصة المربوطة إن كان النشر التلقائي مفعّلاً.
 * محمي بترويسة x-cron-secret (LOVABLE_CRON_SECRET أو الرمز الداخلي في private.cron_tokens).
 */
export const Route = createFileRoute("/api/public/nour-automations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (!provided) return new Response("unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const envSecret = process.env["LOVABLE_CRON_SECRET"];
        let authorized = secretsMatch(provided, envSecret);
        if (!authorized) {
          // الرمز الخاص بهذا المسار أولاً؛ ورمز nour-weekly يُقبل توافقاً مع إعدادات
          // كرون قديمة ضُبطت باسمه قبل فصل المسارين.
          for (const name of ["nour-automations", "nour-weekly"]) {
            const { data: valid } = await supabaseAdmin.rpc("verify_cron_token", {
              _name: name,
              _token: provided,
            });
            if (valid === true) {
              authorized = true;
              break;
            }
          }
        }
        if (!authorized) return new Response("unauthorized", { status: 401 });

        const now = new Date();
        // حجز الصف قبل تنفيذه يمنع تشغيل نفس المهمة مرتين لو وصل نداءان معاً.
        const LOCK_MS = 15 * 60 * 1000;
        const staleBefore = new Date(now.getTime() - LOCK_MS).toISOString();
        const { data: candidates, error } = await supabaseAdmin
          .from("automations")
          .select("*")
          .eq("active", true)
          .lte("next_run_at", now.toISOString())
          .or(`locked_at.is.null,locked_at.lt.${staleBefore}`)
          .order("next_run_at", { ascending: true })
          .limit(20);
        if (error) return new Response(error.message, { status: 500 });

        const due: NonNullable<typeof candidates> = [];
        for (const row of candidates ?? []) {
          const { data: claimed } = await supabaseAdmin
            .from("automations")
            .update({ locked_at: now.toISOString() })
            .eq("id", row.id)
            .eq("active", true)
            .lte("next_run_at", now.toISOString())
            .or(`locked_at.is.null,locked_at.lt.${staleBefore}`)
            .select("id");
          if (claimed?.length) due.push(row);
        }

        const { executeSkill } = await import("@/lib/nour-run.server");
        const { nextRun } = await import("@/lib/automations.functions");

        const report: { id: string; label: string; status: string; taskId?: string | null }[] = [];

        for (const row of due) {
          try {
            const run = await executeSkill(supabaseAdmin, {
              workspaceId: row.workspace_id,
              employeeId: row.employee_id,
              skillId: row.skill_id,
              values: (row.values as Record<string, string> | null) ?? {},
              origin: "جدولة تلقائية",
            });

            let published: string | null = null;
            let publishError: string | null = null;
            if (row.auto_publish) {
              const { toArticle } = await import("@/lib/markdown");
              const { autoPublish } = await import("@/lib/publish-core.server");
              const article = toArticle(run.output);
              const result = await autoPublish(supabaseAdmin, row.workspace_id, article, "draft");
              if (result?.error) {
                publishError = result.error;
              } else {
                published = result
                  ? `${result.provider}${result.link ? ` · ${result.link}` : ""}`
                  : null;
              }
            }

            await supabaseAdmin
              .from("automations")
              .update({
                last_run_at: now.toISOString(),
                last_status: publishError
                  ? `المخرج جاهز · تعذّر حفظ المسودة: ${publishError.slice(0, 160)}`
                  : published
                    ? `نجح · مسودة على ${published}`
                    : "نجح",
                locked_at: null,
                next_run_at: nextRun(
                  row.cadence as "daily" | "weekly" | "monthly",
                  row.day_of_week,
                  row.hour,
                  now,
                  (row as { timezone?: string | null }).timezone ?? "Africa/Cairo",
                ).toISOString(),
              })
              .eq("id", row.id);

            report.push({ id: row.id, label: row.label, status: "ok", taskId: run.taskId });
          } catch (e) {
            const message = e instanceof Error ? e.message : "فشل غير معروف";
            await supabaseAdmin
              .from("automations")
              .update({
                last_run_at: now.toISOString(),
                last_status: `فشل: ${message.slice(0, 200)}`,
                locked_at: null,
                next_run_at: nextRun(
                  row.cadence as "daily" | "weekly" | "monthly",
                  row.day_of_week,
                  row.hour,
                  now,
                  (row as { timezone?: string | null }).timezone ?? "Africa/Cairo",
                ).toISOString(),
              })
              .eq("id", row.id);
            report.push({ id: row.id, label: row.label, status: message });
          }
        }

        // لقطة ترتيب يومية لكل الكلمات المتتبَّعة — سجل تاريخي حقيقي بلا تدخّل
        let ranked = 0;
        try {
          const { data: keywords } = await supabaseAdmin
            .from("tracked_keywords")
            .select("id, workspace_id, keyword, domain")
            .eq("active", true)
            .limit(200);
          if (keywords?.length) {
            const { serpSearch } = await import("@/lib/seo-research.server");
            const stamp = now.toISOString();
            for (const k of keywords) {
              try {
                const results = await serpSearch(k.keyword);
                const hit = results.find((r) => {
                  try {
                    const host = new URL(r.url).hostname.replace(/^www\./, "").toLowerCase();
                    return host === k.domain || host.endsWith(`.${k.domain}`);
                  } catch {
                    return false;
                  }
                });
                await supabaseAdmin.from("rank_snapshots").insert({
                  workspace_id: k.workspace_id,
                  keyword_id: k.id,
                  position: hit?.rank ?? null,
                  url: hit?.url ?? null,
                  captured_at: stamp,
                });
                await supabaseAdmin
                  .from("tracked_keywords")
                  .update({ last_checked_at: stamp })
                  .eq("id", k.id);
                ranked += 1;
              } catch {
                // كلمة واحدة تفشل لا توقف البقية
              }
            }
          }
        } catch (e) {
          console.error("[nour] rank sweep failed:", e);
        }

        return Response.json({ ran: report.length, ranked, report });
      },
    },
  },
});
