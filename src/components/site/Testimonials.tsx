import { useEffect, useRef } from "react";
import { Reveal } from "@/components/Reveal";

const quotes = [
  {
    q: "أول مرة أشوف أداة تكتب بلهجتنا بدون ما تبان مترجمة. سِراج بيدير حسابات ٣ فروع لوحده.",
    n: "ريم القحطاني",
    r: "مؤسِّسة، سلسلة مقاهي",
  },
  {
    q: "وفّرت راتب مسؤول سوشيال كامل، والتفاعل زاد أكتر من الضعف في شهرين.",
    n: "أحمد شوقي",
    r: "متجر إلكتروني",
  },
  {
    q: "أمَل بتفلتر بريدي الصبح وتخليني أبدأ يومي بقرارات مش برسايل.",
    n: "ليلى بن عمر",
    r: "استشارية تسويق",
  },
  {
    q: "الصور بالنص العربي كانت المشكلة الأكبر عندي — هنا اتحلّت بالكامل.",
    n: "خالد المرزوقي",
    r: "وكالة إعلانات",
  },
  {
    q: "الفريق بيشتغل بالليل وأنا نايم، وأصحى ألاقي الخطة جاهزة للمراجعة.",
    n: "سارة العتيبي",
    r: "عيادة تجميل",
  },
];

export function Testimonials() {
  const trackRef = useRef<HTMLDivElement>(null);
  const cards = [...quotes, ...quotes];

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let paused = false;
    let resumeAt = 0;
    let raf = 0;
    let last = performance.now();
    let pos = 0;

    const pause = () => {
      paused = true;
      resumeAt = performance.now() + 3500;
      pos = el.scrollLeft;
      el.classList.add("is-user");
    };
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (paused && now > resumeAt) {
        paused = false;
        el.classList.remove("is-user");
      }
      if (!paused && !el.matches(":hover")) {
        // RTL: التمرير التلقائي البطيء جداً (تراكم عشري حتى لا تُهمل الكسور)
        const half = el.scrollWidth / 2;
        pos -= (dt / 1000) * 22;
        if (Math.abs(pos) >= half) pos += half;
        el.scrollLeft = pos;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    el.addEventListener("pointerdown", pause);
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("wheel", pause, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", pause);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("wheel", pause);
    };
  }, []);

  return (
    <section className="overflow-hidden py-20">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal>
          <p className="text-sm font-bold tracking-wider text-primary">آراء العملاء</p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl leading-tight font-black md:text-5xl">
            أصحاب مشاريع يشتغلون بفريق <span className="text-gradient">أصغر وأسرع</span>
          </h2>
        </Reveal>
      </div>

      <div className="relative mt-10 [mask-image:linear-gradient(to_right,transparent,black_7%,black_93%,transparent)]">
        <div ref={trackRef} className="testimonial-track" dir="rtl">
          {cards.map((t, i) => (
            <figure key={`${t.n}-${i}`} className="testimonial-card liquid-glass">
              <blockquote className="relative text-lg leading-relaxed">«{t.q}»</blockquote>
              <figcaption className="relative mt-5 flex items-center gap-3">
                <span
                  className="grid size-10 place-items-center rounded-full font-display font-black text-background"
                  style={{ backgroundImage: "var(--gradient-ink)" }}
                >
                  {t.n.charAt(0)}
                </span>
                <span>
                  <span className="block font-bold">{t.n}</span>
                  <span className="block text-sm text-muted-foreground">{t.r}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
