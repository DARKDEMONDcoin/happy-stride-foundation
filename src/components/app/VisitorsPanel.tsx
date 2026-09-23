import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Globe, Loader2, Users, Link2Off } from "lucide-react";

import {
  disconnectWebAnalytics,
  saveWebAnalytics,
  visitorsSnapshot,
} from "@/lib/web-analytics.functions";
import { cn } from "@/lib/utils";

const RANGES = [
  { days: 7, label: "٧ أيام" },
  { days: 30, label: "٣٠ يوماً" },
  { days: 90, label: "٩٠ يوماً" },
];

const num = (n: number) => new Intl.NumberFormat("ar-EG").format(n);

function Bars({
  rows,
  emptyLabel,
}: {
  rows: { label: string; value: number }[];
  emptyLabel: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{r.label}</span>
            <span className="mt-1 block h-1.5 rounded-full bg-secondary">
              <span
                className="block h-full rounded-full bg-jade"
                style={{ width: `${Math.max(6, (r.value / max) * 100)}%` }}
              />
            </span>
          </span>
          <span className="shrink-0 text-sm font-black tabular-nums">{num(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export function VisitorsPanel({ workspaceId }: { workspaceId?: string | undefined }) {
  const qc = useQueryClient();
  const snapshot = useServerFn(visitorsSnapshot);
  const save = useServerFn(saveWebAnalytics);
  const disconnect = useServerFn(disconnectWebAnalytics);

  const [days, setDays] = useState(30);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const q = useQuery({
    queryKey: ["visitors", workspaceId, days],
    enabled: Boolean(workspaceId),
    queryFn: () => snapshot({ data: { workspaceId: workspaceId!, days } }),
  });

  const connect = useMutation({
    mutationFn: () => save({ data: { workspaceId: workspaceId!, url } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visitors"] }),
  });

  const cut = useMutation({
    mutationFn: () => disconnect({ data: { workspaceId: workspaceId! } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visitors"] }),
  });

  const snippet = useMemo(() => {
    if (!workspaceId) return "";
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return `<script defer src="${origin}/api/public/track?w=${workspaceId}"></script>`;
  }, [workspaceId]);

  const data = q.data;
  const snap = data?.snapshot ?? null;
  const hasData = Boolean(snap && snap.totals.pageviews > 0);

  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-jade/15 text-jade">
            <Users className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-black">زوار موقعك</h2>
            <p className="truncate text-xs text-muted-foreground">
              أرقام حقيقية: الزوار، الجنسيات، الصفحات، والمصادر.
            </p>
          </div>
        </div>
        {data?.connected ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                onClick={() => setDays(r.days)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                  r.days === days
                    ? "border-transparent bg-foreground text-background"
                    : "border-border text-ink-soft hover:bg-secondary",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {q.isLoading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> نجهّز الأرقام…
        </p>
      ) : !data?.connected ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (workspaceId && url.trim().length > 3 && !connect.isPending) connect.mutate();
          }}
          className="mt-5 space-y-3"
        >
          <p className="text-sm text-ink-soft">ضع رابط موقعك فقط، وسنتولّى الباقي.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              dir="ltr"
              inputMode="url"
              placeholder="https://your-site.com"
              className="w-full flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-start outline-none focus:border-jade"
            />
            <button
              type="submit"
              disabled={!workspaceId || connect.isPending || url.trim().length < 4}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-foreground px-5 py-3 text-sm font-bold text-background disabled:opacity-60"
            >
              {connect.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Globe className="size-4" />
              )}
              ابدأ القياس
            </button>
          </div>
          {connect.error ? (
            <p className="text-xs font-bold text-coral">
              {connect.error instanceof Error ? connect.error.message : "تعذّر الحفظ"}
            </p>
          ) : null}
        </form>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-secondary/60 px-4 py-3 sm:flex sm:justify-between">
            <p className="min-w-0 truncate text-sm font-bold" dir="ltr">
              {data.host}
            </p>
            <button
              type="button"
              onClick={() => cut.mutate()}
              className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-coral"
            >
              <Link2Off className="size-3.5" /> إيقاف
            </button>
          </div>

          {!hasData ? (
            <div className="rounded-2xl border border-dashed border-border p-4">
              <p className="text-sm font-bold">خطوة أخيرة واحدة</p>
              <p className="mt-1 text-xs text-muted-foreground">
                الصق هذا السطر داخل موقعك قبل نهاية وسم &lt;head&gt;، وستبدأ الأرقام بالظهور خلال
                دقائق.
              </p>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-foreground/95 p-3">
                <code dir="ltr" className="min-w-0 truncate text-[0.72rem] text-background">
                  {snippet}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(snippet);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  }}
                  className="shrink-0 rounded-lg bg-background/20 p-2 text-background"
                  aria-label="نسخ"
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground">الزوار</p>
              <p className="mt-1 font-display text-2xl font-black tabular-nums">
                {num(snap?.totals.visitors ?? 0)}
              </p>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs text-muted-foreground">مشاهدات الصفحات</p>
              <p className="mt-1 font-display text-2xl font-black tabular-nums">
                {num(snap?.totals.pageviews ?? 0)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-border p-4">
              <p className="mb-3 text-sm font-bold">جنسيات الزوار</p>
              <Bars
                rows={(snap?.countries ?? []).map((c) => ({ label: c.label, value: c.visitors }))}
                emptyLabel="لا توجد بيانات بعد."
              />
            </div>
            <div className="rounded-2xl border border-border p-4">
              <p className="mb-3 text-sm font-bold">أكثر الصفحات زيارة</p>
              <Bars
                rows={(snap?.pages ?? []).map((p) => ({ label: p.path, value: p.views }))}
                emptyLabel="لا توجد بيانات بعد."
              />
            </div>
            <div className="rounded-2xl border border-border p-4">
              <p className="mb-3 text-sm font-bold">مصادر الزيارات</p>
              <Bars
                rows={(snap?.sources ?? []).map((s) => ({ label: s.source, value: s.visitors }))}
                emptyLabel="لا توجد بيانات بعد."
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
