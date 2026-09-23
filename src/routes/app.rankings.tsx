import { Fragment, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Swords,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { GoogleConnectButton } from "@/components/app/GoogleConnect";
import { useWorkspace } from "@/lib/data";
import {
  addTrackedKeyword,
  listTrackedKeywords,
  refreshRankings,
  removeTrackedKeyword,
} from "@/lib/rank-tracker.functions";

export const Route = createFileRoute("/app/rankings")({
  head: () => ({
    meta: [
      { title: "تتبّع الترتيب | سهل" },
      {
        name: "description",
        content:
          "لوحة تاريخية لترتيب كلماتك المفتاحية في نتائج البحث الحية — أرقام حقيقية بلا تقدير.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RankingsPage,
});

type Point = { position: number | null; url: string | null; capturedAt: string };

/** خط اتجاه صغير: الأعلى في الرسم = ترتيب أفضل (رقم أصغر). */
function Sparkline({ points }: { points: Point[] }) {
  const values = points.filter((p) => p.position != null).slice(-14);
  if (values.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  const w = 120;
  const h = 32;
  const max = Math.max(...values.map((p) => p.position!), 10);
  const path = values
    .map((p, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = ((p.position! - 1) / Math.max(max - 1, 1)) * (h - 4) + 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="text-jade" aria-hidden>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function Delta({ points }: { points: Point[] }) {
  const values = points.filter((p) => p.position != null);
  if (values.length < 2) return null;
  const first = values[values.length - 2]!.position!;
  const last = values[values.length - 1]!.position!;
  const diff = first - last; // موجب = تحسّن
  if (diff === 0) return <span className="text-xs text-muted-foreground">ثابت</span>;
  const up = diff > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold ${up ? "text-jade" : "text-coral"}`}
    >
      {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {Math.abs(diff)}
    </span>
  );
}

const markets: { code: string; label: string }[] = [
  { code: "EG", label: "مصر" },
  { code: "SA", label: "السعودية" },
  { code: "AE", label: "الإمارات" },
  { code: "KW", label: "الكويت" },
  { code: "QA", label: "قطر" },
  { code: "BH", label: "البحرين" },
  { code: "OM", label: "عُمان" },
  { code: "JO", label: "الأردن" },
  { code: "LB", label: "لبنان" },
  { code: "IQ", label: "العراق" },
  { code: "MA", label: "المغرب" },
  { code: "DZ", label: "الجزائر" },
  { code: "TN", label: "تونس" },
  { code: "LY", label: "ليبيا" },
  { code: "SD", label: "السودان" },
  { code: "PS", label: "فلسطين" },
  { code: "SY", label: "سوريا" },
  { code: "YE", label: "اليمن" },
];

const sourceMeta: Record<string, { label: string; cls: string; title: string }> = {
  "search-console": {
    label: "Search Console",
    cls: "bg-jade/12 text-jade-deep",
    title: "متوسط الترتيب الفعلي من بيانات جوجل لموقعك خلال 28 يوماً",
  },
  google: {
    label: "جوجل",
    cls: "bg-amber/15 text-amber",
    title: "موقعك في صفحة نتائج جوجل الحقيقية لهذا السوق (أول 100 نتيجة)",
  },
  "search-engines": {
    label: "تقدير",
    cls: "bg-secondary text-muted-foreground",
    title: "من محركات بديلة (Bing/Brave) — اربط Search Console لأرقام جوجل الفعلية",
  },
};

function RankingsPage() {
  const { data: workspace } = useWorkspace();
  const qc = useQueryClient();
  const list = useServerFn(listTrackedKeywords);
  const add = useServerFn(addTrackedKeyword);
  const remove = useServerFn(removeTrackedKeyword);
  const refresh = useServerFn(refreshRankings);

  const wsCountry = (workspace as { country?: string | null } | undefined)?.country ?? "";
  const wsSite = (workspace as { website?: string | null } | undefined)?.website ?? "";

  const [keyword, setKeyword] = useState("");
  const [domain, setDomain] = useState("");
  const [market, setMarket] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const effectiveMarket = market || (markets.some((m) => m.code === wsCountry) ? wsCountry : "EG");
  const effectiveDomain = domain || wsSite;

  const key = ["rankings", workspace?.id];
  const { data, isLoading } = useQuery({
    queryKey: key,
    enabled: Boolean(workspace?.id),
    queryFn: () => list({ data: { workspaceId: workspace!.id } }),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: key });

  const addMutation = useMutation({
    mutationFn: () =>
      add({
        data: {
          workspaceId: workspace!.id,
          keyword,
          domain: effectiveDomain,
          market: effectiveMarket,
        },
      }),
    onSuccess: () => {
      setKeyword("");
      invalidate();
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => refresh({ data: { workspaceId: workspace!.id } }),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { workspaceId: workspace!.id, id } }),
    onSuccess: invalidate,
  });

  const rows = data?.keywords ?? [];
  const anyGsc = Object.values(data?.history ?? {}).some((pts) =>
    pts.some((p) => p.source === "search-console"),
  );

  return (
    <AppShell
      title="تتبّع الترتيب"
      lead="ترتيبك الحقيقي في جوجل لكل كلمة وسوق — لقطة بتاريخها ومصدرها، ومن يسبقك"
      actions={
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={!workspace || refreshMutation.isPending || !rows.length}
          className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3.5 py-2.5 text-sm font-bold text-background disabled:opacity-50"
        >
          {refreshMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {refreshMutation.isPending ? "نفحص جوجل…" : "حدّث الترتيب الآن"}
        </button>
      }
    >
      {!anyGsc ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-jade/30 bg-jade/6 p-4 text-sm">
          <ShieldCheck className="size-5 shrink-0 text-jade-deep" />
          <p className="min-w-0 flex-1 leading-relaxed">
            <b>للأرقام الرسمية من جوجل:</b> اربط Google Search Console مرة واحدة — سنعرض متوسط
            ترتيبك الفعلي والنقرات والظهور لكل كلمة بدل الاعتماد على قراءة صفحة النتائج.
          </p>
          <GoogleConnectButton workspaceId={workspace?.id} kind="search-console" size="sm" />
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (keyword.trim().length > 1 && effectiveDomain.trim().length > 2) addMutation.mutate();
        }}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4"
      >
        <label className="min-w-48 flex-1">
          <span className="mb-1 block text-xs font-bold text-muted-foreground">
            الكلمة المفتاحية
          </span>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="مثال: أفضل قهوة مختصة في القاهرة"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
          />
        </label>
        <label className="min-w-40 flex-1">
          <span className="mb-1 block text-xs font-bold text-muted-foreground">نطاق موقعك</span>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder={wsSite ? wsSite.replace(/^https?:\/\//, "") : "example.com"}
            dir="ltr"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
          />
        </label>
        <label className="min-w-32">
          <span className="mb-1 block text-xs font-bold text-muted-foreground">السوق</span>
          <select
            value={effectiveMarket}
            onChange={(e) => setMarket(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
          >
            {markets.map((m) => (
              <option key={m.code} value={m.code}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={addMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-jade px-3.5 py-2.5 text-sm font-bold text-background disabled:opacity-50"
        >
          <Plus className="size-4" /> تتبّع
        </button>
      </form>

      {isLoading ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> جارٍ تحميل الكلمات…
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          أضف كلماتك المهمة ونطاق موقعك والسوق، ثم اضغط «حدّث الترتيب الآن» — نور تلتقط ترتيبك من
          جوجل نفسها (أو Search Console إن كان مربوطاً) وتحفظ لك السجل يوماً بيوم مع أسماء المنافسين
          الذين يسبقونك.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-start text-sm">
            <thead className="bg-secondary/60 text-xs">
              <tr>
                <th className="p-3 text-start font-bold">الكلمة</th>
                <th className="p-3 text-start font-bold">السوق</th>
                <th className="p-3 text-start font-bold">الترتيب</th>
                <th className="p-3 text-start font-bold">المصدر</th>
                <th className="p-3 text-start font-bold">التغيّر</th>
                <th className="p-3 text-start font-bold">الاتجاه</th>
                <th className="p-3 text-start font-bold">آخر فحص</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const points = data?.history?.[row.id] ?? [];
                const latest = points[points.length - 1];
                const src = latest?.source ? sourceMeta[latest.source] : null;
                const isOpen = open === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr className="border-t border-border/70">
                      <td className="max-w-[18rem] p-3">
                        <p className="truncate font-semibold">{row.keyword}</p>
                        <p className="truncate text-xs text-muted-foreground" dir="ltr">
                          {latest?.url
                            ? latest.url.replace(/^https?:\/\/(www\.)?/, "")
                            : row.domain}
                        </p>
                      </td>
                      <td className="p-3 text-xs font-bold">
                        {markets.find((m) => m.code === row.market)?.label ?? row.market}
                      </td>
                      <td className="p-3">
                        {!latest ? (
                          <span className="text-xs text-muted-foreground">لم يُفحص بعد</span>
                        ) : latest.position ? (
                          <span className="font-black">#{latest.position}</span>
                        ) : (
                          <span className="text-xs font-bold text-coral">خارج أول 100</span>
                        )}
                        {latest?.impressions != null && latest.source === "search-console" ? (
                          <p className="text-[0.68rem] text-muted-foreground">
                            {latest.clicks ?? 0} نقرة · {latest.impressions} ظهور
                          </p>
                        ) : null}
                      </td>
                      <td className="p-3">
                        {src ? (
                          <span
                            title={src.title}
                            className={`rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${src.cls}`}
                          >
                            {src.label}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3">
                        <Delta points={points} />
                      </td>
                      <td className="p-3">
                        <Sparkline points={points} />
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {row.last_checked_at
                          ? new Date(row.last_checked_at).toLocaleDateString("ar-EG")
                          : "—"}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {latest?.competitors?.length ? (
                            <button
                              onClick={() => setOpen(isOpen ? null : row.id)}
                              className="rounded-lg p-2 text-muted-foreground hover:text-foreground"
                              aria-label="من يسبقك"
                              title="من يسبقك في النتائج"
                            >
                              <Swords className="size-4" />
                            </button>
                          ) : null}
                          <button
                            onClick={() => removeMutation.mutate(row.id)}
                            className="rounded-lg p-2 text-muted-foreground hover:text-coral"
                            aria-label="حذف الكلمة"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && latest?.competitors?.length ? (
                      <tr className="border-t border-border/40 bg-secondary/30">
                        <td colSpan={8} className="p-3">
                          <p className="mb-2 text-xs font-bold text-muted-foreground">
                            أول 5 نتائج لهذه الكلمة الآن:
                          </p>
                          <ol className="flex flex-wrap gap-2">
                            {latest.competitors.map((c) => (
                              <li key={c.url}>
                                <a
                                  href={c.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  dir="ltr"
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${
                                    c.host === row.domain || c.host.endsWith(`.${row.domain}`)
                                      ? "border-jade bg-jade/10 text-jade-deep"
                                      : "border-border bg-card"
                                  }`}
                                >
                                  #{c.position} {c.host}
                                </a>
                              </li>
                            ))}
                          </ol>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
