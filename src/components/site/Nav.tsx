import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  BrainCircuit,
  ChevronDown,
  Globe2,
  Menu,
  MessageSquareText,
  ShieldCheck,
  Store,
  Utensils,
  X,
} from "lucide-react";
import { LogoMark } from "@/components/site/LogoMark";
import { Button } from "@/components/ui/button";

const groups = [
  {
    label: "المنتج",
    intro: "فريق رقمي يعمل كنظام واحد",
    links: [
      {
        label: "الموظفون",
        desc: "تعرّف على فريق سهل وتخصصاته",
        to: "/employees",
        icon: MessageSquareText,
      },
      {
        label: "المزايا",
        desc: "من الطلب إلى التنفيذ والمراجعة",
        to: "/features",
        icon: BrainCircuit,
      },
      { label: "الأمان", desc: "تحكم وصلاحيات وسجل واضح", to: "/security", icon: ShieldCheck },
    ],
  },
  {
    label: "الحلول",
    intro: "تشغيل يتكيّف مع نشاطك",
    links: [
      {
        label: "المتاجر",
        desc: "محتوى وطلبات ومتابعة العملاء",
        to: "/use-cases/ecommerce",
        icon: Store,
      },
      {
        label: "المطاعم",
        desc: "عروض يومية وردود وقت الذروة",
        to: "/use-cases/restaurants",
        icon: Utensils,
      },
      {
        label: "كل القطاعات",
        desc: "حلول للعيادات والعقار والتعليم",
        to: "/use-cases",
        icon: Globe2,
      },
    ],
  },
  {
    label: "المصادر",
    intro: "اعرف كيف يعمل سهل",
    links: [
      { label: "قصص النجاح", desc: "نتائج من مشروعات عربية", to: "/stories", icon: BarChart3 },
      {
        label: "كيف يعمل",
        desc: "من أول إعداد إلى أول نتيجة",
        to: "/how-it-works",
        icon: BrainCircuit,
      },
      {
        label: "المدونة",
        desc: "أفكار عملية للنمو والتشغيل",
        to: "/blog",
        icon: MessageSquareText,
      },
    ],
  },
] as const;

export function Nav({ variant = "over" }: { variant?: "over" | "solid" }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const scrollDistance = useRef(0);
  const scrollDirection = useRef<"up" | "down" | null>(null);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const onScroll = () => {
      if (frame.current !== null) return;

      frame.current = window.requestAnimationFrame(() => {
        const currentScrollY = Math.max(window.scrollY, 0);
        const delta = currentScrollY - lastScrollY.current;
        const nextDirection = delta > 0 ? "down" : delta < 0 ? "up" : scrollDirection.current;

        setScrolled(currentScrollY > 18);

        if (nextDirection !== scrollDirection.current) {
          scrollDistance.current = 0;
          scrollDirection.current = nextDirection;
        }
        scrollDistance.current += Math.abs(delta);

        if (currentScrollY <= 18) {
          setHidden(false);
          scrollDistance.current = 0;
        } else if (nextDirection === "up" && scrollDistance.current >= 18) {
          setHidden(false);
          scrollDistance.current = 0;
        } else if (
          nextDirection === "down" &&
          scrollDistance.current >= 28 &&
          currentScrollY > 96
        ) {
          setHidden(true);
          scrollDistance.current = 0;
        }

        lastScrollY.current = currentScrollY;
        frame.current = null;
      });
    };

    lastScrollY.current = Math.max(window.scrollY, 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    };
  }, [variant]);

  const navHidden = hidden && !mobileOpen && active === null;

  return (
    <header
      className={`sahl-white-nav${scrolled ? " is-scrolled" : ""}${navHidden ? " is-hidden" : ""}`}
      dir="rtl"
      onMouseLeave={() => setActive(null)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setActive(null);
          setMobileOpen(false);
        }
      }}
    >
      <nav className="sahl-white-nav-inner" aria-label="التنقل الرئيسي">
        <Link to="/" className="sahl-white-brand">
          <LogoMark size={36} />
          <span>سهل</span>
        </Link>
        <div className="sahl-white-links">
          {groups.map((group) => (
            <div key={group.label} onMouseEnter={() => setActive(group.label)}>
              <Button
                type="button"
                variant="ghost"
                aria-expanded={active === group.label}
                aria-haspopup="menu"
                onClick={() => setActive(active === group.label ? null : group.label)}
              >
                {group.label}
                <ChevronDown />
              </Button>
              {active === group.label && (
                <div className="sahl-mega" role="menu">
                  <p>{group.intro}</p>
                  <div>
                    {group.links.map((item) => (
                      <a
                        key={item.to}
                        href={item.to}
                        role="menuitem"
                        onClick={() => setActive(null)}
                      >
                        <item.icon />
                        <span>
                          <b>{item.label}</b>
                          <small>{item.desc}</small>
                        </span>
                        <i>←</i>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          <Link to="/integrations">التكاملات</Link>
          <Link to="/pricing" className="sahl-nav-pricing">
            الأسعار
          </Link>
        </div>
        <div className="sahl-white-nav-actions">
          <Link to="/auth" search={{ mode: "signin" as const }}>
            دخول
          </Link>
          <Button asChild>
            <Link to="/auth" search={{ mode: "signup" as const }}>
              ابدأ الآن <span>←</span>
            </Link>
          </Button>
        </div>
        <Button
          className="sahl-white-menu"
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen((value) => !value)}
          aria-label={mobileOpen ? "إغلاق القائمة" : "فتح القائمة"}
        >
          {mobileOpen ? <X /> : <Menu />}
        </Button>
      </nav>
      {mobileOpen && (
        <div className="sahl-white-mobile">
          <div>
            {groups.map((group) => (
              <section key={group.label}>
                <b>{group.label}</b>
                {group.links.map((item) => (
                  <a key={item.to} href={item.to} onClick={() => setMobileOpen(false)}>
                    {item.label}
                    <span>←</span>
                  </a>
                ))}
              </section>
            ))}
            <Link to="/integrations" onClick={() => setMobileOpen(false)}>
              التكاملات<span>←</span>
            </Link>
            <Link to="/pricing" onClick={() => setMobileOpen(false)}>
              الأسعار<span>←</span>
            </Link>
          </div>
          <Button asChild>
            <Link to="/auth" search={{ mode: "signup" as const }}>
              ابدأ الآن
            </Link>
          </Button>
        </div>
      )}
    </header>
  );
}
