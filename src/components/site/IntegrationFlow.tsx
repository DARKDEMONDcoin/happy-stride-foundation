import { Link } from "@tanstack/react-router";
import { Reveal } from "@/components/Reveal";
import { TeamOrbit } from "@/components/site/TeamOrbit";

export function IntegrationFlow() {
  return (
    <section className="relative overflow-hidden bg-foreground py-24 text-background sm:py-28">
      <div
        aria-hidden
        className="integration-grid integration-grid-wave absolute inset-0 opacity-70"
      />
      <div className="relative mx-auto max-w-6xl px-5">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 text-sm font-bold text-amber">
              منظومة واحدة بدلاً من أدوات متفرقة
            </span>
            <h2 className="mt-4 font-display text-4xl leading-tight font-black sm:text-5xl">
              حساباتك تدخل من هنا،
              <span className="text-amber"> وفريقك يتولّى الباقي</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-background/70 sm:text-lg">
              اربط منصاتك مرة واحدة. يفهم موظفو سهل السياق، ينسّقون العمل معاً، ثم ينفّذون داخل
              أدواتك بعد موافقتك.
            </p>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="integration-team-stage relative mx-auto mt-12 max-w-6xl" dir="rtl">
            <div className="integration-team-status">
              <span>
                <i /> فريقك يعمل الآن
              </span>
              <strong>كل مهمة تصل إلى المتخصص المناسب</strong>
            </div>
            <TeamOrbit compact mapCenter dark />

            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-background/65">
              {["صلاحيات تحددها أنت", "موافقتك قبل النشر", "تفصل أي حساب فوراً"].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-amber/80" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={220}>
          <div className="mt-10 text-center">
            <Link
              to="/integrations"
              className="group inline-flex items-center gap-2 font-bold text-amber transition-colors hover:text-background"
            >
              شاهد كل التكاملات
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
