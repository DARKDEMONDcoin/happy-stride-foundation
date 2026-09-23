import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BarChart3,
  BrainCircuit,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronDown,
  Code2,
  Instagram,
  Loader2,
  LockKeyhole,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  SearchCheck,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Workflow,
} from "lucide-react";
import { faqs } from "@/components/site/Faq";
import { Portrait } from "@/components/site/Portrait";
import { SiteFooter } from "@/components/site/SiteFooter";
import { LogoMark } from "@/components/site/LogoMark";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { plans, priceOf, currencyOf, yearlyDiscount } from "@/data/pricing";
import { useRegion } from "@/hooks/use-region";
import ecommerceSector from "@/assets/sectors/ecommerce.jpg";
import restaurantsSector from "@/assets/sectors/restaurants.jpg";
import clinicsSector from "@/assets/sectors/clinics.jpg";
import realestateSector from "@/assets/sectors/realestate.jpg";
import sonnyDesktop from "@/assets/employee-screens-v2/sonny-desktop.png";
import sonnyMobile from "@/assets/employee-screens-v2/sonny-mobile.png";
import evaDesktop from "@/assets/employee-screens-v2/eva-desktop.png";
import evaMobile from "@/assets/employee-screens-v2/eva-mobile.png";
import samDesktop from "@/assets/employee-screens-v2/sam-desktop.png";
import samMobile from "@/assets/employee-screens-v2/sam-mobile.png";
import nourDesktop from "@/assets/employee-screens-v2/nour-desktop.png";
import nourMobile from "@/assets/employee-screens-v2/nour-mobile.png";
import danaDesktop from "@/assets/employee-screens-v2/dana-desktop.png";
import danaMobile from "@/assets/employee-screens-v2/dana-mobile.png";
import adamDesktop from "@/assets/employee-screens-v2/adam-desktop.png";
import adamMobile from "@/assets/employee-screens-v2/adam-mobile.png";
import planFlowWide from "@/assets/product/plan-flow-wide.png";
import planFlowTall from "@/assets/product/plan-flow-tall.png";
import adsVisual from "@/assets/product/ads-visual.png";
import proofVisual from "@/assets/product/proof-visual.png";
import { VerifiedBadge } from "@/components/site/VerifiedBadge";
import danaStory from "@/assets/sample/dana-cold-coffee-story.jpg";
import { SampleChatShot } from "@/components/site/SampleChatShot";

type DemoPhase = "idle" | "thinking" | "draft" | "approved";

const capabilities = [
  {
    icon: MessageSquareText,
    kicker: "سِراج · السوشيال والإعلانات المموّلة",
    title: "من طلب واحد إلى حملة جاهزة للاعتماد.",
    body: "يبني خطة ٣٠ يومًا، يكتب كل نسخة، ينسّق التصميم والنشر، ثم يعيد أفضل الأفكار إلى التقويم.",
    image: sonnyDesktop,
    mobileImage: sonnyMobile,
    tone: "terracotta",
    span: "wide",
  },
  {
    icon: CalendarCheck2,
    kicker: "أمَل · المساعدة التنفيذية",
    title: "ساعتك القادمة واضحة قبل أن تبدأ.",
    body: "تفرز البريد، ترتب الاجتماعات، وتضع القرارات المعلّقة في ملخص صباحي واحد.",
    image: evaDesktop,
    mobileImage: evaMobile,
    tone: "gold",
    span: "standard",
  },
  {
    icon: BarChart3,
    kicker: "سالم · المبيعات",
    title: "كل فرصة لها رسالة وخطوة تالية.",
    body: "يبحث عن العميل المناسب، يخصص التواصل، ويسلمك الفرص الجاهزة للمكالمة.",
    image: samDesktop,
    mobileImage: samMobile,
    tone: "teal",
    span: "standard",
  },
  {
    icon: SearchCheck,
    kicker: "نور · المحتوى والسيو",
    title: "إجابة عربية يجدها عميلك وقت البحث.",
    body: "ترصد السؤال، تبني خطة موضوعات، وتكتب صفحات أصلية مرتبطة بما يطلبه السوق.",
    image: nourDesktop,
    mobileImage: nourMobile,
    tone: "terracotta",
    span: "wide",
  },
  {
    icon: Sparkles,
    kicker: "دانة · التصميم",
    title: "فكرة واحدة، وكل المقاسات جاهزة.",
    body: "تحول المسودة إلى نظام بصري متسق، ثم تجهز نسخ كل منصة للمراجعة.",
    image: danaDesktop,
    mobileImage: danaMobile,
    tone: "teal",
    span: "standard",
  },
  {
    icon: BrainCircuit,
    kicker: "آدم · تحليل البيانات",
    title: "التقرير ينتهي بقرار، لا برقم.",
    body: "يجمع أداء القنوات، يرصد التغير، ويحدد أين تتحرك الميزانية والجهد بعد ذلك.",
    image: adamDesktop,
    mobileImage: adamMobile,
    tone: "gold",
    span: "standard",
  },
] as const;

const sectors = [
  {
    id: "ecommerce",
    label: "المتاجر",
    title: "الحملة تبدأ بالمحتوى وتنتهي بقرار شراء.",
    body: "سِراج يطلق القصة، دانة تجهز المقاسات، سالم يتابع المهتمين، وآدم يوضح ما يستحق التكرار.",
    stat: "٦ أدوار متصلة",
    image: ecommerceSector,
    task: "إطلاق مجموعة الخريف",
    result: "١٢ مادة للمراجعة",
    signal: "٤ قنوات جاهزة",
    icon: "◫",
  },
  {
    id: "restaurants",
    label: "المطاعم",
    title: "عرض اليوم لا ينتظر اجتماع الأسبوع.",
    body: "أمَل ترتب الموعد، سِراج يجهز النشر، دانة تصمم العرض، والفريق يتابع الرسائل في مسار واحد.",
    stat: "من الطلب للنشر",
    image: restaurantsSector,
    task: "قائمة نهاية الأسبوع",
    result: "موعد النشر ٦:٣٠",
    signal: "٣ مواد جاهزة",
    icon: "✦",
  },
  {
    id: "clinics",
    label: "العيادات",
    title: "معلومة دقيقة تمر بالمراجعة قبل جمهورك.",
    body: "نور تكتب المادة، دانة توضحها بصريًا، وأمَل توقف أي مادة حساسة حتى تصل موافقتك.",
    stat: "مراجعة بشرية",
    image: clinicsSector,
    task: "سلسلة التوعية الشهرية",
    result: "بانتظار موافقتك",
    signal: "٦ موضوعات",
    icon: "+",
  },
  {
    id: "realestate",
    label: "العقار",
    title: "الإعلان والمتابعة والتقرير في سياق واحد.",
    body: "سِراج يقدم العقار، سالم يتابع المهتمين، وآدم يلخص القنوات التي جلبت فرصًا جادة.",
    stat: "فريق واحد",
    image: realestateSector,
    task: "إطلاق عقار جديد",
    result: "قائمة المتابعة جاهزة",
    signal: "٥ مواعيد",
    icon: "⌂",
  },
] as const;

/** أرقام حقيقية محسوبة من داخل المنصة نفسها — قابلة للتحقق داخل حسابك. */
const stats = [
  { value: "١٠٨", label: "قدرة جاهزة داخل المنصة", tone: "terracotta" },
  { value: "٤٠", label: "تكاملاً رسميًا مع أدواتك", tone: "gold" },
  { value: "٦", label: "موظفين يعملون بسياق واحد", tone: "teal" },
  { value: "٥", label: "لهجات عربية يكتب بها الفريق", tone: "fusion" },
];

/** إثباتات قابلة للتحقق داخل الحساب — لا ادعاءات عملاء. */
const proofs = [
  {
    kicker: "تحقق بنفسك",
    title: "١٠٨ قدرة تُشغَّل بضغطة",
    body: "افتح محادثة أي موظف واضغط «القدرات»: كل قدرة لها نموذج إدخال ومخرج جاهز للاعتماد، من خطة ٣٠ يومًا إلى فحص سيو فوري.",
  },
  {
    kicker: "بيانات حقيقية",
    title: "أرقامك من مصادرها الرسمية",
    body: "تقارير Search Console وGA4 تُقرأ من حسابك مباشرة بعد الربط. لا نعرض رقمًا مُولّدًا مكان رقم حقيقي، والمصدر مكتوب أسفل كل تقرير.",
  },
  {
    kicker: "سجل كامل",
    title: "كل خطوة مكتوبة ومراجَعة",
    body: "كل مخرج يُحفظ كمهمة «بانتظار اعتمادك» في صفحة الموافقات، ولا يخرج إجراء إلى منصة قبل ضغطك على الاعتماد.",
  },
] as const;

/** منهج سِراج في الإعلانات الممولة — معايير سوق معلنة، لا نتائج عميل مزعومة. */
const adsProof = [
  { k: "نسبة نقر مستهدفة", v: "١٪–٢٪", note: "معيار Meta لكرييتف جيد" },
  { k: "إيقاف التمرير ٣ ثوانٍ", v: "٢٥٪–٤٠٪", note: "معيار فيديو قوي" },
  { k: "نقطة التعادل", v: "١ ÷ الهامش", note: "هامش ٤٠٪ ⇒ ٢٫٥× ROAS" },
  { k: "سقف تكلفة الليد", v: "القيمة × الإغلاق", note: "يُحسب من أرقامك أنت" },
] as const;

/** مخرجات حقيقية التُقطت من مساحات عمل فعلية داخل المنصة — منسوخة كما سُلِّمت. */
const sampleBoards = [
  {
    business: "قهوة رواق · مقهى مختص · جدة",
    prompt:
      "اكتب لي منشور إنستجرام قصير عن عرض قهوة مختصة في جدة: كل مشروب بارد بـ ١٩ ريال من ٤ العصر لـ ٧ المغرب طوال الأسبوع",
    cards: [
      {
        employeeId: "sonny",
        employee: "سِراج",
        role: "مدير السوشيال ميديا",
        quality: 82,
        image: null as string | null,
        publish: { connect: "إنستجرام" },
        body: "### المنشور\nلعشاق القهوة الباردة في جدة… من ٤ إلى ٧، أي مشروب بارد من قهوتنا المختصة بـ١٩ ريال.\n\nخلّ حرارة جدة برا، وبرّد يومك بخيارك المفضل يومياً طوال الأسبوع.\n\nشاهد الخيارات في الصورة، ومرّ علينا قبل ٧ واطلب مشروبك.\n\n### الهاشتاقات\n\\#قهوة\\_مختصة \\#قهوة\\_باردة \\#جدة\n\n### التوقيت والقياس\n- النشر: ٣:٣٠ عصراً بتوقيت جدة؛ قبل بداية العرض بنصف ساعة.\n- القياس بعد ٤٨ ساعة: نسبة المشاركات إلى الوصول.",
      },
      {
        employeeId: "dana",
        employee: "دانة",
        role: "مديرة التصميم",
        quality: 82,
        image: danaStory as string | null,
        publish: { connect: "إنستجرام" },
        body: "### الاتجاه البصري\n- كوب قهوة باردة مكثّف القطرات يحتل ٤٠٪ من الإطار، بإضاءة مسائية دافئة وخلفية بنية هادئة.\n- السعر ١٩ ريال هو العنصر الأكبر، ثم الوقت، ثم الموقع والدعوة.\n\n### المواصفات\n- ستوري إنستجرام ١٠٨٠×١٩٢٠ بكسل؛ خالٍ من النص أول ٢٥٠ بكسل وآخر ٣٢٠ بكسل.\n- الألوان: بني داكن #2B1D17، كريمي #FFF4DF، كراميل #D6A15C بنسبة ٦٠/٣٠/١٠.\n- التباين المحسوب ١٤٫٩:١ — يحقق WCAG AA.",
      },
    ],
  },
  {
    business: "متجر لمار · تجزئة إلكترونية",
    prompt:
      "اكتب لي فقرة افتتاحية لمقال في مدونة متجرنا عن كيف يختار العميل هدية عملية بأقل من ٢٠٠ ريال",
    cards: [
      {
        employeeId: "nour",
        employee: "نور",
        role: "مديرة المحتوى والسيو",
        quality: 72,
        image: null as string | null,
        publish: null,
        body: "# كيف تختار هدية عملية بأقل من 200 ريال تترك أثراً حقيقياً؟\n\nاختيار هدية عملية بميزانية اقتصادية لا يعني أبداً التنازل عن القيمة أو الذوق. ركّز على ثلاثة معايير: أن تخدم روتيناً يومياً للمتلقي، وتأتي بجودة تصنيع مناسبة للاستعمال المتكرر، وتُقدَّم بأسلوب أنيق يرفع قيمتها البصرية.\n\n### حزمة السيو المرافقة\n- عنوان الميتا: كيف تختار هدية عملية بأقل من 200 ريال؟ دليل خطوة بخطوة\n- الرابط اللطيف: practical-gifts-under-200-sar\n- البيانات المنظمة: Article مدمجة مع FAQPage",
      },
    ],
  },
  {
    business: "عيادة صفا · عيادة أسنان",
    prompt: "اكتب لي رد واتساب على عميل يسأل عن سعر تنظيف الأسنان وموعد متاح هذا الأسبوع",
    cards: [
      {
        employeeId: "sam",
        employee: "سالم",
        role: "مدير المبيعات",
        quality: 82,
        image: null as string | null,
        publish: null,
        body: "الموضوع: استفسار موعد تنظيف الأسنان\n\nحياك الله، سعر تنظيف الأسنان يعتمد على نوع التنظيف المطلوب، ونوضح لك السعر المعتمد قبل تثبيت الحجز، وفي حال احتاجت اللثة تنظيفًا عميقًا يحدد الطبيب التكلفة بعد الفحص. بخصوص حجز موعد، يحتاج التوافر إلى مراجعة الجدول؛ لتحديد أقرب موعد متاح لك، هل تفضل الفترة الصباحية أم المسائية؟",
      },
    ],
  },
] as const;

/** الفرق بين سهل ومحادثة ذكاء اصطناعي عامة. */
const versus = [
  {
    q: "الذاكرة",
    chat: "تشرح مشروعك من جديد كل مرة",
    sahl: "يعرف نشاطك ونبرتك وعروضك ويبني عليها",
  },
  { q: "التخصص", chat: "صوت واحد لكل المهام", sahl: "ستة تخصصات، كل واحد بأدواته ومعاييره" },
  { q: "التنفيذ", chat: "تنسخ النص وتنشره بنفسك", sahl: "ينشر ويجدول ويردّ عبر حساباتك بعد الربط" },
  {
    q: "الاعتماد",
    chat: "لا توجد مرحلة مراجعة",
    sahl: "كل إجراء يقف في صفحة الموافقات حتى تعتمده",
  },
  { q: "الأرقام", chat: "تقديرات عامة", sahl: "يقرأ Search Console وGA4 من حسابك مباشرة" },
  { q: "السجل", chat: "محادثة تضيع", sahl: "سجل مكتوب: من فعل ماذا ومتى" },
  {
    q: "الإعلانات وإدارتها",
    chat: "تنسخ نص الإعلان وتدير الحملة بنفسك",
    sahl: "موظف متخصص لبناء الإعلانات وإدارتها — من تنفيذ مدير أفضل شركة تسويق وترجمة في مصر، بخبرة الأفضل لكل مجال وشخص بالأعلانات الممولة",
  },
  {
    q: "صناعة المحتوى البصري",
    chat: "تكتب نصًا وتصمّم الوسائط بنفسك",
    sahl: "يولّد فيديوهات وريلزات وصورًا وكل ما تحتاجه بنفسه",
  },
  {
    q: "حل مشكلة المشروع",
    chat: "نصائح عامة لا تخص حالتك",
    sahl: "أعلى خبرة في تشخيص مشكلة كل مشروع وتحويله إلى مشروع يدر أرباحًا بلا سقف",
  },
] as const;

/** ضمانات التشغيل — مفصّلة في صفحة الأمان. */
const guards = [
  {
    icon: LockKeyhole,
    t: "صلاحيات دنيا قابلة للسحب",
    d: "كل ربط يبدأ بأقل صلاحية ممكنة، وتسحبها من صفحة التكاملات في ثانية.",
  },
  {
    icon: CheckCircle2,
    t: "لا إجراء بدون اعتمادك",
    d: "النشر والردود والميزانيات كلها تقف عند صفحة الموافقات أولًا.",
  },
  {
    icon: ShieldCheck,
    t: "لا تدريب على بياناتك",
    d: "محتوى مشروعك لا يُستخدم لتدريب نماذج عامة، وتُحذف بياناتك عند الطلب.",
  },
  {
    icon: Code2,
    t: "سجل تدقيق لكل خطوة",
    d: "كل إجراء مسجَّل باسمه ووقته والحساب الذي نُفّذ عليه.",
  },
] as const;

const trustPoints = [
  "العربية ولهجاتها",
  "ذاكرة تعرف مشروعك",
  "ستة تخصصات تتعاون",
  "موافقتك قبل التنفيذ",
  "أدواتك في مكان واحد",
  "سجل واضح لكل خطوة",
] as const;

const statHorizonPaths = Array.from({ length: 36 }, (_, index) => {
  const startY = 382 + index * 0.25;
  const firstY = 320 - index * 3.8;
  const secondY = 34 + index * 4.6;
  const endY = 362 + index * 1.7;
  return `M 1480 ${startY.toFixed(1)} C 1240 ${firstY.toFixed(1)}, 690 ${secondY.toFixed(1)}, -80 ${endY.toFixed(1)}`;
});

const statHorizonSignals = [4, 13, 22, 31];

const statHorizonNodes = [
  { cx: 1304, cy: 315, r: 2.2, delay: "-1s" },
  { cx: 1186, cy: 266, r: 1.5, delay: "-4.4s" },
  { cx: 1072, cy: 221, r: 2.8, delay: "-2.6s" },
  { cx: 936, cy: 178, r: 1.7, delay: "-6.1s" },
  { cx: 790, cy: 154, r: 2.1, delay: "-3.2s" },
  { cx: 651, cy: 149, r: 1.4, delay: "-7.3s" },
  { cx: 516, cy: 169, r: 2.5, delay: "-5.2s" },
  { cx: 382, cy: 211, r: 1.6, delay: "-.4s" },
  { cx: 236, cy: 272, r: 2.2, delay: "-6.8s" },
  { cx: 92, cy: 342, r: 1.5, delay: "-2s" },
];

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          node.classList.add("is-visible");
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={`sahl-reveal ${className}`}>
      {children}
    </div>
  );
}

/** هبوط الأجهزة من الأعلى إلى مكانها عند ظهورها — بأسلوب Stripe. */
function useDeviceLanding<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const land = () => node.classList.add("is-landed");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      land();
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          window.requestAnimationFrame(land);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function ProductFrame({
  src,
  mobileSrc,
  alt,
  hero = false,
}: {
  src: string;
  mobileSrc?: string;
  alt: string;
  hero?: boolean;
}) {
  const ref = useDeviceLanding<HTMLElement>();
  return (
    <figure
      ref={ref}
      className={`sahl-device-frame sahl-device-drop${hero ? " is-hero" : ""}${mobileSrc ? " is-responsive-device" : ""}`}
    >
      <div className="sahl-device-lid">
        <span className="sahl-device-camera" aria-hidden="true" />
        <span className="sahl-phone-button is-volume-up" aria-hidden="true" />
        <span className="sahl-phone-button is-volume-down" aria-hidden="true" />
        <span className="sahl-phone-button is-power" aria-hidden="true" />
        <div className="sahl-device-screen">
          <picture>
            {mobileSrc && <source media="(max-width: 720px)" srcSet={mobileSrc} />}
            <img src={src} alt={alt} loading={hero ? "eager" : "lazy"} />
          </picture>
        </div>
      </div>
      <div className="sahl-laptop-base" aria-hidden="true">
        <i />
      </div>
    </figure>
  );
}

function ToolConnections() {
  return (
    <div
      className="sahl-tool-connections"
      aria-label="إنستجرام وواتساب وجوجل وفيسبوك وشوبيفاي متصلة بسهل"
    >
      <svg className="sahl-tool-wires" viewBox="0 0 560 136" aria-hidden="true">
        <path id="sahl-tool-wire-1" d="M74 28 C164 28 194 68 280 68" />
        <path id="sahl-tool-wire-2" d="M74 68 C166 68 200 68 280 68" />
        <path id="sahl-tool-wire-3" d="M74 108 C164 108 194 68 280 68" />
        <path id="sahl-tool-wire-4" d="M486 42 C394 42 368 68 280 68" />
        <path id="sahl-tool-wire-5" d="M486 94 C394 94 368 68 280 68" />
        <g className="sahl-tool-pulses">
          <use href="#sahl-tool-wire-1" />
          <use href="#sahl-tool-wire-2" />
          <use href="#sahl-tool-wire-3" />
          <use href="#sahl-tool-wire-4" />
          <use href="#sahl-tool-wire-5" />
        </g>
      </svg>
      <div className="sahl-tool-icon is-instagram" title="إنستجرام">
        <Instagram />
        <span>إنستجرام</span>
      </div>
      <div className="sahl-tool-icon is-whatsapp" title="واتساب">
        <MessageCircle />
        <span>واتساب</span>
      </div>
      <div className="sahl-tool-icon is-google" title="جوجل">
        <b>G</b>
        <span>جوجل</span>
      </div>
      <div className="sahl-tool-icon is-facebook" title="فيسبوك">
        <b>f</b>
        <span>فيسبوك</span>
      </div>
      <div className="sahl-tool-icon is-shopify" title="شوبيفاي">
        <ShoppingBag />
        <span>شوبيفاي</span>
      </div>
      <div className="sahl-tool-core">
        <LogoMark size={34} />
        <span>سهل</span>
      </div>
    </div>
  );
}

function SirajDemo() {
  const [prompt, setPrompt] = useState("أطلق المنتج الجديد خلال أسبوعين ونسّق الفريق كله");
  const [phase, setPhase] = useState<DemoPhase>("idle");
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );
  const run = () => {
    if (!prompt.trim() || phase === "thinking") return;
    setPhase("thinking");
    timer.current = window.setTimeout(() => setPhase("draft"), 850);
  };
  return (
    <div className="sahl-demo" id="siraj-demo">
      <header>
        <span>
          <i /> غرفة عمل الفريق
        </span>
        <strong>سِراج ينسّق المهمة</strong>
        <small>٦ موظفين جاهزون</small>
      </header>
      <div className="sahl-demo-grid">
        <aside>
          <Portrait memberId="sonny" name="سِراج" eager />
          <strong>سِراج</strong>
          <small>يقود الإطلاق</small>
          <nav>
            <b>المحادثة</b>
            <span>خطة الفريق</span>
            <span>الموافقات</span>
            <span>النتائج</span>
          </nav>
        </aside>
        <div className="sahl-chat">
          <div className="sahl-user-message">
            <small>طلبك</small>
            <p>{prompt}</p>
          </div>
          {phase === "thinking" && (
            <div className="sahl-thinking">
              <Loader2 className="animate-spin" /> سِراج يقسم الإطلاق ويوزع العمل على الفريق...
            </div>
          )}
          {(phase === "draft" || phase === "approved") && (
            <div className="sahl-agent-message">
              <span>
                <Portrait memberId="sonny" name="سِراج" />
                <b>سِراج</b>
              </span>
              <p>
                بنيت خطة ١٤ يومًا: ٨ منشورات و٦ قصص. دانة تجهز المقاسات، نور تكتب صفحة الإطلاق، أمَل
                ترتب الجدول، سالم يتابع المهتمين، وآدم يقيس القنوات.
              </p>
              <div>
                <span>١٤ مادة منظمة</span>
                <span>٥ زملاء مرتبطون بالمهمة</span>
              </div>
            </div>
          )}
          {phase === "approved" && (
            <div className="sahl-success">
              <CheckCircle2 />
              <span>
                <b>اعتمدت خطة الفريق</b>
                <small>انتقلت المهام إلى مساحات الموظفين</small>
              </span>
            </div>
          )}
          <div className="sahl-composer">
            <label htmlFor="sahl-prompt">اكتب النتيجة التي تريدها</label>
            <textarea
              id="sahl-prompt"
              rows={2}
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
                setPhase("idle");
              }}
            />
            <Button
              type="button"
              size="icon"
              onClick={run}
              disabled={!prompt.trim() || phase === "thinking"}
              aria-label="إرسال الطلب للفريق"
            >
              {phase === "thinking" ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
          </div>
          {(phase === "draft" || phase === "approved") && (
            <div className="sahl-demo-actions">
              <Button variant="outline" onClick={() => setPhase("idle")}>
                عدّل الخطة
              </Button>
              <Button onClick={() => setPhase("approved")} disabled={phase === "approved"}>
                <Check />
                {phase === "approved" ? "تم الاعتماد" : "اعتمد ووزّع"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function EditorialHomepage() {
  const [sector, setSector] = useState(0);
  const [sample, setSample] = useState(0);
  const [sampleExpanded, setSampleExpanded] = useState(false);
  const [pricingYearly, setPricingYearly] = useState(true);
  const { country } = useRegion();
  const pricingCurrency = currencyOf(country);
  const currentSector = sectors[sector] ?? sectors[0];
  const currentSample = sampleBoards[sample] ?? sampleBoards[0];
  /** إيقاف حركات المشاهد خارج الشاشة حتى يبقى التمرير سلسًا تمامًا. */
  useEffect(() => {
    const scenes = Array.from(document.querySelectorAll<HTMLElement>(".sahl-scene"));
    if (!scenes.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          entry.target.classList.toggle("is-onscreen", entry.isIntersecting);
      },
      { rootMargin: "20% 0px" },
    );
    for (const scene of scenes) observer.observe(scene);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="sahl-white-home" dir="rtl">
      <section className="sahl-hero" aria-labelledby="home-title">
        <div className="sahl-hero-ribbon" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="sahl-shell sahl-hero-layout">
          <Reveal className="sahl-hero-copy">
            <div
              className="sahl-live-metric"
              aria-label="١٠٨ قدرة جاهزة، ٤٠ تكاملاً، ٦ موظفين بالعربية"
            >
              <span>
                <b>١٠٨</b> قدرة جاهزة
              </span>
              <i aria-hidden="true">•</i>
              <span>
                <b>٤٠</b> تكاملاً
              </span>
              <i aria-hidden="true">•</i>
              <span>
                <b>٦</b> موظفين بالعربية
              </span>
            </div>
            <h1 id="home-title">
              اللي محتاج شهر يتعمل...
              <br />
              يتعمل <em>قبل ما تخلص قهوتك.</em>
            </h1>
            <p className="sahl-first-claim">أول منصة ذكاء اصطناعي عربية.</p>
            <p className="sahl-lead">يكتبولك، يصمملك، يبيعولك، وانت بس بتشوف النتيجة بتكبر.</p>
            <div className="sahl-actions">
              <Button asChild size="lg">
                <Link to="/auth" search={{ mode: "signup" as const }}>
                  كوّن فريقك مجانًا <ArrowLeft />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/pricing">
                  الخطط والأسعار <ArrowLeft />
                </Link>
              </Button>
            </div>
            <small>
              <CheckCircle2 /> تجربة ١٤ يومًا · لا نطلب بطاقة بنكية
            </small>
          </Reveal>
          <div className="sahl-hero-product">
            <span className="sahl-hero-wash" aria-hidden="true" />
            <ProductFrame
              src={sonnyDesktop}
              mobileSrc={sonnyMobile}
              alt="مساحة عمل سهل: محادثة سِراج داخل المنصة"
              hero
            />
            <div className="sahl-float-note liquid-glass-sahl" role="status">
              <span className="sahl-float-note-icon is-verified">
                <VerifiedBadge title="مخرجات موثّقة بانتظار اعتمادك" />
              </span>
              <div>
                <b>بانتظار اعتمادك</b>
              </div>
              <i className="sahl-float-note-dot" aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>

      <section className="sahl-trust" aria-label="مزايا تشغيل فريق سهل">
        <div className="sahl-shell">
          <p>
            <b>مصمم للعمل العربي</b> من أول طلب حتى آخر قرار
          </p>
          <div className="sahl-trust-row">
            {trustPoints.map((point, index) => (
              <span key={point}>
                <small>٠{index + 1}</small>
                <b>{point}</b>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="sahl-section sahl-sample sahl-dark sahl-scene">
        <div className="sahl-dark-veil" aria-hidden="true" />
        <div className="sahl-shell">
          <Reveal>
            <header className="sahl-section-head">
              <div>
                <span>مخرج حقيقي · بلا تجميل</span>
                <h2>
                  اطلبها بكلماتك.
                  <br />
                  <em>واستلمها جاهزة لقرارك.</em>
                </h2>
              </div>
            </header>
          </Reveal>
          <Reveal className="sahl-sample-showcase">
            <div className="sahl-sample-tabs" role="tablist" aria-label="اختر نوع النشاط">
              {sampleBoards.map((board, index) => (
                <Button
                  key={board.business}
                  type="button"
                  variant="ghost"
                  role="tab"
                  aria-selected={sample === index}
                  className={sample === index ? "is-active" : undefined}
                  onClick={() => {
                    setSample(index);
                    setSampleExpanded(false);
                  }}
                >
                  <span aria-hidden="true">{index === 0 ? "☕" : index === 1 ? "◫" : "+"}</span>
                  {index === 0 ? "مطعم ومقهى" : index === 1 ? "متجر إلكتروني" : "عيادة"}
                </Button>
              ))}
            </div>
            <div
              className={`sahl-sample-viewport${sampleExpanded ? " is-expanded" : ""}`}
              role="tabpanel"
            >
              <SampleChatShot
                business={currentSample.business}
                prompt={currentSample.prompt}
                cards={currentSample.cards}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="sahl-sample-expand"
              aria-expanded={sampleExpanded}
              onClick={() => setSampleExpanded((value) => !value)}
            >
              {sampleExpanded ? "عرض مختصر" : "عرض المحادثة كاملة"}
              <ChevronDown aria-hidden="true" />
            </Button>
          </Reveal>
          <Reveal>
            <p className="sahl-sample-note">
              <CheckCircle2 aria-hidden="true" /> الأرقام والعروض في الأمثلة من طلب المستخدم نفسه —
              الفريق لا يخترع سعرًا ولا وعدًا من عنده.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="sahl-section sahl-capabilities">
        <div className="sahl-shell">
          <Reveal>
            <header className="sahl-section-head">
              <span>ستة تخصصات بسياق واحد</span>
              <h2>
                كل موظف ينجز دوره.
                <br />
                <em>وكل نتيجة تسلّم التالية.</em>
              </h2>
              <p>
                سِراج يبدأ الحملة، دانة تجهز صورتها، نور توسع قصتها، سالم يحول الاهتمام إلى فرصة،
                أمَل ترتب الوقت، وآدم يقرأ ما حدث.
              </p>
            </header>
          </Reveal>
          <div className="sahl-cap-grid">
            {capabilities.map((item) => (
              <Reveal key={item.kicker} className={`sahl-cap-card is-${item.span} is-${item.tone}`}>
                <div>
                  <item.icon />
                  <span>{item.kicker}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  {item.kicker.startsWith("سِراج") && (
                    <aside className="sahl-coming-ads">
                      <Megaphone aria-hidden="true" />
                      <div>
                        <span>تخصص إضافي</span>
                        <strong>سِراج يبني حملاتك المموّلة</strong>
                        <p>
                          يحسب هامشك وسقف تكلفة التحويل، يضع هيكل الحساب ومصفوفة خمس زوايا كرييتف
                          وخطة القياس. الإطلاق المباشر على المنصات يتم بعد ربطها وبموافقتك.
                        </p>
                      </div>
                    </aside>
                  )}
                  <Link to="/features">
                    شاهد مهامه <ArrowLeft />
                  </Link>
                </div>
                {item.span === "wide" ? (
                  <ProductFrame
                    src={item.image}
                    mobileSrc={item.mobileImage}
                    alt={`واجهة ${item.kicker} داخل سهل`}
                  />
                ) : null}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="sahl-stats sahl-scene">
        <div className="sahl-stats-wave" aria-hidden="true">
          <svg viewBox="0 0 1400 520" preserveAspectRatio="none">
            <defs>
              <linearGradient id="sahlStatsWave" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--home-terracotta)" />
                <stop offset="48%" stopColor="var(--home-gold)" />
                <stop offset="100%" stopColor="var(--home-teal)" />
              </linearGradient>
            </defs>
            <g className="sahl-stats-wave-lines">
              <path d="M-80 388 C 190 310 338 435 572 342 S 918 126 1510 184" />
              <path d="M-80 424 C 204 342 358 466 590 374 S 940 158 1510 216" />
              <path d="M-80 460 C 220 380 378 498 616 410 S 968 192 1510 250" />
              <path d="M-80 352 C 176 278 322 398 548 308 S 886 96 1510 150" />
            </g>
            <path
              className="sahl-stats-wave-light"
              d="M-80 388 C 190 310 338 435 572 342 S 918 126 1510 184"
            />
          </svg>
        </div>
        <div className="sahl-shell">
          <Reveal>
            <header>
              <span>أرقام من داخل المنصة</span>
              <h2>
                <strong>ما تحصل عليه فعليًا</strong>
                <em> من أول يوم في حسابك.</em>
              </h2>
            </header>
          </Reveal>
          <div className="sahl-stat-grid">
            {stats.map((item, index) => (
              <Reveal key={item.label} className={`sahl-stat is-${item.tone}`}>
                <small>٠{index + 1}</small>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="sahl-section sahl-demo-section">
        <div className="sahl-shell">
          <Reveal>
            <header className="sahl-section-head is-split">
              <div>
                <span>جرّب تسليم المهمة</span>
                <h2>
                  قل ما تريد مرة.
                  <br />
                  <em>واستلم خطة الفريق.</em>
                </h2>
              </div>
              <p>
                طلب واحد من عندك، يتحول إلى ست مهام موزعة على سِراج ودانة ونور وأمَل وسالم وآدم.
              </p>
            </header>
          </Reveal>
          <Reveal>
            <figure className="sahl-plan-flow">
              <picture>
                <source media="(max-width: 720px)" srcSet={planFlowTall} />
                <img
                  src={planFlowWide}
                  alt="طلب واحد يتفرع إلى ست مهام ملونة يتسلمها موظفو سهل"
                  loading="lazy"
                  width={1536}
                  height={864}
                />
              </picture>
              <figcaption>من طلب واحد إلى خطة موزعة على الفريق</figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      <section className="sahl-section sahl-versus sahl-dark sahl-scene">
        <div className="sahl-dark-veil" aria-hidden="true" />
        <div className="sahl-versus-beam" aria-hidden="true" />
        <div className="sahl-shell">
          <Reveal>
            <header className="sahl-section-head">
              <span>السؤال الأول دائمًا</span>
              <h2>
                ولماذا لا أستخدم محادثة ذكاء اصطناعي عادية؟
                <br />
                <em>لأن المحادثة تكتب، وسهل يشتغل.</em>
              </h2>
            </header>
          </Reveal>
          <Reveal className="sahl-versus-table">
            <div className="sahl-versus-head">
              <span>الفرق</span>
              <span>محادثة عامة</span>
              <span>
                <LogoMark size={18} /> سهل
              </span>
            </div>
            {versus.map((row) => (
              <div key={row.q} className="sahl-versus-row">
                <span>{row.q}</span>
                <span className="is-plain">{row.chat}</span>
                <span className="is-sahl">
                  <Check aria-hidden="true" />
                  {row.sahl}
                </span>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="sahl-section sahl-sectors">
        <div className="sahl-shell">
          <Reveal>
            <header className="sahl-section-head">
              <span>فريق يتعلم طبيعة نشاطك</span>
              <h2>
                الأدوار نفسها.
                <br />
                <em>والسياق يتغير مع مشروعك.</em>
              </h2>
              <p>اختر نشاطًا لترى كيف تتغير المهمة، ترتيب الموظفين، ونقطة موافقتك.</p>
            </header>
          </Reveal>
          <div className="sahl-sector-tabs" role="tablist" aria-label="اختر نوع النشاط">
            {sectors.map((item, index) => (
              <Button
                key={item.id}
                variant="ghost"
                role="tab"
                aria-selected={sector === index}
                aria-controls="sahl-sector-content"
                className={sector === index ? "is-active" : ""}
                onClick={() => setSector(index)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <Reveal className="sahl-sector-panel">
            <div>
              <span>{currentSector.label}</span>
              <h3>{currentSector.title}</h3>
              <p>{currentSector.body}</p>
              <strong>{currentSector.stat}</strong>
              <Link to="/use-cases/$id" params={{ id: currentSector.id }}>
                استكشف هذا المسار <ArrowLeft />
              </Link>
            </div>
            <figure id="sahl-sector-content" role="tabpanel" key={currentSector.id}>
              <img
                src={currentSector.image}
                alt={`مشهد يوضح عمل فريق سهل في قطاع ${currentSector.label}`}
                loading="lazy"
                width={1280}
                height={900}
              />
              <div className="sahl-sector-brand">
                <i>{currentSector.icon}</i>
                <span>
                  <small>غرفة عمل الفريق</small>
                  <b>{currentSector.label}</b>
                </span>
                <em>المثال يعمل</em>
              </div>
              <div className="sahl-sector-task">
                <small>المهمة الجارية</small>
                <b>{currentSector.task}</b>
                <span>
                  <i /> {currentSector.result}
                </span>
              </div>
              <div className="sahl-sector-signal">
                <small>مؤشر المتابعة</small>
                <strong>{currentSector.signal}</strong>
                <span>مثال توضيحي</span>
              </div>
            </figure>
          </Reveal>
        </div>
      </section>

      <section className="sahl-section sahl-infrastructure sahl-scene">
        <div className="sahl-shell">
          <Reveal>
            <header className="sahl-section-head is-split">
              <div>
                <span>حساباتك وقواعدك</span>
                <h2>
                  الفريق يصل لأدواتك.
                  <br />
                  <em>والقرار يبقى عندك.</em>
                </h2>
              </div>
              <p>
                سِراج ينشر، سالم يتابع، نور تقرأ البحث، وآدم يجمع الأداء. لا يخرج إجراء حساس قبل
                قاعدة الاعتماد التي تحددها.
              </p>
            </header>
          </Reveal>
          <Reveal className="sahl-system-board">
            <ToolConnections />
            <div className="sahl-system-points">
              <span>
                <Workflow />
                <b>سياق ينتقل بين الستة</b>
              </span>
              <span>
                <LockKeyhole />
                <b>موافقة قبل التنفيذ</b>
              </span>
              <span>
                <Code2 />
                <b>سجل واضح لكل خطوة</b>
              </span>
            </div>
            <div className="sahl-system-horizon" aria-hidden="true">
              <svg viewBox="0 0 1440 440" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="sahlSystemHorizonLine" x1="100%" y1="72%" x2="0%" y2="28%">
                    <stop offset="0%" stopColor="var(--home-terracotta)" />
                    <stop offset="42%" stopColor="var(--home-gold)" stopOpacity=".46" />
                    <stop offset="100%" stopColor="var(--home-teal)" />
                  </linearGradient>
                  <linearGradient id="sahlSystemHorizonSignal" x1="100%" y1="70%" x2="0%" y2="30%">
                    <stop offset="0%" stopColor="var(--home-gold)" stopOpacity="0" />
                    <stop offset="45%" stopColor="var(--home-gold)" />
                    <stop offset="100%" stopColor="var(--home-bg)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <g className="sahl-horizon-lines">
                  {statHorizonPaths.map((path, index) => (
                    <path
                      key={path}
                      d={path}
                      style={{ "--line-opacity": 0.52 - index * 0.009 } as CSSProperties}
                    />
                  ))}
                </g>
                <g className="sahl-horizon-signals">
                  {statHorizonSignals.map((pathIndex, index) => (
                    <path
                      key={pathIndex}
                      d={statHorizonPaths[pathIndex]}
                      style={{ "--signal-delay": `${index * -3.7}s` } as CSSProperties}
                    />
                  ))}
                </g>
                <g className="sahl-horizon-nodes">
                  {statHorizonNodes.map((node) => (
                    <circle
                      key={`${node.cx}-${node.cy}`}
                      cx={node.cx}
                      cy={node.cy}
                      r={node.r}
                      style={{ "--node-delay": node.delay } as CSSProperties}
                    />
                  ))}
                </g>
              </svg>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="sahl-section sahl-proof sahl-dark sahl-scene">
        <div className="sahl-dark-veil" aria-hidden="true" />
        <div className="sahl-proof-ledger" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="sahl-shell">
          <Reveal>
            <header className="sahl-section-head">
              <span>إثبات بدل الوعد</span>
              <h2>
                لا نعرض شهادات مجهولة.
                <br />
                <em>نعرض ما يمكنك التحقق منه.</em>
              </h2>
              <p>
                كل رقم في هذه الصفحة إما موجود داخل المنصة، أو معيار سوق معلن مصدره. ولا نضع اسم
                عميل لم يوافق على ذكره.
              </p>
            </header>
          </Reveal>
          <Reveal className="sahl-proof-visual">
            <figure>
              <img
                src={proofVisual}
                alt="طبقات من السجلات والموافقات المتسلسلة داخل سهل"
                loading="lazy"
                width={1280}
                height={960}
              />
              <span className="sahl-visual-sweep" aria-hidden="true" />
              <span className="sahl-visual-ring" aria-hidden="true" />
            </figure>
            <figcaption>
              كل مخرج له بطاقة، ولكل بطاقة أثر مكتوب: من طلبها، ومن اعتمدها، ومتى.
            </figcaption>
          </Reveal>
          <div className="sahl-proof-grid">
            {proofs.map((item) => (
              <Reveal key={item.title}>
                <article>
                  <span>{item.kicker}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="sahl-section sahl-ads sahl-scene">
        <div className="sahl-shell">
          <Reveal>
            <header className="sahl-section-head is-split">
              <div>
                <span>سِراج · الإعلانات المموّلة</span>
                <h2>
                  حملة تُبنى من أرقام مشروعك.
                  <br />
                  <em>لا من تخمين.</em>
                </h2>
              </div>
              <p>
                سِراج يحسب هامشك وقيمة عميلك أولًا، ثم يبني هيكل الحساب ومصفوفة الكرييتف وخطة القياس
                ليوم واحد حتى اليوم الرابع عشر — ولا تُعتمد ميزانية ولا تُطلق حملة قبل موافقتك.
              </p>
            </header>
          </Reveal>
          <Reveal className="sahl-ads-visual">
            <figure>
              <img
                src={adsVisual}
                alt="قمع إعلاني ومنحنى أداء ودوائر استهداف بألوان سهل"
                loading="lazy"
                width={1280}
                height={960}
              />
              <span className="sahl-visual-orbit" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="sahl-visual-sweep" aria-hidden="true" />
            </figure>
            <div>
              <span>منهج سِراج</span>
              <h3>من الوحدات الاقتصادية إلى الكرييتف إلى القياس.</h3>
              <p>
                قبل أي ريال إنفاق: نعرف هامشك، وقيمة عميلك، والسقف الذي لا تتجاوزه تكلفة التحويل. ثم
                يُبنى الحساب والكرييتف والقياس على هذه الأرقام وحدها.
              </p>
            </div>
          </Reveal>
          <Reveal className="sahl-ads-board">
            <div className="sahl-ads-metrics">
              {adsProof.map((item) => (
                <span key={item.k}>
                  <small>{item.k}</small>
                  <strong>{item.v}</strong>
                  <em>{item.note}</em>
                </span>
              ))}
            </div>
            <ol className="sahl-ads-steps">
              <li>
                <b>الوحدات الاقتصادية</b>
                <span>هامشك وقيمة عميلك يحددان سقف تكلفة التحويل قبل أي إنفاق.</span>
              </li>
              <li>
                <b>هيكل الحساب</b>
                <span>حملة تحويل واحدة، مجموعات محدودة، وتوزيع ٧٠/٢٠/١٠ على القمع.</span>
              </li>
              <li>
                <b>خمس زوايا كرييتف</b>
                <span>
                  ألم، نتيجة، اعتراض، دليل، مقارنة — بنصوص بلهجة جمهورك وبريف تصميم لدانة.
                </span>
              </li>
              <li>
                <b>القياس والتشخيص</b>
                <span>بيكسل وأحداث وUTM، ثم شجرة تشخيص تحدد أين يضيع الإنفاق بالضبط.</span>
              </li>
            </ol>
            <p className="sahl-ads-note">
              <LockKeyhole aria-hidden="true" /> الأرقام أعلاه نطاقات معيارية للسوق تُستخدم
              للمقارنة، وليست نتائج حساب بعينه. الإطلاق المباشر على منصات الإعلانات يتم عبر الربط
              الرسمي وبعد اعتمادك.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="sahl-section sahl-guard sahl-dark sahl-scene">
        <div className="sahl-dark-veil" aria-hidden="true" />
        <div className="sahl-guard-radar" aria-hidden="true">
          <b />
          <i />
          <i />
          <i />
        </div>
        <div className="sahl-shell">
          <Reveal>
            <header className="sahl-section-head is-split">
              <div>
                <span>قبل أن تربط حساباتك</span>
                <h2>
                  نعمل داخل أدواتك.
                  <br />
                  <em>فهذه قواعدنا الأربع.</em>
                </h2>
              </div>
              <p>
                لا نطلب ثقتك دون شرح ما نفعله ببياناتك وصلاحياتك — والتفاصيل كاملة في{" "}
                <Link to="/security">صفحة الأمان</Link>.
              </p>
            </header>
          </Reveal>
          <div className="sahl-guard-grid">
            {guards.map((item) => (
              <Reveal key={item.t}>
                <article>
                  <item.icon aria-hidden="true" />
                  <h3>{item.t}</h3>
                  <p>{item.d}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="sahl-section sahl-pricing" aria-labelledby="home-pricing-title">
        <div className="sahl-shell">
          <Reveal>
            <header className="sahl-section-head">
              <span>عدد الموظفين يتبع حجم العمل</span>
              <h2 id="home-pricing-title">
                ابدأ بدور واحد.
                <br />
                <em>وأضف الفريق حين تحتاجه.</em>
              </h2>
              <p>
                لا تدفع مقابل مقاعد لا تعمل. اختر البداية، أو فعّل تعاون الموظفين الستة في خطة
                النمو. الاشتراك شهري ويُلغى في أي وقت — <Link to="/refunds">سياسة الاسترداد</Link>.
              </p>
            </header>
          </Reveal>
          <Reveal>
            <div className="sahl-home-billing" role="radiogroup" aria-label="دورة الفوترة">
              <Button
                type="button"
                variant="ghost"
                role="radio"
                aria-checked={!pricingYearly}
                className={!pricingYearly ? "is-active" : undefined}
                onClick={() => setPricingYearly(false)}
              >
                شهري
              </Button>
              <Button
                type="button"
                variant="ghost"
                role="radio"
                aria-checked={pricingYearly}
                className={pricingYearly ? "is-active" : undefined}
                onClick={() => setPricingYearly(true)}
              >
                سنوي <small>وفّر {yearlyDiscount * 100}%</small>
              </Button>
            </div>
          </Reveal>
          <div className="sahl-plan-grid">
            {plans.map((plan, planIndex) => {
              const displayPrice = priceOf(plan, pricingYearly, country);
              const numericPrice = Number(displayPrice.replace(/,/g, ""));
              return (
              <Reveal key={plan.id} className="sahl-plan-reveal">
                <article
                  className={`liquid-glass-sahl sahl-home-plan ${plan.highlight ? "is-featured" : ""}`}
                  style={{ "--plan-order": planIndex } as CSSProperties}
                >
                  {plan.highlight && <span className="sahl-plan-tag">الأكثر اختيارًا</span>}
                  <header className="sahl-home-plan-head">
                    <h3>{plan.name}</h3>
                    <p>{plan.desc}</p>
                  </header>
                  <div className="sahl-price">
                    {Number.isFinite(numericPrice) ? (
                      <>
                        <strong><AnimatedNumber value={numericPrice} duration={450} /></strong>
                        <span>{pricingCurrency.label} / شهريًا</span>
                      </>
                    ) : (
                      <strong className="is-custom">حسب الطلب</strong>
                    )}
                  </div>
                  <div className="sahl-plan-divider" aria-hidden="true" />
                  <ul>
                    {plan.perks.map((perk, perkIndex) => (
                      <li
                        key={perk}
                        style={{ "--perk-order": perkIndex } as CSSProperties}
                      >
                        <span className="sahl-home-perk-icon" data-tone={perkIndex % 3}>
                          <Check aria-hidden="true" />
                        </span>
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild variant="outline" className="sahl-home-plan-cta">
                    {plan.id !== "scale" ? (
                      <Link to="/auth" search={{ mode: "signup" as const, plan: plan.id }}>
                        {plan.cta}
                        <ArrowLeft />
                      </Link>
                    ) : (
                      <Link to="/contact">
                        {plan.cta}
                        <ArrowLeft />
                      </Link>
                    )}
                  </Button>
                </article>
              </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="sahl-section sahl-faq">
        <div className="sahl-shell">
          <Reveal>
            <header className="sahl-section-head">
              <span>قرارات واضحة قبل التشغيل</span>
              <h2>
                ما الذي يفعله الفريق؟
                <br />
                وما الذي يبقى بيدك؟
              </h2>
            </header>
          </Reveal>
          <Accordion type="single" collapsible>
            {faqs.slice(0, 6).map((item, index) => (
              <AccordionItem key={item.q} value={`faq-${index}`}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="sahl-final">
        <div className="sahl-shell">
          <Reveal>
            <span>اكتب أول نتيجة تريدها</span>
            <h2>
              الفريق يوزع العمل.
              <br />
              وأنت تعتمد القرار.
            </h2>
            <p>كوّن فريقك، أرسل الهدف مرة واحدة، وراجع الخطة قبل أن يبدأ التنفيذ.</p>
            <div className="sahl-actions">
              <Button asChild size="lg">
                <Link to="/auth" search={{ mode: "signup" as const }}>
                  ابدأ تجربتك المجانية <ArrowLeft />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link to="/pricing">شاهد الأسعار</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
