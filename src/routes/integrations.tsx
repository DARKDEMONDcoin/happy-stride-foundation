import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, ArrowLeft, ShieldCheck, Zap, Info } from "lucide-react";

import { PageShell, PageHero, CtaBand } from "@/components/site/PageShell";
import { Reveal } from "@/components/Reveal";
import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/integrations")({
  head: () => ({
    meta: [
      { title: "التكاملات | اربط سهل بإنستجرام وتيك توك ومتجرك وأدواتك" },
      {
        name: "description",
        content:
          "سهل يعمل داخل أدواتك: نشر على إنستجرام وفيسبوك ولينكدإن وإكس وبينترست ويوتيوب، ربط متجرك وموقعك وبريدك وتحليلاتك. شاهد قائمة التكاملات كاملة.",
      },
      { property: "og:title", content: "التكاملات — سهل" },
      {
        property: "og:description",
        content: "اربط حساباتك مرة واحدة، ثم اطلب من الفريق ما تريد.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IntegrationsPage,
});

type Item = { key: string; note: string; status: "live" | "beta" | "soon" };

const groups: { t: string; d: string; items: Item[] }[] = [
  {
    t: "النشر على السوشيال",
    d: "يكتب، يصمّم، ويجدول، ثم ينشر في وقت الذروة لكل منصة.",
    items: [
      { key: "instagram", note: "نشر صور ومنشورات وردّ على التعليقات", status: "live" },
      { key: "facebook", note: "نشر على صفحات الأعمال وإدارة التعليقات", status: "live" },
      { key: "linkedin", note: "منشورات مهنية من صفحتك أو حسابك", status: "live" },
      { key: "x", note: "نشر مع تقصير تلقائي للنص وأهم هاشتاقين", status: "live" },
      { key: "pinterest", note: "بينات بصور المنتجات والروابط", status: "live" },
      { key: "youtube", note: "رفع الوصف والعناوين والمجتمع", status: "live" },
      { key: "threads", note: "نشر نصي متزامن مع إنستجرام", status: "beta" },
      {
        key: "tiktok",
        note: "مسودات جاهزة للنشر يدوياً — سياسة المنصة تمنع النشر الآلي",
        status: "beta",
      },
    ],
  },
  {
    t: "المتاجر والمواقع",
    d: "يقرأ منتجاتك وينشر مقالاتك على موقعك مباشرة.",
    items: [
      { key: "shopify", note: "قراءة المنتجات وكتابة أوصافها ونشر المدونة", status: "live" },
      { key: "wordpress", note: "نشر مقالات محسّنة للبحث مباشرة", status: "live" },
      { key: "webflow", note: "نشر في مجموعات CMS", status: "live" },
      { key: "ghost", note: "نشر المقالات والنشرات", status: "live" },
      { key: "salla", note: "ربط مخصص عبر ملف منتجات أو رابط", status: "soon" },
    ],
  },
  {
    t: "الردّ على العملاء",
    d: "صندوق موحّد يردّ بنبرتك ويصعّد لك ما يحتاج قراراً.",
    items: [
      { key: "whatsapp", note: "ردود على استفسارات العملاء وتصعيد الجاد منها", status: "beta" },
      { key: "gmail", note: "فرز البريد وصياغة الردود ومتابعة المعلّق", status: "live" },
      { key: "outlook", note: "نفس قدرات البريد على حساب مايكروسوفت", status: "beta" },
      { key: "telegram", note: "قنوات ومجموعات العملاء", status: "beta" },
      { key: "intercom", note: "ردود مقترحة داخل المحادثات", status: "soon" },
    ],
  },
  {
    t: "القياس والبحث",
    d: "أرقام حقيقية من حساباتك، لا تقديرات.",
    items: [
      { key: "analytics", note: "زيارات ومصادرها وسلوك الزوار (GA4)", status: "live" },
      { key: "search-console", note: "كلماتك في جوجل ومواضعك وفرص التحسين", status: "live" },
      { key: "indexnow", note: "إخطار فوري لمحركات البحث بأي صفحة جديدة", status: "live" },
      { key: "google-business", note: "ملف نشاطك على الخريطة والتقييمات", status: "beta" },
      { key: "meta-ads", note: "قراءة أداء الحملات ومقارنة العائد", status: "live" },
      { key: "google-ads", note: "قراءة أداء الحملات والكلمات", status: "beta" },
    ],
  },
  {
    t: "التنظيم والفريق",
    d: "يبقى العمل حيث يعمل فريقك البشري أصلاً.",
    items: [
      { key: "notion", note: "حفظ الخطط والتقارير في مساحتك", status: "live" },
      { key: "sheets", note: "تصدير المهام والنتائج إلى جدول", status: "live" },
      { key: "drive", note: "حفظ التصاميم والملفات", status: "live" },
      { key: "slack", note: "تنبيهات المهام والموافقات", status: "beta" },
      { key: "trello", note: "إنشاء بطاقات المهام", status: "beta" },
      { key: "calendar", note: "حجز المواعيد والمكالمات", status: "live" },
      { key: "airtable", note: "قواعد بيانات العملاء والمحتوى", status: "soon" },
      { key: "hubspot", note: "دفع العملاء المحتملين إلى نظامك", status: "soon" },
    ],
  },
];

const statusLabel: Record<Item["status"], { t: string; c: string }> = {
  live: { t: "متاح", c: "bg-jade/15 text-jade-deep" },
  beta: { t: "تجريبي", c: "bg-amber/20 text-ink" },
  soon: { t: "قريباً", c: "bg-secondary text-muted-foreground" },
};

function IntegrationsPage() {
  const [q, setQ] = useState("");
  const total = useMemo(() => groups.reduce((n, g) => n + g.items.length, 0), []);
  const term = q.trim();

  const filtered = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          items: term
            ? g.items.filter(
                (i) =>
                  appLabel(i.key).includes(term) ||
                  i.key.includes(term.toLowerCase()) ||
                  i.note.includes(term),
              )
            : g.items,
        }))
        .filter((g) => g.items.length > 0),
    [term],
  );

  return (
    <PageShell>
      <PageHero
        eyebrow={`${total} تكاملاً وأكثر`}
        title={
          <>
            اربط حساباتك مرة واحدة،
            <br />
            ثم اطلب فقط
          </>
        }
        lead="سهل لا يطلب منك تغيير أدواتك. يدخل إلى المنصات التي تستخدمها اليوم، وينفّذ فيها العمل نيابة عنك بصلاحيات تحدّدها أنت وتسحبها متى شئت."
      >
        <div className="mx-auto mt-8 flex max-w-md items-center gap-2 rounded-full border border-white/40 bg-white/15 px-4 py-3 backdrop-blur">
          <Search className="size-4.5 shrink-0 text-white/80" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن أداة… مثلاً إنستجرام"
            aria-label="ابحث عن تكامل"
            className="w-full bg-transparent text-white outline-none placeholder:text-white/60"
          />
        </div>
      </PageHero>

      <section className="px-5 pb-4">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
          {[
            { i: Zap, t: "ربط بضغطتين", d: "تسجيل دخول آمن للمنصة، بلا نسخ مفاتيح ولا أكواد." },
            {
              i: ShieldCheck,
              t: "صلاحيات محدودة",
              d: "نطلب أقل صلاحية تكفي المهمة، وتستطيع فصل أي حساب فوراً.",
            },
            {
              i: Info,
              t: "لا نشر بلا ربط",
              d: "إن لم يكن الحساب مربوطاً فلن يدّعي أي موظف أنه نشر — يظهر لك خطأ صريح.",
            },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 60}>
              <div className="flex h-full items-start gap-3 rounded-2xl border border-border bg-card p-5 shadow-card">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                  <c.i className="size-5" strokeWidth={2.2} />
                </span>
                <span>
                  <span className="block font-display font-black">{c.t}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                    {c.d}
                  </span>
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-5 py-12">
        <div className="mx-auto max-w-6xl space-y-12">
          {filtered.map((g) => (
            <div key={g.t}>
              <Reveal>
                <h2 className="font-display text-2xl font-black">{g.t}</h2>
                <p className="mt-2 text-muted-foreground">{g.d}</p>
              </Reveal>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((it, i) => (
                  <Reveal key={it.key} delay={i * 40}>
                    <div className="flex h-full items-start gap-3 rounded-2xl border border-border bg-card p-5 shadow-card">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-background">
                        <AppIcon name={it.key} className="size-5.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="font-display font-black">{appLabel(it.key)}</span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[0.65rem] font-black",
                              statusLabel[it.status].c,
                            )}
                          >
                            {statusLabel[it.status].t}
                          </span>
                        </span>
                        <span className="mt-1.5 block text-sm leading-relaxed text-muted-foreground">
                          {it.note}
                        </span>
                      </span>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">
              لا نتيجة لبحثك. جرّب اسماً آخر، أو اطلب الأداة منّا وسنضيفها.
            </p>
          ) : null}
        </div>
      </section>

      <section className="px-5 pb-16">
        <Reveal>
          <div className="mx-auto max-w-3xl rounded-[1.75rem] border border-border bg-secondary/50 p-8 text-center">
            <h2 className="font-display text-2xl font-black">أداتك غير موجودة؟</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              نضيف تكاملات جديدة بحسب طلبات العملاء. أرسل لنا اسم الأداة وسنخبرك بموعد إتاحتها —
              وغالباً نستطيع ربطها لك خلال أيام.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/contact"
                className="rounded-full bg-foreground px-7 py-3.5 font-bold text-background"
              >
                اطلب تكاملاً
              </Link>
              <Link
                to="/use-cases"
                className="inline-flex items-center gap-2 rounded-full border border-border px-7 py-3.5 font-semibold"
              >
                شاهد الحلول حسب نشاطك
                <ArrowLeft className="size-4" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <CtaBand />
    </PageShell>
  );
}
