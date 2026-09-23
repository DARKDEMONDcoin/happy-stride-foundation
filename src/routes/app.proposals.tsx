import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, RefreshCw, Sparkles, X } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { BrandLoader } from "@/components/site/BrandLoader";
import { Portrait } from "@/components/site/Portrait";
import { getMember } from "@/data/team";
import { useWorkspace } from "@/lib/data";
import {
  acceptProposalNow,
  dismissProposal,
  listProposals,
  refreshProposalsNow,
} from "@/lib/proactive.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/proposals")({
  head: () => ({
    meta: [
      { title: "مبادرات الفريق | سهل" },
      {
        name: "description",
        content: "ما يقترحه موظفوك من تلقاء أنفسهم بناءً على بيانات مساحة عملك الحقيقية.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProposalsPage,
});

const PRIORITY: Record<number, { label: string; style: string }> = {
  1: { label: "عاجل", style: "bg-coral/15 text-coral" },
  2: { label: "مهم", style: "bg-amber/15 text-amber" },
  3: { label: "مفيد", style: "bg-secondary text-muted-foreground" },
};

function ProposalsPage() {
  const { data: workspace } = useWorkspace();
  const qc = useQueryClient();
  const fetchProposals = useServerFn(listProposals);
  const refresh = useServerFn(refreshProposalsNow);
  const accept = useServerFn(acceptProposalNow);
  const dismiss = useServerFn(dismissProposal);

  const key = ["proposals", workspace?.id];
  const { data, isLoading } = useQuery({
    queryKey: key,
    enabled: Boolean(workspace?.id),
    queryFn: () => fetchProposals({ data: { workspaceId: workspace!.id } }),
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["tasks", workspace?.id] });
  };

  const scan = useMutation({
    mutationFn: () => refresh({ data: { workspaceId: workspace!.id } }),
    onSuccess: invalidate,
  });
  const run = useMutation({
    mutationFn: (id: string) => accept({ data: { workspaceId: workspace!.id, proposalId: id } }),
    onSuccess: invalidate,
  });
  const skip = useMutation({
    mutationFn: (id: string) => dismiss({ data: { workspaceId: workspace!.id, proposalId: id } }),
    onSuccess: invalidate,
  });

  const open = (data ?? []).filter((p) => p.status === "open");
  const handled = (data ?? []).filter((p) => p.status !== "open").slice(0, 12);

  return (
    <AppShell
      title="مبادرات الفريق"
      lead="موظفوك لا ينتظرون طلبك: يقرأون بياناتك كل يوم ويقترحون ما ينبغي عمله الآن — بسببه وأثره."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => scan.mutate()}
          disabled={scan.isPending || !workspace?.id}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background disabled:opacity-50"
        >
          {scan.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {scan.isPending ? "أفحص بياناتك…" : "افحص الآن"}
        </button>
        <span className="text-xs text-muted-foreground">
          يُفحَص تلقائياً كل يوم، ويمكنك الفحص الآن في أي وقت.
        </span>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <BrandLoader size="sm" />
        </div>
      ) : !open.length ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center">
          <Sparkles className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 font-display text-lg font-black">لا مبادرة معلّقة الآن</p>
          <p className="mt-2 text-sm text-muted-foreground">
            كل الإشارات في مساحة عملك سليمة. اضغط «افحص الآن» بعد أي تغيير كبير.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {open.map((p) => {
            const member = getMember(p.employee_id);
            const pr = PRIORITY[p.priority] ?? PRIORITY[3]!;
            const busy = run.isPending || skip.isPending;
            return (
              <li key={p.id} className="rounded-3xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn("rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold", pr.style)}
                  >
                    {pr.label}
                  </span>
                  {member ? (
                    <Link
                      to="/app/chat/$id"
                      params={{ id: member.id }}
                      className="flex items-center gap-1.5 text-[0.7rem] font-bold text-muted-foreground hover:text-foreground"
                    >
                      <span className="block size-5 overflow-hidden rounded-md">
                        <Portrait memberId={member.id} name={member.name} className="size-full" />
                      </span>
                      {member.name}
                    </Link>
                  ) : null}
                </div>
                <p className="mt-2 font-display text-base font-black">{p.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{p.reason}</p>
                {p.impact ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">الأثر: {p.impact}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.skill_id ? (
                    <button
                      type="button"
                      onClick={() => run.mutate(p.id)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-bold text-background disabled:opacity-50"
                    >
                      {run.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                      نفّذها الآن
                    </button>
                  ) : (
                    <Link
                      to={p.signal.includes("approvals") ? "/app/approvals" : "/app/integrations"}
                      className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-bold text-background"
                    >
                      {p.signal.includes("approvals") ? "افتح الموافقات" : "اربط حساباتك"}
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => skip.mutate(p.id)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-bold hover:bg-secondary disabled:opacity-50"
                  >
                    <X className="size-3.5" />
                    ليس الآن
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {handled.length ? (
        <div className="mt-8">
          <p className="mb-2 text-xs font-bold text-muted-foreground">مبادرات سابقة</p>
          <ul className="space-y-2">
            {handled.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card/50 px-3 py-2 text-xs"
              >
                <span className="font-bold">{p.title}</span>
                <span className="text-muted-foreground">
                  {p.status === "accepted"
                    ? "نُفِّذت"
                    : p.status === "dismissed"
                      ? "مؤجّلة"
                      : "انتهت"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </AppShell>
  );
}
