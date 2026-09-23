import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Clock3, Sparkles } from "lucide-react";
import { Portrait } from "@/components/site/Portrait";
import { team } from "@/data/team";

const USER_MSG = "اعملي بوست عن العرض الجديد";
const REPLY =
  "تمام 👌 عرض الجمعة: «خصم ٢٥٪ على كل الطلبات لمدة ٤٨ ساعة فقط». كتبت المسودة بلهجتك، صمّمت صورة مربعة، وحضّرتها لإنستقرام وفيسبوك — تحت أمرك للنشر.";

type Stage = "typing-user" | "thinking" | "typing-reply" | "pending" | "published";

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** المعاينة الحية: مساحة عمل سهل تعمل أمام الزائر مباشرة. */
export function SahlHero() {
  const [userText, setUserText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [stage, setStage] = useState<Stage>("typing-user");
  const [activeSeat, setActiveSeat] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const id = setInterval(() => setActiveSeat((s) => (s + 1) % 6), 1500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (reduced()) {
      setUserText(USER_MSG);
      setReplyText(REPLY);
      setStage("published");
      return;
    }
    const wait = (ms: number) => new Promise<void>((r) => timers.current.push(setTimeout(r, ms)));
    let alive = true;

    const type = async (text: string, set: (v: string) => void, speed: number) => {
      for (let i = 1; i <= text.length; i++) {
        if (!alive) return;
        set(text.slice(0, i));
        await wait(speed);
      }
    };

    const run = async () => {
      while (alive) {
        setUserText("");
        setReplyText("");
        setStage("typing-user");
        await wait(700);
        await type(USER_MSG, setUserText, 55);
        setStage("thinking");
        await wait(1100);
        setStage("typing-reply");
        await type(REPLY, setReplyText, 22);
        setStage("pending");
        await wait(2200);
        setStage("published");
        await wait(4200);
      }
    };
    void run();

    return () => {
      alive = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  const showCard = stage === "pending" || stage === "published";

  return (
    <section className="sahl-live" dir="rtl" aria-labelledby="live-title">
      <div className="sahl-live-glowA" aria-hidden="true" />
      <div className="sahl-live-glowB" aria-hidden="true" />

      <div className="sahl-live-head">
        <span className="sahl-badge">
          <i aria-hidden="true" />
          فريقك شغّال دلوقتي
        </span>
        <h1 id="live-title" className="sahl-live-title">
          شوف فريقك بيشتغل قدامك الآن
        </h1>
        <Link to="/auth" search={{ mode: "signup" as const }} className="sahl-live-cta">
          ادخل مساحة عملك
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="sahl-window liquid-glass-sahl">
        <div className="sahl-window-bar">
          <span />
          <span />
          <span />
          <p>مساحة عمل سهل</p>
        </div>

        <div className="sahl-window-body">
          <aside className="sahl-rail" aria-hidden="true">
            {team.slice(0, 6).map((member, i) => (
              <div key={member.id} className={`sahl-rail-item${activeSeat === i ? " is-on" : ""}`}>
                <Portrait memberId={member.id} name={member.name} eager={i < 3} />
                <b />
                <span>{member.name}</span>
              </div>
            ))}
          </aside>

          <div className="sahl-chat">
            <div className="sahl-bubble is-user">
              <p>
                {userText}
                {stage === "typing-user" && <i className="sahl-caret" />}
              </p>
            </div>

            {(stage === "thinking" || replyText || showCard) && (
              <div className="sahl-bubble is-agent">
                <header>
                  <Portrait memberId="sonny" name="سِراج" eager />
                  <strong>سِراج</strong>
                  <small>مدير السوشيال ميديا</small>
                </header>
                {stage === "thinking" ? (
                  <p className="sahl-dots" aria-label="سِراج يكتب">
                    <i />
                    <i />
                    <i />
                  </p>
                ) : (
                  <p>
                    {replyText}
                    {stage === "typing-reply" && <i className="sahl-caret" />}
                  </p>
                )}
              </div>
            )}
          </div>

          <aside className="sahl-approvals">
            <p className="sahl-approvals-title">
              <Sparkles className="size-3.5" aria-hidden="true" />
              بانتظار موافقتك
            </p>
            {showCard ? (
              <article className={`sahl-approval-card${stage === "published" ? " is-done" : ""}`}>
                <div className="sahl-approval-thumb" aria-hidden="true" />
                <strong>منشور: عرض الجمعة −٢٥٪</strong>
                <small>إنستقرام + فيسبوك</small>
                <span>
                  {stage === "published" ? (
                    <>
                      <Check className="size-3.5" aria-hidden="true" /> نُشِر
                    </>
                  ) : (
                    <>
                      <Clock3 className="size-3.5" aria-hidden="true" /> بانتظارك
                    </>
                  )}
                </span>
              </article>
            ) : (
              <p className="sahl-approvals-empty">لا شيء معلّق — الفريق بيجهّز.</p>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
