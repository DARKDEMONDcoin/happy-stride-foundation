import { createFileRoute, Link } from "@tanstack/react-router";

import { PageShell, PageHero, CtaBand } from "@/components/site/PageShell";
import { Reveal } from "@/components/Reveal";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "الأسئلة الشائعة | كل ما تريد معرفته قبل التوظيف — سهل" },
      {
        name: "description",
        content:
          "إجابات صريحة عن الخصوصية، جودة العربية، الربط بالحسابات، الإلغاء، والفرق بين سهل وأدوات الكتابة العادية.",
      },
      { property: "og:title", content: "الأسئلة الشائعة — سهل" },
      { property: "og:description", content: "إجابات مباشرة بلا تسويق زائد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: groups.flatMap((g) =>
            g.items.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          ),
        }),
      },
    ],
  }),
  component: FaqPage,
});

const groups = [
  {
    g: "الأساسيات",
    items: [
      {
        q: "ما الفرق بين سهل وأداة كتابة عادية؟",
        a: "الأداة تعطيك نصاً، سهل ينفّذ العمل: يخطط، يصمم، ينشر، يردّ، ويقيس داخل حساباتك — ثم يرفع لك تقريراً بقرار واضح.",
      },
      {
        q: "هل أحتاج خبرة تقنية؟",
        a: "لا. الإعداد بالكامل بالعربية وبضغطات، وأول تشغيل يستغرق ١١ دقيقة في المتوسط.",
      },
      {
        q: "هل يفهم لهجتي؟",
        a: "نعم — الخليجية والمصرية والشامية والمغاربية والفصحى. يتعلم من نصوصك ويلتزم بقائمة الكلمات الممنوعة التي تحدّدها.",
      },
    ],
  },
  {
    g: "الأمان والتحكم",
    items: [
      {
        q: "ما الذي يراه الموظف الرقمي من حساباتي؟",
        a: "فقط ما تسمح به. كل ربط يبدأ بالصلاحية الأدنى، ويمكنك سحبها في ثانية من صفحة الأدوات.",
      },
      {
        q: "هل ينشر شيئاً دون علمي؟",
        a: "لا، ما لم تفعّل التشغيل التلقائي بنفسك لهذه المهمة تحديداً. الافتراضي أن كل إجراء حسّاس يحتاج موافقتك.",
      },
      {
        q: "هل بياناتي تُستخدم لتدريب نماذج عامة؟",
        a: "أبداً. بياناتك مخصّصة لحسابك، ويمكنك تصديرها أو حذفها نهائياً في أي وقت.",
      },
    ],
  },
  {
    g: "الاشتراك والفوترة",
    items: [
      {
        q: "هل التجربة تحتاج بطاقة؟",
        a: "لا. ١٤ يوماً كاملة بمزايا باقة النمو دون إدخال أي وسيلة دفع.",
      },
      {
        q: "كيف ألغي؟",
        a: "بضغطة واحدة من إعدادات الاشتراك. لا مكالمات احتفاظ ولا رسوم إلغاء، وتبقى بياناتك متاحة للتصدير ٣٠ يوماً.",
      },
      {
        q: "هل يمكنني تغيير الباقة لاحقاً؟",
        a: "نعم، صعوداً أو نزولاً في أي وقت، مع احتساب الفرق تناسبياً.",
      },
    ],
  },
];

function FaqPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="الأسئلة الشائعة"
        title="إجابات صريحة، بلا لغة تسويقية"
        lead="لم نجد سؤالك؟ اكتب لنا وسنرد خلال ساعات عمل قليلة."
      />

      <section className="mx-auto max-w-3xl space-y-10 px-5 py-14">
        {groups.map((grp, gi) => (
          <Reveal key={grp.g} delay={gi * 60}>
            <div>
              <h2 className="font-display text-2xl font-black">{grp.g}</h2>
              <div className="mt-4 space-y-3">
                {grp.items.map((it) => (
                  <details
                    key={it.q}
                    className="group rounded-2xl border border-border bg-card p-5 shadow-card transition-colors open:bg-secondary/40"
                  >
                    <summary className="cursor-pointer list-none font-display text-lg font-bold marker:hidden">
                      <span className="flex items-center justify-between gap-4">
                        {it.q}
                        <span className="text-primary transition-transform duration-300 group-open:rotate-45">
                          +
                        </span>
                      </span>
                    </summary>
                    <p className="mt-3 leading-relaxed text-ink-soft">{it.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </Reveal>
        ))}

        <Reveal>
          <div className="rounded-3xl border border-border bg-secondary/50 p-8 text-center">
            <h2 className="font-display text-xl font-black">سؤالك ليس هنا؟</h2>
            <Link
              to="/contact"
              className="mt-5 inline-flex rounded-full bg-foreground px-7 py-3.5 font-bold text-background"
            >
              تواصل معنا
            </Link>
          </div>
        </Reveal>
      </section>

      <CtaBand />
    </PageShell>
  );
}
