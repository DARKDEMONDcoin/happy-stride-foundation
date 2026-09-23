import { Link } from "@tanstack/react-router";
import { Reveal } from "@/components/Reveal";

export function CtaFooter() {
  return (
    <>
      <section id="cta" className="scroll-mt-24 px-5 pb-24">
        <Reveal>
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] p-10 text-center md:p-20">
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                backgroundImage: "var(--gradient-aurora)",
                backgroundSize: "200% 200%",
                animation: "aurora-shift 18s ease-in-out infinite",
              }}
            />
            <div aria-hidden className="grid-lines absolute inset-0 opacity-40" />
            <div className="relative">
              <h2 className="font-display text-4xl leading-tight font-black text-white md:text-6xl">
                فريقك الجديد جاهز للعمل الليلة
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-white/90">
                ابدأ مجاناً بدون بطاقة ائتمان. أول منشور خلال دقائق، وأول تقرير خلال أسبوع.
              </p>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <Link
                  to="/auth"
                  search={{ mode: "signup" as const }}
                  className="cta-glow-button group inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-4 font-bold text-background transition-transform duration-300 hover:-translate-y-1"
                >
                  وظّف فريقك الآن
                </Link>
                <Link
                  to="/pricing"
                  className="inline-flex items-center rounded-full border border-white/60 bg-white/15 px-7 py-4 font-semibold text-white backdrop-blur transition-colors hover:bg-white/25"
                >
                  شاهد الأسعار
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
