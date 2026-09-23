import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Clock4, ArrowRight } from "lucide-react";

import { PageShell, PageHero, CtaBand } from "@/components/site/PageShell";
import { Reveal } from "@/components/Reveal";
import { posts, getPost } from "@/data/blog";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = getPost(params.slug);
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "المقال غير متاح — سهل" }, { name: "robots", content: "noindex" }],
      };
    }
    const { post } = loaderData;
    return {
      meta: [
        { title: `${post.title} — مدونة سهل` },
        { name: "description", content: post.excerpt.slice(0, 155) },
        { property: "og:title", content: post.title },
        { property: "og:description", content: post.excerpt.slice(0, 155) },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  notFoundComponent: PostNotFound,
  component: PostPage,
});

function PostNotFound() {
  return (
    <PageShell>
      <PageHero eyebrow="المدونة" title="لم نجد هذا المقال" lead="ربما تغيّر الرابط أو حُذف." />
      <div className="py-16 text-center">
        <Link
          to="/blog"
          className="rounded-full bg-foreground px-7 py-3.5 font-bold text-background"
        >
          العودة إلى المدونة
        </Link>
      </div>
    </PageShell>
  );
}

function PostPage() {
  const { post } = Route.useLoaderData();
  const others = posts.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <PageShell>
      <PageHero eyebrow={post.category} title={post.title} lead={post.excerpt}>
        <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm text-white/80">
          <span>{post.author}</span>
          <span className="inline-flex items-center gap-1.5">
            <Clock4 className="size-4" /> {post.readMinutes} دقائق قراءة
          </span>
          <time dateTime={post.date}>{post.date}</time>
        </div>
      </PageHero>

      <article className="mx-auto max-w-3xl px-5 py-14">
        {post.body.map((sec, i) => (
          <Reveal key={sec.h} delay={i * 50}>
            <section className="mb-9">
              <h2 className="font-display text-2xl font-black">{sec.h}</h2>
              <p className="mt-3 text-lg leading-[2] text-ink-soft">{sec.p}</p>
            </section>
          </Reveal>
        ))}

        <Reveal>
          <div className="rounded-3xl border border-border bg-secondary/50 p-8">
            <h2 className="font-display text-xl font-black">طبّق ما قرأته اليوم</h2>
            <p className="mt-2 leading-relaxed text-ink-soft">
              شغّل موظفاً رقمياً واحداً على حسابك، وقارن نتائج أسبوعين.
            </p>
            <Link
              to="/contact"
              className="mt-5 inline-flex rounded-full bg-foreground px-7 py-3.5 font-bold text-background"
            >
              اطلب حسابك
            </Link>
          </div>
        </Reveal>
      </article>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <h2 className="font-display text-2xl font-black">اقرأ أيضاً</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {others.map((p) => (
            <Link
              key={p.slug}
              to="/blog/$slug"
              params={{ slug: p.slug }}
              className="group rounded-3xl border border-border bg-card p-6 shadow-card transition-all duration-400 hover:-translate-y-1.5 hover:shadow-lift"
            >
              <h3 className="font-display text-lg leading-snug font-black">{p.title}</h3>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                <ArrowRight className="size-4 rotate-180 transition-transform duration-300 group-hover:-translate-x-1" />
                اقرأ
              </span>
            </Link>
          ))}
        </div>
      </section>

      <CtaBand />
    </PageShell>
  );
}
