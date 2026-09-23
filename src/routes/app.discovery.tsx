import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Globe,
  Loader2,
  Radar,
  ArrowUpLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Gauge,
  Send,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { Portrait } from "@/components/site/Portrait";
import { getMember } from "@/data/team";
import { discoverBrand, type DiscoveryReport } from "@/lib/discovery.functions";
import { useWorkspace } from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/discovery")({
  head: () => ({
    meta: [
      { title: "كشف العلامة والموقع | سهل" },
      {
        name: "description",
        content:
          "حوار قصير مع نور ينتهي بتقرير كامل عن علامتك: سيو، فرص البحث، المنافسون، حضورك، وخطة البداية.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DiscoveryPage,
});

const field =
  "w-full rounded-2xl border border-border bg-background px-4 py-3 outline-none focus:border-jade";

type Turn = { from: "nour" | "me"; text: string };
type Step = "url" | "goal" | "rivals" | "running" | "done";

const GOALS = ["مبيعات أكثر", "زيارات من جوجل", "حجوزات ومكالمات", "وعي بالعلامة"];

const SCAN_STEPS = [
  "أقرأ صفحات موقعك وأفهم نشاطك",
  "أفحص السيو والسرعة فحصاً حقيقياً",
  "أقيس طلب الكلمات في بحث جوجل وبينج",
  "أجرد محتوى منافسيك من خرائط مواقعهم",
  "أبحث عن حضورك على المنصات وأرتّب خطة البداية",
];

function DiscoveryPage() {
  const { data: workspace } = useWorkspace();
  const run = useServerFn(discoverBrand);
  const savedSite = ((workspace as { website?: string | null } | undefined)?.website ??
    "") as string;

  const nour = getMember("nour");
  const [step, setStep] = useState<Step>("url");
  const [url, setUrl] = useState(savedSite);
  const [goal, setGoal] = useState<string | null>(null);
  const [rivals, setRivals] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [report, setReport] = useState<DiscoveryReport | null>(null);
  const [scanStep, setScanStep] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([
    {
      from: "nour",
      text: savedSite
        ? `أهلاً 👋 أنا نور. هأعمل لك كشفاً كاملاً لعلامتك من رابط واحد. موقعك هو ${savedSite}؟ اكتب «نعم» أو ابعث رابطاً آخر.`
        : "أهلاً 👋 أنا نور. ابعث لي رابط موقعك وهأفحص كل شيء: صحة الموقع، ما يبحث عنه جمهورك، منافسوك، وأين تبدأ.",
    },
  ]);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns, step, report]);

  const say = (from: Turn["from"], text: string) => setTurns((t) => [...t, { from, text }]);

  const scan = useMutation({
    mutationFn: (input: { url: string; goal?: string; competitors?: string[] }) =>
      run({ data: { workspaceId: workspace!.id, ...input } }),
    onSuccess: (r) => {
      setReport(r);
      setStep("done");
      say(
        "nour",
        `خلصت ✅ جاهزية علامتك ${r.readiness}/100. ${
          r.actions.length ? `أهم خطوة الآن: ${r.actions[0]!.title}.` : "التقرير الكامل تحت."
        } التفاصيل كلها ظاهرة أسفل المحادثة — اضغط أي بند لأبدأ تنفيذه فوراً.`,
      );
    },
    onError: (e) => {
      setStep("url");
      say(
        "nour",
        `تعذّر إكمال الفحص: ${e instanceof Error ? e.message : "خطأ غير متوقع"}. جرّب رابطاً آخر.`,
      );
    },
  });

  const start = (finalUrl: string, finalGoal: string | null, finalRivals: string[]) => {
    setStep("running");
    setScanStep(0);
    say("nour", "تمام، بدأت الفحص الآن — دقيقة تقريباً.");
    scan.mutate({
      url: finalUrl,
      ...(finalGoal ? { goal: finalGoal } : {}),
      ...(finalRivals.length ? { competitors: finalRivals } : {}),
    });
  };

  useEffect(() => {
    if (step !== "running") return;
    const id = setInterval(() => setScanStep((s) => Math.min(s + 1, SCAN_STEPS.length - 1)), 9000);
    return () => clearInterval(id);
  }, [step]);

  const handle = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    say("me", value);
    setDraft("");

    if (step === "url") {
      const chosen = /^(نعم|أيوه|ايوه|تمام|yes|اه|آه)$/i.test(value) ? savedSite : value;
      if (chosen.trim().length < 4) {
        say("nour", "محتاج رابط موقع صحيح مثل example.com حتى أبدأ.");
        return;
      }
      setUrl(chosen);
      setStep("goal");
      say("nour", `تمام: ${chosen}. إيه أهم هدف لك الفترة الجاية؟`);
      return;
    }

    if (step === "goal") {
      setGoal(value);
      setStep("rivals");
      say(
        "nour",
        "آخر سؤال: مين أقرب منافس لك؟ ابعث نطاقه (أو أكثر من واحد)، وإن مش عارف اكتب «تخطَّ» وهأستنتجهم بنفسي.",
      );
      return;
    }

    if (step === "rivals") {
      const list = /تخط|تخطى|مش عارف|لا/i.test(value)
        ? []
        : value
            .split(/[,،\s]+/)
            .map((d) => d.trim())
            .filter((d) => d.includes("."))
            .slice(0, 3);
      setRivals(list);
      start(url, goal, list);
    }
  };

  const chips =
    step === "url" && savedSite
      ? ["نعم", "رابط آخر"]
      : step === "goal"
        ? GOALS
        : step === "rivals"
          ? ["تخطَّ"]
          : [];

  return (
    <AppShell
      title="كشف العلامة والموقع"
      lead="حوار قصير مع نور، وتقرير كامل: صحة موقعك، ما يبحث عنه جمهورك، ماذا يفعل منافسوك، وأين تبدأ."
    >
      <section className="rounded-3xl border border-border bg-card p-4 sm:p-6">
        <div className="space-y-3">
          {turns.map((t, i) => (
            <div key={i} className={cn("flex gap-2.5", t.from === "me" && "flex-row-reverse")}>
              {t.from === "nour" && nour ? (
                <Portrait
                  memberId="nour"
                  name={nour.name}
                  className="size-9 shrink-0 rounded-full object-cover"
                />
              ) : null}
              <p
                className={cn(
                  "max-w-[85%] min-w-0 rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words",
                  t.from === "nour" ? "bg-secondary/70" : "bg-foreground text-background",
                )}
              >
                {t.text}
              </p>
            </div>
          ))}

          {step === "running" ? (
            <ul className="rounded-2xl border border-border/70 p-4 text-sm">
              {SCAN_STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-2 py-1">
                  {i < scanStep ? (
                    <CheckCircle2 className="size-4 shrink-0 text-jade-deep" />
                  ) : i === scanStep ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-jade-deep" />
                  ) : (
                    <span className="size-4 shrink-0 rounded-full border border-border" />
                  )}
                  <span className={cn("min-w-0", i > scanStep && "text-muted-foreground")}>
                    {s}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div ref={endRef} />
        </div>

        {step !== "running" && step !== "done" ? (
          <>
            {chips.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {chips.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => (c === "رابط آخر" ? setDraft("") : handle(c))}
                    className="rounded-full border border-border px-3.5 py-1.5 text-xs font-bold transition-colors hover:bg-secondary/70"
                  >
                    {c}
                  </button>
                ))}
              </div>
            ) : null}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (workspace) handle(draft);
              }}
              className="mt-3 flex gap-2"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                dir={step === "url" ? "ltr" : "rtl"}
                placeholder={
                  step === "url"
                    ? "https://your-site.com"
                    : step === "goal"
                      ? "اكتب هدفك…"
                      : "نطاق منافسك…"
                }
                className={cn(field, "flex-1 text-start")}
              />
              <button
                type="submit"
                disabled={!workspace || !draft.trim()}
                className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-foreground px-5 py-3 text-sm font-bold text-background disabled:opacity-60"
              >
                {step === "rivals" ? <Radar className="size-4" /> : <Send className="size-4" />}
                {step === "rivals" ? "ابدأ الكشف" : "إرسال"}
              </button>
            </form>
          </>
        ) : null}

        {step === "done" ? (
          <button
            type="button"
            onClick={() => {
              setReport(null);
              setStep("url");
              setDraft("");
              setTurns([{ from: "nour", text: "تمام، ابعث رابط الموقع اللي عايز أكشفه دلوقتي." }]);
            }}
            className="mt-4 rounded-2xl border border-border px-4 py-2 text-sm font-bold transition-colors hover:bg-secondary/70"
          >
            كشف موقع آخر
          </button>
        ) : null}
      </section>

      {report ? <ReportView report={report} /> : null}
    </AppShell>
  );
}

function ReportView({ report }: { report: DiscoveryReport }) {
  const { profile, audit, opportunities, competitors, presence, actions } = report;
  return (
    <div className="mt-6 space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="الجاهزية الرقمية" value={`${report.readiness}/100`} tone="jade" />
        <Kpi label="صحة الصفحة الرئيسية" value={audit ? `${audit.score}/100` : "—"} />
        <Kpi
          label="أداء الجوال"
          value={audit?.speed?.performance != null ? `${audit.speed.performance}/100` : "—"}
        />
        <Kpi label="منصات لك حضور عليها" value={`${presence.found.length}`} />
      </section>

      <section className="rounded-3xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-black">من أنت في نظر البحث</h2>
        <p className="mt-2 rounded-2xl bg-secondary/60 p-4 text-sm leading-relaxed">
          <b>{profile.name}</b> · {profile.industry}
          {profile.country ? ` · ${profile.country}` : ""}
          {profile.dialect ? ` · لهجة ${profile.dialect}` : ""}
          <br />
          {profile.summary}
        </p>
      </section>

      {actions.length ? (
        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="font-display text-lg font-black">ابدأ من هنا</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            مرتّبة حسب الأثر — اضغط أي بند ليبدأ الموظف المسؤول فوراً.
          </p>
          <div className="mt-4 space-y-3">
            {actions.map((a) => {
              const m = getMember(a.employeeId);
              return (
                <Link
                  key={a.title}
                  to="/app/chat/$id"
                  params={{ id: a.employeeId }}
                  search={{ prompt: a.prompt }}
                  className="group flex items-start gap-3 rounded-2xl border border-border p-4 transition-colors hover:bg-secondary/60"
                >
                  <span
                    className={cn(
                      "mt-0.5 rounded-full px-2.5 py-1 text-[0.7rem] font-black",
                      a.priority === "عالية"
                        ? "bg-coral/15 text-coral"
                        : a.priority === "متوسطة"
                          ? "bg-amber/15 text-amber"
                          : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {a.priority}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{a.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
                      {a.why}
                    </span>
                    {m ? (
                      <span className="mt-1 block text-xs font-bold text-muted-foreground">
                        ينفّذها {m.name}
                      </span>
                    ) : null}
                  </span>
                  <ArrowUpLeft className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {opportunities.length ? (
        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="font-display text-lg font-black">ما يبحث عنه جمهورك</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="text-start">
                  <th className="p-2 text-start font-bold">العبارة</th>
                  <th className="p-2 text-start font-bold">النية</th>
                  <th className="p-2 text-start font-bold">الطلب</th>
                  <th className="p-2 text-start font-bold">الصعوبة</th>
                  <th className="p-2 text-start font-bold">ترتيبك</th>
                  <th className="p-2 text-start font-bold">المتصدرون</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((o) => (
                  <tr key={o.keyword} className="border-t border-border/60">
                    <td className="p-2 font-bold">{o.keyword}</td>
                    <td className="p-2 text-muted-foreground">{o.intent}</td>
                    <td className="p-2">{o.demandScore}</td>
                    <td className="p-2">{o.difficultyScore ?? "—"}</td>
                    <td className="p-2">
                      {o.weRank ? (
                        <span className="font-bold text-jade-deep">#{o.weRank}</span>
                      ) : (
                        <span className="text-coral">خارج النتائج</span>
                      )}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground" dir="ltr">
                      {o.topDomains.join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {audit ? (
        <section className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Gauge className="size-5 text-jade-deep" />
            <h2 className="font-display text-lg font-black">فحص صفحتك الرئيسية</h2>
          </div>
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {audit.checks.map((c) => (
              <li
                key={c.id}
                className="flex items-start gap-2.5 rounded-2xl border border-border/70 p-3"
              >
                {c.status === "pass" ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-jade-deep" />
                ) : c.status === "warn" ? (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-coral" />
                )}
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{c.label}</span>
                  <span className="block text-xs leading-relaxed text-ink-soft">{c.detail}</span>
                  {c.fix && c.status !== "pass" ? (
                    <span className="mt-1 block text-xs font-semibold text-primary">{c.fix}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="font-display text-lg font-black">حضورك على المنصات</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {presence.found.map((p) => (
              <a
                key={p.platform}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-jade/30 bg-jade/8 px-3 py-1.5 text-xs font-bold"
              >
                <AppIcon name={p.platform} className="size-4" /> {appLabel(p.platform)}
              </a>
            ))}
            {presence.found.length === 0 ? (
              <p className="text-sm text-muted-foreground">لم نجد حسابات منشورة لعلامتك.</p>
            ) : null}
          </div>
          {presence.missing.length ? (
            <>
              <p className="mt-4 text-xs font-bold text-muted-foreground">منصات بلا حضور</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {presence.missing.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground"
                  >
                    <AppIcon name={p} className="size-4" /> {appLabel(p)}
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </section>

        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="font-display text-lg font-black">منافسوك</h2>
          <ul className="mt-4 space-y-3">
            {competitors.map((c) => (
              <li key={c.domain} className="rounded-2xl border border-border/70 p-3">
                <p className="flex items-center gap-2 font-bold" dir="ltr">
                  <Globe className="size-4 text-muted-foreground" /> {c.domain}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.contentCount} صفحة منشورة
                  {c.topics.length ? ` · ${c.topics.join("، ")}` : ""}
                </p>
              </li>
            ))}
            {competitors.length === 0 ? (
              <li className="text-sm text-muted-foreground">لم نتعرّف على منافسين من موقعك.</li>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "jade" }) {
  return (
    <div
      className={cn(
        "rounded-3xl border p-6",
        tone === "jade" ? "border-jade/30 bg-jade/8" : "border-border bg-card",
      )}
    >
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-black">{value}</p>
    </div>
  );
}
