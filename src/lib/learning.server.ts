import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

const HIGH_RISK = /ميزانية|سعر|خصم|نشر تلقائي|أرسل|راسل|وعد|صلاحية|دفع|عقد|قانون|طبي/i;
const clean = (text: string, max = 500) => text.replace(/\s+/g, " ").trim().slice(0, max);

export async function learningBlock(client: Client, workspaceId: string, employeeId: string) {
  const { data: settings } = await client
    .from("employee_learning_settings")
    .select("enabled, experiment_percent")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (settings?.enabled === false) return { block: "", lessonIds: [] as string[] };

  const { data } = await client
    .from("employee_lessons")
    .select("id, title, instruction, confidence, evidence_count, status, risk_level")
    .eq("workspace_id", workspaceId)
    .eq("employee_id", employeeId)
    .in("status", ["active", "approved"])
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("confidence", { ascending: false })
    .limit(6);
  const experimentPercent = settings?.experiment_percent ?? 10;
  // الدرس عالي المخاطرة (سعر، خصم، نشر تلقائي، وعد، دفع، صلاحية) لا يدخل أي رد حقيقي
  // قبل أن يعتمده المالك بنفسه ويصير status = active. الاعتماد الآلي وحده لا يكفي:
  // التجربة الصامتة كانت تعرضه على عملاء حقيقيين قبل مراجعة بشرية.
  // المتوسط والمنخفض يدخلان التجربة الصامتة بالنسبة المحددة.
  const selected = (data ?? []).filter((lesson) => {
    if (lesson.status === "active") return true;
    if (lesson.risk_level === "high") return false;
    const share = lesson.risk_level === "low" ? experimentPercent : experimentPercent / 2;
    return Math.random() * 100 < share;
  });
  /**
   * تعلّم متبادل بين الزملاء: ما تعلّمه موظف عن **أسلوب هذه العلامة وتفضيلات مالكها**
   * ينفع بقية الفريق. نشارك دروس ملاحظات المالك فقط (owner_feedback) لأنها عن العلامة
   * لا عن حرفة موظف بعينه؛ ودروس المراجعة الذاتية تبقى خاصة بصاحبها لأنها عن أخطائه هو.
   * لا تُحتسب هذه الدروس في قياس A/B (lessonIds) حتى لا يُنسب أثرها لموظف لم يولّدها.
   */
  const { data: peers } = await client
    .from("employee_lessons")
    .select("instruction, employee_id, confidence")
    .eq("workspace_id", workspaceId)
    .neq("employee_id", employeeId)
    .eq("source_kind", "owner_feedback")
    .eq("status", "active")
    .gte("confidence", 0.7)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("confidence", { ascending: false })
    .limit(3);

  const peerBlock = (peers ?? []).length
    ? [
        "## ما تعلّمه زملاؤك عن هذه العلامة (طبّقه في حدود تخصصك أنت)",
        "هذه تفضيلات أسلوب ثبتت مع موظف آخر في نفس المساحة. التزم بها في النبرة والصياغة، ولا تتجاوز بها حدود عملك ولا طلب المستخدم.",
        ...(peers ?? []).map((lesson, index) => `${index + 1}) ${lesson.instruction}`),
      ].join("\n")
    : "";

  if (!selected.length) return { block: peerBlock, lessonIds: [] as string[] };
  return {
    block: [
      "## دروس نشطة وتجارب منخفضة المخاطر لهذه العلامة",
      "طبّقها فقط عندما تلائم الطلب. لا تجعلها تتجاوز طلب المستخدم أو قواعد الأمان والصدق.",
      ...selected.map((lesson, index) => `${index + 1}) ${lesson.instruction}`),
      ...(peerBlock ? ["", peerBlock] : []),
    ].join("\n"),
    lessonIds: selected.map((lesson) => lesson.id),
  };
}

/**
 * إشارة ضمنية من داخل المحادثة (بلا مهمة ولا اعتماد): «أعاد المالك التوليد» أو
 * «أخذ النص ليعدّله بنفسه». هذه أصدق تقييم متاح — لا تنتظر نموذجاً يحكم على نفسه.
 *
 * تُسجَّل كإشارة تُعلِّم نتيجة التشغيلة (outcome) فتدخل بوابة الأمان في دورة القياس،
 * ولا تُحوَّل إلى نصّ درس: «أعد التوليد» ليست تعليمة يتعلّمها الموظف، بل دليل رسوب.
 */
export async function recordChatSignal(
  client: Client,
  input: {
    workspaceId: string;
    employeeId: string;
    messageId: string;
    kind: "edited" | "rejected";
    originalText?: string | null;
  },
) {
  const { data: run } = await client
    .from("employee_runs")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("message_id", input.messageId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!run?.id) return { ok: false };
  const { data: already } = await client
    .from("employee_feedback")
    .select("id")
    .eq("run_id", run.id)
    .eq("kind", input.kind)
    .limit(1)
    .maybeSingle();
  if (already) return { ok: true };
  await client.from("employee_feedback").insert({
    workspace_id: input.workspaceId,
    employee_id: input.employeeId,
    run_id: run.id,
    kind: input.kind,
    reason: null,
    original_text: input.originalText ? clean(input.originalText, 4000) : null,
    weight: 2,
  });
  await client.from("employee_runs").update({ outcome: input.kind }).eq("id", run.id);
  return { ok: true };
}


export async function recordEmployeeRun(
  client: Client,
  input: {
    workspaceId: string;
    employeeId: string;
    conversationId?: string | null;
    messageId?: string | null;
    taskId?: string | null;
    capability?: string | null;
    request: string;
    originalOutput: string;
    finalOutput: string;
    qualityScore?: number | null;
    issues?: string[];
    revised?: boolean;
    lessonIds?: string[];
  },
) {
  const { error } = await client.from("employee_runs").insert({
    workspace_id: input.workspaceId,
    employee_id: input.employeeId,
    conversation_id: input.conversationId ?? null,
    message_id: input.messageId ?? null,
    task_id: input.taskId ?? null,
    capability: input.capability ?? null,
    request_text: clean(input.request, 4000),
    original_output: input.originalOutput,
    final_output: input.finalOutput,
    quality_score: input.qualityScore ?? null,
    quality_issues: (input.issues ?? []) as Json,
    was_revised: input.revised ?? false,
    applied_lesson_ids: input.lessonIds ?? [],
  });
  if (error) console.warn("[learning] run capture skipped:", error.message);
}

export async function recordTaskFeedback(
  client: Client,
  input: {
    workspaceId: string;
    taskId: string;
    employeeId: string;
    kind: "approved" | "edited" | "rejected" | "published" | "metric" | "note";
    reason?: string | null;
    originalText?: string | null;
    editedText?: string | null;
    metrics?: Json;
  },
) {
  const { data: run } = await client
    .from("employee_runs")
    .select("id")
    .eq("task_id", input.taskId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  await client.from("employee_feedback").insert({
    workspace_id: input.workspaceId,
    employee_id: input.employeeId,
    run_id: run?.id ?? null,
    task_id: input.taskId,
    kind: input.kind,
    reason: input.reason ? clean(input.reason, 700) : null,
    original_text: input.originalText ?? null,
    edited_text: input.editedText ?? null,
    metrics: input.metrics ?? {},
    weight: input.kind === "rejected" || input.kind === "edited" ? 2 : 1,
  });
  if (run?.id && ["approved", "edited", "rejected", "published"].includes(input.kind)) {
    await client.from("employee_runs").update({ outcome: input.kind }).eq("id", run.id);
  }
}

function lessonFromFeedback(row: {
  kind: string;
  reason: string | null;
  original_text: string | null;
  edited_text: string | null;
}) {
  if (row.reason && row.reason.trim().length >= 8) return clean(row.reason, 360);
  if (row.kind === "edited" && row.original_text && row.edited_text) {
    const before = clean(row.original_text, 220);
    const after = clean(row.edited_text, 220);
    if (before !== after)
      return `فضّل الصياغة والأسلوب اللذين استخدمهما المالك في النسخة المعدّلة: «${after}» بدل «${before}».`;
  }
  return null;
}

/**
 * تحسين ذاتي بلا تدخل بشري: يقرأ ملاحظات الجودة التي تكرّرت على مخرجات الموظف
 * نفسه (من الفاحص الحتمي وحَكَم الجودة)، ويحوّل كل خلل متكرر إلى درس دائم
 * يُحقن في تعليماته مسبقاً حتى لا يقع فيه مرة أخرى.
 *
 * الفرق عن دروس المالك: هذه لا تنتظر أن يعدّل المالك أو يرفض — الموظف يراجع
 * أخطاءه بنفسه. تبدأ كتجربة صامتة وتُقاس بنفس دورة القياس قبل التفعيل.
 */
export async function buildSelfReviewLessons(
  client: Client,
  workspaceId: string,
  employeeId: string,
  minimumEvidence: number,
) {
  const { data: runs } = await client
    .from("employee_runs")
    .select("quality_issues, quality_score, created_at")
    .eq("workspace_id", workspaceId)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(150);

  const groups = new Map<string, { issue: string; count: number }>();
  for (const run of runs ?? []) {
    const issues = Array.isArray(run.quality_issues) ? run.quality_issues : [];
    const seen = new Set<string>();
    for (const raw of issues) {
      if (typeof raw !== "string") continue;
      const issue = clean(raw, 300);
      if (issue.length < 12) continue;
      const key = issue
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .split(" ")
        .slice(0, 7)
        .join(" ");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const current = groups.get(key) ?? { issue, count: 0 };
      current.count += 1;
      groups.set(key, current);
    }
  }

  let created = 0;
  for (const group of groups.values()) {
    if (group.count < minimumEvidence) continue;
    const instruction = clean(
      `تكرّر هذا الخلل في مخرجاتك السابقة (${group.count.toLocaleString("ar-EG")} مرات): «${group.issue}». طبّق إصلاحه من أول مسودة، وتحقّق منه قبل التسليم.`,
      400,
    );
    const { data: exists } = await client
      .from("employee_lessons")
      .select("id, evidence_count")
      .eq("workspace_id", workspaceId)
      .eq("employee_id", employeeId)
      .eq("source_kind", "self_review")
      .ilike("instruction", `%${group.issue.slice(0, 40)}%`)
      .neq("status", "expired")
      .maybeSingle();
    if (exists) {
      await client
        .from("employee_lessons")
        .update({ evidence_count: group.count, instruction })
        .eq("id", exists.id);
      continue;
    }
    const { data: lesson } = await client
      .from("employee_lessons")
      .insert({
        workspace_id: workspaceId,
        employee_id: employeeId,
        title: `مراجعة ذاتية: خلل متكرر في ${group.count.toLocaleString("ar-EG")} مخرجات`,
        instruction,
        source_kind: "self_review",
        status: "approved",
        risk_level: HIGH_RISK.test(instruction) ? "high" : "low",
        confidence: Math.min(0.9, 0.5 + group.count * 0.07),
        evidence_count: group.count,
        evidence: [{ issue: group.issue, count: group.count }] as unknown as Json,
        activated_at: null,
        expires_at: new Date(Date.now() + 120 * 86_400_000).toISOString(),
      })
      .select("id")
      .single();
    if (lesson) created += 1;
  }
  return { created };
}

export async function buildLearningCandidates(
  client: Client,
  workspaceId: string,
  employeeId: string,
) {
  const { data: settings } = await client
    .from("employee_learning_settings")
    .select("enabled, auto_promote_low_risk, minimum_evidence, minimum_improvement")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (settings?.enabled === false) return { created: 0, promoted: 0 };
  const minimumEvidence = settings?.minimum_evidence ?? 3;

  const { data: feedback } = await client
    .from("employee_feedback")
    .select("kind, reason, original_text, edited_text, created_at")
    .eq("workspace_id", workspaceId)
    .eq("employee_id", employeeId)
    .in("kind", ["edited", "rejected", "note"])
    .order("created_at", { ascending: false })
    .limit(80);

  const groups = new Map<string, { instruction: string; evidence: typeof feedback }>();
  for (const item of feedback ?? []) {
    const instruction = lessonFromFeedback(item);
    if (!instruction) continue;
    const key = instruction
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .split(" ")
      .slice(0, 8)
      .join(" ");
    const current = groups.get(key) ?? { instruction, evidence: [] };
    current.evidence?.push(item);
    groups.set(key, current);
  }

  let created = 0;
  const promoted = 0;
  for (const group of groups.values()) {
    const count = group.evidence?.length ?? 0;
    if (count < minimumEvidence) continue;
    const { data: exists } = await client
      .from("employee_lessons")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("employee_id", employeeId)
      .eq("instruction", group.instruction)
      .neq("status", "expired")
      .maybeSingle();
    if (exists) continue;
    const risk = HIGH_RISK.test(group.instruction) ? "high" : "low";
    const confidence = Math.min(0.95, 0.55 + count * 0.08);
    // كل درس يبدأ كتجربة صامتة. دورة القياس وحدها تفعّل منخفض المخاطر بعد إثبات التحسن.
    const status = "approved";
    const { data: lesson } = await client
      .from("employee_lessons")
      .insert({
        workspace_id: workspaceId,
        employee_id: employeeId,
        title: `درس من ${count.toLocaleString("ar-EG")} إشارات متكررة`,
        instruction: group.instruction,
        source_kind: "owner_feedback",
        status,
        risk_level: risk,
        confidence,
        evidence_count: count,
        evidence: group.evidence?.slice(0, 8) as unknown as Json,
        activated_at: null,
        expires_at: new Date(Date.now() + 120 * 86_400_000).toISOString(),
      })
      .select("id")
      .single();
    if (!lesson) continue;
    created += 1;
  }
  return { created, promoted };
}

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

/** يقيس الدروس المرشحة من السجلات الحقيقية، ثم يفعّل النافع ويتراجع عن الضار. */
export async function runLearningCycle(client: Client, workspaceId: string) {
  const { data: settings } = await client
    .from("employee_learning_settings")
    .select("enabled, auto_promote_low_risk, minimum_evidence, minimum_improvement")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  // نفس شكل النتيجة الكاملة حتى عند التعطيل — غياب selfLessons كان يظهر كـundefined في التقارير.
  if (settings?.enabled === false)
    return { created: 0, selfLessons: 0, evaluated: 0, promoted: 0, rolledBack: 0 };

  const { data: employeeRows } = await client
    .from("employee_runs")
    .select("employee_id")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1000);
  const employees = [...new Set((employeeRows ?? []).map((row) => row.employee_id))];
  const minimumEvidenceSetting = Math.max(3, settings?.minimum_evidence ?? 3);
  let created = 0;
  let selfLessons = 0;
  for (const employeeId of employees) {
    const result = await buildLearningCandidates(client, workspaceId, employeeId);
    created += result.created;
    // تحسين ذاتي: الموظف يتعلّم من أخطائه المتكررة بلا انتظار ملاحظة من المالك.
    try {
      const self = await buildSelfReviewLessons(
        client,
        workspaceId,
        employeeId,
        minimumEvidenceSetting,
      );
      created += self.created;
      selfLessons += self.created;
    } catch (error) {
      console.warn("[learning] self review skipped:", (error as Error).message);
    }
  }

  const { data: lessons } = await client
    .from("employee_lessons")
    .select("id, employee_id, status, risk_level")
    .eq("workspace_id", workspaceId)
    .in("status", ["approved", "active"])
    .limit(200);
  // ٣ تجارب لا تكفي لتثبيت درس يُحقن في كل رد لاحقاً لكل العملاء؛ الحد الأدنى ٨.
  const minimumEvidence = Math.max(8, settings?.minimum_evidence ?? 8);
  const configuredImprovement = settings?.minimum_improvement ?? 4;
  const minimumImprovement =
    configuredImprovement > 1 ? configuredImprovement / 100 : configuredImprovement;
  let evaluated = 0;
  let promoted = 0;
  let rolledBack = 0;

  for (const lesson of lessons ?? []) {
    const { data: runs } = await client
      .from("employee_runs")
      .select("quality_score, outcome, applied_lesson_ids, created_at, was_revised")
      .eq("workspace_id", workspaceId)
      .eq("employee_id", lesson.employee_id)
      .not("quality_score", "is", null)
      // درجة المخرج المُصلَح تقديرية مقيّدة بالعتبة ولم يقسها الحَكَم مجدداً، فإدخالها في
      // المتوسط يشوّه قياس التحسّن. نقيس على التشغيلات المقيسة فعلاً فقط.
      .eq("was_revised", false)
      .order("created_at", { ascending: false })
      .limit(120);
    const candidateRows = (runs ?? []).filter((run) => run.applied_lesson_ids.includes(lesson.id));
    const baselineRows = (runs ?? []).filter((run) => !run.applied_lesson_ids.includes(lesson.id));
    if (candidateRows.length < minimumEvidence || baselineRows.length < minimumEvidence) continue;
    const candidateScore = average(candidateRows.slice(0, 30).map((run) => run.quality_score ?? 0));
    const baselineScore = average(baselineRows.slice(0, 30).map((run) => run.quality_score ?? 0));
    if (candidateScore === null || baselineScore === null) continue;
    // خط أساس صفر: القسمة مستحيلة، لكن تصفير التحسّن كان يحجب درساً نافعاً فعلاً.
    // نستخدم الفرق المطلق منسوباً إلى سلّم ١٠٠ بدل إعلان «لا تغيير».
    const improvement =
      baselineScore > 0
        ? (candidateScore - baselineScore) / baselineScore
        : (candidateScore - baselineScore) / 100;
    const rejected = candidateRows.slice(0, 30).some((run) => run.outcome === "rejected");
    const safetyPassed = !rejected && candidateScore >= 82;

    await client.from("employee_evaluations").insert({
      workspace_id: workspaceId,
      employee_id: lesson.employee_id,
      lesson_id: lesson.id,
      sample_size: Math.min(30, candidateRows.length),
      baseline_score: baselineScore,
      candidate_score: candidateScore,
      improvement,
      safety_passed: safetyPassed,
      details: { source: "measured_runs", rejected } as Json,
    });
    evaluated += 1;

    if (
      lesson.status === "approved" &&
      lesson.risk_level === "low" &&
      settings?.auto_promote_low_risk !== false &&
      safetyPassed &&
      improvement >= minimumImprovement
    ) {
      await client
        .from("employee_lessons")
        .update({ status: "active", activated_at: new Date().toISOString() })
        .eq("id", lesson.id);
      promoted += 1;
    } else if (lesson.status === "active" && (!safetyPassed || improvement < -minimumImprovement)) {
      await client.from("employee_lessons").update({ status: "rolled_back" }).eq("id", lesson.id);
      rolledBack += 1;
    }
  }
  return { created, selfLessons, evaluated, promoted, rolledBack };
}
