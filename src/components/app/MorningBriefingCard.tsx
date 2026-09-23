import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Coffee,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { getMember } from "@/data/team";
import { getMorningBriefing } from "@/lib/briefing.functions";
import { cn } from "@/lib/utils";

const statusLabel: Record<string, string> = {
  idea: "فكرة",
  draft: "مسودة",
  scheduled: "مجدول",
  published: "نُشر",
  failed: "فشل",
  publishing: "ينشر الآن",
};

/** إحاطة أمَل الصباحية: ما يهمك اليوم في بطاقة واحدة، تُبنى مرة يومياً. */
export function MorningBriefingCard({
  workspaceId,
  className,
}: {
  workspaceId: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const fetchBriefing = useServerFn(getMorningBriefing);
  const eva = getMember("eva");
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["briefing", workspaceId],
    queryFn: () => fetchBriefing({ data: { workspaceId } }),
    staleTime: 10 * 60 * 1000,
  });

  const refresh = async () => {
    await qc.fetchQuery({
      queryKey: ["briefing", workspaceId],
      queryFn: () => fetchBriefing({ data: { workspaceId, refresh: true } }),
    });
    void refetch();
  };

  return (
    <section
      className={cn(
        "bg-card border border-border relative overflow-hidden rounded-2xl border border-foreground/10 p-5 shadow-lift sm:p-6",
        className,
      )}
      aria-label="الإحاطة الصباحية"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Coffee className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-muted-foreground">
              إحاطة {eva?.name ?? "أمَل"} اليومية
            </p>
            <h2 className="mt-1 font-display text-lg font-black leading-snug text-foreground sm:text-xl">
              {data ? `${data.greeting} — ${data.headline}` : "جارٍ تجهيز إحاطة اليوم…"}
            </h2>
          </div>
        </div>
        <button
          onClick={() => void refresh()}
          disabled={isFetching}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold text-foreground transition-colors hover:bg-background/10 disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} /> حدّث
        </button>
      </div>

      {isLoading ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> أمَل تجمع ما يهمك اليوم…
        </p>
      ) : error ? (
        <p className="mt-5 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-semibold text-coral">
          {error instanceof Error ? error.message : "تعذّر بناء الإحاطة"}
        </p>
      ) : data ? (
        <>
          <div className="mt-5 grid grid-cols-3 gap-2 [&>*]:min-w-0">
            {[
              { k: "أُنجز هذا الأسبوع", v: data.stats.done7d },
              { k: "نُشر هذا الأسبوع", v: data.stats.published7d },
              { k: "مجدول قادم", v: data.stats.scheduled },
            ].map((s) => (
              <div
                key={s.k}
                className="rounded-xl border border-border/50 bg-secondary/40 px-3 py-3 sm:px-4"
              >
                <p className="truncate text-[10px] text-foreground/60 sm:text-[11px]">{s.k}</p>
                <p className="font-display text-xl font-black text-foreground">
                  {s.v.toLocaleString("ar-EG")}
                </p>
              </div>
            ))}
          </div>

          {data.attention.length ? (
            <ul className="mt-4 space-y-1.5">
              {data.attention.map((a) => (
                <li
                  key={a}
                  className="flex items-center gap-2 rounded-xl bg-amber/15 px-3 py-2 text-xs font-semibold text-foreground"
                >
                  <TriangleAlert className="size-3.5 shrink-0 text-amber" /> {a}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-5 grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-black text-foreground">
                <CalendarDays className="size-4 text-jade" /> منشورات اليوم
              </h3>
              {data.todayPosts.length ? (
                <ul className="mt-2 space-y-1.5">
                  {data.todayPosts.map((p) => (
                    <li key={p.id}>
                      <Link
                        to="/app/calendar"
                        className="flex items-center gap-2 rounded-xl border border-border/40 bg-secondary/30 p-1.5 pe-3 text-xs text-foreground transition-colors hover:bg-background/12"
                      >
                        {p.image ? (
                          <img
                            src={p.image}
                            alt=""
                            className="size-9 shrink-0 rounded-lg object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-background/10">
                            <AppIcon name={p.provider} className="size-4" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">{p.title}</span>
                          <span className="text-foreground/55">
                            {appLabel(p.provider)} ·{" "}
                            {new Date(p.at).toLocaleTimeString("ar-EG", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            · {statusLabel[p.status] ?? p.status}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-foreground/60">
                  لا منشورات اليوم —{" "}
                  <Link to="/app/calendar" className="font-bold text-amber">
                    خطط أسبوعك مع سِراج
                  </Link>
                </p>
              )}
              {data.rankMoves.length ? (
                <ul className="mt-3 space-y-1">
                  {data.rankMoves.map((m) => (
                    <li key={m.keyword} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-foreground">{m.keyword}</span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 font-black",
                          m.delta > 0 ? "text-jade" : "text-coral",
                        )}
                      >
                        {m.delta > 0 ? (
                          <ArrowUpRight className="size-3.5" />
                        ) : (
                          <ArrowDownRight className="size-3.5" />
                        )}
                        {m.from} → {m.to}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-black text-foreground">
                <Lightbulb className="size-4 text-amber" /> 3 أفكار لليوم
              </h3>
              {data.ideas.length ? (
                <ul className="mt-2 space-y-1.5">
                  {data.ideas.map((i) => (
                    <li key={i.title}>
                      <Link
                        to="/app/chat/$id"
                        params={{ id: "sonny" }}
                        search={{ prompt: i.prompt }}
                        className="group block rounded-xl border border-border/40 bg-secondary/30 px-3 py-2 text-xs text-foreground transition-colors hover:bg-background/12"
                      >
                        <span className="flex items-center gap-1.5 font-bold">
                          <AppIcon name={i.provider} className="size-3.5" /> {i.title}
                        </span>
                        <span className="mt-0.5 block text-foreground/55">«{i.hook}»</span>
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-amber opacity-70 transition group-hover:opacity-100">
                          <Sparkles className="size-3" /> اطلبها من سِراج
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-foreground/60">
                  أفكار اليوم ستظهر بعد تحليل علامتك.
                </p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
