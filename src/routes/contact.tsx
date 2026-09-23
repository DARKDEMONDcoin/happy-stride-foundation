import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageSquare, Phone, CheckCircle2 } from "lucide-react";

import { PageShell, PageHero } from "@/components/site/PageShell";
import { Reveal } from "@/components/Reveal";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "تواصل معنا | نرد خلال ساعات عمل قليلة — سهل" },
      {
        name: "description",
        content: "اسأل عن الباقات، اطلب عرضاً للمؤسسات، أو احصل على دعم تقني بالعربية.",
      },
      { property: "og:title", content: "تواصل مع فريق سهل" },
      { property: "og:description", content: "مبيعات، دعم، وشراكات — بالعربية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

const channels = [
  { icon: Mail, t: "البريد", d: "hello@sahl.ai", s: "رد خلال يوم عمل واحد" },
  { icon: MessageSquare, t: "الدردشة", d: "من داخل لوحة التحكم", s: "رد خلال ٣ ساعات" },
  {
    icon: Phone,
    t: "المؤسسات",
    d: "راسلنا على hello@sahl.ai لحجز مكالمة ٣٠ دقيقة",
    s: "لفرق ١٠+ مستخدمين",
  },
  { icon: Mail, t: "بلاغات الأمان", d: "security@sahl.ai", s: "للإبلاغ عن الثغرات" },
];

const inputCls =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 outline-none transition-colors focus:border-primary";

function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <PageShell>
      <PageHero
        eyebrow="تواصل معنا"
        title="نحب الأسئلة الصعبة"
        lead="اكتب لنا سؤالك بالتفصيل، وسيرد عليك إنسان — لا رد آلي."
      />

      <section className="mx-auto grid max-w-5xl gap-8 px-5 py-14 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          {channels.map((c, i) => (
            <Reveal key={c.t} delay={i * 60}>
              <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
                <span className="grid size-11 place-items-center rounded-2xl bg-amber/15 text-amber">
                  <c.icon className="size-5" strokeWidth={2.1} />
                </span>
                <h2 className="mt-4 font-display text-lg font-black">{c.t}</h2>
                <p className="mt-1 font-semibold">{c.d}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.s}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={80}>
          <div className="rounded-3xl border border-border bg-card p-8 shadow-card">
            {sent ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="mx-auto size-12 text-jade-deep" />
                <h2 className="mt-4 font-display text-2xl font-black">وصلتنا رسالتك</h2>
                <p className="mt-2 text-ink-soft">سنرد على بريدك خلال يوم عمل واحد.</p>
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSent(true);
                }}
              >
                <h2 className="font-display text-2xl font-black">أرسل رسالة</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-bold" htmlFor="name">
                      الاسم
                    </label>
                    <input id="name" required className={inputCls} placeholder="اسمك الكريم" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-bold" htmlFor="email">
                      البريد الإلكتروني
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      className={inputCls}
                      placeholder="you@company.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-bold" htmlFor="topic">
                    الموضوع
                  </label>
                  <select id="topic" className={inputCls}>
                    <option>استفسار عن الباقات</option>
                    <option>عرض للمؤسسات</option>
                    <option>دعم تقني</option>
                    <option>شراكة</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-bold" htmlFor="msg">
                    رسالتك
                  </label>
                  <textarea
                    id="msg"
                    required
                    rows={5}
                    className={inputCls}
                    placeholder="أخبرنا عن نشاطك وما تحتاجه بالضبط…"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-full bg-foreground py-3.5 font-bold text-background transition-transform duration-300 hover:-translate-y-0.5"
                >
                  إرسال
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  بالإرسال أنت توافق على سياسة الخصوصية. لا نشارك بريدك مع أحد.
                </p>
              </form>
            )}
          </div>
        </Reveal>
      </section>
    </PageShell>
  );
}
