import { useEffect, useRef, useState } from "react";

/** دفتر المحل: كل حركة ينفّذها فريقك تُسجَّل سطراً سطراً كما في دفتر التاجر. */
const rows = [
  { t: "08:12", who: "سِراج", act: "نشر منشورين على إنستقرام وتيك توك", win: "+2 منشور" },
  { t: "09:04", who: "أمَل", act: "فرزت 41 رسالة ورتّبت مواعيد اليوم", win: "+1:40 ساعة" },
  { t: "10:37", who: "سالم", act: "تابع 18 عميلاً محتملاً على واتساب", win: "+6 فرص" },
  { t: "12:20", who: "دانة", act: "صمّمت هوية إعلان الموسم", win: "+5 تصاميم" },
  { t: "14:05", who: "نور", act: "كتبت مقالاً وحسّنت 4 صفحات", win: "+9 كلمات ظهور" },
  { t: "16:48", who: "آدم", act: "أعدّ تقرير المبيعات ورشّح أفضل منتج", win: "+18% مبيعات" },
  { t: "19:30", who: "سِراج", act: "ردّ على 63 تعليقاً باللهجة", win: "+63 رد" },
] as const;

const totals = [
  { v: "1,240", k: "حركة مسجّلة هذا الشهر" },
  { v: "40+", k: "ساعة رجعت لك" },
  { v: "70%−", k: "من تكلفة فريق بشري" },
  { v: "0", k: "يوم غياب" },
] as const;

export function DiwanLedger() {
  const ref = useRef<HTMLDivElement>(null);
  const [written, setWritten] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        if (reduce) return setWritten(rows.length);
        let i = 0;
        const id = window.setInterval(() => {
          i += 1;
          setWritten(i);
          if (i >= rows.length) window.clearInterval(id);
        }, 380);
        io.disconnect();
      },
      { threshold: 0.2 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <section id="ledger" className="diwan-sec ledger-sec scroll-mt-24" dir="rtl">
      <div className="mx-auto max-w-5xl px-5">
        <header className="diwan-sec-head">
          <p className="diwan-sec-kicker">دفتر المحل</p>
          <h2 className="diwan-sec-title">يوم واحد في ديوانك، مكتوب سطراً سطراً</h2>
          <p className="diwan-sec-lead">
            لا تقارير غامضة: كل حركة ينفّذها موظفوك تُسجَّل بوقتها وصاحبها ونتيجتها — كما يكتب
            التاجر دفتره في آخر النهار.
          </p>
        </header>

        <div ref={ref} className="ledger glass-panel">
          <div className="ledger-head">
            <span>الوقت</span>
            <span>الموظف</span>
            <span>الحركة</span>
            <span>المكسب</span>
          </div>
          <ul className="ledger-rows">
            {rows.map((row, i) => (
              <li key={row.t} className={i < written ? "is-written" : ""}>
                <span className="ledger-time tabular-nums">{row.t}</span>
                <span className="ledger-who">{row.who}</span>
                <span className="ledger-act">{row.act}</span>
                <span className="ledger-win">{row.win}</span>
              </li>
            ))}
          </ul>
          <footer className="ledger-foot">
            <span>مُغلق على {written} حركة</span>
            <b>الدفتر يُحدَّث تلقائياً</b>
          </footer>
        </div>

        <dl className="ledger-totals">
          {totals.map((total) => (
            <div key={total.k}>
              <dt className="font-display tabular-nums">{total.v}</dt>
              <dd>{total.k}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
