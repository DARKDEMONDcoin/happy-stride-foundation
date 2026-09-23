import { createFileRoute, Link } from "@tanstack/react-router";
import { Quote } from "lucide-react";

import { PageShell, PageHero, CtaBand } from "@/components/site/PageShell";
import { Reveal } from "@/components/Reveal";
import { stories } from "@/data/stories";
import { team } from "@/data/team";
import { Portrait } from "@/components/site/Portrait";

export const Route = createFileRoute("/stories")({
  head: () => ({
    meta: [
      { title: "قصص النجاح | نتائج حقيقية من مشاريع عربية — سهل" },
      {
        name: "description",
        content:
          "كيف ضاعف متجر أزياء طلباته، وملأت شركة برمجيات خط مبيعاتها، ورفعت سلسلة مطاعم تقييمها — بفريق رقمي واحد.",
      },
      { property: "og:title", content: "قصص نجاح عملاء سهل" },
      { property: "og:description", content: "أرقام قبل وبعد من مشاريع عربية حقيقية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StoriesPage,
});

function StoriesPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="قصص النجاح"
        title="نتائج تُقاس، لا وعوداً تُقال"
        lead="ثلاث حالات من قطاعات مختلفة، مع الأرقام قبل التشغيل وبعده."
      />

      <section className="mx-auto max-w-6xl space-y-8 px-5 py-14">
        {stories.map((s, i) => (
          <Reveal key={s.id} delay={i * 70}>
            <article className="grid gap-8 rounded-3xl border border-border bg-card p-8 shadow-card md:p-10 lg:grid-cols-[1.15fr_0.85fr]">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted-foreground">
                  <span className="rounded-full bg-secondary px-3 py-1">{s.sector}</span>
                  <span className="rounded-full bg-secondary px-3 py-1">{s.country}</span>
                </div>
                <h2 className="mt-4 font-display text-2xl leading-snug font-black md:text-3xl">
                  {s.headline}
                </h2>
                <p className="mt-2 font-semibold text-primary">{s.company}</p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-secondary/60 p-5">
                    <h3 className="text-sm font-bold text-muted-foreground">قبل</h3>
                    <p className="mt-2 leading-relaxed">{s.before}</p>
                  </div>
                  <div className="rounded-2xl bg-jade/10 p-5">
                    <h3 className="text-sm font-bold text-jade-deep">بعد</h3>
                    <p className="mt-2 leading-relaxed">{s.after}</p>
                  </div>
                </div>

                <figure className="mt-6 border-r-4 border-amber pr-5">
                  <Quote className="size-5 text-amber" />
                  <blockquote className="mt-2 text-lg leading-relaxed">«{s.quote}»</blockquote>
                  <figcaption className="mt-2 text-sm text-muted-foreground">
                    {s.person} — {s.role}، {s.company}
                  </figcaption>
                </figure>
              </div>

              <div className="space-y-4">
                {s.results.map((r) => (
                  <div
                    key={r.k}
                    className="rounded-2xl border border-border p-5 text-center shadow-card"
                  >
                    <div className="font-display text-3xl font-black text-primary">{r.v}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{r.k}</div>
                  </div>
                ))}
                <div className="rounded-2xl bg-secondary/60 p-5">
                  <h3 className="text-sm font-bold text-muted-foreground">الموظفون المشغَّلون</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {s.employees.map((id) => {
                      const m = team.find((t) => t.id === id);
                      if (!m) return null;
                      return (
                        <Link
                          key={id}
                          to="/employees/$id"
                          params={{ id }}
                          className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pe-3.5 ps-1.5 text-sm font-semibold transition-colors hover:text-primary"
                        >
                          <span className="size-7 shrink-0 overflow-hidden rounded-full">
                            <Portrait memberId={m.id} name={m.name} className="size-full" />
                          </span>
                          {m.name}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </section>

      <CtaBand title="قصتك القادمة" lead="ابدأ اليوم، وشاركنا أرقامك بعد ٦٠ يوماً." />
    </PageShell>
  );
}
