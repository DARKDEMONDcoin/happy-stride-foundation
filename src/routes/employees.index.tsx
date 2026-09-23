import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { PageShell, PageHero, CtaBand } from "@/components/site/PageShell";
import { AppRow } from "@/components/site/AppIcon";
import { Portrait, RegionPicker } from "@/components/site/Portrait";
import { Reveal } from "@/components/Reveal";
import { team } from "@/data/team";

export const Route = createFileRoute("/employees/")({
  head: () => ({
    meta: [
      { title: "الموظفون الرقميون | ستة تخصصات تعمل بالعربية 24/7 — سهل" },
      {
        name: "description",
        content:
          "تعرّف على فريق سهل: سِراج للسوشيال، أمَل للمساعدة التنفيذية، سالم للمبيعات، نور للمحتوى، دانة للتصميم، وآدم للتحليل.",
      },
      { property: "og:title", content: "الموظفون الرقميون في سهل" },
      {
        property: "og:description",
        content: "ستة موظفين بالذكاء الاصطناعي باشتراك واحد — كل واحد بتخصصه وأدواته.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmployeesPage,
});

function EmployeesPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="فريقك الكامل"
        title="ستة موظفين، تخصص واحد لكل منهم، واشتراك واحد لك"
        lead="لا تشتري «أداة». توظّف زملاء رقميين لهم أسماء وأدوار وحدود واضحة — تراقب عملهم، وتوافق قبل التنفيذ الحسّاس."
      />

      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-muted-foreground">
            يظهر فريقك بزيّ بلدك — غيّر البلد وقتما تشاء:
          </p>
          <RegionPicker />
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {team.map((m, i) => (
            <Reveal key={m.id} delay={i * 70}>
              <article className="group flex h-full flex-col rounded-3xl border border-border bg-card p-7 shadow-card transition-all duration-400 hover:-translate-y-1.5 hover:shadow-lift">
                <div className="flex items-start gap-4">
                  <span className="relative block size-20 shrink-0 overflow-hidden rounded-3xl shadow-card">
                    <Portrait
                      memberId={m.id}
                      name={m.name}
                      className="size-full transition-transform duration-700 group-hover:scale-105"
                    />
                  </span>
                  <div>
                    <h2 className="font-display text-2xl font-black">{m.name}</h2>
                    <p className="text-sm font-semibold text-muted-foreground">{m.role}</p>
                    <span
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
                      style={{ background: m.tintSoft, color: m.tint }}
                    >
                      {m.tagline}
                    </span>
                  </div>
                </div>

                <p className="mt-5 leading-relaxed text-ink-soft">{m.summary}</p>

                <ul className="mt-5 grid gap-2 text-sm">
                  {m.tasks.slice(0, 3).map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <span
                        className="mt-2 size-1.5 shrink-0 rounded-full"
                        style={{ background: m.tint }}
                      />
                      {t}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 grid grid-cols-3 gap-3">
                  {m.metrics.map((s) => (
                    <div key={s.k} className="rounded-2xl bg-secondary/70 p-3 text-center">
                      <div className="font-display text-lg font-black text-primary">{s.v}</div>
                      <div className="mt-0.5 text-[0.68rem] text-muted-foreground">{s.k}</div>
                    </div>
                  ))}
                </div>

                <AppRow apps={m.apps.slice(0, 6)} className="mt-6" />

                <Link
                  to="/employees/$id"
                  params={{ id: m.id }}
                  className="mt-7 inline-flex items-center gap-2 font-bold text-primary transition-transform duration-300 group-hover:-translate-x-1"
                >
                  ملف {m.name} الكامل
                  <ArrowLeft className="size-4" />
                </Link>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <CtaBand title="وظّف من تحتاجه فقط" lead="فعّل موظفاً واحداً اليوم، وأضف البقية حين تكبر." />
    </PageShell>
  );
}
