import { CalendarClock, Check, Link2, Send } from "lucide-react";

import { Markdown } from "@/components/app/Markdown";
import { Portrait } from "@/components/site/Portrait";

export type SampleCard = {
  employeeId: string;
  employee: string;
  role: string;
  quality: number;
  image?: string | null;
  /** أزرار النشر الحقيقية التي ظهرت مع هذا الرد داخل المحادثة. */
  publish?: { connect?: string | null } | null;
  body: string;
};

/**
 * لقطة حقيقية من المحادثة: نفس فقاعات الدردشة وصورة الموظف وتنسيق الرد
 * وشريط النشر كما يراه المستخدم داخل مساحة العمل — بلا إعادة صياغة.
 */
export function SampleChatShot({
  business,
  prompt,
  cards,
}: {
  business: string;
  prompt: string;
  cards: readonly SampleCard[];
}) {
  return (
    <div className="sahl-shot" dir="rtl">
      <div className="sahl-shot-bar">
        <span />
        <span />
        <span />
        <p>{business}</p>
      </div>

      <div className="sahl-shot-thread">
        <div className="sahl-shot-user">
          <p dir="auto">{prompt}</p>
        </div>

        {cards.map((card) => (
          <div key={card.employeeId} className="sahl-shot-row">
            <span className="sahl-shot-avatar">
              <Portrait memberId={card.employeeId} name={card.employee} />
            </span>
            <div className="sahl-shot-content">
              <p className="sahl-shot-who">
                <b>{card.employee}</b>
                <small>{card.role}</small>
              </p>

              <Markdown body={card.body} />

              {card.image ? (
                <figure className="sahl-shot-media">
                  <img src={card.image} alt={`الصورة التي ولّدها ${card.employee}`} loading="lazy" />
                </figure>
              ) : null}

              {card.publish ? (
                <div className="sahl-shot-publish">
                  <div className="sahl-shot-publish-head">
                    <span>جودة المنشور {card.quality}٪</span>
                    {card.publish.connect ? (
                      <button type="button" className="is-connect" disabled>
                        <Link2 className="size-3.5" /> {card.publish.connect} · اربطه
                      </button>
                    ) : null}
                  </div>
                  <div className="sahl-shot-publish-actions">
                    <button type="button" className="is-primary" disabled>
                      <Send className="size-4" /> انشر الآن
                    </button>
                    <button type="button" disabled>
                      <CalendarClock className="size-4" /> جدولة
                    </button>
                  </div>
                </div>
              ) : (
                <div className="sahl-shot-publish">
                  <div className="sahl-shot-publish-head">
                    <span>جودة المخرج {card.quality}٪</span>
                  </div>
                  <div className="sahl-shot-publish-actions">
                    <button type="button" className="is-primary" disabled>
                      <Check className="size-4" /> اعتماد
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
