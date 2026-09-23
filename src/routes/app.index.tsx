import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  LayoutDashboard,
  Activity,
  CheckCircle2,
  Clock3,
  Link2,
  ListChecks,
  Sparkles,
} from "lucide-react";

import { ActivationMap } from "@/components/app/ActivationMap";
import { AdsResultsCard } from "@/components/app/AdsResultsCard";
import { AppShell } from "@/components/app/AppShell";
import { BusinessProfileCard } from "@/components/app/BusinessProfileCard";
import { CatchUpNote } from "@/components/app/CatchUpNote";
import { MorningBriefingCard } from "@/components/app/MorningBriefingCard";
import { appLabel } from "@/components/site/AppIcon";
import { getMember, team } from "@/data/team";
import { taskStatusLabel } from "@/data/app";
import { useIntegrations, useProfile, useTasks, useWorkspace } from "@/lib/data";
import { Portrait } from "@/components/site/Portrait";
import { BrandLoader } from "@/components/site/BrandLoader";
import { splitReview } from "@/lib/task-freshness";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "مساحة عملك | سهل" },
      { name: "description", content: "نظرة عامة على عمل فريقك الرقمي اليوم." },
      { property: "og:title", content: "مساحة عملك | سهل" },
      { property: "og:description", content: "نظرة عامة على عمل فريقك الرقمي اليوم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppHome,
});

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `قبل ${mins} دقيقة`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `قبل ${hrs} ساعة`;
  return `قبل ${Math.round(hrs / 24)} يوم`;
}

/** شاشة أول يوم: لا أرقام صفرية ولا لوحات فارغة — طلب واحد فقط يبدأ كل شيء. */
function FirstRun({ workspace }: { workspace: { id: string } | null }) {
  return (
    <>
      <section className="app-editorial-panel app-first-run">
        <p className="app-editorial-kicker flex items-center gap-1.5">
          <Sparkles className="size-3 text-primary" /> ابدأ من هنا
        </p>
        <h2 className="mt-1.5 font-display text-xl font-black sm:text-2xl">
          اطلب أول عمل من فريقك
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
          اكتب طلبك بالعربية كما تكلّم موظفاً — واختر من يبدأ. لا يُنشر شيء قبل موافقتك.
        </p>

        <div className="app-team-directory">
          {team.map((m) => (
            <Link
              key={m.id}
              to="/app/chat/$id"
              params={{ id: m.id }}
              className="app-team-row group"
            >
              <span className="block size-11 shrink-0 overflow-hidden rounded-lg grayscale transition-all duration-300 group-hover:grayscale-0">
                <Portrait memberId={m.id} name={m.name} className="size-full" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{m.name}</span>
                <span className="block truncate text-[0.72rem] text-muted-foreground">
                  {m.role}
                </span>
              </span>
              <ArrowLeft className="size-4 shrink-0 transition-transform group-hover:-translate-x-1" />
            </Link>
          ))}
        </div>
      </section>

      {workspace ? (
        <div className="mt-4">
          <BusinessProfileCard
            workspaceId={workspace.id}
            website={(workspace as { website?: string | null }).website}
            profile={(workspace as { profile?: Record<string, unknown> }).profile as never}
          />
        </div>
      ) : null}
    </>
  );
}

function AppHome() {
  const { data: profile } = useProfile();
  const { data: workspace } = useWorkspace();
  const { data: tasks, isLoading } = useTasks(workspace?.id);
  const { data: integrations } = useIntegrations(workspace?.id);

  const list = tasks ?? [];
  // الطابور الحيّ فقط: ما مضى عليه شهر بلا قرار صار أرشيفاً، وإبقاؤه في
  // العدّاد كان يخنق الشاشة برقم لا يعبّر عن قرار معلّق فعلاً.
  const review = splitReview(list.filter((t) => t.status === "review")).live;
  const running = list.filter((t) => t.status === "running");
  const done = list.filter((t) => t.status === "done");
  const connected = (integrations ?? []).filter((i) => i.status === "connected").length;
  const broken = (integrations ?? []).filter((i) => i.status === "error");
  const started = list.length > 0;

  // أرقام صفرية لا تُعرض: لوحة نظيفة تعرض ما حدث فعلاً فقط.
  const kpis = [
    { k: "مهام منجزة", n: done.length, d: "منذ انطلاق مساحتك", icon: CheckCircle2 },
    { k: "قيد التنفيذ", n: running.length, d: "فريقك يعمل الآن", icon: Clock3 },
    { k: "بانتظار موافقتك", n: review.length, d: "تحتاج قرارك", urgent: true, icon: ListChecks },
    { k: "حسابات مرتبطة", n: connected, d: `من أصل ${integrations?.length ?? 0}`, icon: Link2 },
  ].filter((k) => k.n > 0);

  const lead = started
    ? `${review.length} بانتظار موافقتك · ${running.length} قيد التنفيذ`
    : "فريقك جاهز — ابدأ بطلب واحد.";

  return (
    <AppShell title={`أهلاً ${profile?.full_name ?? ""}`} lead={lead}>
      {broken.length ? (
        <div className="app-system-alert">
          <span className="app-system-alert-label">تنبيه</span>
          <p className="flex-1 text-sm font-semibold">
            {broken.length} حساب يحتاج إعادة ربط — المهام المرتبطة به متوقفة.
          </p>
          <Link to="/app/integrations" className="app-text-link">
            إصلاح الربط
          </Link>
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid min-h-[40vh] place-items-center">
          <BrandLoader size="sm" />
        </div>
      ) : !started ? (
        <FirstRun workspace={workspace ?? null} />
      ) : (
        <div className="app-command-center space-y-4">
          <CatchUpNote tasks={list as never} />
          {workspace ? <MorningBriefingCard workspaceId={workspace.id} /> : null}
          <section className="app-command-head">
            <div>
              <p>SAHL / EXECUTIVE CONTROL</p>
              <h2 className="flex items-center gap-2.5">
                {" "}
                <LayoutDashboard className="size-6 text-primary" /> مركز قيادة العمل والنتائج{" "}
              </h2>
            </div>
            <span>
              <i /> تحديث مباشر من حساباتك
            </span>
          </section>
          {kpis.length ? (
            <section className="app-metric-strip" aria-label="ملخص مساحة العمل">
              {kpis.map((k) => (
                <div key={k.k} className={k.urgent ? "app-metric is-urgent" : "app-metric"}>
                  <span className="app-metric-icon" aria-hidden="true">
                    <k.icon />
                  </span>
                  <p className="app-metric-label">{k.k}</p>
                  <p className="app-metric-number">{k.n}</p>
                  <p className="app-metric-note">{k.d}</p>
                </div>
              ))}
            </section>
          ) : null}

          <ActivationMap variant="compact" />

          {workspace ? (
            <AdsResultsCard workspaceId={workspace.id} integrations={integrations ?? []} />
          ) : null}

          <div className="app-operations-grid">
            <section className="app-editorial-panel">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-base font-black sm:text-lg">
                  <CheckCircle2 className="size-5 text-jade" /> آخر ما أنجزه فريقك
                </h2>
                <Link to="/app/tasks" className="app-text-link">
                  كل المهام
                </Link>
              </div>
              <ul className="app-work-list">
                {list.slice(0, 5).map((t) => {
                  const member = getMember(t.employee_id);
                  return (
                    <li key={t.id} className="app-work-row">
                      <div className="flex flex-wrap items-center gap-2.5 text-xs">
                        {member ? (
                          <span className="inline-flex items-center gap-1.5 font-bold">
                            <span
                              className="size-6 overflow-hidden rounded-lg"
                              style={{ background: member.tintSoft }}
                            >
                              <Portrait
                                memberId={member.id}
                                name={member.name}
                                className="size-full"
                              />
                            </span>
                            {member.name}
                          </span>
                        ) : null}
                        <span className="text-muted-foreground">{appLabel(t.channel)}</span>
                        <span className="app-status-word">
                          {taskStatusLabel[t.status as keyof typeof taskStatusLabel] ?? t.status}
                        </span>
                        <span className="ms-auto text-muted-foreground">
                          {timeAgo(t.created_at)}
                        </span>
                      </div>
                      <p className="mt-2.5 break-words font-bold">{t.title}</p>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="app-editorial-panel app-running-panel">
              <h2 className="flex items-center gap-2 font-display text-base font-black sm:text-lg">
                <Activity className="size-5 text-amber" /> مهام جارية
              </h2>
              <ul className="app-running-list">
                {running.slice(0, 5).map((t) => (
                  <li key={t.id} className="flex items-center gap-3 text-sm">
                    <span className="app-running-index" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate font-semibold">{t.title}</span>
                  </li>
                ))}
                {running.length === 0 ? (
                  <li className="text-sm text-muted-foreground">لا توجد مهام جارية.</li>
                ) : null}
              </ul>
              <Link to="/app/chat" className="app-text-link mt-5 inline-flex items-center gap-1.5">
                اطلب مهمة جديدة <ArrowLeft className="size-4" />
              </Link>
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}
