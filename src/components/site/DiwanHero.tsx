import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Play,
  Send,
  Image,
  MessageCircle,
  TrendingUp,
  CalendarCheck,
  Search,
} from "lucide-react";
import { Portrait } from "@/components/site/Portrait";
import { team } from "@/data/team";

/** أحداث حيّة تظهر على «طبلية» المجلس. */
const events = [
  { icon: Send, text: "سِراج نشر منشور إنستقرام", who: "سِراج" },
  { icon: MessageCircle, text: "سالم ردّ على عميل في واتساب", who: "سالم" },
  { icon: Image, text: "دانة صمّمت 3 إعلانات جديدة", who: "دانة" },
  { icon: TrendingUp, text: "آدم رصد ارتفاع المبيعات 18%", who: "آدم" },
  { icon: CalendarCheck, text: "أمَل رتّبت مواعيد الغد", who: "أمَل" },
  { icon: Search, text: "نور حسّنت ظهورك في البحث", who: "نور" },
] as const;

const time = (offset: number) => {
  const d = new Date(Date.now() - offset * 47000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** حلقة المجلس: الموظفون يجلسون حول طبلية تتدفّق فيها أعمالهم لحظة بلحظة. */
export function DiwanHero() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2600);
    return () => clearInterval(id);
  }, []);

  const visible = Array.from({ length: 3 }, (_, i) => events[(tick + i) % events.length]!);

  return (
    <section id="top" className="diwan" aria-labelledby="diwan-title" dir="rtl">
      <div className="diwan-aura" aria-hidden="true" />
      <div className="diwan-grid" aria-hidden="true" />

      <div className="diwan-head">
        <p className="diwan-eyebrow">
          <i aria-hidden="true" />
          مجلسك الرقمي — ستة موظفين يعملون الآن
        </p>
        <h1 id="diwan-title" className="diwan-title">
          افتح ديوانك،
          <span>وخلّي فريقك يشتغل</span>
        </h1>
        <p className="diwan-lead">
          سهل يمنحك مجلساً من ستة موظفين بالذكاء الاصطناعي: ينشرون، يصمّمون، يردّون على عملائك،
          ويتابعون مبيعاتك بالعربية وبلهجتك — وأنت تجلس في الصدر وتقرّر فقط.
        </p>
        <div className="diwan-actions">
          <Link to="/auth" search={{ mode: "signup" as const }} className="diwan-cta">
            استقبل فريقك مجاناً
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Link>
          <Link to="/app" className="diwan-ghost">
            <Play className="size-4" aria-hidden="true" />
            شاهد المجلس يعمل
          </Link>
        </div>
      </div>

      <div className="diwan-majlis">
        <div className="diwan-halo" aria-hidden="true" />

        <div className="diwan-seats">
          {team.slice(0, 6).map((member, i) => {
            const a = ((195 + (i * 150) / 5) * Math.PI) / 180;
            return (
              <div
                key={member.id}
                className="diwan-seat"
                style={{
                  ["--i" as string]: i,
                  ["--sx" as string]: "0px",
                  ["--sy" as string]: "0px",
                  left: `${50 + 44 * Math.cos(a)}%`,
                  top: `${46 + 38 * Math.sin(a)}%`,
                }}
              >
                <figure>
                  <Portrait memberId={member.id} name={member.name} eager={i < 3} />
                </figure>
                <strong>{member.name}</strong>
                <small>{member.role}</small>
                <b>يعمل الآن</b>
              </div>
            );
          })}
        </div>

        <div className="diwan-table">
          <header>
            <p>طبلية المجلس</p>
            <span>تحديث حيّ</span>
          </header>
          <ul className="diwan-feed">
            {visible.map((event, i) => (
              <li key={`${tick}-${i}`}>
                <i>
                  <event.icon className="size-3.5" aria-hidden="true" />
                </i>
                {event.text}
                <span>{time(i)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="diwan-proof">
        <div>
          <strong>24/7</strong>
          <small>بلا إجازات ولا نوم</small>
        </div>
        <div>
          <strong>7</strong>
          <small>منصات ينشرون عليها</small>
        </div>
        <div>
          <strong>+120</strong>
          <small>مهمة شهرياً لكل موظف</small>
        </div>
        <div>
          <strong>دقائق</strong>
          <small>لتشغيل المجلس كامل</small>
        </div>
      </div>
    </section>
  );
}
