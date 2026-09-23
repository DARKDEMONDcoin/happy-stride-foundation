/**
 * ذاكرة القرارات — أقوى ما يميّز موظفاً حقيقياً عن أداة: أنه لا ينسى ما اتفقتم عليه.
 * نستخلص من كل محادثة القرارات والالتزامات والقيود والأرقام المعتمدة فقط (لا تخمين)،
 * نحفظها في جدول decisions، ثم نحقن الأكثر صلة في تعليمات الموظف قبل كل رد.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { freeChat } from "./nour-research.server";
import { normalizeArabic, rankMemories } from "./memory.server";

type Client = SupabaseClient<Database>;

export const DECISION_KINDS = ["decision", "commitment", "constraint", "number"] as const;
export type DecisionKind = (typeof DECISION_KINDS)[number];

export const DECISION_KIND_LABEL: Record<string, string> = {
  decision: "قرار",
  commitment: "التزام",
  constraint: "قيد",
  number: "رقم معتمد",
};

export type DecisionDraft = {
  kind: DecisionKind;
  title: string;
  decision: string;
  rationale?: string;
};

const SYSTEM = [
  "أنت مسؤول أرشيف القرارات في شركة. مهمتك استخراج ما تم الاتفاق عليه فعلاً في تبادل واحد بين المالك وموظفه.",
  "استخرج فقط:",
  "- decision: قرار صريح تم حسمه (اختيار اتجاه، منصة، أسلوب، خطة).",
  "- commitment: تعهّد بتنفيذ شيء محدد.",
  "- constraint: قيد أو ممنوع دائم (ميزانية، كلمة ممنوعة، سياسة).",
  "- number: رقم معتمد (ميزانية، هدف، سعر، مهلة).",
  "لا تستخرج أسئلة، ولا أفكاراً مطروحة للنقاش، ولا نصائح عامة، ولا شيئاً غير محسوم.",
  "إن لم يوجد شيء محسوم أعد قائمة فارغة — هذا هو الجواب الصحيح في معظم الأحيان.",
  'أعد JSON فقط: {"decisions":[{"kind":"decision","title":"عنوان قصير جداً","decision":"القرار بجملة واحدة واضحة","rationale":"سببه إن ذُكر"}]}',
  "بحد أقصى ثلاثة عناصر، وكلها بالعربية الفصحى الواضحة.",
].join("\n");

function parseDrafts(raw: string): DecisionDraft[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  const list = (parsed as { decisions?: unknown }).decisions;
  if (!Array.isArray(list)) return [];
  const out: DecisionDraft[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = typeof row["title"] === "string" ? row["title"].trim() : "";
    const decision = typeof row["decision"] === "string" ? row["decision"].trim() : "";
    const kindRaw = typeof row["kind"] === "string" ? row["kind"].trim() : "decision";
    const rationale = typeof row["rationale"] === "string" ? row["rationale"].trim() : "";
    if (title.length < 3 || decision.length < 8) continue;
    const kind = (DECISION_KINDS as readonly string[]).includes(kindRaw)
      ? (kindRaw as DecisionKind)
      : "decision";
    out.push({
      kind,
      title: title.slice(0, 120),
      decision: decision.slice(0, 600),
      ...(rationale ? { rationale: rationale.slice(0, 400) } : {}),
    });
    if (out.length >= 3) break;
  }
  return out;
}

/** يستخلص القرارات من تبادل واحد. لا ينادي النموذج إن كان التبادل قصيراً جداً. */
export async function extractDecisions(request: string, reply: string): Promise<DecisionDraft[]> {
  if (reply.trim().length < 220 && request.trim().length < 120) return [];
  const clip = (t: string, max: number) => (t.length > max ? `${t.slice(0, max)}…` : t);
  try {
    const raw = await freeChat(
      "",
      [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `طلب المالك:\n${clip(request, 1500)}\n\nرد الموظف:\n${clip(reply, 4000)}`,
        },
      ],
      { json: true, maxTokens: 700, timeoutMs: 25_000, attempts: 2 },
    );
    return parseDrafts(raw);
  } catch {
    return [];
  }
}

function tokens(text: string): Set<string> {
  return new Set(
    normalizeArabic(text)
      .split(" ")
      .filter((w) => w.length > 2),
  );
}

function similar(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return false;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / Math.min(ta.size, tb.size) >= 0.72;
}

/** يحفظ القرارات الجديدة فقط، ويستبدل القرار القديم المتشابه بدل تكديس تكرار. */
export async function recordDecisions(
  client: Client,
  params: {
    workspaceId: string;
    employeeId: string;
    conversationId?: string | null;
    drafts: DecisionDraft[];
  },
): Promise<number> {
  if (!params.drafts.length) return 0;

  // «الاستبدال» يقتصر على قرارات الموظف نفسه: قرار زميل في مجال آخر لا يُلغى
  // لمجرد تشابه العنوان (مثل «الميزانية» عند سالم وآدم).
  const { data: existing } = await client
    .from("decisions")
    .select("id, title, decision")
    .eq("workspace_id", params.workspaceId)
    .eq("employee_id", params.employeeId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(120);

  let saved = 0;
  for (const draft of params.drafts) {
    const twin = (existing ?? []).find((row) =>
      similar(`${row.title} ${row.decision}`, `${draft.title} ${draft.decision}`),
    );

    const { data: inserted } = await client
      .from("decisions")
      .insert({
        workspace_id: params.workspaceId,
        employee_id: params.employeeId,
        conversation_id: params.conversationId ?? null,
        kind: draft.kind,
        title: draft.title,
        decision: draft.decision,
        rationale: draft.rationale ?? null,
      })
      .select("id")
      .maybeSingle();
    if (!inserted) continue;
    saved += 1;
    if (twin) {
      await client
        .from("decisions")
        .update({ status: "superseded", superseded_by: inserted.id })
        .eq("id", twin.id);
    }
  }
  return saved;
}

/** كتلة نصية جاهزة للحقن في تعليمات الموظف — القرارات الأكثر صلة بالطلب الحالي. */
export async function decisionsBlock(
  client: Client,
  workspaceId: string,
  query: string,
  limit = 6,
): Promise<string> {
  const { data } = await client
    .from("decisions")
    .select("kind, title, decision, rationale, employee_id, created_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(80);
  const rows = data ?? [];
  if (!rows.length) return "";

  const ranked = rankMemories(
    rows.map((row) => ({
      title: row.title,
      body: `${row.decision}${row.rationale ? ` — ${row.rationale}` : ""}`,
      kind: row.kind,
    })),
    query,
    limit,
  );
  if (!ranked.length) return "";

  return [
    "## قرارات معتمدة سابقاً (ذاكرة قرارات مساحة العمل)",
    "هذه قرارات وقيود اتفق عليها المالك فعلاً. التزم بها ولا تناقضها ولا تعِد طرحها كسؤال.",
    "إن كان الطلب الحالي يخالف قراراً منها، نبّه المالك في سطر واحد ثم نفّذ ما طلبه الآن.",
    ...ranked.map(
      (r) =>
        `- [${DECISION_KIND_LABEL[r.kind ?? "decision"] ?? "قرار"}] ${r.title}: ${r.body ?? ""}`,
    ),
  ].join("\n");
}
