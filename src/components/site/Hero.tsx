import { Link } from "@tanstack/react-router";
import { Portrait } from "@/components/site/Portrait";
import { team } from "@/data/team";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260808_112712_da9d53df-6d27-4b12-bdf6-aa9dc2622bdf.mp4";

export function Hero() {
  return (
    <section id="top" className="sahl-video-hero" aria-labelledby="hero-title">
      <div className="sahl-video-plate" aria-hidden="true">
        <video
          className="sahl-video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/hero/cinematic-poster.jpg"
        >
          <source src={VIDEO_URL} type="video/mp4" />
        </video>
      </div>

      <div className="sahl-video-copy" dir="rtl">
        <p className="sahl-video-eyebrow">فريق ذكاء اصطناعي عربي يفهم شغلك ولهجتك</p>
        <h1 id="hero-title">
          خلّي شغلك يكبر.
          <span>فريق سهل يتولّى الباقي.</span>
        </h1>
        <p className="sahl-video-lead">
          ستة موظفين رقميين ينفّذون التسويق والمبيعات والمحتوى والتنظيم داخل حساباتك — وأنت تقودهم
          من مكان واحد.
        </p>
        <div className="sahl-video-actions">
          <Link to="/auth" search={{ mode: "signup" as const }} className="sahl-video-primary">
            <span>كوّن فريقك مجانًا</span>
          </Link>
          <Link to="/app" className="sahl-video-secondary">
            شاهد فريقك يعمل
          </Link>
        </div>
      </div>

      <div className="sahl-video-team" dir="rtl" aria-label="موظفو سهل الرقميون">
        <p>فريقك جاهز</p>
        <ul>
          {team.map((employee, index) => (
            <li key={employee.id} style={{ "--team-order": index } as React.CSSProperties}>
              <Portrait memberId={employee.id} name={employee.name} eager={index < 3} />
              <span>
                <strong>{employee.name}</strong>
                <small>{employee.role}</small>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <a className="sahl-video-scroll" href="#workspace" aria-label="انتقل إلى مساحة العمل">
        <span />
      </a>
    </section>
  );
}
