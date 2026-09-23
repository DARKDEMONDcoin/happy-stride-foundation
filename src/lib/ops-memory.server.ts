/**
 * الذاكرة التشغيلية العامة — للموظفين الذين ليس لهم سياق مخصّص (أمَل، سالم، دانة، آدم):
 * أرقام أدائهم الحقيقية داخل هذه المساحة (ما اعتُمد، ما رُفض، متوسط الجودة، الملاحظات المتكررة)
 * وأمثلة من مخرجاتهم التي نجحت فعلاً — كي يبنوا على ما نجح بدل البدء من الصفر كل مرة.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max).trim()}…` : text.trim();

/** كتلة نصية جاهزة للحقن (فارغة إن لم تتوفر بيانات كافية). */
export async function opsMemory(
  client: Client,
  workspaceId: string,
  employeeId: string,
): Promise<string> {
  const [tasksRes, runsRes] = await Promise.all([
    client
      .from("tasks")
      .select("title, kind, channel, status, output, created_at")
      .eq("workspace_id", workspaceId)
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false })
      .limit(40),
    client
      .from("employee_runs")
      .select("request_text, final_output, quality_score, quality_issues, outcome, was_revised")
      .eq("workspace_id", workspaceId)
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const tasks = tasksRes.data ?? [];
  const runs = runsRes.data ?? [];
  if (!tasks.length && !runs.length) return "";

  const sections: string[] = [];

  /* ١) أرقام الاعتماد الحقيقية. */
  if (tasks.length) {
    const done = tasks.filter((t) => t.status === "done").length;
    const review = tasks.filter((t) => t.status === "review").length;
    const rejected = tasks.filter((t) => t.status === "rejected").length;
    const rate = Math.round((done / tasks.length) * 100);
    sections.push(
      [
        "### أداؤك الفعلي في هذه المساحة (آخر مهامك)",
        // العيّنة محدودة بآخر 40 مهمة: بدون هذا التوضيح كان الموظف يقدّم سقف
        // العيّنة للمالك على أنه العدد الحقيقي في المساحة.
        `- في آخر ${tasks.length} مهمة لك (عيّنة، ليست كل مهام المساحة): ${done} معتمدة/منجزة، ${review} بانتظار الاعتماد، ${rejected} مرفوضة — نسبة الاعتماد ${rate}%.`,
        "- لا تذكر هذه الأعداد للمالك كإجمالي المساحة ولا كعدد المخرجات المنتظرة؛ هي مؤشر أداء لك أنت. العدد الحقيقي يظهر له في شاشة الموافقات.",
        rejected > 0
          ? "- كل مهمة مرفوضة تعني أن شكل المخرج لم يعجب المالك: راجع الأمثلة المعتمدة أدناه والتزم بنفس البنية والطول."
          : "- حافظ على نفس بنية مخرجاتك المعتمدة أدناه.",
      ].join("\n"),
    );
  }

  /* ٢) أمثلة معتمدة يُبنى عليها. */
  const approved = tasks
    .filter((t) => t.status === "done" && (t.output ?? "").trim().length > 40)
    .slice(0, 3);
  if (approved.length) {
    sections.push(
      [
        "### مخرجات لك اعتمدها المالك فعلاً (احتذِ ببنيتها ونبرتها)",
        ...approved.map(
          (t) => `- ${t.title} (${t.channel || t.kind}): ${clip(t.output ?? "", 420)}`,
        ),
      ].join("\n"),
    );
  }

  /* ٣) الجودة والملاحظات المتكررة. */
  if (runs.length) {
    const scored = runs.filter((r) => typeof r.quality_score === "number");
    const avg = scored.length
      ? Math.round(scored.reduce((sum, r) => sum + (r.quality_score ?? 0), 0) / scored.length)
      : null;
    const issues = new Map<string, number>();
    for (const run of runs) {
      const list = Array.isArray(run.quality_issues) ? run.quality_issues : [];
      for (const raw of list) {
        const key = typeof raw === "string" ? raw : JSON.stringify(raw);
        if (!key) continue;
        issues.set(clip(key, 90), (issues.get(clip(key, 90)) ?? 0) + 1);
      }
    }
    const top = [...issues.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const revised = runs.filter((r) => r.was_revised).length;
    sections.push(
      [
        "### جودة ردودك السابقة (قياس داخلي)",
        avg !== null ? `- متوسط درجة الجودة: ${avg} من 100 على ${scored.length} رد.` : "",
        `- ${revised} من ${runs.length} رد احتاج تحسيناً قبل التسليم.`,
        top.length
          ? `- ملاحظات تكررت عليك: ${top.map(([issue, count]) => `${issue} (${count}×)`).join("، ")} — تجنّبها في هذا الرد تحديداً.`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (!sections.length) return "";
  return `## ذاكرتك التشغيلية (بيانات حقيقية من حساب العميل — تُقدَّم على أي عُرف عام)\n${sections.join("\n\n")}`;
}
