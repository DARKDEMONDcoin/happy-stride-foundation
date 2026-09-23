import { createFileRoute } from "@tanstack/react-router";
import { Compass, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";

import { PageShell, PageHero, CtaBand } from "@/components/site/PageShell";
import { Reveal } from "@/components/Reveal";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "من نحن | بنينا سهل لصاحب المشروع العربي" },
      {
        name: "description",
        content:
          "قصة سهل ومبادئه: عربية أصيلة أولاً، تحكّم كامل للمستخدم، وشفافية في الأسعار والنتائج.",
      },
      { property: "og:title", content: "من نحن — سهل" },
      { property: "og:description", content: "لماذا بنينا فريق موظفين رقميين يعمل بالعربية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});

const values = [
  {
    icon: Compass,
    t: "العربية ليست ميزة إضافية",
    d: "بنينا الأدوات حول اللغة واللهجات والاتجاه من اليمين، لا كترجمة لواجهة إنجليزية.",
  },
  {
    icon: ShieldCheck,
    t: "التحكم يبقى معك",
    d: "أي إجراء يمكن إيقافه، ومراجعته، وتصديره. لا صندوق أسود ولا قرارات خفية.",
  },
  {
    icon: HeartHandshake,
    t: "نجاحك هو المقياس",
    d: "لا نقيس نجاحنا بعدد الكلمات المولَّدة، بل بالساعات التي وفّرناها والطلبات التي أتت.",
  },
  {
    icon: Sparkles,
    t: "بساطة قاسية",
    d: "كل شاشة تُختبر مع صاحب مشروع حقيقي. إن احتاجت شرحاً، نعيد تصميمها.",
  },
];

const milestones = [
  { y: "٢٠٢٤", t: "الفكرة", d: "بدأنا بمشكلة واحدة: صاحب متجر ينشر مرة أسبوعياً لأن لا وقت لديه." },
  {
    y: "٢٠٢٥",
    t: "أول ١٠٠ مشروع",
    d: "شغّلنا سِراج ودانة مع مئة مشروع في السعودية ومصر والإمارات.",
  },
  { y: "٢٠٢٦", t: "الفريق الكامل", d: "أطلقنا الفريق الكامل: ستة موظفين رقميين ومسارات عمل تربطهم ببعض تلقائياً، متاحون اليوم لكل مشترك." },
];

function AboutPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="من نحن"
        title="بنينا الفريق الذي تمنّينا وجوده حين بدأنا"
        lead="سهل شركة منتجات تقنية عربية، هدفها أن يحصل كل صاحب مشروع على قوة فريق تسويق ومبيعات كامل — من هاتفه."
      />

      <section className="mx-auto max-w-4xl px-5 py-14">
        <Reveal>
          <p className="text-xl leading-[2.1] text-ink-soft">
            رأينا نفس المشهد يتكرر: صاحب مشروع بارع في منتجه، لكنه يخسر أسواقاً لأنه لا يملك وقتاً
            للنشر، ولا ميزانية لوكالة، ولا صبراً على أدوات مكتوبة بلغة لا تشبه عملاءه. فبدل بناء
            «أداة كتابة» أخرى، بنينا زملاء عمل: كل واحد له دور واضح، يعمل داخل حساباتك، ويرفع تقريره
            في نهاية الأسبوع.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {values.map((v, i) => (
            <Reveal key={v.t} delay={i * 60}>
              <div className="h-full rounded-3xl border border-border bg-card p-7 shadow-card">
                <span className="grid size-12 place-items-center rounded-2xl bg-jade/12 text-jade-deep">
                  <v.icon className="size-6" strokeWidth={2.1} />
                </span>
                <h2 className="mt-5 font-display text-xl font-black">{v.t}</h2>
                <p className="mt-3 leading-relaxed text-ink-soft">{v.d}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {milestones.map((m, i) => (
            <Reveal key={m.y} delay={i * 60}>
              <div className="rounded-3xl bg-secondary/60 p-6">
                <span className="font-display text-3xl font-black text-primary">{m.y}</span>
                <h3 className="mt-3 font-display text-lg font-black">{m.t}</h3>
                <p className="mt-2 leading-relaxed text-ink-soft">{m.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <CtaBand title="انضم إلى المشاريع التي كفّت عن التأجيل" />
    </PageShell>
  );
}
