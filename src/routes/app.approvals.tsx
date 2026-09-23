import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, X, PartyPopper, Loader2 } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { PublishPanel } from "@/components/app/PublishPanel";
import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { getMember } from "@/data/team";
import { useTasks, useUpdateTask, useWorkspace } from "@/lib/data";
import { sanitizePostBody } from "@/lib/post-format";
import { BrandLoader } from "@/components/site/BrandLoader";
import { Portrait } from "@/components/site/Portrait";
import { saveLearningFeedback } from "@/lib/learning.functions";
import { splitReview, STALE_REVIEW_DAYS } from "@/lib/task-freshness";

export const Route = createFileRoute("/app/approvals")({
  head: () => ({
    meta: [
      { title: "الموافقات | سهل" },
      { name: "description", content: "راجع ما أنجزه فريقك واعتمده قبل النشر." },
      { property: "og:title", content: "الموافقات | سهل" },
      { property: "og:description", content: "راجع ما أنجزه فريقك واعتمده قبل النشر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApprovalsPage,
});

/** يستخرج درجة مراجعة الجودة المخزّنة ضمن خطوات المهمة (مثال: «مراجعة الجودة — 88/100»). */
function qualityScoreOf(steps: unknown): number | null {
  if (!Array.isArray(steps)) return null;
  for (const step of steps) {
    const label = (step as { label?: unknown })?.label;
    if (typeof label !== "string") continue;
    const match = label.match(/(\d{1,3})\s*\/\s*100/);
    if (match?.[1]) {
      const value = Number(match[1]);
      if (value > 0 && value <= 100) return value;
    }
  }
  return null;
}

function ApprovalsPage() {
  const { data: workspace } = useWorkspace();
  const { data: tasks, isLoading } = useTasks(workspace?.id);
  const update = useUpdateTask(workspace?.id);
  const saveFeedback = useServerFn(saveLearningFeedback);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  // الطابور ينقسم: ما ينتظر قرارك فعلاً، وأرشيف تجاوز ثلاثين يوماً بلا قرار.
  // خلطهما كان يخنق الشاشة ويُظهر رقماً لا يعبّر عن عمل معلّق حقيقي.
  const allPending = (tasks ?? []).filter((t) => t.status === "review");
  const { live: pending, stale: archived } = splitReview(allPending);
  const [showArchive, setShowArchive] = useState(false);

  const act = async (id: string, status: "done" | "rejected") => {
    setBusyId(id);
    const steps =
      status === "done"
        ? [
            { label: "فهم الطلب", state: "done" },
            { label: "التنفيذ", state: "done" },
            { label: "مراجعتك", state: "done" },
            { label: "النشر", state: "done" },
          ]
        : undefined;
    try {
      await update.mutateAsync({ id, patch: steps ? { status, steps } : { status } });
      if (workspace?.id) {
        const task = allPending.find((item) => item.id === id);
        if (task)
          await saveFeedback({
            data: {
              workspaceId: workspace.id,
              taskId: id,
              employeeId: task.employee_id,
              kind: status === "done" ? "approved" : "rejected",
              reason:
                status === "rejected"
                  ? reason.trim() || "رفض المالك المخرج"
                  : "اعتمد المالك المخرج دون تعديل",
            },
          });
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppShell
      title="طابور الموافقات"
      lead={`${pending.length} عنصراً بانتظارك`}
      actions={
        pending.length ? (
          <button
            onClick={async () => {
              for (const t of pending) await act(t.id, "done");
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-foreground px-3 py-2.5 text-sm font-bold text-background sm:px-4"
          >
            <Check className="size-4" />
            <span className="hidden sm:inline">اعتماد الكل</span>
            <span className="sm:hidden">الكل</span>
          </button>
        ) : null
      }
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BrandLoader size="sm" />
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-14 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-jade/12 text-jade-deep">
            <PartyPopper className="size-7" />
          </span>
          <h2 className="mt-5 font-display text-2xl font-black">لا شيء ينتظرك</h2>
          <p className="mt-2 text-ink-soft">فريقك يكمل العمل — سنخبرك فور جاهزية عنصر جديد.</p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {pending.map((a) => {
            const member = getMember(a.employee_id);
            return (
              <article
                key={a.id}
                className="min-w-0 rounded-3xl border border-border bg-card p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  {member ? (
                    <span className="inline-flex items-center gap-1.5 font-bold">
                      <span
                        className="size-7 shrink-0 overflow-hidden rounded-lg"
                        style={{ background: member.tintSoft }}
                      >
                        <Portrait memberId={member.id} name={member.name} className="size-full" />
                      </span>
                      {member.name}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <AppIcon name={a.channel} className="size-3.5 shrink-0" />
                    {appLabel(a.channel)}
                  </span>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 font-bold">
                    {a.kind}
                  </span>
                  {(() => {
                    // درجة مراجعة الجودة التي حسبها حَكَم الجودة وقت التنفيذ — كانت مخفية
                    // داخل خطوات المهمة، والآن تظهر للمالك قبل الاعتماد.
                    const score = qualityScoreOf(a.steps);
                    if (score === null) return null;
                    const good = score >= 82;
                    return (
                      <span
                        title="درجة مراجعة الجودة الداخلية قبل التسليم"
                        className={`rounded-full px-2.5 py-0.5 font-bold ${good ? "bg-jade/15 text-jade-deep" : "bg-amber-500/15 text-amber-700"}`}
                      >
                        جودة {score}/100
                      </span>
                    );
                  })()}
                  <span className="ms-auto text-muted-foreground">{a.scheduled ?? ""}</span>

                </div>

                <h2 className="mt-4 font-display text-lg font-black break-words">{a.title}</h2>
                <p className="mt-3 max-h-96 overflow-y-auto overflow-x-hidden rounded-2xl bg-secondary/50 p-4 leading-relaxed break-words whitespace-pre-wrap text-ink-soft">
                  {sanitizePostBody(a.output ?? a.detail) || a.detail}
                </p>

                {workspace?.id ? (
                  <PublishPanel
                    workspaceId={workspace.id}
                    employeeId={a.employee_id}
                    taskId={a.id}
                    channel={a.channel}
                    body={a.output ?? a.detail ?? ""}
                  />
                ) : null}

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    onClick={() => void act(a.id, "done")}
                    disabled={busyId === a.id}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-bold transition-colors hover:bg-secondary disabled:opacity-60"
                  >
                    {busyId === a.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    اعتماد بدون نشر
                  </button>
                  <button
                    onClick={() => {
                      if (rejecting === a.id) void act(a.id, "rejected");
                      else setRejecting(a.id);
                    }}
                    disabled={busyId === a.id}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-60"
                  >
                    <X className="size-4" /> رفض
                  </button>
                </div>
                {rejecting === a.id ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="ما الذي تريد أن يتعلمه من هذا الرفض؟"
                      className="min-h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => void act(a.id, "rejected")}
                      className="min-h-10 rounded-lg bg-coral px-4 text-sm font-bold text-background"
                    >
                      تأكيد الرفض
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {archived.length ? (
        <section className="mt-8 rounded-3xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-black">
                أرشيف {archived.length} مخرجاً قديماً
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                مضى عليها أكثر من {STALE_REVIEW_DAYS} يوماً بلا قرار، فخرجت من العدّاد ومن إحاطة
                أمَل حتى لا يبني الفريق عليها إشارات قديمة.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowArchive((v) => !v)}
              className="min-h-10 rounded-full border border-border px-4 text-sm font-bold transition-colors hover:bg-secondary"
            >
              {showArchive ? "إخفاء الأرشيف" : "عرض الأرشيف"}
            </button>
          </div>
          {showArchive ? (
            <ul className="mt-4 grid gap-2">
              {archived.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl bg-secondary/50 px-4 py-3 text-sm"
                >
                  <span className="min-w-0 flex-1 font-bold break-words">{a.title}</span>
                  <span className="text-muted-foreground">
                    {getMember(a.employee_id)?.name ?? a.employee_id}
                  </span>
                  <button
                    type="button"
                    onClick={() => void act(a.id, "done")}
                    disabled={busyId === a.id}
                    className="min-h-9 rounded-full border border-border px-3 font-bold disabled:opacity-60"
                  >
                    اعتماد
                  </button>
                  <button
                    type="button"
                    onClick={() => void act(a.id, "rejected")}
                    disabled={busyId === a.id}
                    className="min-h-9 rounded-full px-3 font-bold text-muted-foreground disabled:opacity-60"
                  >
                    رفض
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </AppShell>
  );
}
