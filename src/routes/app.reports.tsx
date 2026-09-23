import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, PlugZap, Printer } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { SeoAuditCard } from "@/components/app/SeoAuditCard";
import { GoogleConnectButton } from "@/components/app/GoogleConnect";
import { VisitorsPanel } from "@/components/app/VisitorsPanel";
import { BrandLoader } from "@/components/site/BrandLoader";
import { useWorkspace } from "@/lib/data";
import { buildReport } from "@/lib/reports.functions";

export const Route = createFileRoute("/app/reports")({
  head: () => ({
    meta: [
      { title: "تقارير السيو | سهل" },
      {
        name: "description",
        content: "تقرير سيو قابل للطباعة من بيانات Search Console وGA4 الحقيقية.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

const num = (n: number) => n.toLocaleString("ar-EG");

function Table({
  caption,
  rows,
}: {
  caption: string;
  rows: { key: string; clicks: number; impressions: number; ctr: number; position: number }[];
}) {
  if (!rows.length) return null;
  return (
    <section className="mt-6">
      <h3 className="font-display font-black">{caption}</h3>
      <div className="mt-2 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-start text-sm">
          <thead className="bg-secondary/60 text-xs">
            <tr>
              <th className="p-3 text-start font-bold">العنصر</th>
              <th className="p-3 text-start font-bold">نقرات</th>
              <th className="p-3 text-start font-bold">ظهور</th>
              <th className="p-3 text-start font-bold">CTR</th>
              <th className="p-3 text-start font-bold">متوسط الترتيب</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-border/70">
                <td className="max-w-[22rem] truncate p-3 font-semibold">{r.key}</td>
                <td className="p-3">{num(r.clicks)}</td>
                <td className="p-3">{num(r.impressions)}</td>
                <td className="p-3">{(r.ctr * 100).toFixed(1)}%</td>
                <td className="p-3">{r.position.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SourceCard({
  label,
  status,
  workspaceId,
  kind,
}: {
  label: string;
  status: { state: "ok" | "not_connected" | "not_selected" | "error"; message: string };
  workspaceId: string | undefined;
  kind: "search-console" | "analytics";
}) {
  const ok = status.state === "ok";
  const tone =
    status.state === "ok"
      ? "border-jade/40 bg-jade/10"
      : status.state === "error"
        ? "border-coral/40 bg-coral/10"
        : "border-border bg-secondary/50";
  const Icon = ok ? CheckCircle2 : status.state === "error" ? AlertTriangle : PlugZap;
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${tone}`}>
      <Icon
        className={`mt-0.5 size-5 shrink-0 ${ok ? "text-jade" : status.state === "error" ? "text-coral" : "text-muted-foreground"}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{status.message}</p>
        {!ok ? (
          <span className="mt-2 inline-flex">
            <GoogleConnectButton
              workspaceId={workspaceId}
              kind={kind}
              size="sm"
              needsPick={status.state === "not_selected"}
              {...(status.state === "error" ? { label: "أعد الربط" } : {})}
            />
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ReportsPage() {
  const { data: workspace } = useWorkspace();
  const build = useServerFn(buildReport);

  const { data, isLoading, error } = useQuery({
    queryKey: ["report", workspace?.id],
    enabled: Boolean(workspace?.id),
    queryFn: () => build({ data: { workspaceId: workspace!.id, days: 28 } }),
  });

  return (
    <AppShell
      title="تقارير السيو"
      lead="تقرير مبني على أرقام حقيقية فقط — بلا أي تقدير مُختلق"
      actions={
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3.5 py-2.5 text-sm font-bold text-background print:hidden"
        >
          <Printer className="size-4" /> اطبع / PDF
        </button>
      }
    >
      <div className="mb-6">
        <SeoAuditCard />
      </div>
      {isLoading ? (
        <BrandLoader size="sm" label="جارٍ تجميع البيانات…" />
      ) : error ? (
        <p className="rounded-2xl bg-coral/12 px-4 py-3 text-sm font-semibold text-coral">
          {error instanceof Error ? error.message : "تعذّر بناء التقرير"}
        </p>
      ) : !workspace && !isLoading ? (
        <p className="rounded-2xl bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
          مساحة العمل غير جاهزة بعد — أعد تحميل الصفحة.
        </p>
      ) : data ? (
        <article className="rounded-3xl border border-border bg-card p-6 print:border-0 print:p-0">
          <header>
            <h2 className="font-display text-2xl font-black">
              تقرير أداء البحث — {data.workspace.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.workspace.industry}
              {data.range ? ` · ${data.range.start} → ${data.range.end}` : ""}
            </p>
          </header>

          <div className="mt-4 grid gap-3 md:grid-cols-2 print:hidden">
            <SourceCard
              label="Google Search Console"
              status={data.sources.search}
              workspaceId={workspace?.id}
              kind="search-console"
            />
            <SourceCard
              label="Google Analytics 4"
              status={data.sources.analytics}
              workspaceId={workspace?.id}
              kind="analytics"
            />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "نقرات البحث", value: data.search ? num(data.search.totals.clicks) : "—" },
              {
                label: "مرات الظهور",
                value: data.search ? num(data.search.totals.impressions) : "—",
              },
              {
                label: "جلسات الموقع",
                value: data.analytics ? num(data.analytics.totals.sessions) : "—",
              },
              { label: "مخرجات جاهزة", value: num(data.work.published + data.work.awaiting) },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-border p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="mt-1 font-display text-2xl font-black">{s.value}</p>
              </div>
            ))}
          </div>

          {data.search ? (
            <>
              <Table caption="أعلى الاستعلامات" rows={data.search.queries} />
              <Table caption="أعلى الصفحات" rows={data.search.pages} />
            </>
          ) : null}

          {data.opportunities.length ? (
            <section className="mt-6">
              <h3 className="font-display font-black">فرص قريبة من الصفحة الأولى</h3>
              <ul className="mt-2 space-y-2">
                {data.opportunities.map((o) => (
                  <li key={o.query} className="rounded-2xl border border-border p-4 text-sm">
                    <span className="font-bold">{o.query}</span>
                    <span className="mt-1 block text-muted-foreground">{o.reason}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.analytics ? (
            <section className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="font-display font-black">القنوات</h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {data.analytics.channels.map((c) => (
                    <li key={c.channel} className="flex justify-between gap-3">
                      <span>{c.channel}</span>
                      <span className="font-bold">{num(c.sessions)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-display font-black">صفحات هبوط البحث العضوي</h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {data.analytics.organicLandingPages.map((p) => (
                    <li key={p.page} className="flex justify-between gap-3">
                      <span className="truncate">{p.page}</span>
                      <span className="font-bold">{num(p.sessions)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}

          <section className="mt-6">
            <h3 className="font-display font-black">أحدث مخرجات نور</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {data.work.recent.map((t) => (
                <li key={`${t.title}-${t.created_at}`} className="flex justify-between gap-3">
                  <span className="truncate">{t.title}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString("ar-EG")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </article>
      ) : null}

      <div className="mt-6">
        <VisitorsPanel workspaceId={workspace?.id} />
      </div>
    </AppShell>
  );
}
