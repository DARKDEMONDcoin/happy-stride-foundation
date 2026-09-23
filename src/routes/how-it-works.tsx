import { createFileRoute, Link } from "@tanstack/react-router";
import { UserPlus, Sliders, PlugZap, Rocket, LineChart } from "lucide-react";

import { PageShell, PageHero, CtaBand } from "@/components/site/PageShell";
import { Reveal } from "@/components/Reveal";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "كيف يعمل سهل | من التسجيل إلى أول منشور في 11 دقيقة" },
      {
        name: "description",
        content:
          "خمس خطوات واضحة: أنشئ حسابك، عرّفنا على علامتك، اربط أدواتك، وافق على الخطة، ثم راقب النتائج أسبوعياً.",
      },
      { property: "og:title", content: "كيف يعمل سهل" },
      {
        property: "og:description",
        content: "أول منشور خلال دقائق وأول تقرير خلال أسبوع — بدون فريق إضافي.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HowPage,
});

const steps = [
  {
    icon: UserPlus,
    t: "أنشئ حسابك",
    d: "دقيقة واحدة بالبريد أو جوجل. بدون بطاقة ائتمان وبدون مكالمة مبيعات.",
    time: "١ دقيقة",
  },
  {
    icon: Sliders,
    t: "عرّفنا على علامتك",
    d: "اسم النشاط، اللهجة، الجمهور، الألوان، وعشرة نصوص تفتخر بها. هذه هي ذاكرة فريقك.",
    time: "٥ دقائق",
  },
  {
    icon: PlugZap,
    t: "اربط أدواتك",
    d: "اختر الحسابات التي يعمل عليها كل موظف، وحدّد صلاحيته: نشر فقط، أو نشر ورد، أو قراءة فقط.",
    time: "٣ دقائق",
  },
  {
    icon: Rocket,
    t: "وافق على أول خطة",
    d: "يعرض عليك الفريق تقويم أسبوعك الأول. عدّل ما تريد بضغطة، ثم اضغط «اعتماد».",
    time: "٢ دقيقة",
  },
  {
    icon: LineChart,
    t: "راقب وقرّر",
    d: "تقرير أسبوعي بتوصية واحدة قابلة للتنفيذ. توسّع في ما ينجح، وتوقف عمّا لا ينجح.",
    time: "أسبوعياً",
  },
];

function HowPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="التشغيل"
        title="من التسجيل إلى أول منشور في 11 دقيقة"
        lead="لا تدريب معقّد ولا استشاري. تُعرّفنا على علامتك مرة واحدة، ويتكفّل الفريق بالباقي."
      />

      <section className="mx-auto max-w-4xl px-5 py-14">
        <ol className="relative space-y-6 border-r-2 border-dashed border-border pr-8">
          {steps.map((s, i) => (
            <Reveal key={s.t} delay={i * 70}>
              <li className="relative rounded-3xl border border-border bg-card p-7 shadow-card">
                <span
                  className="absolute -right-[3.05rem] top-8 grid size-10 place-items-center rounded-2xl text-white shadow-lift"
                  style={{ backgroundImage: "var(--gradient-aurora)" }}
                >
                  <s.icon className="size-5" strokeWidth={2.2} />
                </span>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-xl font-black">
                    {i + 1}. {s.t}
                  </h2>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-muted-foreground">
                    {s.time}
                  </span>
                </div>
                <p className="mt-3 leading-relaxed text-ink-soft">{s.d}</p>
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal>
          <div className="mt-10 rounded-3xl border border-border bg-secondary/50 p-8 text-center">
            <h2 className="font-display text-xl font-black">وماذا لو لم يعجبك المخرج؟</h2>
            <p className="mt-3 leading-relaxed text-ink-soft">
              اضغط «أعد المحاولة» مع سطر واحد يشرح ما تريد تغييره. يتعلّم الموظف من تصحيحك ولا يكرّر
              الخطأ في المهام القادمة.
            </p>
            <Link
              to="/app"
              className="mt-6 inline-flex rounded-full bg-foreground px-7 py-3.5 font-bold text-background transition-transform duration-300 hover:-translate-y-1"
            >
              ابدأ الآن مجاناً
            </Link>
          </div>
        </Reveal>
      </section>

      <CtaBand />
    </PageShell>
  );
}
