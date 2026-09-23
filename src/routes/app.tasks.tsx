import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { getMember } from "@/data/team";
import { taskStatusLabel } from "@/data/app";
import { taskSteps, useTasks, useWorkspace, type Task } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Portrait } from "@/components/site/Portrait";
import { BrandLoader } from "@/components/site/BrandLoader";

export const Route = createFileRoute("/app/tasks")({
  head: () => ({
    meta: [
      { title: "المهام | سهل" },
      { name: "description", content: "تابع كل مهمة يعمل عليها فريقك خطوة بخطوة." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TasksPage,
});

const filters = [
  { id: "all", label: "الكل" },
  { id: "running", label: "قيد التنفيذ" },
  { id: "review", label: "بانتظار موافقتك" },
  { id: "queued", label: "في الطابور" },
  { id: "paused", label: "متوقفة" },
  { id: "done", label: "مُنجزة" },
] as const;

const statusStyle: Record<string, string> = {
  running: "bg-amber/15 text-amber",
  review: "bg-primary/10 text-primary",
  queued: "bg-secondary text-muted-foreground",
  paused: "bg-coral/15 text-coral",
  done: "bg-jade/12 text-jade-deep",
};

function when(t: Task) {
  return new Date(t.created_at).toLocaleDateString("ar", { day: "numeric", month: "long" });
}

function TasksPage() {
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const { data: workspace } = useWorkspace();
  const { data: tasks, isLoading } = useTasks(workspace?.id);
  const all = tasks ?? [];
  const list = filter === "all" ? all : all.filter((t) => t.status === filter);

  return (
    <AppShell title="المهام" lead="كل مهمة تُنفَّذ على خطوات — وتتوقف بأمان إن انقطع أي ربط.">
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-bold transition-colors",
              filter === f.id
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:bg-secondary",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <BrandLoader size="sm" />
        </div>
      ) : list.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-border bg-card p-12 text-center">
          <p className="font-display text-xl font-black">لا توجد مهام هنا</p>
          <p className="mt-2 text-ink-soft">
            اطلب من أي موظف عبر المحادثة، وستظهر مهمته هنا مباشرة.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {list.map((t) => {
            const member = getMember(t.employee_id);
            const steps = taskSteps(t);
            return (
              <article key={t.id} className="rounded-3xl border border-border bg-card p-6">
                <div className="flex flex-wrap items-center gap-3">
                  {member ? (
                    <span className="inline-flex items-center gap-2 text-sm font-bold">
                      <span
                        className="size-8 overflow-hidden rounded-xl"
                        style={{ background: member.tintSoft }}
                      >
                        <Portrait memberId={member.id} name={member.name} className="size-full" />
                      </span>
                      {member.name}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-bold",
                      statusStyle[t.status] ?? "bg-secondary",
                    )}
                  >
                    {taskStatusLabel[t.status as keyof typeof taskStatusLabel] ?? t.status}
                  </span>
                  <span className="ms-auto text-xs text-muted-foreground">{when(t)}</span>
                </div>

                <h2 className="mt-3 font-display text-lg font-black">{t.title}</h2>
                {t.detail ? (
                  <p className="mt-1.5 leading-relaxed text-ink-soft">{t.detail}</p>
                ) : null}

                {steps.length ? (
                  <ol className="mt-4 flex flex-wrap gap-2">
                    {steps.map((s) => (
                      <li
                        key={s.label}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold",
                          s.state === "done" && "border-jade/30 bg-jade/10 text-jade-deep",
                          s.state === "active" && "border-amber/40 bg-amber/12 text-amber",
                          s.state === "todo" && "border-border text-muted-foreground",
                          s.state === "blocked" && "border-coral/40 bg-coral/12 text-coral",
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            s.state === "done" && "bg-jade",
                            s.state === "active" && "bg-amber",
                            s.state === "todo" && "bg-muted-foreground/40",
                            s.state === "blocked" && "bg-coral",
                          )}
                        />
                        {s.label}
                      </li>
                    ))}
                  </ol>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
