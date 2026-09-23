import { LogoMark } from "@/components/site/LogoMark";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";

const cols: { t: string; l: { label: string; to: string }[] }[] = [
  {
    t: "المنتج",
    l: [
      { label: "الموظفون", to: "/employees" },
      { label: "المزايا", to: "/features" },
      { label: "التكاملات", to: "/integrations" },
      { label: "كيف يعمل", to: "/how-it-works" },
      { label: "الأسعار", to: "/pricing" },
    ],
  },
  {
    t: "الحلول",
    l: [
      { label: "المتاجر الإلكترونية", to: "/use-cases/ecommerce" },
      { label: "المطاعم والكافيهات", to: "/use-cases/restaurants" },
      { label: "العيادات", to: "/use-cases/clinics" },
      { label: "العقار والمقاولات", to: "/use-cases/realestate" },
      { label: "كل القطاعات", to: "/use-cases" },
    ],
  },
  {
    t: "الشركة",
    l: [
      { label: "من نحن", to: "/about" },
      { label: "قصص النجاح", to: "/stories" },
      { label: "المدونة", to: "/blog" },
      { label: "الأسئلة الشائعة", to: "/faq" },
      { label: "تواصل معنا", to: "/contact" },
    ],
  },
  {
    t: "قانوني وأمان",
    l: [
      { label: "الأمان", to: "/security" },
      { label: "سياسة الخصوصية", to: "/privacy" },
      { label: "شروط الاستخدام", to: "/terms" },
      { label: "ملفات الارتباط", to: "/cookies" },
      { label: "الاستخدام المقبول", to: "/acceptable-use" },
      { label: "معالجة البيانات (DPA)", to: "/dpa" },
      { label: "المعالِجون الفرعيون", to: "/subprocessors" },
      { label: "الاشتراك والاسترداد", to: "/refunds" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-glow" aria-hidden />
      <div className="mx-auto w-full max-w-6xl px-5 pb-10 pt-12">
        <div className="site-footer-panel">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
            <div>
              <Link to="/" className="flex items-center gap-2.5">
                <LogoMark className="size-12" size={48} />
                <span className="font-display text-xl font-extrabold">سهل</span>
              </Link>
              <p className="mt-4 max-w-xs leading-relaxed text-muted-foreground">
                فريق موظفين بالذكاء الاصطناعي، يعمل بالعربية على مدار الساعة لأصحاب المشاريع — ينشر،
                يصمّم، يردّ، ويبيع نيابة عنك.
              </p>
            </div>
            {cols.map((c) => (
              <nav key={c.t} aria-label={c.t} className="site-footer-desktop-col">
                <h3 className="site-footer-title">{c.t}</h3>
                <ul className="mt-4 space-y-2">
                  {c.l.map((l) => (
                    <li key={l.to}>
                      <Link to={l.to} className="site-footer-link">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
            <div className="site-footer-mobile-cols">
              {cols.map((c) => (
                <details key={c.t}>
                  <summary>
                    <span>{c.t}</span>
                    <ChevronDown aria-hidden />
                  </summary>
                  <nav aria-label={c.t}>
                    {c.l.map((l) => (
                      <Link key={l.to} to={l.to} className="site-footer-link">
                        {l.label}
                      </Link>
                    ))}
                  </nav>
                </details>
              ))}
            </div>
          </div>

          <div className="site-footer-divider" />

          <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
            <p>© {new Date().getFullYear()} سهل. جميع الحقوق محفوظة.</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="site-footer-pill">
                <span className="site-footer-dot" />
                جميع الأنظمة تعمل
              </span>
              <span className="site-footer-pill">صُنع بالعربية · يدعم كل الدول العربية</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
