import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Check, X } from "lucide-react";

import { PageShell, PageHero, CtaBand } from "@/components/site/PageShell";
import { Reveal } from "@/components/Reveal";
import { AppRow } from "@/components/site/AppIcon";
import { getUseCase, useCases } from "@/data/use-cases";
import { team } from "@/data/team";

export const Route = createFileRoute("/use-cases/$id")({
  loader: ({ params }) => {
    const useCase = getUseCase(params.id);
    if (!useCase) throw notFound();
    return { id: useCase.id };
  },
  head: ({ params }) => {
    const u = getUseCase(params.id);
    if (!u) return {};
    return {
      meta: [
        { title: `${u.name} | خطة تسويق وتشغيل يومية بالذكاء الاصطناعي — سهل` },
        { name: "description", content: u.lead.slice(0, 155) },
        { property: "og:title", content: `${u.name} — سهل` },
        { property: "og:description", content: u.lead.slice(0, 155) },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: u.faq.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        },
      ],
    };
  },
  component: UseCasePage,
});

function UseCasePage() {
  const { id } = Route.useLoaderData();
  const u = getUseCase(id)!;
  const crew = u.crew.map((c) => team.find((m) => m.id === c)).filter(Boolean);
  const others = useCases.filter((o) => o.id !== u.id).slice(0, 3);

  return (
    <PageShell>
      <PageHero eyebrow={u.name} title={u.title} lead={u.lead}>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/auth"
            search={{ mode: "signup" as const, plan: "growth" as const }}
            className="rounded-full bg-white px-7 py-3.5 font-bold text-ink"
          >
            ابدأ بخطة {u.name}
          </Link>
          <Link
            to="/employees"
            className="rounded-full border border-white/60 bg-white/15 px-7 py-3.5 font-semibold text-white backdrop-blur"
          >
            تعرّف على الفريق
          </Link>
        </div>
      </PageHero>

      {/* الوجع */}
      <section className="px-5 py-14">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="font-display text-2xl font-black md:text-3xl">
              هذا ما يستهلك يومك الآن
            </h2>
          </Reveal>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {u.pains.map((p, i) => (
              <Reveal key={p} delay={i * 60}>
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-coral/15 text-coral">
                    <X className="size-3.5" strokeWidth={3} />
                  </span>
                  <p className="leading-relaxed text-ink-soft">{p}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ماذا ينفّذ الفريق */}
      <section className="bg-secondary/40 px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="font-display text-2xl font-black md:text-3xl">
              وهذا ما ينفّذه الفريق بدلاً عنك
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
              كل بند أدناه مهمة فعلية تُنفَّذ وتظهر في لوحتك، لا وعد عام.
            </p>
          </Reveal>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {u.plays.map((p, i) => (
              <Reveal key={p.t} delay={i * 50}>
                <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-card">
                  <span
                    className="w-fit rounded-full px-3 py-1 text-xs font-black"
                    style={{ background: u.tintSoft, color: u.tint }}
                  >
                    {p.who}
                  </span>
                  <h3 className="mt-4 font-display text-lg font-black">{p.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* أسبوع نموذجي */}
      <section className="px-5 py-16">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <h2 className="font-display text-2xl font-black md:text-3xl">أسبوعك مع سهل</h2>
          </Reveal>
          <ol className="mt-8 space-y-3">
            {u.week.map((w, i) => (
              <Reveal key={w.day + i} delay={i * 50}>
                <li className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5">
                  <span className="grid min-w-20 shrink-0 place-items-center rounded-xl bg-foreground px-3 py-1.5 text-xs font-black text-background">
                    {w.day}
                  </span>
                  <p className="leading-relaxed text-ink-soft">{w.d}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* الأرقام + التكاملات */}
      <section className="px-5 pb-16">
        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1.1fr_1fr]">
          <Reveal>
            <div className="h-full rounded-[1.75rem] border border-border bg-card p-8 shadow-card">
              <h2 className="font-display text-xl font-black">ما الذي يتغيّر عندك</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {u.outcomes.map((o) => (
                  <div key={o.k} className="rounded-2xl bg-secondary/60 p-4 text-center">
                    <div className="font-display text-2xl font-black" style={{ color: u.tint }}>
                      {o.v}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-muted-foreground">{o.k}</div>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                الأرقام أعلاه تصف سعة التشغيل التي يوفّرها الفريق، وليست ضماناً لنتائج مبيعات —
                النتيجة تعتمد على منتجك وسوقك.
              </p>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="h-full rounded-[1.75rem] border border-border bg-card p-8 shadow-card">
              <h2 className="font-display text-xl font-black">الأدوات التي يعمل عليها</h2>
              <AppRow apps={u.apps} className="mt-6" />
              <Link
                to="/integrations"
                className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary"
              >
                شاهد كل التكاملات
                <ArrowLeft className="size-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* الفريق الموصى به */}
      <section className="bg-secondary/40 px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="font-display text-2xl font-black md:text-3xl">
              الموظفون الذين يشتغلون على هذا الحساب
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {crew.map((m, i) =>
              m ? (
                <Reveal key={m.id} delay={i * 50}>
                  <Link
                    to="/employees/$id"
                    params={{ id: m.id }}
                    className="flex h-full items-start gap-3 rounded-2xl border border-border bg-card p-5 transition-transform duration-300 hover:-translate-y-1"
                  >
                    <span
                      className="grid size-11 shrink-0 place-items-center rounded-xl"
                      style={{ background: m.tintSoft, color: m.tint }}
                    >
                      <m.icon className="size-5" strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-lg font-black">{m.name}</span>
                      <span className="block text-sm text-muted-foreground">{m.role}</span>
                    </span>
                  </Link>
                </Reveal>
              ) : null,
            )}
          </div>
        </div>
      </section>

      {/* أسئلة القطاع */}
      <section className="px-5 py-16">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <h2 className="font-display text-2xl font-black md:text-3xl">أسئلة أصحاب {u.name}</h2>
          </Reveal>
          <div className="mt-7 space-y-3">
            {u.faq.map((f, i) => (
              <Reveal key={f.q} delay={i * 60}>
                <details className="group rounded-2xl border border-border bg-card p-5">
                  <summary className="cursor-pointer list-none font-display text-base font-black">
                    {f.q}
                  </summary>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200}>
            <Link
              to="/faq"
              className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary"
            >
              بقية الأسئلة الشائعة
              <ArrowLeft className="size-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* قطاعات أخرى */}
      <section className="px-5 pb-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="font-display text-xl font-black">قطاعات أخرى</h2>
          </Reveal>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {others.map((o, i) => (
              <Reveal key={o.id} delay={i * 60}>
                <Link
                  to="/use-cases/$id"
                  params={{ id: o.id }}
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-5 transition-transform duration-300 hover:-translate-y-1"
                >
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-xl"
                    style={{ background: o.tintSoft, color: o.tint }}
                  >
                    <o.icon className="size-5" strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{o.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{o.short}</span>
                  </span>
                  <Check className="size-4 shrink-0 text-jade opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title={`ابدأ خطة ${u.name} الليلة`}
        lead="اربط حساباتك، اعتمد أول خطة أسبوع، ودع الفريق يشتغل."
      />
    </PageShell>
  );
}
