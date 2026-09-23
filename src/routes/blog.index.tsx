import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock4, ArrowLeft } from "lucide-react";

import { PageShell, PageHero, CtaBand } from "@/components/site/PageShell";
import { Reveal } from "@/components/Reveal";
import { posts } from "@/data/blog";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "المدونة | دلائل عملية للتشغيل بالذكاء الاصطناعي بالعربية — سهل" },
      {
        name: "description",
        content:
          "مقالات تطبيقية عن نبرة العلامة العربية، تقويم النشر، الأمان، والمقارنة بين الوكالة والموظف الرقمي.",
      },
      { property: "og:title", content: "مدونة سهل" },
      { property: "og:description", content: "تجارب وأرقام من تشغيل فرق رقمية عربية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const lead = posts[0]!;
  const rest = posts.slice(1);

  return (
    <PageShell>
      <PageHero
        eyebrow="المدونة"
        title="ما تعلّمناه من تشغيل فرق رقمية عربية"
        lead="مقالات قصيرة وعملية — بلا حشو ولا وعود، مع أرقام من الميدان."
      />

      <section className="mx-auto max-w-6xl px-5 py-14">
        <Reveal>
          <Link
            to="/blog/$slug"
            params={{ slug: lead.slug }}
            className="group block overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-card transition-all duration-400 hover:-translate-y-1.5 hover:shadow-lift md:p-12"
          >
            <span className="rounded-full bg-jade/12 px-3 py-1 text-xs font-bold text-jade-deep">
              {lead.category}
            </span>
            <h2 className="mt-5 max-w-3xl font-display text-3xl leading-snug font-black md:text-4xl">
              {lead.title}
            </h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">{lead.excerpt}</p>
            <div className="mt-6 flex items-center gap-4 text-sm text-muted-foreground">
              <span>{lead.author}</span>
              <span className="inline-flex items-center gap-1.5">
                <Clock4 className="size-4" /> {lead.readMinutes} دقائق
              </span>
              <span className="inline-flex items-center gap-1.5 font-bold text-primary">
                اقرأ المقال
                <ArrowLeft className="size-4 transition-transform duration-300 group-hover:-translate-x-1" />
              </span>
            </div>
          </Link>
        </Reveal>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {rest.map((p, i) => (
            <Reveal key={p.slug} delay={i * 70}>
              <Link
                to="/blog/$slug"
                params={{ slug: p.slug }}
                className="flex h-full flex-col rounded-3xl border border-border bg-card p-7 shadow-card transition-all duration-400 hover:-translate-y-1.5 hover:shadow-lift"
              >
                <span className="w-fit rounded-full bg-secondary px-3 py-1 text-xs font-bold text-muted-foreground">
                  {p.category}
                </span>
                <h3 className="mt-4 font-display text-xl leading-snug font-black">{p.title}</h3>
                <p className="mt-3 grow leading-relaxed text-ink-soft">{p.excerpt}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock4 className="size-4" /> {p.readMinutes} دقائق
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <CtaBand />
    </PageShell>
  );
}
