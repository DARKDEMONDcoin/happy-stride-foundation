import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Nav } from "@/components/site/Nav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Reveal } from "@/components/Reveal";
import { cn } from "@/lib/utils";

export function PageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="sahl-page-hero">
      <div className="sahl-page-ribbon" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="sahl-page-hero-inner">
        {eyebrow ? (
          <Reveal>
            <span className="sahl-page-eyebrow">{eyebrow}</span>
          </Reveal>
        ) : null}
        <Reveal delay={70}>
          <h1 className="sahl-page-title">{title}</h1>
        </Reveal>
        {lead ? (
          <Reveal delay={140}>
            <p className="sahl-page-lead">{lead}</p>
          </Reveal>
        ) : null}
        {children ? <Reveal delay={200}>{children}</Reveal> : null}
      </div>
    </section>
  );
}

export function PageShell({
  children,
  className,
  hideFooterOnMobile = false,
}: {
  children: ReactNode;
  className?: string;
  hideFooterOnMobile?: boolean;
}) {
  return (
    <div className={cn("sahl-site-page min-h-screen bg-background", className)}>
      <Nav />
      <main>{children}</main>
      <div className={hideFooterOnMobile ? "hidden md:block" : undefined}>
        <SiteFooter />
      </div>
    </div>
  );
}

export function CtaBand({
  title = "فريقك الجديد جاهز للعمل الليلة",
  lead = "ابدأ مجاناً بدون بطاقة ائتمان. أول منشور خلال دقائق، وأول تقرير خلال أسبوع.",
}: {
  title?: string;
  lead?: string;
}) {
  return (
    <section className="sahl-page-cta px-5 py-20">
      <Reveal>
        <div className="sahl-page-cta-panel relative mx-auto max-w-6xl overflow-hidden p-10 text-center md:p-16">
          <div className="sahl-page-cta-ribbon" aria-hidden="true" />
          <div className="relative">
            <h2 className="font-display text-3xl leading-tight font-black md:text-5xl">{title}</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">{lead}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/contact"
                className="group inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-4 font-bold text-background transition-transform duration-300 hover:-translate-y-1"
              >
                وظّف فريقك الآن
                <ArrowLeft className="size-5 transition-transform duration-300 group-hover:-translate-x-1" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center rounded-md border border-border bg-background px-7 py-4 font-semibold text-foreground transition-colors hover:bg-secondary"
              >
                شاهد الأسعار
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
