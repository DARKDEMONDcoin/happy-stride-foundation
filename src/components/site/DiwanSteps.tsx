import { DoorOpen, UserPlus, SlidersHorizontal, Coffee } from "lucide-react";

/** مراسم دخول الديوان: أربع خطوات قصيرة من التعريف حتى الجلوس في الصدر. */
const steps = [
  {
    icon: DoorOpen,
    n: "١",
    t: "افتح الباب",
    d: "رابط موقعك أو ثلاث جمل عن شغلك. الفريق يقرأ ويبني ملف علامتك بنفسه.",
  },
  {
    icon: UserPlus,
    n: "٢",
    t: "اختر من يجلس معك",
    d: "شغّل من تحتاجه فقط — سِراج للسوشيال، سالم للمبيعات، دانة للتصميم — واربط حساباتك بأمان.",
  },
  {
    icon: SlidersHorizontal,
    n: "٣",
    t: "حدّد سلطتهم",
    d: "راجع كل مخرج قبل النشر، أو أعطهم الصلاحية الكاملة ودعهم ينفّذون بلا انتظار.",
  },
  {
    icon: Coffee,
    n: "٤",
    t: "اجلس في الصدر",
    d: "دفتر الديوان يعرض ما أُنجز وما تكلّف وماذا حقّق، مع توصية أسبوعية لخطوتك القادمة.",
  },
] as const;

export function DiwanSteps() {
  return (
    <section id="how" className="diwan-sec steps-sec scroll-mt-24" dir="rtl">
      <div className="mx-auto max-w-6xl px-5">
        <header className="diwan-sec-head">
          <p className="diwan-sec-kicker">مراسم الدخول</p>
          <h2 className="diwan-sec-title">من الترحيب إلى أول منشور في ثماني دقائق</h2>
          <p className="diwan-sec-lead">
            أربع خطوات فقط، بلا تدريب ولا إعدادات معقّدة — ثم يبدأ المجلس عمله.
          </p>
        </header>

        <ol className="steps-ribbon">
          {steps.map((step) => (
            <li key={step.n} className="steps-card glass-panel">
              <span className="steps-num font-display">{step.n}</span>
              <span className="steps-icon">
                <step.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="steps-title font-display">{step.t}</h3>
              <p className="steps-body">{step.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
