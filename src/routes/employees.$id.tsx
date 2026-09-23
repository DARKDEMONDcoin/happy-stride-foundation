import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Check, ShieldAlert } from "lucide-react";

import { PageShell, CtaBand } from "@/components/site/PageShell";
import { AppRow } from "@/components/site/AppIcon";
import { Portrait } from "@/components/site/Portrait";
import { Reveal } from "@/components/Reveal";
import { team } from "@/data/team";

export const Route = createFileRoute("/employees/$id")({
  loader: ({ params }) => {
    const member = team.find((m) => m.id === params.id);
    if (!member) throw notFound();
    return { id: member.id, name: member.name, role: member.role, tagline: member.tagline };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "الموظف غير موجود — سهل" }, { name: "robots", content: "noindex" }],
      };
    }
    const t = `${loaderData.name} — ${loaderData.role} | سهل`;
    return {
      meta: [
        { title: t },
        { name: "description", content: loaderData.tagline },
        { property: "og:title", content: t },
        { property: "og:description", content: loaderData.tagline },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  notFoundComponent: MemberNotFound,
  component: MemberPage,
});

function MemberNotFound() {
  return (
    <PageShell>
      <div className="mx-auto max-w-xl px-5 pt-40 pb-24 text-center">
        <h1 className="font-display text-3xl font-black">لم نجد هذا الموظف</h1>
        <p className="mt-3 text-muted-foreground">ربما تغيّر الرابط. تصفّح الفريق كاملاً.</p>
        <Link
          to="/employees"
          className="mt-7 inline-flex rounded-full bg-foreground px-6 py-3 font-bold text-background"
        >
          كل الموظفين
        </Link>
      </div>
    </PageShell>
  );
}

function MemberPage() {
  const { id } = Route.useParams();
  const m = team.find((x) => x.id === id)!;
  const others = team.filter((x) => x.id !== id).slice(0, 3);

  return (
    <PageShell>
      <section className="sahl-member-hero relative overflow-hidden pt-32 pb-16 md:pt-40">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ backgroundImage: "var(--gradient-ink)" }}
        />
        <div
          aria-hidden
          className="absolute -top-1/2 -left-1/4 h-[140%] w-[80%] opacity-40 blur-3xl"
          style={{
            backgroundImage: "var(--gradient-aurora)",
            backgroundSize: "200% 200%",
            animation: "aurora-pan 20s ease-in-out infinite",
            borderRadius: "48% 52% 40% 60%",
          }}
        />
        <div aria-hidden className="grid-lines absolute inset-0 opacity-30" />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-24"
          style={{ background: "linear-gradient(to bottom, transparent, var(--background))" }}
        />
        <div className="relative mx-auto max-w-6xl px-5">
          <Link
            to="/employees"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white"
          >
            <ArrowLeft className="size-4 rotate-180" />
            كل الموظفين
          </Link>
          <div className="mt-6 flex flex-wrap items-center gap-5">
            <span className="relative block size-28 shrink-0 overflow-hidden rounded-[2rem] border border-white/30 shadow-lift ring-4 ring-white/10 md:size-32">
              <Portrait memberId={m.id} name={m.name} className="size-full" eager />
            </span>
            <div>
              <h1 className="font-display text-4xl font-black text-white md:text-5xl">{m.name}</h1>
              <p className="mt-2 text-lg font-semibold text-white/85">
                {m.role} — {m.title}
              </p>
              <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
                {m.tagline}
              </span>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/90">{m.summary}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/app"
              className="rounded-full bg-background px-7 py-3.5 font-bold text-foreground shadow-lift transition-transform duration-300 hover:-translate-y-1"
            >
              وظّف {m.name} الآن
            </Link>
            <Link
              to="/pricing"
              className="rounded-full border border-white/50 bg-white/15 px-6 py-3.5 font-semibold text-white backdrop-blur hover:bg-white/25"
            >
              الأسعار
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-5 sm:grid-cols-3">
          {m.metrics.map((s) => (
            <Reveal key={s.k}>
              <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-card">
                <div className="font-display text-3xl font-black text-primary">{s.v}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.k}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[1.1fr_0.9fr]">
        <Reveal>
          <div className="rounded-3xl border border-border bg-card p-8 shadow-card">
            <h2 className="font-display text-2xl font-black">ماذا ينجز يومياً</h2>
            <ul className="mt-5 space-y-3">
              {m.tasks.map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg"
                    style={{ background: m.tintSoft, color: m.tint }}
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  <span className="leading-relaxed">{t}</span>
                </li>
              ))}
            </ul>

            <h3 className="mt-8 font-display text-lg font-extrabold">المهارات</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {m.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-border bg-secondary/60 px-3.5 py-1.5 text-sm font-medium"
                >
                  {s}
                </span>
              ))}
            </div>

            <h3 className="mt-8 font-display text-lg font-extrabold">التطبيقات التي يعمل داخلها</h3>
            <AppRow apps={m.apps} className="mt-3" />
          </div>
        </Reveal>

        <div className="space-y-6">
          <Reveal delay={80}>
            <div className="rounded-3xl border border-border bg-card p-8 shadow-card">
              <h2 className="font-display text-2xl font-black">نماذج من عمله</h2>
              <div className="mt-5 space-y-4">
                {m.sample.map((s) => (
                  <figure key={s.label} className="rounded-2xl bg-secondary/60 p-5">
                    <figcaption className="text-xs font-bold text-muted-foreground">
                      {s.label}
                    </figcaption>
                    <blockquote className="mt-2 leading-relaxed">{s.body}</blockquote>
                  </figure>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={140}>
            <div className="rounded-3xl border border-border bg-card p-8 shadow-card">
              <h2 className="flex items-center gap-2 font-display text-xl font-black">
                <ShieldAlert className="size-5 text-amber" />
                حدوده — بصراحة
              </h2>
              <ul className="mt-4 space-y-2.5 text-ink-soft">
                {m.limits.map((l) => (
                  <li key={l} className="flex items-start gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber" />
                    {l}
                  </li>
                ))}
                <li className="flex items-start gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber" />
                  لا ينفّذ أي إجراء حسّاس قبل موافقتك الصريحة
                </li>
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <h2 className="font-display text-2xl font-black">زملاء يعملون معه</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {others.map((o) => (
            <Link
              key={o.id}
              to="/employees/$id"
              params={{ id: o.id }}
              className="group rounded-3xl border border-border bg-card p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
            >
              <span className="relative block size-14 overflow-hidden rounded-2xl shadow-card">
                <Portrait
                  memberId={o.id}
                  name={o.name}
                  className="size-full transition-transform duration-500 group-hover:scale-105"
                />
              </span>
              <h3 className="mt-4 font-display text-lg font-black">{o.name}</h3>
              <p className="text-sm text-muted-foreground">{o.role}</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{o.tagline}</p>
            </Link>
          ))}
        </div>
      </section>

      <CtaBand />
    </PageShell>
  );
}
