import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ListChecks, Loader2, Plane, Play, Save, TriangleAlert } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { useConnectedAccounts, useProfile, useWorkspace } from "@/lib/data";
import { getAutopilot, runAutopilotNow, saveAutopilot } from "@/lib/autopilot.functions";

export const Route = createFileRoute("/app/autopilot")({
  head: () => ({
    meta: [
      { title: "الطيار الآلي | سهل" },
      {
        name: "description",
        content:
          "خلّ سِراج يشتغل لوحده: يكتب منشوراتك اليومية بصورها وينشرها على إنستجرام وفيسبوك ولينكدإن وإكس في مواعيدها.",
      },
      { property: "og:title", content: "الطيار الآلي | سهل" },
      { property: "og:description", content: "محتوى يومي يُكتب ويُنشر تلقائياً بلا تدخّل منك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AutopilotPage,
});

const PROVIDERS = ["instagram", "facebook", "linkedin", "x", "pinterest", "youtube"] as const;
const DIALECTS = ["خليجية", "مصرية", "شامية", "مغربية", "فصحى"] as const;
const DAY_NAMES = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
] as const;
/** مناطق زمنية شائعة للمنطقة العربية + خيار توقيت الجهاز. */
const ZONES = [
  "Asia/Riyadh",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Qatar",
  "Asia/Kuwait",
  "Asia/Baghdad",
  "Asia/Amman",
  "Asia/Beirut",
  "Africa/Casablanca",
  "Africa/Tunis",
  "Africa/Algiers",
  "Europe/Istanbul",
  "Europe/London",
  "America/New_York",
  "UTC",
] as const;

function AutopilotPage() {
  const { data: workspace } = useWorkspace();
  const { data: profile } = useProfile();
  const { data: accounts } = useConnectedAccounts(workspace?.id);
  const qc = useQueryClient();

  const settings = useQuery({
    queryKey: ["autopilot", workspace?.id],
    enabled: Boolean(workspace?.id),
    queryFn: () => getAutopilot({ data: { workspaceId: workspace!.id } }),
  });

  const [active, setActive] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);
  const [brief, setBrief] = useState("");
  const [dialect, setDialect] = useState<string>("خليجية");
  const [slots, setSlots] = useState<string[]>(["09:00"]);
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [timezone, setTimezone] = useState<string>("Asia/Riyadh");
  const [newSlot, setNewSlot] = useState("12:00");
  const [mode, setMode] = useState<"auto" | "review">("review");
  const [withImage, setWithImage] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const row = settings.data?.autopilot ?? null;
  // لا إعدادات محفوظة بعد: نبدأ بلهجة المالك التي اختارها عند التسجيل ومنطقته الزمنية الفعلية.
  useEffect(() => {
    if (row || !profile) return;
    if (profile.dialect) setDialect(profile.dialect);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && (ZONES as readonly string[]).includes(tz)) setTimezone(tz);
  }, [row, profile]);
  useEffect(() => {
    if (!row) return;
    setActive(row.active);
    setProviders(row.providers ?? []);
    setBrief(row.brief ?? "");
    setDialect(row.dialect ?? "خليجية");
    const saved = (row as { slots?: string[] | null }).slots ?? [];
    setSlots(
      saved.length
        ? saved
        : (row.hours ?? [9]).map((h) => `${String((Number(h) + 3) % 24).padStart(2, "0")}:00`),
    );
    setDays(((row as { days?: number[] | null }).days ?? [0, 1, 2, 3, 4, 5, 6]).map(Number));
    setTimezone((row as { timezone?: string | null }).timezone ?? "Asia/Riyadh");
    setMode(row.mode === "auto" ? "auto" : "review");
    setWithImage(row.with_image);
  }, [row]);

  const save = useMutation({
    mutationFn: () =>
      saveAutopilot({
        data: {
          workspaceId: workspace!.id,
          active,
          providers,
          brief,
          dialect,
          slots: slots.length ? slots : ["09:00"],
          days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
          timezone,
          mode,
          withImage,
        },
      }),
    onSuccess: () => {
      setNote("تم الحفظ.");
      void qc.invalidateQueries({ queryKey: ["autopilot", workspace?.id] });
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "تعذّر الحفظ."),
  });

  const runNow = useMutation({
    mutationFn: () => runAutopilotNow({ data: { workspaceId: workspace!.id } }),
    onSuccess: (res) => {
      setNote(
        res.report.status === "generated"
          ? res.report.created
            ? `تم تجهيز ${res.report.created} منشوراً — تابعها في طابور النشر.`
            : "تم توليد المنشور — راجعه في صفحة الموافقات."
          : (res.report.note ?? "لم يُنتج شيء هذه المرة."),
      );
      void qc.invalidateQueries({ queryKey: ["autopilot", workspace?.id] });
      void qc.invalidateQueries({ queryKey: ["social-posts", workspace?.id] });
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "تعذّر التشغيل."),
  });

  const connected = new Set((accounts ?? []).map((a) => a.provider));
  const toggleProvider = (p: string) =>
    setProviders((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]));
  const addSlot = (value: string) => {
    if (!/^\d{1,2}:\d{2}$/.test(value)) return;
    setSlots((list) => (list.includes(value) ? list : [...list, value].sort()));
  };
  const removeSlot = (value: string) => setSlots((list) => list.filter((s) => s !== value));
  const toggleDay = (d: number) =>
    setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d].sort()));

  const busy = save.isPending || runNow.isPending;

  return (
    <AppShell
      title="الطيار الآلي"
      lead="سِراج يكتب وينشر لوحده — أنت تحدّد المنصات والمواعيد والأسلوب فقط."
      actions={
        <div className="flex gap-2">
          <Link
            to="/app/calendar"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-sm font-bold hover:bg-secondary"
          >
            <CalendarDays className="size-4" /> التقويم
          </Link>
          <Link
            to="/app/queue"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-sm font-bold hover:bg-secondary"
          >
            <ListChecks className="size-4" /> الطابور
          </Link>
        </div>
      }
    >
      {error ? (
        <p className="mb-4 rounded-2xl bg-destructive/10 p-4 text-sm font-bold text-destructive">
          {error}
        </p>
      ) : null}
      {note ? (
        <p className="mb-4 rounded-2xl bg-jade/12 p-4 text-sm font-bold text-jade-deep">{note}</p>
      ) : null}
      {row?.paused_reason ? (
        <p className="mb-4 inline-flex items-start gap-2 rounded-2xl bg-destructive/10 p-4 text-sm font-bold text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {row.paused_reason}
        </p>
      ) : null}

      <div className="grid gap-5">
        <section className="rounded-3xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-secondary text-ink-soft">
                <Plane className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-xl font-black">تشغيل الطيار</h2>
                <p className="text-sm text-ink-soft">{row?.last_status ?? "لم يعمل بعد."}</p>
                {row?.active && row.next_run_at ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    المنشور القادم:{" "}
                    {new Date(row.next_run_at).toLocaleString("ar", {
                      weekday: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: timezone,
                    })}
                  </p>
                ) : null}
              </div>
            </div>
            <button
              onClick={() => setActive((v) => !v)}
              className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors ${
                active ? "bg-jade text-background" : "bg-secondary text-ink-soft"
              }`}
            >
              {active ? "مُفعّل" : "متوقف"}
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-6">
          <h3 className="font-display text-lg font-black">المنصات</h3>
          <p className="mt-1 text-sm text-ink-soft">
            المنصات المربوطة فقط تعمل. غير المربوط اربطه من{" "}
            <Link to="/app/integrations" className="font-bold underline">
              صفحة التكاملات
            </Link>
            .
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {PROVIDERS.map((p) => {
              const on = providers.includes(p);
              const linked = connected.has(p);
              return (
                <button
                  key={p}
                  onClick={() => toggleProvider(p)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                    on
                      ? "border-transparent bg-foreground text-background"
                      : "border-border text-ink-soft"
                  }`}
                >
                  <AppIcon name={p} className="size-4" />
                  {appLabel(p)}
                  {!linked ? <span className="text-xs opacity-70">(غير مربوط)</span> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-6">
          <h3 className="font-display text-lg font-black">عمّا يكتب؟</h3>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
            placeholder="مثال: محمصة قهوة مختصة في جدة — نبيع حبوب مختصة واشتراكات شهرية، الجمهور شباب ٢٥–٤٠."
            className="mt-3 w-full rounded-2xl border border-border bg-background p-4 text-sm leading-relaxed outline-none focus:border-foreground"
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">اللهجة:</span>
            {DIALECTS.map((d) => (
              <button
                key={d}
                onClick={() => setDialect(d)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${
                  dialect === d ? "bg-foreground text-background" : "bg-secondary text-ink-soft"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={withImage}
              onChange={(e) => setWithImage(e.target.checked)}
              className="size-4"
            />
            أرفق صورة مولّدة مع كل منشور (إنستجرام يتطلبها)
          </label>
        </section>

        <section className="rounded-3xl border border-border bg-card p-6">
          <h3 className="font-display text-lg font-black">المواعيد</h3>
          <p className="mt-1 text-sm text-ink-soft">
            أضف أي عدد من المواعيد بأي ساعة ودقيقة تريدها، واختر أيام النشر وتوقيت بلدك — بلا أي
            قيد.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="time"
              value={newSlot}
              onChange={(e) => setNewSlot(e.target.value)}
              className="rounded-2xl border border-border bg-background px-4 py-2 text-sm font-bold outline-none focus:border-foreground"
            />
            <button
              onClick={() => addSlot(newSlot)}
              className="rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background"
            >
              أضف موعداً
            </button>
            <label className="ms-auto flex items-center gap-2 text-sm font-bold">
              التوقيت:
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
              >
                {[...new Set([timezone, ...ZONES])].map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {slots.length ? (
              slots.map((s) => (
                <button
                  key={s}
                  onClick={() => removeSlot(s)}
                  title="اضغط للحذف"
                  className="rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background"
                >
                  {s} ×
                </button>
              ))
            ) : (
              <span className="text-sm text-ink-soft">لم تضف موعداً بعد.</span>
            )}
          </div>

          <p className="mt-5 text-sm font-bold">أيام النشر</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DAY_NAMES.map((name, i) => (
              <button
                key={name}
                onClick={() => toggleDay(i)}
                className={`rounded-full px-4 py-2 text-sm font-bold ${
                  days.includes(i) ? "bg-foreground text-background" : "bg-secondary text-ink-soft"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-6">
          <h3 className="font-display text-lg font-black">وضع التشغيل</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(
              [
                { id: "auto", title: "ينشر لوحده", desc: "يكتب وينشر في الموعد بلا أي تدخّل منك." },
                {
                  id: "review",
                  title: "بانتظار موافقتك",
                  desc: "يكتب ويجهّز، وأنت تعتمد قبل النشر.",
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setMode(opt.id)}
                className={`rounded-2xl border p-4 text-start transition-colors ${
                  mode === opt.id ? "border-foreground bg-secondary" : "border-border"
                }`}
              >
                <span className="block font-bold">{opt.title}</span>
                <span className="mt-1 block text-sm text-ink-soft">{opt.desc}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              setError(null);
              setNote(null);
              save.mutate();
            }}
            disabled={busy || !workspace?.id}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-bold text-background disabled:opacity-60"
          >
            {save.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            احفظ الإعدادات
          </button>
          <button
            onClick={() => {
              setError(null);
              setNote(null);
              runNow.mutate();
            }}
            disabled={busy || !row}
            className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-bold disabled:opacity-60"
          >
            {runNow.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            شغّله الآن للتجربة
          </button>
        </div>
      </div>
    </AppShell>
  );
}
