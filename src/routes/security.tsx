import { createFileRoute } from "@tanstack/react-router";
import { Lock, KeyRound, ScrollText, EyeOff, ServerCog, UserCheck } from "lucide-react";

import { PageShell, PageHero, CtaBand } from "@/components/site/PageShell";
import { Reveal } from "@/components/Reveal";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "الأمان | تشفير، صلاحيات دنيا، وسجل تدقيق كامل — سهل" },
      {
        name: "description",
        content:
          "كيف نحمي حساباتك: تشفير أثناء النقل والتخزين، خزنة أسرار منفصلة، صلاحيات قابلة للسحب، وسجل تدقيق لكل إجراء.",
      },
      { property: "og:title", content: "الأمان في سهل" },
      { property: "og:description", content: "تحكّم كامل، وسجل يوضح من فعل ماذا ومتى." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SecurityPage,
});

const items = [
  { icon: Lock, t: "تشفير شامل", d: "TLS أثناء النقل وتشفير على مستوى القرص أثناء التخزين." },
  {
    icon: KeyRound,
    t: "خزنة أسرار منفصلة",
    d: "رموز الوصول لحساباتك تُحفظ معزولة عن بيانات التطبيق.",
  },
  { icon: UserCheck, t: "صلاحيات دنيا", d: "كل ربط يبدأ بأقل صلاحية ممكنة، وتسحبها في ثانية." },
  { icon: EyeOff, t: "لا تدريب على بياناتك", d: "محتواك لا يُستخدم لتدريب نماذج عامة، أبداً." },
  { icon: ScrollText, t: "سجل تدقيق", d: "كل إجراء مسجَّل: من، ماذا، متى، وعلى أي حساب." },
  { icon: ServerCog, t: "عزل بين العملاء", d: "بيانات كل حساب معزولة منطقياً بسياسات وصول صارمة." },
];

const practices = [
  "مصادقة ثنائية اختيارية لكل مستخدم",
  "تنبيه فوري عند أي ربط أو تغيير صلاحية",
  "نسخ احتياطي يومي مع اختبار استرجاع دوري",
  "مراجعة أمنية للتبعيات البرمجية بشكل مستمر",
  "حذف نهائي للبيانات خلال ٣٠ يوماً من الطلب",
  "قناة إبلاغ عن الثغرات: security@sahl.ai",
];

function SecurityPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="الأمان"
        title="نعمل داخل حساباتك، فنتعامل مع ذلك بجدية"
        lead="لا يمكن أن نطلب ثقتك دون أن نشرح بالضبط كيف نحمي ما تعطينا إياه."
      />

      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-6 md:grid-cols-3">
          {items.map((it, i) => (
            <Reveal key={it.t} delay={i * 60}>
              <div className="h-full rounded-3xl border border-border bg-card p-7 shadow-card">
                <span className="grid size-12 place-items-center rounded-2xl bg-jade/12 text-jade-deep">
                  <it.icon className="size-6" strokeWidth={2.1} />
                </span>
                <h2 className="mt-5 font-display text-xl font-black">{it.t}</h2>
                <p className="mt-3 leading-relaxed text-ink-soft">{it.d}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="mt-10 rounded-3xl border border-border bg-secondary/50 p-8">
            <h2 className="font-display text-2xl font-black">ممارسات تشغيلية</h2>
            <ul className="mt-5 grid gap-3 md:grid-cols-2">
              {practices.map((p) => (
                <li key={p} className="rounded-2xl bg-card px-5 py-4 font-medium shadow-card">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      <CtaBand title="ابدأ بثقة" lead="فعّل الموافقة المسبقة، واسحب أي صلاحية متى شئت." />
    </PageShell>
  );
}
