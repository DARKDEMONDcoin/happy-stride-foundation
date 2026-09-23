import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Loader2, Play, Plus, Trash2, X } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { skillsFor, getSkill, type Skill } from "@/data/skills";
import { useWorkspace } from "@/lib/data";
import {
  deleteAutomation,
  listAutomations,
  runAutomationNow,
  saveAutomation,
  toggleAutomation,
} from "@/lib/automations.functions";
import { cn } from "@/lib/utils";
import { BrandLoader } from "@/components/site/BrandLoader";

export const Route = createFileRoute("/app/automations")({
  head: () => ({
    meta: [
      { title: "الجدولة التلقائية | سهل" },
      { name: "description", content: "اجعل نور تنفّذ مهامها تلقائياً كل يوم أو أسبوع أو شهر." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AutomationsPage,
});

const cadenceLabel: Record<string, string> = {
  daily: "يومياً",
  weekly: "أسبوعياً",
  monthly: "شهرياً",
};

const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function Form({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(saveAutomation);
  const nourSkills = useMemo(() => skillsFor("nour"), []);
  const sonnySkillList = useMemo(() => skillsFor("sonny"), []);
  const [skillId, setSkillId] = useState(nourSkills[0]?.id ?? "");
  const skill: Skill | undefined = getSkill(skillId);
  const [values, setValues] = useState<Record<string, string>>({});
  const [label, setLabel] = useState("");
  const [cadence, setCadence] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [hour, setHour] = useState(9);
  const [autoPublish, setAutoPublish] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (id: string) => {
    setSkillId(id);
    const s = getSkill(id);
    setValues(Object.fromEntries((s?.fields ?? []).map((f) => [f.name, f.defaultValue ?? ""])));
  };

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          workspaceId,
          employeeId: skill?.employeeId ?? "nour",
          skillId,
          label: label.trim() || (skill?.title ?? "جدولة"),
          values,
          cadence,
          dayOfWeek,
          hour,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Cairo",
          autoPublish,
          active: true,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["automations", workspaceId] });
      onClose();
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "تعذّر الحفظ"),
  });

  const ready = skill?.fields.every((f) => !f.required || (values[f.name] ?? "").trim()) ?? false;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-black">جدولة مهمة جديدة لنور</h2>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-xl p-1 hover:bg-secondary"
          >
            <X className="size-5" />
          </button>
        </div>

        <label className="block text-sm font-bold">المهمة</label>
        <select
          value={skillId}
          onChange={(e) => pick(e.target.value)}
          className="mt-1.5 w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm"
        >
          <optgroup label="نور — المحتوى والسيو">
            {nourSkills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </optgroup>
          <optgroup label="سِراج — السوشيال ميديا">
            {sonnySkillList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </optgroup>
        </select>
        {skill ? <p className="mt-1.5 text-xs text-muted-foreground">{skill.summary}</p> : null}

        <label className="mt-4 block text-sm font-bold">اسم الجدولة</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={skill?.title ?? ""}
          className="mt-1.5 w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm"
        />

        <div className="mt-4 space-y-3">
          {(skill?.fields ?? []).map((f) => (
            <div key={f.name}>
              <label className="block text-sm font-bold">
                {f.label}
                {f.required ? <span className="text-coral"> *</span> : null}
              </label>
              {f.type === "select" ? (
                <select
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  className="mt-1.5 w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm"
                >
                  <option value="">—</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  placeholder={f.placeholder}
                  rows={3}
                  className="mt-1.5 w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm"
                />
              ) : (
                <input
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="mt-1.5 w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm"
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-bold">التكرار</label>
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value as typeof cadence)}
              className="mt-1.5 w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm"
            >
              <option value="daily">يومياً</option>
              <option value="weekly">أسبوعياً</option>
              <option value="monthly">شهرياً</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold">اليوم</label>
            <select
              value={dayOfWeek}
              disabled={cadence === "daily"}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="mt-1.5 w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm disabled:opacity-50"
            >
              {days.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold">الساعة (UTC)</label>
            <select
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              className="mt-1.5 w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2.5 text-sm font-semibold">
          <input
            type="checkbox"
            checked={autoPublish}
            onChange={(e) => setAutoPublish(e.target.checked)}
            className="size-4"
          />
          أرسل المخرج مسودةً تلقائياً إلى منصة النشر المربوطة
        </label>

        {error ? <p className="mt-3 text-sm font-semibold text-coral">{error}</p> : null}

        <button
          onClick={() => {
            setError(null);
            mutation.mutate();
          }}
          disabled={!ready || mutation.isPending}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-3 text-sm font-bold text-background disabled:opacity-60"
        >
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          احفظ الجدولة
        </button>
      </div>
    </div>
  );
}

function AutomationsPage() {
  const qc = useQueryClient();
  const { data: workspace } = useWorkspace();
  const list = useServerFn(listAutomations);
  const toggle = useServerFn(toggleAutomation);
  const remove = useServerFn(deleteAutomation);
  const runNow = useServerFn(runAutomationNow);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["automations", workspace?.id],
    enabled: Boolean(workspace?.id),
    queryFn: () => list({ data: { workspaceId: workspace!.id } }),
  });

  const rows = data?.automations ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["automations", workspace?.id] });

  return (
    <AppShell
      title="الجدولة التلقائية"
      lead="نور تنفّذ مهامها في مواعيدها بلا طلب منك"
      actions={
        <button
          onClick={() => setOpen(true)}
          disabled={!workspace}
          className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3.5 py-2.5 text-sm font-bold text-background disabled:opacity-60"
        >
          <Plus className="size-4" /> جدولة
        </button>
      }
    >
      {open && workspace ? (
        <Form workspaceId={workspace.id} onClose={() => setOpen(false)} />
      ) : null}

      {note ? (
        <p className="mb-5 rounded-2xl bg-jade/12 px-4 py-3 text-sm font-semibold text-jade-deep">
          {note}
        </p>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BrandLoader size="sm" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <CalendarClock className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-display font-black">لا جدولات بعد</p>
          <p className="mt-1 text-sm text-muted-foreground">
            أضف جدولة واحدة، وستجد المخرج جاهزاً في الموافقات كل مرة.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center gap-3 rounded-3xl border border-border bg-card p-5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display font-black">{a.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {getSkill(a.skill_id)?.title ?? a.skill_id} ·{" "}
                  {cadenceLabel[a.cadence] ?? a.cadence}
                  {a.cadence === "daily" ? "" : ` · ${days[a.day_of_week] ?? ""}`} ·{" "}
                  {String(a.hour).padStart(2, "0")}:00 بتوقيتك
                  {a.auto_publish ? " · نشر تلقائي كمسودة" : ""}
                </span>
                <span className="mt-1 block truncate text-xs text-ink-soft">
                  {a.last_run_at
                    ? `آخر تشغيل: ${new Date(a.last_run_at).toLocaleString("ar-EG")} — ${a.last_status ?? ""}`
                    : `التشغيل القادم: ${new Date(a.next_run_at).toLocaleString("ar-EG")}`}
                </span>
              </span>

              <button
                onClick={async () => {
                  setBusy(a.id);
                  setNote(null);
                  try {
                    const r = await runNow({ data: { workspaceId: workspace!.id, id: a.id } });
                    setNote(`تم التنفيذ: ${r.title} — راجع المخرج في الموافقات.`);
                    void invalidate();
                  } catch (e) {
                    setNote(e instanceof Error ? e.message : "تعذّر التشغيل");
                  } finally {
                    setBusy(null);
                  }
                }}
                disabled={busy === a.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-bold hover:bg-secondary disabled:opacity-60"
              >
                {busy === a.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5" />
                )}
                شغّل الآن
              </button>

              <button
                onClick={async () => {
                  await toggle({
                    data: { workspaceId: workspace!.id, id: a.id, active: !a.active },
                  });
                  void invalidate();
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-bold",
                  a.active ? "bg-jade/12 text-jade-deep" : "bg-secondary text-ink-soft",
                )}
              >
                {a.active ? "مفعّلة" : "موقوفة"}
              </button>

              <button
                onClick={async () => {
                  await remove({ data: { workspaceId: workspace!.id, id: a.id } });
                  void invalidate();
                }}
                aria-label="حذف"
                className="rounded-full border border-border p-2 text-coral hover:bg-coral/10"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
