import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  FileText,
  Globe2,
  LayoutTemplate,
  LifeBuoy,
  Loader2,
  Mail,
  Megaphone,
  MessageSquareHeart,
  MessagesSquare,
  PenLine,
  Radar,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Target,
  Users,
  Video,
} from "lucide-react";

import { useServerFn } from "@tanstack/react-start";

import { BusinessProfileCard } from "@/components/app/BusinessProfileCard";
import { team } from "@/data/team";
import { Portrait } from "@/components/site/Portrait";
import { saveAutomation } from "@/lib/automations.functions";
import { useAddBrainItem, useUpdateWorkspace, useWorkspace } from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "جهّز فريقك في دقائق | سهل" },
      {
        name: "description",
        content:
          "عرّف سهل على نشاطك، اختر نبرتك وأهدافك وفريقك، وابدأ العمل خلال دقائق — وكل خطوة اختيارية.",
      },
      { property: "og:title", content: "جهّز فريقك الرقمي في دقائق — سهل" },
      {
        property: "og:description",
        content: "إعداد ذكي ومرن، بدون خبرة تقنية، وكل خطوة يمكن تخطّيها.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Onboarding,
});

const steps = [
  {
    id: "site",
    title: "ابدأ من موقعك",
    lead: "سنقرأ موقعك ونملأ عنك كل شيء — أو تخطَّ واكتب بنفسك.",
  },
  { id: "business", title: "عرّفنا على نشاطك", lead: "كلما عرفنا أكثر، كان المحتوى أقرب لعملائك." },
  { id: "voice", title: "كيف تتكلم علامتك؟", lead: "اختر نبرة جاهزة أو اكتب نبرتك الخاصة." },
  {
    id: "goals",
    title: "ما الذي تريد إنجازه؟",
    lead: "نختار لك المهام التلقائية المناسبة لأهدافك.",
  },
  { id: "team", title: "من يعمل معك؟", lead: "كل الموظفين مشمولون — فعّل من تحتاجه الآن." },
] as const;

const tones = [
  {
    id: "دافئة وقريبة، بدون مبالغة",
    label: "دافئة وقريبة",
    sample: "أهلاً! جهّزنا لك شيئاً يعجبك اليوم 🌿",
  },
  {
    id: "احترافية ورصينة",
    label: "احترافية ورصينة",
    sample: "يسرّنا مشاركتكم آخر تحديثات المنتج لهذا الربع.",
  },
  {
    id: "جريئة ومباشرة",
    label: "جريئة ومباشرة",
    sample: "توقف عن إضاعة ميزانيتك. إليك ما ينجح فعلاً.",
  },
  { id: "مرحة وخفيفة الظل", label: "مرحة وخفيفة", sample: "خبر حلو… وخبر أحلى. ابدأ بالثاني 😄" },
];

const goals = [
  {
    id: "social",
    label: "محتوى يومي للسوشيال",
    hint: "أفكار ومنشورات جاهزة كل صباح",
    icon: MessageSquareHeart,
  },
  {
    id: "ads",
    label: "إعلانات ممولة",
    hint: "بناء الحملات وإدارة الميزانية والنتائج",
    icon: Megaphone,
  },
  {
    id: "seo",
    label: "ظهور أعلى في جوجل",
    hint: "كلمات مفتاحية ومقالات تجلب زيارات",
    icon: Search,
  },
  { id: "sales", label: "عملاء ومبيعات أكثر", hint: "متابعة العملاء وردود أسرع", icon: Users },
  {
    id: "whatsapp",
    label: "ردود فورية على العملاء",
    hint: "واتساب والرسائل والتعليقات بلا تأخير",
    icon: MessagesSquare,
  },
  { id: "video", label: "فيديو وريلز وصور", hint: "تصميم وتوليد المحتوى البصري", icon: Video },
  { id: "email", label: "بريد ورسائل منتظمة", hint: "نشرات ورسائل متابعة", icon: Mail },
  {
    id: "store",
    label: "مبيعات المتجر الإلكتروني",
    hint: "وصف المنتجات والعروض والسلات المتروكة",
    icon: ShoppingBag,
  },
  {
    id: "competitors",
    label: "متابعة المنافسين والسوق",
    hint: "ما يفعله منافسك وفرصك الحالية",
    icon: Radar,
  },
  {
    id: "reputation",
    label: "سمعة وتقييمات أفضل",
    hint: "تقييمات جوجل والردود على الشكاوى",
    icon: Star,
  },
  {
    id: "reports",
    label: "تقارير تفهمها بسرعة",
    hint: "ملخص أسبوعي لأداء كل شيء",
    icon: BarChart3,
  },
  { id: "brand", label: "هوية وصوت ثابت", hint: "كل المخرجات بنفس النبرة", icon: PenLine },
  {
    id: "leads",
    label: "عملاء محتملون جدد",
    hint: "اكتشاف عملاء وبيانات تواصل ورسائل أولى",
    icon: Target,
  },
  {
    id: "proposals",
    label: "عروض أسعار ومقترحات",
    hint: "مقترحات وعروض جاهزة للإرسال",
    icon: FileText,
  },
  {
    id: "landing",
    label: "صفحات هبوط تبيع",
    hint: "صفحات وعروض ترفع نسبة التحويل",
    icon: LayoutTemplate,
  },
  {
    id: "support",
    label: "دعم ومتابعة بعد البيع",
    hint: "متابعة الطلبات وحل الشكاوى وتكرار الشراء",
    icon: LifeBuoy,
  },
  { id: "local", label: "عملاء من منطقتك", hint: "خرائط جوجل والبحث المحلي والفروع", icon: Globe2 },
];

const glassField =
  "w-full rounded-2xl border border-border bg-card/60 px-4 py-3 text-sm outline-none backdrop-blur-xl transition placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-card/80";

function Onboarding() {
  const navigate = useNavigate();
  const { data: workspace } = useWorkspace();
  const updateWorkspace = useUpdateWorkspace();
  const addBrain = useAddBrainItem(workspace?.id);
  const createAutomation = useServerFn(saveAutomation);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [about, setAbout] = useState("");
  const [website, setWebsite] = useState("");
  const [tone, setTone] = useState(tones[0]!.id);
  const [customTone, setCustomTone] = useState("");
  const [banned, setBanned] = useState<string[]>(["الأفضل في العالم", "مجاناً ١٠٠٪"]);
  const [bannedInput, setBannedInput] = useState("");
  const [picked, setPicked] = useState<string[]>(["social"]);
  const [hired, setHired] = useState<string[]>(team.map((member) => member.id));

  useEffect(() => {
    if (!workspace) return;
    setName((value) => value || workspace.name);
    setIndustry((value) => value || workspace.industry);
    setWebsite((value) => value || workspace.website || "");
  }, [workspace]);

  const current = steps[step]!;
  const progress = useMemo(() => Math.round(((step + 1) / steps.length) * 100), [step]);

  const toggle = (list: string[], set: (value: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);

  async function finish() {
    if (!workspace) return;
    setSaving(true);
    try {
      const finalName = name.trim() || workspace.name;
      const finalTone = customTone.trim() || tone;
      await updateWorkspace.mutateAsync({
        id: workspace.id,
        patch: {
          name: finalName,
          industry: industry.trim() || workspace.industry,
          initials: finalName.slice(0, 2),
          tone: finalTone,
          website: website.trim() || null,
          banned_words: banned,
        },
      });

      if (about.trim()) {
        await addBrain.mutateAsync({
          kind: "note",
          title: "ماذا نبيع ولمن",
          body: about.trim(),
          meta: "ملاحظة · من الإعداد الأولي",
        });
      }
      if (picked.length) {
        await addBrain.mutateAsync({
          kind: "note",
          title: "أهدافنا هذا الربع",
          body: picked
            .map((id) => goals.find((goal) => goal.id === id)?.label)
            .filter(Boolean)
            .join("، "),
          meta: "ملاحظة · من الإعداد الأولي",
        });
      }

      const topic = industry.trim() || workspace.industry || finalName;
      if (picked.includes("social") && hired.includes("sonny")) {
        try {
          await createAutomation({
            data: {
              workspaceId: workspace.id,
              employeeId: "sonny",
              skillId: "social-daily-ideas",
              label: "3 أفكار منشورات كل صباح",
              values: {
                business: topic,
                platform: "إنستغرام",
                dialect: "خليجية (السعودية/الإمارات)",
              },
              cadence: "daily",
              dayOfWeek: 1,
              hour: 7,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Cairo",
              autoPublish: false,
              active: true,
            },
          });
        } catch (error) {
          console.error("[onboarding] social automation failed:", error);
        }
      }
      if ((picked.includes("seo") || picked.includes("brand")) && hired.includes("nour")) {
        try {
          await createAutomation({
            data: {
              workspaceId: workspace.id,
              employeeId: "nour",
              skillId: "daily-ideas",
              label: "5 أفكار محتوى كل صباح",
              values: { topic, count: "5" },
              cadence: "daily",
              dayOfWeek: 1,
              hour: 6,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Cairo",
              autoPublish: false,
              active: true,
            },
          });
        } catch (error) {
          console.error("[onboarding] content automation failed:", error);
        }
      }

      void navigate({ to: "/app/chat" });
    } finally {
      setSaving(false);
    }
  }

  const next = () => (step === steps.length - 1 ? void finish() : setStep(step + 1));

  return (
    <div className="onboarding-stage sahl-onboarding-theme min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-6">
        <Link to="/" className="font-display text-2xl font-black">
          سهل<span className="text-primary">.</span>
        </Link>
        <Link
          to="/app"
          className="rounded-full border border-border bg-card/60 px-4 py-2 text-xs font-bold backdrop-blur-xl"
        >
          تخطّي الإعداد
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-20">
        <div className="mb-5 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-card/80">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-bold text-muted-foreground">
            {step + 1} / {steps.length}
          </span>
        </div>

        <ol className="mb-6 flex flex-wrap gap-2">
          {steps.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setStep(index)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold backdrop-blur-xl transition",
                  index === step
                    ? "border-primary/50 bg-primary/20 text-foreground"
                    : "border-border bg-card/50 text-muted-foreground hover:text-foreground",
                )}
              >
                {index < step ? <Check className="size-3.5 text-primary" /> : null}
                {item.title}
              </button>
            </li>
          ))}
        </ol>

        <section className="onboarding-glass rounded-[2rem] p-6 sm:p-9">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] font-bold text-primary backdrop-blur-xl">
            <Sparkles className="size-3.5" /> خطوة اختيارية — تقدر تتخطاها
          </span>
          <h1 className="mt-4 font-display text-2xl font-black md:text-3xl">{current.title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{current.lead}</p>

          <div className="mt-7">
            {current.id === "site" ? (
              <div className="space-y-5">
                {workspace ? (
                  <BusinessProfileCard
                    workspaceId={workspace.id}
                    compact
                    onProfiled={(profiled) => {
                      if (profiled.name) setName(profiled.name);
                      if (profiled.industry && profiled.industry !== "عام")
                        setIndustry(profiled.industry);
                      const summary = [
                        profiled.summary,
                        profiled.products.length ? `نبيع: ${profiled.products.join("، ")}` : "",
                        profiled.audience ? `لمن: ${profiled.audience}` : "",
                      ]
                        .filter(Boolean)
                        .join("\n");
                      if (summary) setAbout(summary);
                      if (profiled.suggestedTone) setTone(profiled.suggestedTone);
                    }}
                  />
                ) : null}
                <label className="block">
                  <span className="mb-2 block text-sm font-bold">رابط موقعك (اختياري)</span>
                  <div className="relative">
                    <Globe2 className="absolute right-3 top-3.5 size-4 text-muted-foreground" />
                    <input
                      value={website}
                      onChange={(event) => setWebsite(event.target.value)}
                      dir="ltr"
                      placeholder="https://example.com"
                      className={cn(glassField, "pe-9")}
                    />
                  </div>
                </label>
                <p className="rounded-2xl border border-border bg-card/50 p-4 text-sm text-muted-foreground backdrop-blur-xl">
                  ما عندك موقع؟ لا مشكلة إطلاقاً — اضغط «التالي» واكتب عن نشاطك بكلماتك.
                </p>
              </div>
            ) : null}

            {current.id === "business" ? (
              <div className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold">اسم النشاط</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={glassField}
                    placeholder="مثال: نخلة للتمور الفاخرة"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold">مجال النشاط</span>
                  <input
                    value={industry}
                    onChange={(event) => setIndustry(event.target.value)}
                    className={glassField}
                    placeholder="تجزئة، مطاعم، خدمات…"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold">ماذا تبيع ولمن؟</span>
                  <textarea
                    value={about}
                    onChange={(event) => setAbout(event.target.value)}
                    className={cn(glassField, "min-h-32 resize-none")}
                    placeholder="نورّد تموراً فاخرة معبأة يدوياً للمتاجر والفنادق في السعودية…"
                  />
                </label>
                <p className="flex items-center gap-2 rounded-2xl border border-border bg-card/50 p-4 text-sm text-muted-foreground backdrop-blur-xl">
                  <Sparkles className="size-4 shrink-0 text-primary" />
                  هذا النص يذهب إلى عقل العلامة ويقرأه كل موظفيك.
                </p>
              </div>
            ) : null}

            {current.id === "voice" ? (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  {tones.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTone(item.id)}
                      className={cn(
                        "rounded-2xl border p-4 text-start backdrop-blur-xl transition",
                        tone === item.id
                          ? "border-primary/60 bg-primary/15"
                          : "border-border bg-card/50 hover:bg-card/70",
                      )}
                    >
                      <span className="block font-bold">{item.label}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        «{item.sample}»
                      </span>
                    </button>
                  ))}
                </div>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold">
                    أو اكتب نبرتك بنفسك (اختياري)
                  </span>
                  <textarea
                    value={customTone}
                    onChange={(event) => setCustomTone(event.target.value)}
                    className={cn(glassField, "min-h-24 resize-none")}
                    placeholder="نتكلم بلهجة سعودية بسيطة، جمل قصيرة، وبدون مبالغة…"
                  />
                </label>
                <div>
                  <span className="mb-2 block text-sm font-bold">كلمات ممنوعة</span>
                  <div className="flex flex-wrap gap-2">
                    {banned.map((word) => (
                      <button
                        key={word}
                        type="button"
                        onClick={() => setBanned((list) => list.filter((item) => item !== word))}
                        className="rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-bold backdrop-blur-xl hover:border-destructive/50 hover:text-destructive"
                      >
                        {word} ✕
                      </button>
                    ))}
                  </div>
                  <input
                    value={bannedInput}
                    onChange={(event) => setBannedInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== "،" && event.key !== ",") return;
                      event.preventDefault();
                      const word = bannedInput.trim();
                      if (word && !banned.includes(word)) setBanned((list) => [...list, word]);
                      setBannedInput("");
                    }}
                    placeholder="اكتب كلمة واضغط Enter"
                    className={cn(glassField, "mt-3")}
                  />
                </div>
              </div>
            ) : null}

            {current.id === "goals" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {goals.map((goal) => {
                  const on = picked.includes(goal.id);
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => toggle(picked, setPicked, goal.id)}
                      className={cn(
                        "flex items-start gap-3 rounded-2xl border p-4 text-start backdrop-blur-xl transition",
                        on
                          ? "border-primary/60 bg-primary/15"
                          : "border-border bg-card/50 hover:bg-card/70",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-2xl",
                          on ? "bg-primary text-primary-foreground" : "bg-card/70",
                        )}
                      >
                        <goal.icon className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-bold">{goal.label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {goal.hint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {current.id === "team" ? (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  {team.map((member) => {
                    const on = hired.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggle(hired, setHired, member.id)}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border p-4 text-start backdrop-blur-xl transition",
                          on
                            ? "border-primary/60 bg-primary/15"
                            : "border-border bg-card/50 hover:bg-card/70",
                        )}
                      >
                        <span
                          className="size-11 shrink-0 overflow-hidden rounded-2xl"
                          style={{ background: member.tintSoft }}
                        >
                          <Portrait memberId={member.id} name={member.name} className="size-full" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold">{member.name}</span>
                          <span className="block truncate text-sm text-muted-foreground">
                            {member.role}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "grid size-6 shrink-0 place-items-center rounded-full border",
                            on
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border",
                          )}
                        >
                          {on ? <Check className="size-3.5" /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="rounded-2xl border border-border bg-card/50 p-4 text-sm text-muted-foreground backdrop-blur-xl">
                  لن نربط أي حساب الآن. عندما تطلب نشراً أو إرسالاً، سيطلب الموظف المعني ربط الحساب
                  بضغطة واحدة.
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
            <button
              type="button"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-5 py-2.5 text-sm font-bold backdrop-blur-xl disabled:opacity-40"
            >
              <ArrowRight className="size-4" /> السابق
            </button>
            <div className="flex items-center gap-3">
              {step < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  className="text-sm font-bold text-muted-foreground hover:text-foreground"
                >
                  تخطّي هذه الخطوة
                </button>
              ) : null}
              <button
                type="button"
                onClick={next}
                disabled={saving || !workspace}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition hover:opacity-95 disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {step === steps.length - 1 ? "ابدأ العمل" : "التالي"}
                <ArrowLeft className="size-4" />
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
