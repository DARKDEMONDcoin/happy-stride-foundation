import { Link } from "@tanstack/react-router";
import {
  Check,
  ArrowLeft,
  Settings,
  Link2,
  MessageSquare,
  CheckSquare,
  Zap,
  BarChart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  useBrainItems,
  useConnectedAccounts,
  useSocialPosts,
  useTasks,
  useWorkspace,
} from "@/lib/data";
import { cn } from "@/lib/utils";

type StepTo =
  | "/app/settings"
  | "/app/integrations"
  | "/app/chat"
  | "/app/approvals"
  | "/app/autopilot"
  | "/app/rankings";

type Step = {
  icon: LucideIcon;
  id: string;
  title: string;
  lead: string;
  to: StepTo;
  cta: string;
  done: boolean;
};

/**
 * خريطة التفعيل: ترتيب حقيقي لما يجب أن يفعله صاحب العمل بعد التسجيل،
 * كل خطوة محسوبة من بيانات مساحة العمل الفعلية لا من قائمة ثابتة.
 */
export function ActivationMap({
  className,
  variant = "full",
}: {
  className?: string;
  variant?: "full" | "compact";
}) {
  const { data: workspace } = useWorkspace();
  const { data: accounts } = useConnectedAccounts(workspace?.id);
  const { data: tasks } = useTasks(workspace?.id);
  const { data: posts } = useSocialPosts(workspace?.id);
  const { data: brain } = useBrainItems(workspace?.id);

  if (!workspace) return null;

  const ws = workspace as { website?: string | null; profile?: Record<string, unknown> | null };
  const profileFilled = Boolean(ws.website) && Object.keys(ws.profile ?? {}).length > 0;
  const connected = (accounts ?? []).length;
  const taskList = tasks ?? [];
  const published = (posts ?? []).filter((p) => p.status === "published").length;

  const steps: Step[] = [
    {
      id: "profile",
      icon: Settings,
      title: "عرّفنا على نشاطك",
      lead: "رابط موقعك ونبذة عن جمهورك — منها يبني فريقك كل شيء.",
      to: "/app/settings",
      cta: "أكمل ملف النشاط",
      done: profileFilled,
    },
    {
      id: "connect",
      icon: Link2,
      title: "اربط حساباتك",
      lead: "حساب واحد يكفي للبدء، وكل حساب إضافي يوسّع وصولك.",
      to: "/app/integrations",
      cta: "اربط حساباً",
      done: connected > 0,
    },
    {
      id: "brief",
      icon: MessageSquare,
      title: "اطلب أول عمل من فريقك",
      lead: "اكتب طلبك بالعربي كما تكلّم موظفاً — ويأتيك جاهزاً.",
      to: "/app/chat",
      cta: "افتح محادثة",
      done: taskList.length > 0,
    },
    {
      id: "approve",
      icon: CheckSquare,
      title: "راجع واعتمد",
      lead: "لا يُنشر شيء قبل موافقتك، والاعتماد بنقرة واحدة.",
      to: "/app/approvals",
      cta: "راجع المخرجات",
      done: taskList.some((t) => t.status === "done") || published > 0,
    },
    {
      id: "autopilot",
      icon: Zap,
      title: "شغّل النشر التلقائي",
      lead: "حدد الأيام والأوقات، ويكمل فريقك بدون تدخّل يومي.",
      to: "/app/autopilot",
      cta: "اضبط الطيار الآلي",
      done: (posts ?? []).some((p) => p.status === "scheduled") || published > 0,
    },
    {
      id: "measure",
      icon: BarChart,
      title: "تابع نتائجك",
      lead: "ترتيبك في البحث وأداء منشوراتك في مكان واحد.",
      to: "/app/rankings",
      cta: "افتح المتابعة",
      done: (brain ?? []).length > 0 && published > 0,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  const next = steps.find((s) => !s.done)!;

  const pct = Math.round((doneCount / steps.length) * 100);

  if (variant === "compact") {
    return (
      <Link to={next.to} className={cn("activation-compact", className)}>
        <span className="activation-count">
          {doneCount}/{steps.length}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">الخطوة التالية: {next.title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{next.lead}</span>
        </span>
        <span className="activation-cta">
          {next.cta} <ArrowLeft className="size-3.5" />
        </span>
      </Link>
    );
  }

  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border border-border bg-card shadow-card",
        className,
      )}
    >
      <div className="grid gap-3 border-b border-border/70 bg-secondary/25 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-bold tracking-wide text-primary">تشغيل فريقك</p>
          <h2 className="mt-1 font-display text-base font-black sm:text-lg">
            أنجزت {doneCount} من {steps.length} خطوات
          </h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            التالي: <b className="text-foreground">{next.title}</b> — {next.lead}
          </p>
        </div>
        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
          <span className="font-display text-2xl font-black tabular-nums sm:text-3xl">{pct}%</span>
          <Link
            to={next.to}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background transition-transform hover:-translate-y-0.5"
          >
            {next.cta} <ArrowLeft className="size-3.5" />
          </Link>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary sm:col-span-2">
          <div
            className="h-full rounded-full bg-foreground transition-[width] duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ol className="grid gap-2.5 p-4 sm:grid-cols-2 sm:gap-3 sm:p-6 xl:grid-cols-3">
        {steps.map((s, i) => (
          <li
            key={s.id}
            className={cn(
              "flex items-start gap-3 rounded-2xl border p-3.5 transition-colors sm:p-4",
              s.done
                ? "border-foreground/15 bg-secondary/40"
                : "border-border/70 hover:bg-secondary/40",
              s.id === next.id && "border-foreground/40 bg-secondary/50",
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg text-[0.7rem] font-black",
                s.done ? "bg-foreground text-background" : "bg-secondary text-ink-soft",
              )}
            >
              {s.done ? (
                <Check className="size-3.5" strokeWidth={3} />
              ) : (
                <s.icon className="size-3.5" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-bold sm:text-base">
                {s.title}
                {s.id === next.id ? (
                  <span className="size-1.5 shrink-0 rounded-full bg-foreground" />
                ) : null}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-soft sm:text-sm">
                {s.lead}
              </span>
              {!s.done ? (
                <Link
                  to={s.to}
                  className="mt-2 inline-block text-xs font-bold text-foreground underline underline-offset-4"
                >
                  {s.cta} ←
                </Link>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
