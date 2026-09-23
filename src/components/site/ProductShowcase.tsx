import { Reveal } from "@/components/Reveal";

const dashboard = "/product-shots/overview.png";
const calendar = "/product-shots/calendar-mobile.png";
const chat = "/product-shots/chat-mobile.png";

export function ProductShowcase() {
  return (
    <section className="product-showcase overflow-hidden py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <p className="section-kicker">هكذا يعمل فريقك الرقمي</p>
            <h2 className="section-title">
              ستة موظفين ينفّذون العمل داخل حساباتك، وأنت تديرهم من مكان واحد
            </h2>
            <p className="section-lead">
              سهل يمنحك فريقًا رقميًا عربيًا يعمل داخل حساباتك: يناقشك، ينفّذ مهامك، وينظّم وقتك —
              وأنت تتابع كل شيء من مساحة عمل واضحة تجمع النقاش، الجدولة، والإنجاز في مكان واحد.
            </p>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="device-stage">
            <div className="laptop-frame">
              <div className="laptop-bar">
                <span />
                <span />
                <span />
                <b>مساحة عمل سهل</b>
              </div>
              <img
                src={dashboard}
                alt="النظرة العامة لمساحة عمل سهل على الكمبيوتر"
                loading="lazy"
              />
              <div className="laptop-base" />
            </div>
            <figure className="phone-frame phone-calendar">
              <span className="phone-island" />
              <img src={calendar} alt="تقويم المحتوى في سهل" loading="lazy" />
              <figcaption>تحديث حي</figcaption>
            </figure>
            <figure className="phone-frame phone-chat">
              <span className="phone-island" />
              <img src={chat} alt="محادثة سِراج داخل تطبيق سهل على الهاتف" loading="lazy" />
              <figcaption>الفريق متاح</figcaption>
            </figure>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
