import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Reveal } from "@/components/Reveal";
import { Portrait } from "@/components/site/Portrait";
import { team } from "@/data/team";
import { cn } from "@/lib/utils";

const copy: Record<string, { promise: string; tasks: string[]; proof: string }> = {
  sonny: {
    promise: "يحوّل خطتك إلى حضور يومي لا يتوقف.",
    tasks: ["خطة محتوى شهرية", "تصميم ونشر على المنصات", "متابعة التفاعل"],
    proof: "حتى ١٢٠ منشورًا شهريًا",
  },
  eva: {
    promise: "تحمي وقتك من البريد والمواعيد والتفاصيل.",
    tasks: ["فرز البريد والأولويات", "تنظيم الاجتماعات", "ملخص يومي تنفيذي"],
    proof: "يوفّر حتى ١٢ ساعة أسبوعيًا",
  },
  sam: {
    promise: "يبني خط مبيعات ويتابع الفرص بدلًا منك.",
    tasks: ["بحث العملاء المحتملين", "رسائل مخصصة", "تحديث فرص البيع"],
    proof: "حتى ١٬٥٠٠ تواصل شهريًا",
  },
  nour: {
    promise: "تجعل علامتك إجابة يكتشفها الناس ويثقون بها.",
    tasks: ["بحث الكلمات والفرص", "محتوى عربي أصيل", "تحسين الظهور والصفحات"],
    proof: "حتى ٢٠ مقالًا شهريًا",
  },
  dana: {
    promise: "تعطي كل فكرة شكلًا واضحًا ومتسقًا مع هويتك.",
    tasks: ["إعلانات ومنشورات", "قوالب وهوية بصرية", "مقاسات لكل منصة"],
    proof: "حتى ٢٠٠ تصميم شهريًا",
  },
  adam: {
    promise: "يخبرك ماذا تعني الأرقام وما القرار التالي.",
    tasks: ["جمع المؤشرات", "تنبيهات الانخفاض", "توصيات قابلة للتنفيذ"],
    proof: "١٥ مصدر بيانات في لوحة واحدة",
  },
};

export function Employees() {
  const [active, setActive] = useState(team[0]?.id ?? "sonny");
  return (
    <section id="employees" className="employees-stage scroll-mt-24">
      <div className="mx-auto max-w-6xl px-5 py-24 md:py-32">
        <Reveal>
          <div className="max-w-3xl">
            <p className="section-kicker">ليسوا أدوات. هذا فريقك.</p>
            <h2 className="section-title">كل موظف يعرف دوره، وكلهم يعرفون مشروعك</h2>
            <p className="section-lead">
              اختر الشخص المناسب للمهمة، أو كلّف الفريق كاملًا بهدف واحد. السياق ينتقل بينهم والعمل
              يعود إليك جاهزًا للمراجعة.
            </p>
          </div>
        </Reveal>

        <div className="employee-editorial-grid">
          {team.map((member, index) => {
            const detail = copy[member.id];
            if (!detail) return null;
            const on = active === member.id;
            return (
              <Reveal key={member.id} delay={index * 55}>
                <article
                  className={cn("employee-editorial-card liquid-glass", on && "is-active")}
                  onMouseEnter={() => setActive(member.id)}
                  onFocus={() => setActive(member.id)}
                  tabIndex={0}
                  style={{ "--employee-tone": member.tint } as React.CSSProperties}
                >
                  <div className="employee-photo-wrap">
                    <Portrait
                      memberId={member.id}
                      name={member.name}
                      className="size-full"
                      eager={index < 3}
                    />
                    <span>{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="employee-editorial-copy">
                    <p>{member.role}</p>
                    <h3>{member.name}</h3>
                    <strong>{detail.promise}</strong>
                    <ul>
                      {detail.tasks.map((task) => (
                        <li key={task}>{task}</li>
                      ))}
                    </ul>
                    <div className="employee-proof">{detail.proof}</div>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>

        <Reveal>
          <div className="employee-closing">
            <p>ابدأ بموظف واحد، ووسّع فريقك عندما تحتاج.</p>
            <Link to="/auth" search={{ mode: "signup" as const }}>
              قابل فريقك الآن
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
