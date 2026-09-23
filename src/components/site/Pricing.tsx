import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Reveal } from "@/components/Reveal";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { plans, priceOf, currencyOf } from "@/data/pricing";
import { useRegion } from "@/hooks/use-region";
import { cn } from "@/lib/utils";

export function Pricing() {
  const [yearly, setYearly] = useState(true);
  const { country, countryInfo } = useRegion();
  const cur = currencyOf(country);

  return (
    <section id="pricing" className="scroll-mt-24 border-y border-border bg-secondary/40 py-24">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal>
          <div className="text-center">
            <p className="text-sm font-bold tracking-wider text-primary">الأسعار</p>
            <h2 className="mt-3 font-display text-4xl font-black md:text-5xl">
              أرخص من راتب متدرّب
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              ابدأ مجاناً وارتقِ وقت ما تحتاج. بدون عقود، وبدون رسوم مخفية.
            </p>
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
              الأسعار معروضة بعملة {countryInfo.name} ({cur.code}) تقريبياً — وتُحاسب بالريال
              السعودي أو الدولار.
            </p>
            <div className="mt-7 inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
              {[
                { l: "سنوي · وفّر 20%", v: true },
                { l: "شهري", v: false },
              ].map((o) => (
                <button
                  key={o.l}
                  onClick={() => setYearly(o.v)}
                  className={cn(
                    "rounded-full px-5 py-2 text-sm font-bold transition-all duration-300",
                    yearly === o.v
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="mt-12 grid items-start gap-5 md:grid-cols-3">
          {plans.map((p, i) => {
            const price = priceOf(p, yearly, country);
            const numeric = Number(price.replace(/,/g, ""));
            return (
              <Reveal key={p.name} delay={i * 90}>
                <article
                  className={cn(
                    "pricing-liquid-glass relative h-full rounded-3xl border p-8 transition-all duration-400 hover:-translate-y-1",
                    p.highlight
                      ? "is-highlight pricing-glow border-transparent shadow-lift"
                      : "border-border shadow-card",
                  )}
                  style={p.highlight ? { backgroundImage: "var(--gradient-ink)" } : undefined}
                >
                  <span
                    className={cn(
                      "inline-block rounded-full px-3 py-1 text-xs font-bold",
                      p.highlight ? "bg-amber text-ink" : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {p.tag}
                  </span>
                  <h3
                    className={cn(
                      "mt-4 font-display text-2xl font-black",
                      p.highlight && "text-background",
                    )}
                  >
                    {p.name}
                  </h3>
                  <p
                    className={cn(
                      "mt-1 text-sm",
                      p.highlight ? "text-background/70" : "text-muted-foreground",
                    )}
                  >
                    {p.desc}
                  </p>

                  <div className="mt-6 flex items-end gap-1.5">
                    <span
                      className={cn(
                        "font-display text-5xl font-black tabular-nums",
                        p.highlight && "text-background",
                      )}
                    >
                      {Number.isFinite(numeric) ? <AnimatedNumber value={numeric} /> : price}
                    </span>
                    <span
                      className={cn(
                        "pb-2 text-sm",
                        p.highlight ? "text-background/70" : "text-muted-foreground",
                      )}
                    >
                      {p.monthly === null ? "" : `${cur.label} / شهرياً`}
                    </span>
                  </div>

                  {p.id === "scale" ? (
                    <Link
                      to="/contact"
                      className={cn(
                        "mt-6 block rounded-full py-3 text-center font-bold transition-transform duration-300 hover:-translate-y-0.5",
                        p.highlight
                          ? "bg-background text-foreground"
                          : "bg-foreground text-background",
                      )}
                    >
                      {p.cta}
                    </Link>
                  ) : (
                    <Link
                      to="/auth"
                      search={{ mode: "signup", plan: p.id }}
                      className={cn(
                        "mt-6 block rounded-full py-3 text-center font-bold transition-transform duration-300 hover:-translate-y-0.5",
                        p.highlight
                          ? "bg-background text-foreground"
                          : "bg-foreground text-background",
                      )}
                    >
                      {p.cta}
                    </Link>
                  )}

                  <ul className="mt-7 space-y-3">
                    {p.perks.map((f, pi) => (
                      <li
                        key={f}
                        className="perk-row flex items-start gap-2.5"
                        style={{ animationDelay: `${i * 90 + pi * 70}ms` }}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "mt-2 size-1.5 shrink-0 rounded-full",
                            p.highlight ? "bg-amber" : "bg-jade-deep",
                          )}
                        />
                        <span
                          className={cn(
                            "text-sm",
                            p.highlight ? "text-background/90" : "text-ink-soft",
                          )}
                        >
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
