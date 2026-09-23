import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive, Search } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { BrandLoader } from "@/components/site/BrandLoader";
import { Portrait } from "@/components/site/Portrait";
import { getMember } from "@/data/team";
import { useWorkspace } from "@/lib/data";
import { archiveDecision, listDecisions } from "@/lib/decisions.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/decisions")({
  head: () => ({
    meta: [
      { title: "سجل القرارات | سهل" },
      {
        name: "description",
        content: "كل ما اتفقت عليه مع فريقك محفوظ وملزم — لا يُنسى ولا يُعاد سؤاله.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DecisionsPage,
});

const KIND_LABEL: Record<string, string> = {
  decision: "قرار",
  commitment: "التزام",
  constraint: "قيد",
  number: "رقم معتمد",
};

const KIND_STYLE: Record<string, string> = {
  decision: "bg-primary/10 text-primary",
  commitment: "bg-jade/12 text-jade-deep",
  constraint: "bg-coral/15 text-coral",
  number: "bg-amber/15 text-amber",
};

function DecisionsPage() {
  const { data: workspace } = useWorkspace();
  const qc = useQueryClient();
  const fetchDecisions = useServerFn(listDecisions);
  const archive = useServerFn(archiveDecision);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["decisions", workspace?.id],
    enabled: Boolean(workspace?.id),
    queryFn: () => fetchDecisions({ data: { workspaceId: workspace!.id } }),
  });

  const rows = useMemo(() => {
    const active = (data ?? []).filter((d) => d.status === "active");
    const needle = q.trim();
    if (!needle) return active;
    return active.filter((d) => `${d.title} ${d.decision} ${d.rationale ?? ""}`.includes(needle));
  }, [data, q]);

  const mutation = useMutation({
    mutationFn: (id: string) => archive({ data: { workspaceId: workspace!.id, decisionId: id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["decisions", workspace?.id] }),
  });

  return (
    <AppShell
      title="سجل القرارات"
      lead="كل قرار وقيد ورقم اتفقتم عليه محفوظ هنا، ويُحقن تلقائياً في تعليمات كل موظف قبل أي رد."
    >
      <div className="relative mb-4 max-w-md">
        <Search className="absolute inset-y-0 end-3 my-auto size-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث في القرارات…"
          className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 pe-10 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <BrandLoader size="sm" />
        </div>
      ) : !rows.length ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
          <p className="font-display text-lg font-black">لا قرارات محفوظة بعد</p>
          <p className="mt-2 text-sm text-muted-foreground">
            حين تحسم شيئاً في أي محادثة — ميزانية، أسلوب، منصة، ممنوعات — يحفظه الموظف هنا تلقائياً
            ويلتزم به في كل ردّ لاحق.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((d) => {
            const member = getMember(d.employee_id);
            return (
              <li key={d.id} className="rounded-3xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold",
                      KIND_STYLE[d.kind] ?? "bg-secondary text-muted-foreground",
                    )}
                  >
                    {KIND_LABEL[d.kind] ?? "قرار"}
                  </span>
                  {member ? (
                    <span className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                      <span className="block size-5 overflow-hidden rounded-md">
                        <Portrait memberId={member.id} name={member.name} className="size-full" />
                      </span>
                      {member.name}
                    </span>
                  ) : null}
                  <span className="text-[0.7rem] text-muted-foreground" dir="ltr">
                    {new Date(d.created_at).toLocaleDateString("ar", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => mutation.mutate(d.id)}
                    disabled={mutation.isPending}
                    className="ms-auto inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[0.7rem] font-bold hover:bg-secondary disabled:opacity-50"
                  >
                    <Archive className="size-3.5" />
                    أرشفة
                  </button>
                </div>
                <p className="mt-2 font-display text-base font-black">{d.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{d.decision}</p>
                {d.rationale ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">السبب: {d.rationale}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
