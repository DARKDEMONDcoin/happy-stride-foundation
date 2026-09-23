import { LogoMark } from "@/components/site/LogoMark";
import { useEffect, useRef, useState } from "react";
import { Quote, Sparkles } from "lucide-react";

import user1 from "@/assets/auth-user-1.png";
import user2 from "@/assets/auth-user-2.png";
import user3 from "@/assets/auth-user-3.png";
import user4 from "@/assets/auth-user-4.png";

type Slide = {
  src: string;
  bg: string;
  glow: string;
  name: string;
  role: string;
  quote: string;
  metric: string;
};

const SLIDES: Slide[] = [
  {
    src: user1,
    bg: "#C1663A",
    glow: "#E89A6B",
    name: "نُهى العُمري",
    role: "أتيليه نُهى · الرياض",
    quote: "وفّرت ساعتين كل يوم. المنشورات تنزل بالوقت الصح وأنا مركّزة على التفصيل.",
    metric: "‎+٣١٪ طلبات في شهر",
  },
  {
    src: user2,
    bg: "#2F6B5E",
    glow: "#5FA894",
    name: "كريم مصطفى",
    role: "كافيه ضي · القاهرة",
    quote: "بيرد على العملاء بالمصري بالليل وأنا نايم، وبيلاقيني الحجوزات جاهزة الصبح.",
    metric: "ردّ خلال ٤٠ ثانية",
  },
  {
    src: user3,
    bg: "#8A4A63",
    glow: "#C1809A",
    name: "ريما الشهري",
    role: "متجر ريما للأزياء · جدة",
    quote: "أول مرة أحس إن فيه فريق يفهم لهجتي ويكتب زي ما أتكلم مع زبوناتي.",
    metric: "٤ منصات بضغطة",
  },
  {
    src: user4,
    bg: "#3C5A78",
    glow: "#7FA3C4",
    name: "فيصل الدوسري",
    role: "منصة رقمية · الدمام",
    quote: "بدل وكالة كاملة، فريق سهل جهّز لي خطة المحتوى والفيديوهات في يوم واحد.",
    metric: "توفير ٧٠٪ من التكلفة",
  },
];

const DURATION = 700;
const INTERVAL = 4600;

export function AuthCover() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    SLIDES.forEach((s) => {
      const img = new Image();
      img.src = s.src;
    });
  }, []);

  useEffect(() => {
    if (paused) return;
    timer.current = setInterval(() => setActive((p) => (p + 1) % SLIDES.length), INTERVAL);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused]);

  const current = SLIDES[active]!;
  const roleOf = (i: number) => {
    if (i === active) return "center" as const;
    if (i === (active + SLIDES.length - 1) % SLIDES.length) return "left" as const;
    if (i === (active + 1) % SLIDES.length) return "right" as const;
    return "back" as const;
  };

  return (
    <div
      className="auth-cover"
      style={{
        backgroundColor: current.bg,
        transition: `background-color ${DURATION}ms cubic-bezier(0.4,0,0.2,1)`,
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        aria-hidden
        className="auth-cover-glow"
        style={{
          background: `radial-gradient(60% 60% at 50% 78%, ${current.glow}, transparent 70%)`,
          transition: `background ${DURATION}ms cubic-bezier(0.4,0,0.2,1)`,
        }}
      />
      <div aria-hidden className="auth-cover-grain" />

      <span aria-hidden className="auth-cover-ghost">
        سهل
      </span>

      <div className="auth-cover-stage" aria-hidden>
        {SLIDES.map((s, i) => (
          <div key={s.src} className="auth-cover-figure" data-role={roleOf(i)}>
            <img src={s.src} alt="" draggable={false} loading="lazy" width={768} height={1280} />
          </div>
        ))}
      </div>

      <div className="auth-cover-top">
        <span className="auth-cover-brand">
          <LogoMark className="size-5" size={20} />
          عملاء سهل
        </span>
      </div>

      <div className="auth-cover-bottom">
        <div key={active} className="auth-cover-card">
          <Quote className="auth-cover-quote-icon" strokeWidth={2.2} />
          <p className="auth-cover-quote">{current.quote}</p>
          <div className="auth-cover-meta">
            <div>
              <strong>{current.name}</strong>
              <span>{current.role}</span>
            </div>
            <span className="auth-cover-metric">{current.metric}</span>
          </div>
        </div>

        <div className="auth-cover-dots" role="tablist" aria-label="آراء العملاء">
          {SLIDES.map((s, i) => (
            <button
              key={s.src}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={s.name}
              className="auth-cover-dot"
              data-active={i === active}
              onClick={() => setActive(i)}
            >
              <span
                style={{
                  animationDuration: `${INTERVAL}ms`,
                  animationPlayState: paused ? "paused" : "running",
                }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
