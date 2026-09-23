import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const steps = [
  {
    n: "01",
    t: "عرّفنا بشركتك",
    d: "رابط موقعك أو ثلاث جمل تكفي. الفريق يقرأ ويبني ملف علامتك التجارية تلقائياً.",
  },
  {
    n: "02",
    t: "اختر موظفيك",
    d: "فعّل من تحتاجه فقط — سِراج للسوشيال، أمَل للبريد، سالم للمبيعات — واربط حساباتك بأمان.",
  },
  {
    n: "03",
    t: "حدّد مستوى التحكم",
    d: "راجع كل مخرج قبل النشر، أو شغّل الوضع التلقائي الكامل ودعهم يعملون.",
  },
  {
    n: "04",
    t: "تابع النتائج",
    d: "لوحة واحدة تعرض ما أُنجز، ما تكلّف، وماذا حقق — مع توصيات أسبوعية.",
  },
];

export function HowItWorks() {
  const listRef = useRef<HTMLOListElement>(null);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setProgress(1);
      setActive(steps.length);
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const anchor = window.innerHeight * 0.72;
      const raw = (anchor - rect.top) / Math.max(rect.height, 1);
      const p = Math.min(1, Math.max(0, raw));
      setProgress(p);
      setActive(Math.min(steps.length, Math.ceil(p * steps.length + 0.15)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section id="how" className="mx-auto max-w-5xl scroll-mt-24 px-5 py-24">
      <div>
        <p className="text-sm font-bold tracking-wider text-primary">كيف يعمل</p>
        <h2 className="mt-3 font-display text-4xl leading-tight font-black md:text-5xl">
          من التسجيل إلى أول منشور في 8 دقائق
        </h2>
      </div>

      <ol ref={listRef} className="timeline-list relative mt-14 space-y-10 ps-14">
        <span aria-hidden className="timeline-rail" />
        <span
          aria-hidden
          className="timeline-rail-fill"
          style={{ transform: `scaleY(${progress})` }}
        />
        {steps.map((s, i) => {
          const on = i < active;
          return (
            <li key={s.n} className={cn("timeline-step relative", on && "is-on")}>
              <span className="timeline-dot font-display font-black">{s.n}</span>
              <h3 className="timeline-title font-display text-xl font-extrabold">{s.t}</h3>
              <p className="timeline-body mt-2 leading-relaxed text-muted-foreground">{s.d}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
