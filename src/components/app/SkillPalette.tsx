import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  BarChart3,
  Compass,
  Layers,
  Link2,
  Loader2,
  PenLine,
  Search,
  Sparkles,
  Star,
  Wand2,
  Workflow,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

import type { Skill, SkillCategory } from "@/data/skills";
import { cn } from "@/lib/utils";

type Props = {
  skills: Skill[];
  disabled?: boolean;
  pending?: boolean;
  onRun: (skill: Skill, values: Record<string, string>) => void;
  /** يُعرض كصف رقائق سريعة فوق مربع الإدخال. */
  quick?: Skill[];
  /** عند التمرير، تُعرض الرقائق السريعة بالخارج ويبقى الزر وحده. */
  hideQuick?: boolean;
};

const CATEGORY_META: Record<SkillCategory, { icon: LucideIcon; hue: string }> = {
  "بحث واستراتيجية": { icon: Compass, hue: "text-jade bg-jade/12" },
  "كتابة ونشر": { icon: PenLine, hue: "text-primary bg-primary/12" },
  "تحسين وصيانة": { icon: Wrench, hue: "text-amber bg-amber/15" },
  "قياس وتقارير": { icon: BarChart3, hue: "text-foreground bg-secondary" },
  "سلطة وروابط": { icon: Link2, hue: "text-coral bg-coral/12" },
  "أتمتة وتشغيل": { icon: Workflow, hue: "text-jade-deep bg-jade-deep/12" },
  "توسّع وإعادة استخدام": { icon: Layers, hue: "text-amber bg-amber/15" },
};

export function categoryMeta(category: SkillCategory) {
  return CATEGORY_META[category] ?? { icon: Sparkles, hue: "text-primary bg-primary/12" };
}

function initialValues(skill: Skill) {
  return Object.fromEntries(skill.fields.map((f) => [f.name, f.defaultValue ?? ""]));
}

/** تطبيع بسيط للبحث العربي: توحيد الهمزات والتاء المربوطة والياء وإزالة التشكيل. */
function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

const inputCls =
  "mt-1.5 w-full rounded-2xl border border-border bg-background px-4 py-2.5 outline-none transition-colors focus:border-primary focus:ring-4 focus:ring-primary/10";

/**
 * لوحة القدرات: رقائق سريعة للقدرات المميّزة + مستعرض قابل للبحث مجمّع بالتصنيفات،
 * ثم نموذج تنفيذ أنيق.
 */
export function SkillPalette({ skills, disabled, pending, onRun, quick, hideQuick }: Props) {
  const [browsing, setBrowsing] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Skill | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const groups = useMemo(() => {
    const q = norm(query.trim());
    const list = q
      ? skills.filter((s) => norm(`${s.title} ${s.summary} ${s.category} ${s.kind}`).includes(q))
      : skills;
    const map = new Map<SkillCategory, Skill[]>();
    for (const s of list) map.set(s.category, [...(map.get(s.category) ?? []), s]);
    return [...map.entries()];
  }, [skills, query]);

  // إغلاق بمفتاح Esc.
  useEffect(() => {
    if (!browsing && !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (open) setOpen(null);
        else setBrowsing(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [browsing, open]);

  if (skills.length === 0) return null;

  const start = (skill: Skill) => {
    setValues(initialValues(skill));
    setOpen(skill);
    setBrowsing(false);
  };

  const ready =
    open?.fields.every((f) => !f.required || (values[f.name] ?? "").trim().length > 0) ?? false;

  const requiredCount = open?.fields.filter((f) => f.required).length ?? 0;

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          onClick={() => setBrowsing(true)}
          disabled={disabled || pending}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-2 text-xs font-bold transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card disabled:opacity-50 disabled:hover:translate-y-0 sm:gap-2 sm:px-3.5"
        >
          <span className="grid size-5 place-items-center rounded-full bg-primary/12 text-primary transition-transform group-hover:rotate-12">
            <Sparkles className="size-3" strokeWidth={2.6} />
          </span>
          <span className="hidden lg:inline">كل القدرات</span>
          <span className="hidden rounded-full bg-secondary px-1.5 py-0.5 text-[0.65rem] tabular-nums text-muted-foreground sm:inline">
            {skills.length}
          </span>
        </button>

        {!hideQuick && quick && quick.length > 0 ? (
          <div
            className="employee-command-scroll no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 [mask-image:linear-gradient(to_left,transparent,black_1.5rem,black_calc(100%-1.5rem),transparent)]"
            onWheel={(event) => {
              if (Math.abs(event.deltaY) > Math.abs(event.deltaX))
                event.currentTarget.scrollLeft += event.deltaY;
            }}
          >
            {quick.map((s) => {
              const meta = categoryMeta(s.category);
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={disabled || pending}
                  onClick={() => start(s)}
                  title={s.summary}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-secondary/50 py-1.5 pe-3 ps-1.5 text-xs font-semibold text-ink-soft transition-all hover:border-primary/40 hover:bg-card hover:text-foreground hover:shadow-card disabled:opacity-50"
                >
                  <span className={cn("grid size-5 place-items-center rounded-full", meta.hue)}>
                    <meta.icon className="size-3" strokeWidth={2.4} />
                  </span>
                  {s.title}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {typeof document !== "undefined" && (browsing || open)
        ? createPortal(
            <>
              {browsing ? (
                <div
                  className="fixed inset-0 z-50 grid place-items-end bg-foreground/45 p-0 backdrop-blur-sm animate-fade-in sm:place-items-center sm:p-4"
                  onClick={() => setBrowsing(false)}
                  role="dialog"
                  aria-modal
                  aria-label="مستعرض القدرات"
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-lift animate-pop-in sm:rounded-3xl"
                  >
                    <div className="border-b border-border p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-display text-lg font-black">القدرات</p>
                          <p className="text-xs text-muted-foreground">
                            {skills.length} قدرة جاهزة — اختر واحدة، املأ حقلين، واستلم مخرجاً
                            كاملاً.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBrowsing(false)}
                          className="grid size-9 shrink-0 place-items-center rounded-xl border border-border transition-colors hover:bg-secondary"
                          aria-label="إغلاق"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      <label className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-background px-3.5 py-2.5 transition-colors focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
                        <Search className="size-4 shrink-0 text-muted-foreground" />
                        <input
                          autoFocus
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="ابحث: مقال، هاشتاق، تقرير، رد على عميل…"
                          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                        />
                        {query ? (
                          <button
                            type="button"
                            onClick={() => setQuery("")}
                            className="text-xs font-bold text-muted-foreground hover:text-foreground"
                          >
                            مسح
                          </button>
                        ) : (
                          <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground sm:block">
                            Esc
                          </kbd>
                        )}
                      </label>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                      {groups.length === 0 ? (
                        <div className="py-12 text-center">
                          <p className="font-bold">لا نتائج مطابقة.</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            جرّب كلمة أعم — أو اكتب طلبك مباشرة في المحادثة وسيتولاه الموظف.
                          </p>
                        </div>
                      ) : null}
                      {groups.map(([category, list]) => {
                        const meta = categoryMeta(category);
                        return (
                          <section key={category} className="mb-6 last:mb-0">
                            <h3 className="mb-2.5 flex items-center gap-2 text-xs font-black">
                              <span
                                className={cn(
                                  "grid size-6 place-items-center rounded-lg",
                                  meta.hue,
                                )}
                              >
                                <meta.icon className="size-3.5" strokeWidth={2.4} />
                              </span>
                              {category}
                              <span className="text-muted-foreground">· {list.length}</span>
                            </h3>
                            <ul className="grid gap-2 sm:grid-cols-2">
                              {list.map((s) => (
                                <li key={s.id}>
                                  <button
                                    type="button"
                                    onClick={() => start(s)}
                                    className="group flex w-full items-start gap-3 rounded-2xl border border-border bg-background/60 p-3.5 text-start transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card hover:shadow-card"
                                  >
                                    <span className="min-w-0 flex-1">
                                      <span className="flex items-center gap-1.5 text-sm font-bold">
                                        {s.title}
                                        {s.featured ? (
                                          <Star
                                            className="size-3 fill-amber text-amber"
                                            aria-label="مميّزة"
                                          />
                                        ) : null}
                                      </span>
                                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                                        {s.summary}
                                      </span>
                                    </span>
                                    <ArrowLeft className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:-translate-x-0.5 group-hover:opacity-100" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </section>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}

              {open ? (
                <div
                  className="fixed inset-0 z-50 grid place-items-end bg-foreground/45 p-0 backdrop-blur-sm animate-fade-in sm:place-items-center sm:p-4"
                  onClick={() => setOpen(null)}
                  role="dialog"
                  aria-modal
                  aria-label={open.title}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-lift animate-pop-in sm:rounded-3xl"
                  >
                    <div className="flex items-start gap-3 border-b border-border p-5">
                      {(() => {
                        const meta = categoryMeta(open.category);
                        return (
                          <span
                            className={cn(
                              "grid size-11 shrink-0 place-items-center rounded-2xl",
                              meta.hue,
                            )}
                          >
                            <meta.icon className="size-5" strokeWidth={2.2} />
                          </span>
                        );
                      })()}
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.7rem] font-bold text-muted-foreground">
                          {open.category}
                        </p>
                        <h3 className="font-display text-xl font-black leading-tight">
                          {open.title}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">{open.summary}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOpen(null)}
                        className="grid size-9 shrink-0 place-items-center rounded-xl border border-border transition-colors hover:bg-secondary"
                        aria-label="إغلاق"
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    <form
                      className="flex min-h-0 flex-1 flex-col"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!ready) return;
                        onRun(open, values);
                        setOpen(null);
                      }}
                    >
                      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                        {open.fields.map((f) => {
                          const id = `skill-${open.id}-${f.name}`;
                          const val = values[f.name] ?? "";
                          const set = (v: string) => setValues((p) => ({ ...p, [f.name]: v }));
                          return (
                            <div key={f.name}>
                              <label htmlFor={id} className="block text-sm font-bold">
                                {f.label}
                                {f.required ? <span className="text-primary"> *</span> : null}
                              </label>
                              {f.help ? (
                                <p className="mt-0.5 text-xs text-muted-foreground">{f.help}</p>
                              ) : null}
                              {f.type === "textarea" ? (
                                <textarea
                                  id={id}
                                  rows={4}
                                  value={val}
                                  placeholder={f.placeholder}
                                  onChange={(e) => set(e.target.value)}
                                  className={inputCls}
                                />
                              ) : f.type === "select" ? (
                                <select
                                  id={id}
                                  value={val}
                                  onChange={(e) => set(e.target.value)}
                                  className={inputCls}
                                >
                                  {(f.options ?? []).map((o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  id={id}
                                  type={f.type === "number" ? "number" : "text"}
                                  value={val}
                                  placeholder={f.placeholder}
                                  onChange={(e) => set(e.target.value)}
                                  className={inputCls}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="border-t border-border p-4 sm:p-5">
                        <button
                          type="submit"
                          disabled={!ready || pending}
                          className={cn(
                            "flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-5 py-3 font-bold text-background transition-all hover:-translate-y-0.5 hover:shadow-lift",
                            (!ready || pending) &&
                              "opacity-50 hover:translate-y-0 hover:shadow-none",
                          )}
                        >
                          {pending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Wand2 className="size-4" />
                          )}
                          نفّذ المهمة
                        </button>
                        {!ready && requiredCount > 0 ? (
                          <p className="mt-2 text-center text-xs text-muted-foreground">
                            املأ الحقول المعلّمة بـ * للمتابعة.
                          </p>
                        ) : null}
                      </div>
                    </form>
                  </div>
                </div>
              ) : null}
            </>,
            document.body,
          )
        : null}
    </>
  );
}
