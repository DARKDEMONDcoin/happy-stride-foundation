import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, FileText, Printer, ShieldCheck } from "lucide-react";

import { PageShell, PageHero } from "@/components/site/PageShell";
import { Reveal } from "@/components/Reveal";
import { cn } from "@/lib/utils";

export type LegalSection = {
  /** معرّف الرابط المباشر للقسم — يُستخدم في فهرس المحتويات. */
  id: string;
  h: string;
  /**
   * فقرات نصية:
   * - تبدأ بـ«• » لتظهر كنقطة.
   * - تبدأ بـ«> » لتظهر كملاحظة مميّزة.
   * - تبدأ بـ«## » لتظهر كعنوان فرعي.
   */
  p: string[];
};

const ALL_DOCS = [
  { to: "/terms", label: "شروط الاستخدام" },
  { to: "/privacy", label: "سياسة الخصوصية" },
  { to: "/cookies", label: "سياسة ملفات الارتباط" },
  { to: "/acceptable-use", label: "سياسة الاستخدام المقبول" },
  { to: "/dpa", label: "اتفاقية معالجة البيانات (DPA)" },
  { to: "/subprocessors", label: "قائمة المعالِجين الفرعيين" },
  { to: "/refunds", label: "سياسة الاشتراك والاسترداد" },
  { to: "/security", label: "الأمان" },
];

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? "");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-120px 0px -65% 0px", threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids.join("|")]);
  return active;
}

function useReadProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setPct(max > 0 ? Math.min(100, Math.max(0, (doc.scrollTop / max) * 100)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return pct;
}

function Line({ line }: { line: string }) {
  if (line.startsWith("## ")) {
    return (
      <h3 className="pt-3 font-display text-lg font-black text-foreground">{line.slice(3)}</h3>
    );
  }
  if (line.startsWith("> ")) {
    return (
      <p className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 text-[1.02rem] leading-[1.95] font-medium text-foreground">
        {line.slice(2)}
      </p>
    );
  }
  if (line.startsWith("• ")) {
    return (
      <p className="relative pr-5 text-[1.05rem] leading-[2] text-muted-foreground before:absolute before:top-[0.95em] before:right-0 before:size-1.5 before:rounded-full before:bg-primary">
        {line.slice(2)}
      </p>
    );
  }
  return <p className="text-[1.05rem] leading-[2] text-muted-foreground">{line}</p>;
}

/**
 * قالب موحّد لكل الصفحات القانونية: شريط تقدّم للقراءة، فهرس محتويات لاصق يبرز القسم الحالي،
 * خلاصة سريعة في أعلى المستند، أقسام مرقّمة بروابط مباشرة، وتذييل يربط بقية المستندات.
 */
export function LegalDoc({
  title,
  lead,
  updated,
  effective,
  version,
  summary,
  sections,
  related = true,
}: {
  title: string;
  lead: string;
  updated: string;
  effective?: string;
  version?: string;
  /** خلاصة سريعة تظهر أعلى المستند بلغة بسيطة. */
  summary?: string[];
  sections: LegalSection[];
  related?: boolean;
}) {
  const ids = sections.map((s) => s.id);
  const active = useActiveSection(ids);
  const progress = useReadProgress();
  const words = sections.reduce((n, s) => n + s.p.join(" ").split(/\s+/).length, 0);
  const minutes = Math.max(2, Math.round(words / 190));

  return (
    <PageShell>
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-50 h-0.5 bg-primary/80 transition-[width] duration-150 print:hidden"
        style={{ width: `${progress}%` }}
      />

      <PageHero eyebrow="مركز الوثائق القانونية" title={title} lead={lead} />

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 lg:grid-cols-[270px_1fr]">
        <aside className="lg:sticky lg:top-28 lg:self-start print:hidden">
          <details
            open
            className="group rounded-3xl border border-border bg-card p-5 shadow-card [&:not([open])>summary]:mb-0 lg:[&>summary]:pointer-events-none"
          >
            <summary className="mb-3 flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-bold text-muted-foreground [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                المحتويات
              </span>
              <span className="text-xs font-medium lg:hidden">{sections.length} أقسام</span>
            </summary>
            <ol className="max-h-[52vh] space-y-1 overflow-y-auto text-sm lg:max-h-[58vh]">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className={cn(
                      "block rounded-xl px-3 py-2 leading-relaxed transition-colors",
                      active === s.id
                        ? "bg-primary/10 font-bold text-primary"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                    )}
                  >
                    {i + 1}. {s.h}
                  </a>
                </li>
              ))}
            </ol>
            <div className="mt-5 space-y-2 border-t border-border pt-4 text-xs leading-6 text-muted-foreground">
              <p className="flex items-center gap-2">
                <CalendarClock className="size-3.5" /> آخر تحديث: {updated}
              </p>
              {effective ? <p>تاريخ السريان: {effective}</p> : null}
              {version ? <p>الإصدار: {version}</p> : null}
              <p>زمن القراءة التقريبي: {minutes} دقائق</p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              <Printer className="size-4" />
              طباعة أو حفظ PDF
            </button>
          </details>
        </aside>

        <div className="min-w-0 space-y-10">
          {summary?.length ? (
            <Reveal>
              <div className="rounded-3xl border border-border bg-secondary/50 p-6 md:p-7">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-primary" />
                  <h2 className="font-display text-xl font-black">الخلاصة في سطور</h2>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  ملخّص غير مُلزِم يساعدك على الفهم السريع — النص الرسمي هو الأقسام أدناه.
                </p>
                <ul className="mt-4 grid gap-3 md:grid-cols-2">
                  {summary.map((s) => (
                    <li
                      key={s}
                      className="rounded-2xl bg-card px-5 py-4 text-[0.98rem] leading-relaxed font-medium shadow-card"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ) : null}

          {sections.map((s, i) => (
            <Reveal key={s.id} delay={Math.min(i * 20, 140)}>
              <section id={s.id} className="scroll-mt-28">
                <h2 className="font-display text-2xl font-black">
                  <span className="text-muted-foreground">{i + 1}.</span> {s.h}
                </h2>
                <div className="mt-3 space-y-3">
                  {s.p.map((line) => (
                    <Line key={line} line={line} />
                  ))}
                </div>
              </section>
            </Reveal>
          ))}

          <div className="rounded-3xl border border-border bg-card p-6 print:hidden">
            <h2 className="font-display text-xl font-black">تحتاج نسخة موقّعة أو لديك سؤال؟</h2>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              فرق المشتريات والامتثال يمكنها طلب نسخة موقّعة من هذا المستند أو استيضاح أي بند عبر
              صفحة التواصل، ونردّ خلال يوم عمل واحد.
            </p>
            <Link
              to="/contact"
              className="mt-4 inline-flex items-center rounded-full bg-foreground px-6 py-3 font-bold text-background transition-transform hover:-translate-y-0.5"
            >
              تواصل مع الفريق القانوني
            </Link>
          </div>

          {related ? (
            <div className="rounded-3xl border border-border bg-card p-6 print:hidden">
              <h2 className="font-display text-xl font-black">وثائق قانونية أخرى</h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {ALL_DOCS.filter((l) => l.label !== title).map((l) => (
                  <li key={l.to}>
                    <Link
                      to={l.to}
                      className="block rounded-xl px-3 py-2 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-primary"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}
