import { createFileRoute } from "@tanstack/react-router";
import {
  Languages,
  Clock4,
  ShieldCheck,
  Wand2,
  Plug,
  BarChart3,
  Workflow,
  MessagesSquare,
  FileCheck2,
} from "lucide-react";

import { PageShell, PageHero, CtaBand } from "@/components/site/PageShell";
import { AppRow } from "@/components/site/AppIcon";
import { Reveal } from "@/components/Reveal";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "المزايا | عربية أصيلة، تكامل كامل، وتحكّم مطلق — سهل" },
      {
        name: "description",
        content:
          "لهجة محلية حقيقية، صور بنص عربي سليم، ربط آمن مع 25 تطبيقاً، موافقات قبل التنفيذ، وتقارير تقول لك ماذا تفعل بعدها.",
      },
      { property: "og:title", content: "مزايا منصة سهل" },
      {
        property: "og:description",
        content: "كل ما يجعل فريقك الرقمي يعمل بثقة داخل حساباتك — بالعربية.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FeaturesPage,
});

const pillars = [
  {
    icon: Languages,
    t: "عربية تُكتب لا تُترجَم",
    d: "نبرة خليجية أو مصرية أو شامية أو فصحى — يتعلمها من أمثلتك، ويرفض الكلمات التي تمنعها.",
  },
  {
    icon: Wand2,
    t: "صور بنص عربي سليم",
    d: "توليد بصري بحروف متصلة صحيحة وتشكيل سليم، بهوية علامتك ومقاسات كل منصة.",
  },
  {
    icon: Plug,
    t: "يعمل داخل أدواتك",
    d: "ربط مباشر مع منصات النشر والبريد والمتاجر ولوحات البيانات — بصلاحيات تختارها بنفسك.",
  },
  {
    icon: ShieldCheck,
    t: "موافقة قبل التنفيذ",
    d: "أي إجراء حسّاس يقف عند بابك. تفعّل التشغيل التلقائي حين تثق، وتسحبه في ثانية.",
  },
  {
    icon: Clock4,
    t: "تشغيل 24/7",
    d: "لا إجازات ولا تأخير. العميل يسأل الثالثة فجراً فيجد رداً بنبرتك خلال دقيقتين.",
  },
  {
    icon: BarChart3,
    t: "تقارير بقرار لا بأرقام",
    d: "كل تقرير ينتهي بتوصية واحدة قابلة للتنفيذ، لا بلوحة أرقام تتركك حائراً.",
  },
];

const deep = [
  {
    icon: Workflow,
    t: "مسارات عمل تلقائية",
    d: "اربط الموظفين معاً: نور تكتب المقال، دانة تصمم غلافه، سِراج ينشره، آدم يقيس أثره — بدون تدخل منك.",
    points: ["مشغّلات زمنية أو حدثية", "شروط وموافقات", "تنبيه فوري عند التعثّر"],
  },
  {
    icon: MessagesSquare,
    t: "صندوق موحّد للعملاء",
    d: "كل الرسائل من كل المنصات في مكان واحد، مصنّفة حسب النية: سؤال سعر، شكوى، أو فرصة بيع.",
    points: ["تصنيف تلقائي بالنية", "ردود مقترحة بنبرتك", "تصعيد للفريق البشري"],
  },
  {
    icon: FileCheck2,
    t: "ذاكرة العلامة التجارية",
    d: "ملف واحد يجمع نبرتك، ألوانك، منتجاتك، أسعارك، وأسئلة عملائك — يقرأه كل موظف قبل أي مهمة.",
    points: ["رفع مستندات وروابط", "قائمة كلمات ممنوعة", "تحديث ينعكس فوراً"],
  },
];

const apps = [
  "instagram",
  "x",
  "linkedin",
  "tiktok",
  "facebook",
  "youtube",
  "gmail",
  "outlook",
  "calendar",
  "slack",
  "notion",
  "whatsapp",
  "telegram",
  "hubspot",
  "sheets",
  "drive",
  "wordpress",
  "shopify",
  "figma",
  "canva",
  "analytics",
  "search-console",
  "meta-ads",
  "stripe",
  "zoom",
];

function FeaturesPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="لماذا سهل"
        title="ذكاء اصطناعي يفهم سوقك، لا مجرد نموذج يتكلم عربي"
        lead="بنينا كل تفصيلة حول واقع صاحب المشروع العربي: اللهجة، المنصات، طرق الدفع، وساعات الذروة المحلية."
      />

      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-6 md:grid-cols-3">
          {pillars.map((p, i) => (
            <Reveal key={p.t} delay={i * 60}>
              <div className="h-full rounded-3xl border border-border bg-card p-7 shadow-card transition-all duration-400 hover:-translate-y-1.5 hover:shadow-lift">
                <span className="grid size-12 place-items-center rounded-2xl bg-jade/12 text-jade-deep">
                  <p.icon className="size-6" strokeWidth={2.1} />
                </span>
                <h2 className="mt-5 font-display text-xl font-black">{p.t}</h2>
                <p className="mt-3 leading-relaxed text-ink-soft">{p.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-6 px-5 pb-14">
        {deep.map((d, i) => (
          <Reveal key={d.t} delay={i * 70}>
            <div className="grid gap-6 rounded-3xl border border-border bg-card p-8 shadow-card md:grid-cols-[1fr_1fr] md:items-center">
              <div>
                <span className="grid size-12 place-items-center rounded-2xl bg-amber/15 text-amber">
                  <d.icon className="size-6" strokeWidth={2.1} />
                </span>
                <h2 className="mt-5 font-display text-2xl font-black">{d.t}</h2>
                <p className="mt-3 leading-relaxed text-ink-soft">{d.d}</p>
              </div>
              <ul className="grid gap-3">
                {d.points.map((p) => (
                  <li
                    key={p}
                    className="rounded-2xl bg-secondary/60 px-5 py-4 font-medium shadow-card"
                  >
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <Reveal>
          <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-card">
            <h2 className="font-display text-2xl font-black">يتصل بـ 25 تطبيقاً تستخدمه فعلاً</h2>
            <p className="mt-3 text-muted-foreground">
              ربط بضغطتين، صلاحيات أدنى افتراضياً، وإلغاء في أي لحظة.
            </p>
            <AppRow apps={apps} className="mt-7 justify-center" />
          </div>
        </Reveal>
      </section>

      <CtaBand
        title="جرّبها على حساباتك أنت"
        lead="١٤ يوماً مجاناً، بدون بطاقة، وبتصدير كامل لبياناتك متى شئت."
      />
    </PageShell>
  );
}
