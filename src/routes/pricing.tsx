import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Check,
  Minus,
  ShieldCheck,
  X,
} from "lucide-react";

import { PageShell, CtaBand } from "@/components/site/PageShell";
import { PricingBeyondHero } from "@/components/site/PricingBeyondHero";

import { Reveal } from "@/components/Reveal";
import { plans, priceOf, currencyOf, yearlyDiscount } from "@/data/pricing";
import { useRegion } from "@/hooks/use-region";
import { RegionPicker } from "@/components/site/Portrait";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/site/LogoMark";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "الأسعار | فريق كامل بأقل من راتب موظف واحد — سهل" },
      {
        name: "description",
        content:
          "ثلاث باقات واضحة بدون رسوم خفية: البداية، النمو، والمؤسسات. جرّب 14 يوماً مجاناً وألغِ في أي وقت.",
      },
      { property: "og:title", content: "أسعار سهل" },
      {
        property: "og:description",
        content: "ابدأ بـ 149 ريالاً شهرياً لموظف رقمي كامل يعمل 24/7 بالعربية.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

// الباقات مصدرها ملف واحد مشترك مع قسم الأسعار في الصفحة الرئيسية.

const matrix: { f: string; v: (boolean | string)[] }[] = [
  { f: "عدد الموظفين الرقميين", v: ["1", "6", "6+"] },
  { f: "المهام الشهرية", v: ["60", "1000", "غير محدودة"] },
  { f: "النشر التلقائي على 8 منصات", v: [true, true, true] },
  { f: "مسارات عمل بين الموظفين", v: [false, true, true] },
  { f: "صندوق العملاء الموحّد", v: [false, true, true] },
  { f: "سجل تدقيق وتصدير كامل", v: [true, true, true] },
  { f: "صلاحيات فريق متعددة", v: [false, false, true] },
  { f: "مدير حساب مخصص", v: [false, false, true] },
];

function PricingPage() {
  const { country } = useRegion();
  const cur = currencyOf(country);
  const [mobilePlan, setMobilePlan] = useState<(typeof plans)[number]["id"]>("growth");
  const [yearly, setYearly] = useState(true);
  const selected = plans.find((plan) => plan.id === mobilePlan);
  if (!selected) return null;
  return (
    <PageShell className="sahl-pricing-shell bg-background" hideFooterOnMobile>
      <section className="sahl-upgrade md:hidden" aria-labelledby="mobile-pricing-title">
        <div className="sahl-upgrade-dots" aria-hidden="true" />
        <div className="sahl-upgrade-inner">
          <div className="sahl-upgrade-topbar">
            <span className="sahl-upgrade-brand" aria-hidden="true">
              <LogoMark size={18} />
            </span>
            <Button asChild variant="ghost" size="icon" className="sahl-upgrade-close">
              <Link to="/" aria-label="إغلاق صفحة الأسعار">
                <X strokeWidth={1.8} />
              </Link>
            </Button>
          </div>

          <header className="sahl-upgrade-heading">
            <p>فريقك الرقمي يبدأ من هنا</p>
            <h1 id="mobile-pricing-title">اختر باقتك</h1>
          </header>

          <div className="sahl-upgrade-tabs" role="tablist" aria-label="باقات سهل">
            {plans.map((plan) => (
              <Button
                key={plan.id}
                type="button"
                variant="ghost"
                role="tab"
                aria-selected={mobilePlan === plan.id}
                onClick={() => setMobilePlan(plan.id)}
                className={mobilePlan === plan.id ? "is-active" : undefined}
              >
                {plan.name}
              </Button>
            ))}
          </div>

          <div className="sahl-upgrade-plan" role="tabpanel">
            <div className="sahl-upgrade-plan-title">
              <div className="min-w-0">
                <h2>باقة {selected.name}</h2>
                <p>{selected.tag}</p>
              </div>
              {selected.highlight ? <span>الأكثر اختياراً</span> : null}
            </div>

            <div className="sahl-upgrade-perks">
              <ul>
                {selected.perks.map((perk, index) => {
                  const tone = index % 3 === 0 ? "primary" : index % 3 === 1 ? "gold" : "jade";
                  return (
                    <li key={perk}>
                      <span className="sahl-upgrade-perk-check" data-tone={tone} aria-hidden="true">
                        <Check strokeWidth={2.4} />
                      </span>
                      <span>{perk}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {selected.monthly === null ? (
              <div className="sahl-upgrade-custom-offer">
                <strong>عرض مخصص حسب احتياجك</strong>
                <span>حل مرن حسب حجم فريقك وفروعك</span>
              </div>
            ) : (
              <>
                <div className="sahl-upgrade-billing" role="radiogroup" aria-label="دورة الفوترة">
                  <Button
                    type="button"
                    variant="ghost"
                    role="radio"
                    aria-checked={!yearly}
                    onClick={() => setYearly(false)}
                    className={!yearly ? "is-selected" : undefined}
                  >
                    <span className="sahl-upgrade-radio" aria-hidden="true"><i /></span>
                    <span className="sahl-upgrade-cycle">شهري</span>
                    <strong>{`${priceOf(selected, false, country)} ${cur.label}`}</strong>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    role="radio"
                    aria-checked={yearly}
                    onClick={() => setYearly(true)}
                    className={yearly ? "is-selected" : undefined}
                  >
                    <span className="sahl-upgrade-radio" aria-hidden="true"><i /></span>
                    <span className="sahl-upgrade-cycle">سنوي <small>وفّر {yearlyDiscount * 100}%</small></span>
                    <strong>{`${priceOf(selected, true, country)} ${cur.label}`}</strong>
                  </Button>
                </div>

                <p className="sahl-upgrade-note">
                  {yearly
                    ? `${priceOf(selected, true, country)} ${cur.label} شهرياً، تُدفع سنوياً بعد التجربة المجانية.`
                    : `${priceOf(selected, false, country)} ${cur.label} شهرياً بعد ١٤ يوماً مجاناً.`}
                </p>
              </>
            )}

            <Button asChild className="sahl-upgrade-cta">
              {selected.id === "scale" ? (
                <Link to="/contact">{selected.cta}</Link>
              ) : (
                <Link to="/auth" search={{ mode: "signup", plan: selected.id }}>
                  {selected.cta}
                </Link>
              )}
            </Button>

            <p className="sahl-upgrade-trust">
              <ShieldCheck /> بدون بطاقة · إلغاء فوري · بيانات مشفّرة
            </p>
          </div>

          <nav className="sahl-upgrade-legal" aria-label="روابط قانونية">
            <Link to="/terms">الشروط</Link><span>·</span>
            <Link to="/privacy">الخصوصية</Link><span>·</span>
            <Link to="/refunds">الاسترداد</Link>
          </nav>
        </div>
      </section>

      <div className="hidden md:block">
        <PricingBeyondHero />


        <section className="mx-auto max-w-6xl px-5 py-14">
          <div className="mb-8 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
            <span>العملة حسب بلدك:</span>
            <RegionPicker />
          </div>
          <div className="pricing-desktop-grid grid grid-cols-3 gap-6">
            {plans.map((p, i) => (
              <Reveal key={p.id} delay={i * 70} className="pricing-desktop-reveal">
                <div
                  className={`pricing-desktop-card ${p.highlight ? "is-featured" : ""}`}
                >
                  {p.highlight ? (
                    <span className="pricing-desktop-badge">الأكثر اختياراً</span>
                  ) : null}

                  <header className="pricing-desktop-card-head">
                    <h2>{p.name}</h2>
                    <p>{p.desc}</p>
                  </header>

                  <div className={`pricing-desktop-price ${p.monthly === null ? "is-custom" : ""}`}>
                    <strong>{priceOf(p, false, country)}</strong>
                    {p.monthly !== null ? <span>{cur.label} / شهرياً</span> : null}
                  </div>

                  <div className="pricing-desktop-divider" aria-hidden="true" />

                  <ul className="pricing-desktop-perks">
                    {p.perks.map((perk, index) => {
                      const tone = index % 3 === 0 ? "teal" : index % 3 === 1 ? "gold" : "brick";
                      return (
                        <li key={perk}>
                          <span className="pricing-desktop-perk-icon" data-tone={tone}>
                            <Check strokeWidth={2.4} />
                          </span>
                          <span>{perk}</span>
                        </li>
                      );
                    })}
                  </ul>

                  <Button asChild variant="outline" className="pricing-desktop-cta">
                    {p.id === "scale" ? (
                      <Link to="/contact">{p.cta}</Link>
                    ) : (
                      <Link to="/auth" search={{ mode: "signup", plan: p.id }}>
                        {p.cta}
                      </Link>
                    )}
                  </Button>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 pb-16">
          <Reveal>
            <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-card">
              <table className="w-full min-w-[36rem] text-right">
                <thead>
                  <tr className="border-b border-border text-sm">
                    <th className="p-5 font-display text-base font-black">المقارنة</th>
                    {plans.map((p) => (
                      <th key={p.id} className="p-5 font-display text-base font-black">
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row) => (
                    <tr key={row.f} className="border-b border-border/70 last:border-0">
                      <td className="p-5 font-medium">{row.f}</td>
                      {row.v.map((v, idx) => (
                        <td key={idx} className="p-5">
                          {typeof v === "boolean" ? (
                            v ? (
                              <Check className="size-5 text-jade-deep" strokeWidth={3} />
                            ) : (
                              <Minus className="size-5 text-muted-foreground" />
                            )
                          ) : (
                            <span className="font-bold">{v}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            كل الباقات تشمل: تشفير البيانات، تصدير كامل في أي وقت، وإلغاء بضغطة دون مكالمة احتفاظ. الأسعار لا تشمل ضريبة القيمة المضافة؛ تُضاف عند الفوترة حسب بلدك.
          </p>
        </section>

        <CtaBand title="جرّب قبل أن تدفع" lead="١٤ يوماً كاملة بكل مزايا باقة النمو، بدون بطاقة." />
      </div>
    </PageShell>
  );
}
