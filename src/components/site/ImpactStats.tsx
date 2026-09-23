import { useEffect, useRef, useState } from "react";

type Lane = {
  role: string;
  nodes: { at: number; task: string }[];
};

const lanes: Lane[] = [
  {
    role: "كاتب المحتوى",
    nodes: [
      { at: 2, task: "خطة محتوى الأسبوع" },
      { at: 6, task: "مقال طويل جاهز" },
      { at: 9, task: "٣ إعلانات نصية" },
      { at: 12, task: "نشرة بريدية" },
      { at: 16, task: "إعادة صياغة باللهجة" },
      { at: 19, task: "وصف منتجات" },
      { at: 23, task: "تقرير يومي" },
    ],
  },
  {
    role: "محلل SEO",
    nodes: [
      { at: 3, task: "بحث كلمات مفتاحية" },
      { at: 10, task: "تدقيق صفحات" },
      { at: 15, task: "تحسين عناوين" },
      { at: 22, task: "تقرير ترتيب" },
    ],
  },
  {
    role: "مدير السوشيال",
    nodes: [
      { at: 4, task: "جدولة منشورات" },
      { at: 11, task: "ردود المجتمع" },
      { at: 18, task: "تحليل التفاعل" },
    ],
  },
  {
    role: "مساعد الدعم",
    nodes: [
      { at: 1, task: "فرز المحادثات" },
      { at: 8, task: "ردود واتساب" },
      { at: 14, task: "تصعيد الحالات" },
      { at: 21, task: "ملخص العملاء" },
    ],
  },
];

const hours = [0, 4, 8, 12, 16, 20, 24];
const kpis = [
  { v: "+٤٠", k: "ساعة تعود لفريقك شهريًا" },
  { v: "٧٠٪−", k: "انخفاض تكلفة التشغيل" },
  { v: "٦/٧", k: "أيام تشغيل أسبوعية" },
  { v: "+١٠٠٠", k: "مهمة منفَّذة شهريًا" },
];

const total = lanes.reduce((s, l) => s + l.nodes.length, 0);

export function ImpactStats() {
  const ref = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(([e]) => setLive(!!e?.isIntersecting), { threshold: 0.25 });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!live) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % total), 1700);
    return () => window.clearInterval(id);
  }, [live]);

  let cursor = step;
  let activeLane = 0;
  for (let i = 0; i < lanes.length; i += 1) {
    const len = lanes[i]!.nodes.length;
    if (cursor < len) {
      activeLane = i;
      break;
    }
    cursor -= len;
  }
  const activeNode = cursor;

  return (
    <section className="impact-strip" aria-label="جدول عمل فريق سهل خلال اليوم">
      <div className="mx-auto max-w-5xl px-5">
        <header className="flow-head">
          <span className="flow-chip">
            <span className="flow-chip-dot" /> يعمل الآن
          </span>
          <h2 className="flow-title font-display">فريقك الذكي يشتغل على مدار اليوم</h2>
          <p className="flow-sub">
            كل موظف يستلم مهامه تلقائيًا، ينفّذها، ويسلّم النتيجة — بدون متابعة منك.
          </p>
        </header>

        <div ref={ref} className={`flow-panel ${live ? "is-live" : ""}`} dir="ltr">
          <div className="flow-ruler" aria-hidden="true">
            {hours.map((h) => (
              <span key={h} style={{ left: `${(h / 24) * 100}%` }}>
                {h}h
              </span>
            ))}
          </div>

          <ul className="flow-lanes">
            {lanes.map((lane, li) => {
              const isActive = li === activeLane;
              return (
                <li key={lane.role} className={`flow-lane ${isActive ? "is-active" : ""}`}>
                  <span className="flow-lane-name" dir="rtl">
                    {lane.role}
                  </span>
                  <div className="flow-track">
                    <span className="flow-rail" />
                    <span
                      className="flow-rail-fill"
                      style={{
                        width: isActive
                          ? `${((lane.nodes[activeNode]?.at ?? 0) / 24) * 100}%`
                          : "0%",
                      }}
                    />
                    {lane.nodes.map((n, ni) => {
                      const on = isActive && ni <= activeNode;
                      const now = isActive && ni === activeNode;
                      return (
                        <span
                          key={n.task}
                          className={`flow-node ${on ? "is-on" : ""} ${now ? "is-now" : ""}`}
                          style={{ left: `${(n.at / 24) * 100}%` }}
                        >
                          {now && (
                            <span className="flow-tip" dir="rtl">
                              {n.task}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <dl className="flow-kpis">
          {kpis.map((kpi) => (
            <div key={kpi.k}>
              <dt className="font-display tabular-nums">{kpi.v}</dt>
              <dd>{kpi.k}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
