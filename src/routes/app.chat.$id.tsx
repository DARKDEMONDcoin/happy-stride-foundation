import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Check,
  Copy,
  Share2,
  RefreshCw,
  Download,
  PenLine,
  Plus,
  Trash2,
  History,
  X,
  Fingerprint,
  SlidersHorizontal,
  BookOpenText,
  AudioLines,
  PlugZap,
  ImagePlus,
  TextCursorInput,
  Search,
  CalendarDays,
  Bot,
  ListChecks,
  ExternalLink,
  ArrowRight,
  Plane,
  CalendarClock,
  CheckCircle2,
  Sparkles,
  ScrollText,
  LayoutDashboard,
  ChevronDown,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { ConnectNow } from "@/components/app/ConnectNow";
import { InlineApproval } from "@/components/app/InlineApproval";
import { getMember } from "@/data/team";
import {
  useAddBrainItem,
  useBrainItems,
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useIntegrations,
  useMessages,
  useProfile,
  useRenameConversation,
  useWorkspace,
} from "@/lib/data";
import { askEmployee, runSkill } from "@/lib/ai.functions";
import { saveChatSignal } from "@/lib/learning.functions";
import { SkillPalette } from "@/components/app/SkillPalette";
import { Thinking } from "@/components/app/Thinking";
import { Markdown } from "@/components/app/Markdown";
import { ChatAttachments, splitUserBody } from "@/components/app/ChatAttachments";
import { PostCards } from "@/components/app/PostCards";
import { requestedPublishTargets } from "@/lib/platforms";
import { askedForPublishableOutput, extractPostText, isNonPostReply } from "@/lib/post-format";
import { detectHandoff } from "@/lib/handoff";
import { HandoffCard } from "@/components/app/HandoffCard";
import { PublishToWordPress } from "@/components/app/PublishToWordPress";
import { ActionPanel } from "@/components/app/ActionPanel";
import { ActionCard, type PendingAction } from "@/components/app/ActionCard";
import { UserAvatar } from "@/components/app/UserAvatar";
import { BrandVoiceExtractor } from "@/components/app/BrandVoiceExtractor";
import { Portrait } from "@/components/site/Portrait";
import { streamEmployeeTurn } from "@/lib/employee-stream";
import {
  MediaStudio,
  type Attachment,
  type ImageMode,
  type Aspect,
} from "@/components/app/MediaStudio";

import { featuredSkillsFor, skillsFor, type Skill } from "@/data/skills";
import { cn } from "@/lib/utils";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";

/** يقسّم الرسائل حسب اليوم لعرض فواصل تاريخ أنيقة. */
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "اليوم";
  if (same(d, yesterday)) return "أمس";
  return d.toLocaleDateString("ar", { weekday: "long", day: "numeric", month: "long" });
}

function conversationDate(iso: string) {
  return new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  /** المؤقّت يُلغى عند الخروج: بدونه يُحدَّث زر مختفٍ بعد تبديل المحادثة. */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setDone(false), 1600);
        } catch {
          /* تجاهل */
        }
      }}
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.7rem] font-bold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      aria-label="نسخ الرد"
    >
      {done ? <Check className="size-3 text-jade" /> : <Copy className="size-3" />}
      {done ? "نُسخ" : "نسخ"}
    </button>
  );
}

/** أزرار أسفل رد الموظف: نسخ · مشاركة · تنزيل · تعديل في المربع · إعادة التوليد. */
function MessageActions({
  text,
  onEdit,
  onRegenerate,
  disabled,
}: {
  text: string;
  onEdit: () => void;
  onRegenerate: (() => void) | null;
  disabled: boolean;
}) {
  const [shared, setShared] = useState(false);
  /** المؤقّت يُلغى عند الخروج: بدونه يُحدَّث زر مختفٍ بعد تبديل المحادثة. */
  const shareTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (shareTimer.current) clearTimeout(shareTimer.current);
    },
    [],
  );
  const btn =
    "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.7rem] font-bold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50";
  const share = async () => {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setShared(true);
        if (shareTimer.current) clearTimeout(shareTimer.current);
        shareTimer.current = setTimeout(() => setShared(false), 1600);
      }
    } catch {
      /* أُلغيت المشاركة */
    }
  };
  const download = () => {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sahl-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <CopyButton text={text} />
      <button type="button" onClick={() => void share()} className={btn} aria-label="مشاركة">
        <Share2 className="size-3" /> {shared ? "نُسخ للمشاركة" : "مشاركة"}
      </button>
      <button type="button" onClick={download} className={btn} aria-label="تنزيل">
        <Download className="size-3" /> تنزيل
      </button>
      <button type="button" onClick={onEdit} className={btn} aria-label="تعديل يدوي">
        <PenLine className="size-3" /> عدّل
      </button>
      {onRegenerate ? (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={disabled}
          className={btn}
          aria-label="إعادة التوليد"
        >
          <RefreshCw className="size-3" /> أعد التوليد
        </button>
      ) : null}
    </span>
  );
}

/**
 * يقرّر إن كان رد الموظف منشوراً قابلاً للنشر (لا سؤالاً ولا شرحاً قصيراً).
 * يُطبَّق على كل الموظفين بالتساوي: المنشور القصير (تغريدة/كابشن/ستوري) مقبول
 * عندما يطلبه المستخدم صراحةً، والنص الطويل بلا هاشتاق يبقى مقبولاً كمنشور.
 */
function looksPostable(body: string, request?: string | null): boolean {
  const text = body.trim();
  if (text.length < 40) return false;
  if (/^[^\n]{0,200}\?\s*$/.test(text)) return false;
  if (isNonPostReply(text)) return false;
  if (/#[^\s#]{2,}/.test(text)) return true;
  if (/(تغريدة|تويت|tweet|كابشن|caption|ستور(?:ي|يز)|story|سناب|snap)/iu.test(request ?? ""))
    return text.length >= 40;
  return text.length > 220;
}

export const Route = createFileRoute("/app/chat/$id")({
  validateSearch: (s: Record<string, unknown>): { prompt?: string } =>
    typeof s["prompt"] === "string" && s["prompt"] ? { prompt: s["prompt"].slice(0, 4000) } : {},
  loader: ({ params }) => {
    const member = getMember(params.id);
    if (!member) throw notFound();
    return { name: member.name, role: member.role };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `محادثة ${loaderData.name} | سهل` : "محادثة | سهل" },
      {
        name: "description",
        content: loaderData ? `تحدث مع ${loaderData.name} — ${loaderData.role}.` : "محادثة الموظف.",
      },
      {
        property: "og:title",
        content: loaderData ? `محادثة ${loaderData.name} | سهل` : "محادثة | سهل",
      },
      {
        property: "og:description",
        content: loaderData ? `تحدث مع ${loaderData.name} — ${loaderData.role}.` : "محادثة الموظف.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: () => <ChatMissing />,
  notFoundComponent: () => <ChatMissing />,
  component: ChatPage,
});

function ChatMissing() {
  return (
    <AppShell title="الموظف غير موجود">
      <div className="rounded-3xl border border-border bg-card p-10 text-center">
        <p className="text-ink-soft">لم نعثر على هذا الموظف ضمن فريقك.</p>
        <Link
          to="/app/chat"
          className="mt-5 inline-block rounded-full bg-foreground px-6 py-2.5 text-sm font-bold text-background"
        >
          العودة للمحادثات
        </Link>
      </div>
    </AppShell>
  );
}

/** عناوين عربية لمفاتيح JSON عند عرض رد قديم بصيغة غير متوقعة. */
const JSON_LABELS: Record<string, string> = {
  day: "اليوم",
  title: "العنوان",
  content_pillar: "محور المحتوى",
  channel: "المنصة",
  body: "النص",
  caption: "النص",
  hashtags: "الهاشتاجات",
  scheduled: "موعد النشر",
  best_time: "أفضل وقت",
  metrics_to_measure: "مؤشرات القياس",
  call_to_action: "دعوة لاتخاذ إجراء",
  instagram_post: "منشور إنستجرام",
  x_post: "تغريدة إكس",
  linkedin_post: "منشور لينكدإن",
  facebook_post: "منشور فيسبوك",
};
const JSON_HIDDEN = new Set(["image_prompt", "needs_connection", "kind", "provider", "reason"]);

/** يحوّل أي بنية JSON إلى نص عربي مقروء بدل عرض أقواس ومفاتيح. */
function jsonToText(node: unknown, depth = 0): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string") return node.replace(/\\n/g, "\n").trim();
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (Array.isArray(node))
    return node
      .map((v) => {
        const r = jsonToText(v, depth + 1);
        return r && typeof v !== "object" ? `- ${r}` : r;
      })
      .filter(Boolean)
      .join(depth === 0 ? "\n\n---\n\n" : "\n");
  if (typeof node === "object")
    return Object.entries(node as Record<string, unknown>)
      .filter(([k, v]) => !JSON_HIDDEN.has(k) && v !== null && v !== undefined && v !== "")
      .map(([k, v]) => {
        const r = jsonToText(v, depth + 1);
        if (!r) return "";
        const label = JSON_LABELS[k] ?? k.replace(/_/g, " ");
        if (typeof v === "object") return `${"#".repeat(Math.min(depth + 2, 6))} ${label}\n\n${r}`;
        return r.includes("\n") ? `**${label}:**\n\n${r}` : `**${label}:** ${r}`;
      })
      .filter(Boolean)
      .join("\n\n");
  return "";
}

/** بعض الردود القديمة محفوظة كنص JSON خام — نحوّلها لعرض مقروء. */
/** يفصل بادئة JSON عن أي نص أُلحق بها (صورة، مصادر) في الردود القديمة. */
function splitJsonPrefix(text: string): { parsed: unknown; rest: string } | null {
  const open = text[0];
  if (open !== "{" && open !== "[") return null;
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        try {
          return { parsed: JSON.parse(text.slice(0, i + 1)), rest: text.slice(i + 1).trim() };
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function prettyBody(body: string): string {
  const text = body.trim();
  if (!text.startsWith("{") && !text.startsWith("[")) return body;
  try {
    const split = splitJsonPrefix(text);
    if (!split) throw new Error("not json");
    const { parsed, rest } = split;
    const tail = rest ? `\n\n${rest}` : "";
    const items = (Array.isArray(parsed) ? parsed : [parsed]) as Array<{
      reply?: string;
      deliverable?: { title?: string; body?: string } | null;
      deliverables?: Array<{ title?: string; body?: string }> | null;
    }>;
    const parts = items.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const chunk: string[] = [];
      if (typeof item.reply === "string" && item.reply.trim()) chunk.push(item.reply.trim());
      for (const d of [
        item.deliverable,
        ...(Array.isArray(item.deliverables) ? item.deliverables : []),
      ])
        if (d?.body) chunk.push(`### ${d.title ?? "المخرج"}\n\n${d.body}`);
      return chunk;
    });
    if (parts.length) return parts.join("\n\n") + tail;
    const readable = jsonToText(parsed);
    return readable.trim().length > 20 ? readable + tail : body;
  } catch {
    return body;
  }
}

function timeOf(iso: string) {
  const parts = new Intl.DateTimeFormat("ar-EG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("hour")}:${value("minute")} ${value("dayPeriod")}`.trim();
}

type WorkTool = {
  id: string;
  title: string;
  description: string;
  /** مسار داخلي يُعرض داخل المحادثة عبر إطار مدمج. */
  to: string;
  icon: typeof ListChecks;
  sonnyOnly?: boolean;
};

const WORK_TOOLS: WorkTool[] = [
  {
    id: "command-center",
    title: "مركز القيادة",
    description: "تابع العمل والنتائج والمنصات من مكان واحد",
    to: "/app/",
    icon: LayoutDashboard,
  },
  {
    id: "tasks",
    title: "المهام",
    description: "تابع التنفيذ خطوة بخطوة",
    to: "/app/tasks",
    icon: ListChecks,
  },
  {
    id: "autopilot",
    title: "الطيار الآلي",
    description: "شغّل صناعة ونشر المحتوى",
    to: "/app/autopilot",
    icon: Plane,
    sonnyOnly: true,
  },
  {
    id: "calendar",
    title: "تقويم المحتوى",
    description: "خطّط وراجع المحتوى بصريًا",
    to: "/app/calendar",
    icon: CalendarDays,
    sonnyOnly: true,
  },
  {
    id: "automations",
    title: "الجدولة التلقائية",
    description: "كرّر المهام في مواعيدها",
    to: "/app/automations",
    icon: CalendarClock,
  },
  {
    id: "queue",
    title: "طابور النشر",
    description: "راقب المنشورات ومواعيدها",
    to: "/app/queue",
    icon: History,
    sonnyOnly: true,
  },
  {
    id: "approvals",
    title: "الموافقات",
    description: "راجع واعتمد النتائج",
    to: "/app/approvals",
    icon: CheckCircle2,
  },
  {
    id: "proposals",
    title: "مبادرات الفريق",
    description: "ما يقترحه الموظف من نفسه",
    to: "/app/proposals",
    icon: Sparkles,
  },
  {
    id: "decisions",
    title: "سجل القرارات",
    description: "كل ما اتفقتم عليه ملزم",
    to: "/app/decisions",
    icon: ScrollText,
  },
];

/** بقية أقسام المنصة — تُفتح كذلك داخل المحادثة عند ذكر رابطها. */
const ALL_APP_TOOLS: WorkTool[] = [
  {
    id: "integrations",
    title: "التكاملات",
    description: "اربط حساباتك",
    to: "/app/integrations",
    icon: PlugZap,
  },
  {
    id: "brain",
    title: "عقل العلامة",
    description: "ذاكرة علامتك",
    to: "/app/brain",
    icon: BookOpenText,
  },
  {
    id: "reports",
    title: "التقارير",
    description: "أرقامك الحقيقية",
    to: "/app/reports",
    icon: ScrollText,
  },
  {
    id: "rankings",
    title: "تتبّع الترتيب",
    description: "ترتيبك في Google",
    to: "/app/rankings",
    icon: Search,
  },
  {
    id: "settings",
    title: "الإعدادات",
    description: "بيانات علامتك",
    to: "/app/settings",
    icon: SlidersHorizontal,
  },
  { id: "discovery", title: "الاكتشاف", description: "فرص جديدة", to: "/app/discovery", icon: Bot },
];

const EMPLOYEE_COPY: Record<string, { prompts: string[]; greetings: string[] }> = {
  sonny: {
    prompts: [
      "اكتب حملة إطلاق كاملة لمنتجي…",
      "حضّر تقويم محتوى للشهر القادم…",
      "حوّل هذه الفكرة إلى منشور جذّاب…",
      "راجع أداء حساباتي واقترح الخطوة التالية…",
    ],
    greetings: [
      "جاهز نحوّل فكرتك إلى حضور يستحق التوقف عنده.",
      "خلّينا نبني محتوى يبدو منك، لا من آلة.",
      "من أول الفكرة حتى النشر، أنا معك.",
      "قل لي هدفك، وسأرتّب الطريق الأقصر إليه.",
    ],
  },
  eva: {
    prompts: [
      "رتّبي أولويات يومي ورسائلي…",
      "حضّري ردًا مهنيًا على هذا البريد…",
      "نسّقي موعدًا يناسب الجميع…",
      "لخّصي ما يحتاج قراري اليوم…",
    ],
    greetings: [
      "سأحمي وقتك وأرتّب ما يستحق انتباهك أولًا.",
      "اترك التفاصيل لي واحتفظ أنت بالقرارات المهمة.",
      "يوم أهدأ يبدأ من قائمة مرتبة بوضوح.",
      "أنا هنا لأجعل كل شيء في موعده ومكانه.",
    ],
  },
  sam: {
    prompts: [
      "ابحث عن أفضل العملاء لهذا العرض…",
      "اكتب رسالة تواصل شخصية لهذا العميل…",
      "رتّب متابعة الفرص المفتوحة…",
      "حلّل خط المبيعات وحدد الأولوية…",
    ],
    greetings: [
      "لنبحث عن الفرص التي تستحق وقت فريقك فعلًا.",
      "كل رسالة ستبدو شخصية وواضحة، لا آلية.",
      "سأتابع بهدوء حتى تصبح الفرصة محادثة حقيقية.",
      "ابدأ بالهدف، وسأبني لك طريق الوصول للعميل.",
    ],
  },
  nour: {
    prompts: [
      "ابحث عن أفضل فرصة محتوى لموقعي…",
      "اكتب مقالًا عربيًا يتصدر البحث…",
      "راجع هذه الصفحة وحدد مشاكل السيو…",
      "ابنِ خريطة محتوى للموضوع بالكامل…",
    ],
    greetings: [
      "سنكتب للناس أولًا، ثم نجعل محركات البحث تفهمنا.",
      "كل كلمة سنختارها لها سبب ونتيجة قابلة للقياس.",
      "لنحوّل ما يبحث عنه جمهورك إلى محتوى يجدونه فعلًا.",
      "أنا جاهزة لبناء حضور يبقى، لا زيارة عابرة.",
    ],
  },
  dana: {
    prompts: [
      "صمّمي هوية بصرية لهذه الفكرة…",
      "حوّلي هذا العرض إلى إعلان جذّاب…",
      "أنشئي مجموعة تصاميم لكل المنصات…",
      "راجعي هذا التصميم وطوّريه…",
    ],
    greetings: [
      "لنحوّل فكرتك إلى شيء يُرى ويُتذكر.",
      "الجمال هنا ليس زينة؛ بل وضوح وثقة.",
      "سأحافظ على روح علامتك في كل مقاس وتفصيلة.",
      "ابدأ بالإحساس الذي تريده، وسأمنحه شكلًا.",
    ],
  },
  adam: {
    prompts: [
      "حلّل أداء القنوات هذا الشهر…",
      "أين نهدر الميزانية الآن؟…",
      "حوّل هذه الأرقام إلى قرارات واضحة…",
      "قارن النتائج وحدد ما يجب مضاعفته…",
    ],
    greetings: [
      "سأفصل الإشارة عن الضوضاء وأعطيك القرار الواضح.",
      "الأرقام تحكي قصة؛ دوري أن أجعلها مفهومة.",
      "لن ننظر إلى التقارير فقط، بل إلى الخطوة التالية.",
      "دعنا نعرف ما يعمل فعلًا وما يجب أن يتوقف.",
    ],
  },
};

/** أزرار الشريط العلوي المناسبة لكل موظف. */
const BAR_BRAND = new Set(["sonny", "nour", "dana"]);
const BAR_WORK = new Set(["sonny", "eva", "sam", "nour", "adam", "dana"]);

function useTypewriter(lines: string[], pause = 1700, enabled = true) {
  const [line, setLine] = useState(0);
  const [length, setLength] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setLine(0);
      setLength(lines[0]?.length ?? 0);
      setDeleting(false);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLength(lines[0]?.length ?? 0);
      return;
    }
    const current = lines[line] ?? "";
    const complete = length === current.length;
    const empty = length === 0;
    const delay = complete && !deleting ? pause : deleting ? 28 : 52;
    const timer = window.setTimeout(() => {
      if (complete && !deleting) setDeleting(true);
      else if (empty && deleting) {
        setDeleting(false);
        setLine((value) => (value + 1) % lines.length);
      } else setLength((value) => value + (deleting ? -1 : 1));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [deleting, enabled, length, line, lines, pause]);

  return lines[line]?.slice(0, length) ?? "";
}

function ChatPage() {
  const { id } = Route.useParams();
  const member = getMember(id);
  if (!member) return <ChatMissing />;
  return <ChatView key={id} id={id} member={member} />;
}

function ChatView({
  id,
  member,
}: {
  id: string;
  member: NonNullable<ReturnType<typeof getMember>>;
}) {
  const qc = useQueryClient();
  const { data: workspace } = useWorkspace();
  const { data: profile } = useProfile();
  const { data: conversations } = useConversations(workspace?.id, id);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [startingNewConversation, setStartingNewConversation] = useState(false);
  const createConversation = useCreateConversation(workspace?.id, id);
  const renameConversation = useRenameConversation(workspace?.id, id);
  const deleteConversation = useDeleteConversation(workspace?.id, id);
  const { data: messages } = useMessages(workspace?.id, id, conversationId);
  const { data: integrations } = useIntegrations(workspace?.id);
  const { data: brainItems } = useBrainItems(workspace?.id);
  const addBrainItem = useAddBrainItem(workspace?.id);
  const hasVoiceGuide = (brainItems ?? []).some((b) => b.title === "دليل صوت العلامة");
  const { prompt: prefill } = Route.useSearch();
  const [draft, setDraft] = useState(prefill ?? "");
  useEffect(() => {
    if (prefill) setDraft(prefill);
  }, [prefill]);
  const [pending, setPending] = useState<string | null>(null);
  /** البثّ الحقيقي: المرحلة التي ينفّذها الموظف الآن + نص ردّه وهو يُكتب. */
  const [liveStep, setLiveStep] = useState<string | null>(null);
  const [liveText, setLiveText] = useState("");
  const [savedTask, setSavedTask] = useState<string | null>(null);
  /** طلب ربط سياقي: يظهر فقط عندما تحتاج المهمة الحالية حساباً غير مربوط. */
  const [needsConnection, setNeedsConnection] = useState<{
    provider: string;
    reason: string;
  } | null>(null);
  /** إجراء حقيقي جهّزه الموظف على تكامله المربوط — ينتظر اعتماد المالك بضغطة. */
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const [error, setError] = useState<string | null>(null);

  // حرية الوسائط: مرفقات المستخدم + قراره في الصورة التلقائية + نسبة الأبعاد.
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [imageMode, setImageMode] = useState<ImageMode>("auto");
  const [imagePrompt, setImagePrompt] = useState("");
  const [aspect, setAspect] = useState<Aspect>("square");
  /** طول المنشور: اختياري تماماً — الافتراضي «تلقائي» يترك القرار للموظف. */
  const [postLength, setPostLength] = useState<"auto" | "short" | "medium" | "long">("auto");

  useEffect(() => {
    if (!startingNewConversation && !conversationId && conversations?.[0])
      setConversationId(conversations[0].id);
  }, [conversationId, conversations, startingNewConversation]);

  /** لوحات الشريط العلوي — تُفتح كلها داخل نفس الصفحة. */
  const [barPanel, setBarPanel] = useState<"apps" | "brand" | "chats" | "work" | null>(null);
  const [barPanelAnchor, setBarPanelAnchor] = useState({ x: 0, top: 0 });
  const barPanelButtonRefs = useRef<
    Record<"apps" | "brand" | "chats" | "work", HTMLButtonElement | null>
  >({ apps: null, brand: null, chats: null, work: null });
  const [brandSource, setBrandSource] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [embeddedTool, setEmbeddedTool] = useState<{
    tool: WorkTool;
    mode: "inline" | "expanded";
  } | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  /** كل مسار داخلي يُفتح داخل المحادثة نفسها بدل مغادرتها. */
  const openAppInChat = (path: string) => {
    const clean = path.split("?")[0]!.replace(/\/$/, "");
    const tool =
      WORK_TOOLS.find((item) => item.to.replace(/\/$/, "") === clean) ??
      ALL_APP_TOOLS.find((item) => item.to.replace(/\/$/, "") === clean);
    if (!tool) return false;
    setEmbeddedTool({ tool, mode: "inline" });
    setBarPanel(null);
    return true;
  };
  const [activeTool, setActiveTool] = useState<"media" | "length" | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  /** يبقى true وهو عند أسفل المحادثة، ويصير false لحظة ما يقلّب لأعلى بنفسه. */
  const [stickToBottom, setStickToBottom] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  /** يصير true عند إيقاف الطلب بعد الإرسال — فنتجاهل نتيجته. */
  const cancelledRef = useRef(false);

  const ask = useServerFn(askEmployee);
  const runSkillFn = useServerFn(runSkill);
  /** إشارة صامتة للتعلّم: «عدّل» أو «أعد التوليد» تقييمٌ حقيقي لا يحتاج سؤال المالك. */
  const sendChatSignal = useServerFn(saveChatSignal);
  const signal = (messageId: string, kind: "edited" | "rejected", originalText: string) => {
    if (!workspace) return;
    void sendChatSignal({
      data: { workspaceId: workspace.id, employeeId: id, messageId, kind, originalText },
    }).catch(() => undefined);
  };
  const employeeSkills = skillsFor(id);
  const quickSkills = featuredSkillsFor(id).slice(0, 6);
  const employeeCopy: { prompts: string[]; greetings: string[] } =
    EMPLOYEE_COPY[id] ?? EMPLOYEE_COPY["sonny"]!;
  // أثناء وجود رسائل لا نشغّل مؤقتات كتابة مستمرة تعيد رسم صفحة المحادثة كلها.
  const hasMessages = Boolean((messages ?? []).length || pending);
  const rotatingPlaceholder = useTypewriter(employeeCopy.prompts, 1700, !hasMessages);
  const rotatingGreeting = useTypewriter(employeeCopy.greetings, 2400, !hasMessages);
  const userName = profile?.full_name?.trim().split(/\s+/)[0] || "صديقي";
  /** آخر رسالة فشل إرسالها — لزر «أعد المحاولة». */
  const [pendingText, setPendingText] = useState<string | null>(null);

  /** إزاحة سحب لوحة الأداة — يحرّكها المستخدم من رأسها داخل نفس المحادثة. */
  const [toolOffset, setToolOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const positionBarPanel = (panel: "apps" | "brand" | "chats" | "work") => {
    const button = barPanelButtonRefs.current[panel];
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setBarPanelAnchor({ x: rect.left + rect.width / 2, top: rect.bottom + 8 });
  };

  const toggleBarPanel = (panel: "apps" | "brand" | "chats" | "work") => {
    if (barPanel === panel) {
      setBarPanel(null);
      return;
    }
    positionBarPanel(panel);
    setBarPanel(panel);
  };

  useEffect(() => {
    if (!barPanel) return;
    const reposition = () => positionBarPanel(barPanel);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [barPanel]);

  useEffect(() => {
    setToolOffset({ x: 0, y: 0 });
  }, [embeddedTool?.tool.id, embeddedTool?.mode]);
  const dragHandlers = {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest("button, a, input")) return;
      dragRef.current = {
        px: event.clientX,
        py: event.clientY,
        ox: toolOffset.x,
        oy: toolOffset.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      const start = dragRef.current;
      if (!start) return;
      setToolOffset({
        x: start.ox + (event.clientX - start.px),
        y: start.oy + (event.clientY - start.py),
      });
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
    },
  };
  const toolStyle = {
    transform: `translate3d(${toolOffset.x}px, ${toolOffset.y}px, 0)`,
  } satisfies React.CSSProperties;

  const owned = (integrations ?? []).filter((i) => i.employee_id === id);
  const filteredConversations = (conversations ?? []).filter((conversation) =>
    conversation.title
      .toLocaleLowerCase("ar")
      .includes(conversationSearch.trim().toLocaleLowerCase("ar")),
  );
  const wpConnected = (integrations ?? []).some(
    (i) => i.provider === "wordpress" && i.status === "connected",
  );

  const send = useMutation({
    mutationFn: async (message: string) => {
      const activeConversationId =
        startingNewConversation || !conversationId
          ? (await createConversation.mutateAsync()).id
          : conversationId;
      if (startingNewConversation || !conversationId) setConversationId(activeConversationId);
      setStartingNewConversation(false);
      const payload = {
        workspaceId: workspace!.id,
        employeeId: id,
        conversationId: activeConversationId,
        message,
        attachments,
        imageMode,
        imagePrompt: imagePrompt.trim() || undefined,
        imageAspect: aspect,
        postLength,
      };

      // البثّ الحقيقي: مراحل التنفيذ الفعلية ثم نص الرد وهو يُكتب.
      // الأسئلة والدردشة لا تبثّ شيئاً — تصل كاملة مرة واحدة.
      // لا نعيد الطلب إن كان التنفيذ قد بدأ فعلاً — كي لا تتكرر الرسالة مرتين.
      let started = false;
      try {
        const result = await streamEmployeeTurn(payload, {
          onStep: (label) => {
            started = true;
            if (!cancelledRef.current) setLiveStep(label);
          },
          onDelta: (text) => {
            started = true;
            if (cancelledRef.current) return;
            streamBufferRef.current += text;
            if (streamFrameRef.current === null) {
              streamFrameRef.current = window.requestAnimationFrame(flushStream);
            }
          },
          onReset: () => {
            streamBufferRef.current = "";
            setLiveText("");
          },
        });
        return { result, activeConversationId };
      } catch (streamError) {
        if (started) throw streamError;
        // تعذّر بدء البثّ (شبكة/جلسة): نُنفّذ الطلب بالمسار العادي كي لا يُفقد.
        console.warn("[chat] stream failed, falling back:", streamError);
        setLiveStep(null);
        setLiveText("");
        const result = await ask({ data: payload });
        return { result, activeConversationId };
      }
    },

    onSuccess: async ({ result: res, activeConversationId }) => {
      await qc.invalidateQueries({
        queryKey: ["messages", workspace?.id, id, activeConversationId],
      });
      setLiveStep(null);
      setLiveText("");
      if (cancelledRef.current) {
        cancelledRef.current = false;
        return;
      }
      setPending(null);
      setPendingText(null);

      // المرفقات ووصف الصورة يخصّان الرسالة المُرسلة فقط.
      setAttachments([]);
      setImagePrompt("");

      setSavedTask(res?.createdTaskId ?? null);
      setNeedsConnection(res?.needsConnection ?? null);
      setPendingAction((res?.action as PendingAction | null | undefined) ?? null);
      void qc.invalidateQueries({ queryKey: ["messages-last", workspace?.id] });
      void qc.invalidateQueries({ queryKey: ["conversations", workspace?.id, id] });
      void qc.invalidateQueries({ queryKey: ["tasks", workspace?.id] });
    },
    onError: (e: unknown, message) => {
      setPending(null);
      setLiveStep(null);
      setLiveText("");
      if (cancelledRef.current) {
        cancelledRef.current = false;
        return;
      }
      setPendingText(message);
      setError(e instanceof Error ? e.message : "تعذّر إرسال الطلب");
    },
  });

  const skillRun = useMutation({
    mutationFn: async (p: { skill: Skill; values: Record<string, string> }) => {
      const activeConversationId =
        startingNewConversation || !conversationId
          ? (await createConversation.mutateAsync()).id
          : conversationId;
      if (startingNewConversation || !conversationId) setConversationId(activeConversationId);
      setStartingNewConversation(false);
      return runSkillFn({
        data: {
          workspaceId: workspace!.id,
          employeeId: id,
          skillId: p.skill.id,
          values: p.values,
          conversationId: activeConversationId,
        },
      });
    },
    onSuccess: (res) => {
      setSavedTask(res?.taskId ?? null);
      void qc.invalidateQueries({ queryKey: ["messages", workspace?.id, id, conversationId] });
      void qc.invalidateQueries({ queryKey: ["messages-last", workspace?.id] });
      void qc.invalidateQueries({ queryKey: ["tasks", workspace?.id] });
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "تعذّر تنفيذ المهمة"),
  });

  const busy = send.isPending || skillRun.isPending;

  const messageRequests = useMemo(() => {
    let last = "";
    return (messages ?? []).map((message) => {
      const before = last;
      if (message.role === "user") last = splitUserBody(message.body).text || message.body;
      return before;
    });
  }, [messages]);

  // نحدّث شاشة البث مرة واحدة لكل إطار بدلاً من إعادة رسم المحادثة مع كل جزء صغير.
  const streamBufferRef = useRef("");
  const streamFrameRef = useRef<number | null>(null);
  const flushStream = () => {
    streamFrameRef.current = null;
    const chunk = streamBufferRef.current;
    streamBufferRef.current = "";
    if (chunk && !cancelledRef.current) setLiveText((previous) => previous + chunk);
  };

  useEffect(
    () => () => {
      if (streamFrameRef.current !== null) {
        window.cancelAnimationFrame(streamFrameRef.current);
        streamFrameRef.current = null;
      }
      streamBufferRef.current = "";
    },
    [],
  );

  // المستخدم حرّ في التقليب أثناء كتابة الموظف: لا ننزل معه إلا إذا كان أصلاً عند الأسفل.
  useEffect(() => {
    if (!stickToBottom) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [
    messages?.length,
    send.isPending,
    skillRun.isPending,
    liveStep,
    liveText,
    stickToBottom,
  ]);

  const onColumnScroll = () => {
    const el = columnRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStickToBottom(distance < 120);
  };

  // إبقاء التركيز في مربع الكتابة + تمدد تلقائي لارتفاع النص.
  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy, id]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    // مربع فارغ = ارتفاع ثابت، حتى لا يتحرك مع تقليب الجُمل.
    if (!draft) {
      el.style.height = "3rem";
      return;
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  const submit = (text: string) => {
    const body = text.trim();
    if (!body || !workspace || busy) return;
    setError(null);
    setSavedTask(null);
    setStickToBottom(true);

    cancelledRef.current = false;
    setDraft("");
    setLiveStep(null);
    setLiveText("");
    setPending(body);
    send.mutate(body);
  };

  /** إيقاف الطلب بعد الإرسال: نُعيد النص إلى مربع الإدخال ونُهمل النتيجة. */
  const stopSending = () => {
    if (!busy) return;
    cancelledRef.current = true;
    if (pending) setDraft(pending);
    setPending(null);
    setPendingText(null);
    setLiveStep(null);
    setLiveText("");
    setError(null);
    send.reset();
    skillRun.reset();
    inputRef.current?.focus();
  };

  return (
    <AppShell
      title={member.name}
      lead={member.role}
      padded={false}
      compactTitle
      actions={
        <div className="chat-topbar-actions no-scrollbar flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto sm:gap-1.5">
          <span
            className="chat-presence"
            title={busy ? `${member.name} بيشتغل على طلبك الآن` : `${member.name} متاح الآن`}
          >
            <i aria-hidden="true" />
            <span>{busy ? "بيشتغل الآن" : "متاح الآن"}</span>
          </span>
          <SkillPalette
            skills={employeeSkills}
            quick={quickSkills}
            hideQuick
            disabled={!workspace}
            pending={busy}
            onRun={(skill, values) => {
              setError(null);
              skillRun.mutate({ skill, values });
            }}
          />
          {member.apps.length ? (
            <button
              ref={(button) => {
                barPanelButtonRefs.current.apps = button;
              }}
              type="button"
              onClick={() => toggleBarPanel("apps")}
              aria-expanded={barPanel === "apps"}
              title={`تكاملات ${member.name}`}
              className={cn("topbar-pill", barPanel === "apps" && "is-active")}
            >
              <PlugZap className="size-4 shrink-0" />
              <span>التكاملات</span>
              <small>
                {owned.filter((i) => i.status === "connected").length}/{member.apps.length}
              </small>
            </button>
          ) : null}
          {BAR_BRAND.has(member.id) ? (
            <button
              ref={(button) => {
                barPanelButtonRefs.current.brand = button;
              }}
              type="button"
              onClick={() => toggleBarPanel("brand")}
              aria-expanded={barPanel === "brand"}
              title="عقل وصوت العلامة"
              className={cn("topbar-pill", barPanel === "brand" && "is-active")}
            >
              <Fingerprint className="size-4 shrink-0" />
              <span>العلامة</span>
            </button>
          ) : null}
          {BAR_WORK.has(member.id) ? (
            <button
              ref={(button) => {
                barPanelButtonRefs.current.work = button;
              }}
              type="button"
              onClick={() => toggleBarPanel("work")}
              aria-expanded={barPanel === "work"}
              title={`تشغيل ومتابعة ${member.name}`}
              className={cn("topbar-pill", barPanel === "work" && "is-active")}
            >
              <Bot className="size-4 shrink-0" />
              <span>تشغيل ومتابعة</span>
            </button>
          ) : null}
          <button
            ref={(button) => {
              barPanelButtonRefs.current.chats = button;
            }}
            type="button"
            onClick={() => toggleBarPanel("chats")}
            aria-expanded={barPanel === "chats"}
            title={`محادثات ${member.name}`}
            className={cn("topbar-pill", barPanel === "chats" && "is-active")}
          >
            <History className="size-4 shrink-0" />
            <span>المحادثات</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setStartingNewConversation(true);
              setConversationId(undefined);
              setBarPanel(null);
              setDraft("");
              setPending(null);
              setError(null);
              inputRef.current?.focus();
            }}
            disabled={!workspace}
            className="chat-new-button grid size-9 shrink-0 place-items-center rounded-full border border-border transition-colors hover:bg-secondary disabled:opacity-50"
            aria-label="محادثة جديدة"
            title="محادثة جديدة"
          >
            <Plus className="size-4" />
          </button>
        </div>
      }
    >
      <div className="chat-command-layout">
        <div
          className={cn(
            "chat-stage relative flex min-h-[calc(100dvh-4rem)] min-w-0 flex-col",
            ((messages ?? []).length > 0 || pending) && "is-engaged",
          )}
          style={
            {
              "--chat-accent": member.tint,
              "--chat-accent-soft": member.tintSoft,
            } as React.CSSProperties
          }
        >
          <div className="chat-smoke" aria-hidden="true">
            <i />
            <i />
            <i />
            <b />
            <b />
            <b />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div
            ref={columnRef}
            onScroll={onColumnScroll}
            className="chat-message-column relative mx-auto flex w-full max-w-none flex-1 flex-col px-3 sm:px-6 lg:px-8 xl:px-10"
          >
            {(messages ?? []).length === 0 && !pending ? (
              <div className="chat-welcome animate-pop-in">
                <div className="chat-welcome-portraits" aria-hidden="true">
                  <span className="chat-welcome-avatar is-user">
                    <UserAvatar />
                  </span>
                  <span className="chat-welcome-avatar is-employee">
                    <Portrait memberId={member.id} name={member.name} className="size-full" />
                  </span>
                </div>
                <p className="chat-welcome-eyebrow">
                  أنا {member.name}، {member.role}
                </p>
                <h2>أهلًا {userName}</h2>
                <p className="chat-welcome-rotating" aria-live="polite">
                  {rotatingGreeting}
                  <span className="typewriter-caret" aria-hidden="true" />
                </p>
              </div>
            ) : null}

            {(messages ?? []).map((m, idx, arr) => {
              const prev = arr[idx - 1];
              const newDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
              const isUser = m.role === "user";
              const body = isUser ? m.body : prettyBody(m.body);
              const priorRequest = messageRequests[idx] ?? "";
              return (
                <div key={m.id} className="space-y-4">
                  {newDay ? (
                    <div className="flex items-center gap-3 py-1 text-[0.7rem] font-bold text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      {dayLabel(m.created_at)}
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  ) : null}
                  <Message
                    from={isUser ? "user" : "assistant"}
                    className={cn("animate-bubble-in", isUser ? "ms-0 me-auto" : "ms-auto me-0")}
                  >
                    <div
                      className={cn(
                        "chat-message-row group flex min-w-0 gap-3",
                        isUser ? "justify-start" : "justify-end",
                      )}
                    >
                      {!isUser ? (
                        <span className="relative order-2 mt-1 block size-9 shrink-0 overflow-hidden rounded-xl shadow-sm">
                          <Portrait memberId={member.id} name={member.name} className="size-full" />
                        </span>
                      ) : null}
                      <MessageContent
                        className={cn(
                          "chat-message-content min-w-0 px-4 py-3 text-sm leading-7",
                          isUser
                            ? "max-w-[min(46rem,78%)] bubble-user rounded-xl rounded-ss-sm text-primary-foreground whitespace-pre-wrap shadow-card"
                            : "order-1 w-full max-w-[min(76rem,calc(100%-3rem))] bg-transparent",
                        )}
                      >
                        {isUser ? (
                          (() => {
                            const parsed = splitUserBody(m.body);
                            return (
                              <>
                                {parsed.items.length ? (
                                  <ChatAttachments
                                    items={parsed.items}
                                    className={parsed.text ? "mb-2" : undefined}
                                  />
                                ) : null}
                                {parsed.text ? <p dir="auto">{parsed.text}</p> : null}
                              </>
                            );
                          })()
                        ) : (
                          <Markdown body={body} onOpenApp={openAppInChat} />
                        )}
                        {!isUser &&
                        id === "nour" &&
                        workspace &&
                        m.body.length > 600 &&
                        askedForPublishableOutput(priorRequest) ? (
                          wpConnected ? (
                            <PublishToWordPress workspaceId={workspace.id} body={m.body} />
                          ) : (
                            <span className="mt-3 inline-flex">
                              <ConnectNow
                                workspaceId={workspace.id}
                                provider="wordpress"
                                size="sm"
                                label="اربط ووردبريس وانشر المقال"
                              />
                            </span>
                          )
                        ) : null}
                        {!isUser &&
                        id === "sonny" &&
                        workspace &&
                        !m.body.includes("(/app/tasks)") &&
                        askedForPublishableOutput(priorRequest) &&
                        looksPostable(m.body, priorRequest) ? (
                          <PostCards
                            workspaceId={workspace.id}
                            employeeId={id}
                            taskId={savedTask}
                            channel={requestedPublishTargets(priorRequest)[0] ?? "instagram"}
                            request={priorRequest}
                            body={m.body}
                          />
                        ) : null}

                        {(() => {
                          const req = isUser ? splitUserBody(m.body).text || m.body : priorRequest;
                          const handoff = detectHandoff(req, id);
                          if (!handoff) return null;
                          // تظهر مرة واحدة: مع رسالة المستخدم مباشرة إن كانت آخر رسالة،
                          // أو تحت رد الموظف بعدها.
                          const nextIsAssistant = arr[idx + 1] && arr[idx + 1]!.role !== "user";
                          if (isUser && nextIsAssistant) return null;
                          return (
                            <HandoffCard
                              handoff={handoff}
                              request={req}
                              currentName={member.name}
                            />
                          );
                        })()}

                        <div
                          className={cn(
                            "mt-1.5 flex flex-wrap items-center gap-2 text-[0.7rem]",
                            isUser ? "text-background/60" : "text-muted-foreground",
                          )}
                        >
                          <span className="whitespace-nowrap tabular-nums" dir="ltr">
                            {timeOf(m.created_at)}
                          </span>
                          {!isUser ? (
                            <span className="ms-auto min-w-0 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100 [&_button]:min-h-9">
                              <MessageActions
                                text={body}
                                disabled={busy}
                                onEdit={() => {
                                  // التعديل اليدوي لمنشور = نص المنشور فقط، بلا شرح الموظف.
                                  setDraft(looksPostable(body) ? extractPostText(body) : body);
                                  inputRef.current?.focus();
                                  signal(m.id, "edited", m.body);
                                }}
                                onRegenerate={
                                  priorRequest
                                    ? () => {
                                        signal(m.id, "rejected", m.body);
                                        void submit(
                                          `${priorRequest}\n\n(أعد صياغة الرد السابق بزاوية مختلفة وأقوى، وحافظ على نفس الطلب.)`,
                                        );
                                      }
                                    : null
                                }
                              />
                            </span>
                          ) : null}
                        </div>
                      </MessageContent>
                    </div>
                  </Message>
                </div>
              );
            })}

            {pending ? (
              <div className="flex justify-start gap-3 animate-bubble-in">
                <div className="bubble-user min-w-0 max-w-[min(46rem,88%)] rounded-3xl rounded-ss-lg px-5 py-3.5 leading-relaxed text-background shadow-card">
                  {attachments.length ? (
                    <ChatAttachments items={attachments} className="mb-2" />
                  ) : null}
                  <p dir="auto" className="whitespace-pre-wrap">
                    {pending}
                  </p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[0.7rem] text-background/60">
                    <Check className="size-3" /> وصل إلى {member.name}
                  </p>
                </div>
              </div>
            ) : null}

            {busy ? (
              <Thinking
                memberId={member.id}
                name={member.name}
                step={liveStep}
                text={liveText}
                request={pending ?? pendingText ?? ""}
                imageRequested={
                  imageMode !== "off" && (imageMode !== "auto" || Boolean(imagePrompt.trim()))
                }
                attachments={attachments.length}
              />
            ) : null}

            {savedTask && !busy ? (
              <InlineApproval
                workspaceId={workspace?.id}
                taskId={savedTask}
                employeeName={member.name}
                onEdit={(text) => {
                  setDraft(text);
                  inputRef.current?.focus();
                }}
                onDone={() => setSavedTask(null)}
              />
            ) : null}

            {pendingAction && workspace && !busy ? (
              <ActionCard
                workspaceId={workspace.id}
                action={pendingAction}
                onDone={() => setPendingAction(null)}
              />
            ) : null}

            {needsConnection && !busy ? (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky/30 bg-sky/10 px-4 py-3 text-sm font-semibold animate-pop-in">
                <AppIcon name={needsConnection.provider} className="size-6 shrink-0" />
                <span className="min-w-0 flex-1">
                  لتنفيذ هذه المهمة فعلياً يحتاج {member.name} ربط{" "}
                  <b>{appLabel(needsConnection.provider)}</b>
                  {needsConnection.reason ? ` — ${needsConnection.reason}` : ""}. دقيقة واحدة عبر
                  OAuth الرسمي.
                </span>
                <ConnectNow
                  workspaceId={workspace?.id}
                  provider={needsConnection.provider}
                  size="sm"
                />
                <button
                  onClick={() => setNeedsConnection(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  لاحقاً
                </button>
              </div>
            ) : null}

            {error ? (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-coral/25 bg-coral/10 px-4 py-3 text-sm font-semibold text-coral animate-pop-in">
                <span className="flex-1">{error}</span>
                {pendingText ? (
                  <button
                    type="button"
                    onClick={() => submit(pendingText)}
                    className="rounded-full bg-coral px-4 py-1.5 text-xs font-bold text-background"
                  >
                    أعد المحاولة
                  </button>
                ) : null}
              </div>
            ) : null}

            {embeddedTool?.mode === "inline" ? (
              <section
                className="chat-inline-tool"
                aria-label={embeddedTool.tool.title}
                style={toolStyle}
              >
                <header className="chat-tool-drag" {...dragHandlers}>
                  <div>
                    <strong>{embeddedTool.tool.title}</strong>
                    <span>تعمل داخل محادثة {member.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmbeddedTool({ tool: embeddedTool.tool, mode: "expanded" })}
                    title="تكبير الأداة داخل المحادثة"
                    aria-label={`تكبير ${embeddedTool.tool.title}`}
                  >
                    <ExternalLink className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmbeddedTool(null)}
                    aria-label="إغلاق الأداة"
                  >
                    <X className="size-4" />
                  </button>
                </header>
                <iframe
                  src={`${embeddedTool.tool.to}?embedded=1`}
                  title={embeddedTool.tool.title}
                />
              </section>
            ) : null}

            <div ref={endRef} />
          </div>

          {!stickToBottom ? (
            <button
              type="button"
              onClick={() => {
                setStickToBottom(true);
                endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }}
              className="chat-jump-bottom"
              aria-label="انزل لأحدث رسالة"
            >
              <ChevronDown className="size-4" />
              أحدث رسالة
            </button>
          ) : null}

          <div className="chat-composer-dock pointer-events-none p-3 sm:p-5">
            {attachments.length && activeTool !== "media" && !busy ? (
              <div className="pointer-events-auto mb-2 rounded-2xl border border-border/70 bg-card p-2 shadow-sm">
                <ChatAttachments
                  compact
                  items={attachments}
                  onRemove={(url) => setAttachments((list) => list.filter((a) => a.url !== url))}
                />
              </div>
            ) : null}
            <PromptInput
              onSubmit={(message) =>
                submit(
                  message.text ||
                    draft ||
                    (attachments.length ? "راجع المرفقات دي وقولي رأيك فيها." : ""),
                )
              }
              className="chat-composer pointer-events-auto mx-auto w-full max-w-none rounded-2xl border border-border/70 p-2 transition-all focus-within:border-primary/55 focus-within:ring-4 focus-within:ring-primary/10"
            >
              <PromptInputTextarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder=""
                aria-label={`اكتب طلبك لـ${member.name}`}
                dir="auto"
                rows={1}
                className={cn(
                  "chat-composer-textarea field-sizing-fixed max-h-40 min-h-12 resize-none bg-transparent px-3 py-2.5",
                  draft ? "overflow-y-auto" : "overflow-hidden",
                )}
              />
              {!draft ? (
                <span className="chat-composer-placeholder" aria-hidden="true" dir="auto">
                  {rotatingPlaceholder || `اكتب طلبك لـ${member.name}…`}
                  <span className="chat-composer-caret">▌</span>
                </span>
              ) : null}
              {toolsOpen ? (
                <div className="chat-tool-launcher" aria-label="أدوات الطلب">
                  <button
                    type="button"
                    onClick={() => setActiveTool((value) => (value === "media" ? null : "media"))}
                    className={cn("chat-tool-choice", activeTool === "media" && "is-active")}
                    aria-expanded={activeTool === "media"}
                  >
                    <ImagePlus className="size-4" /> الوسائط
                    {attachments.length ? <span>{attachments.length}</span> : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTool((value) => (value === "length" ? null : "length"))}
                    className={cn("chat-tool-choice", activeTool === "length" && "is-active")}
                    aria-expanded={activeTool === "length"}
                  >
                    <TextCursorInput className="size-4" /> الطول
                  </button>
                </div>
              ) : null}
              {activeTool ? (
                <div className="chat-tool-popover">
                  <div className="chat-tool-popover-head">
                    <div>
                      <p>{activeTool === "media" ? "الوسائط" : "طول المحتوى"}</p>
                      <span>
                        {activeTool === "media"
                          ? "أرفق أو أنشئ ما يحتاجه الطلب"
                          : "اختر الحجم الأنسب لهذه النتيجة"}
                      </span>
                    </div>
                    <button type="button" onClick={() => setActiveTool(null)} aria-label="إغلاق">
                      <X className="size-4" />
                    </button>
                  </div>
                  {activeTool === "media" ? (
                    <MediaStudio
                      workspaceId={workspace?.id}
                      attachments={attachments}
                      onAttachmentsChange={setAttachments}
                      imageMode={imageMode}
                      onImageModeChange={setImageMode}
                      imagePrompt={imagePrompt}
                      onImagePromptChange={setImagePrompt}
                      aspect={aspect}
                      onAspectChange={setAspect}
                      disabled={busy}
                      defaultOpen
                      hideTrigger
                    />
                  ) : (
                    <div className="chat-length-options">
                      {(
                        [
                          ["auto", "تلقائي", "يقرر الموظف الأنسب"],
                          ["short", "قصير", "مباشر وسريع"],
                          ["medium", "متوسط", "متوازن ومفصل"],
                          ["long", "مطوّل", "شامل ومتعمق"],
                        ] as const
                      ).map(([value, label, hint]) => (
                        <button
                          key={value}
                          type="button"
                          disabled={busy}
                          onClick={() => setPostLength(value)}
                          className={cn("chat-length-option", postLength === value && "is-active")}
                        >
                          <span>{label}</span>
                          <small>{hint}</small>
                          {postLength === value ? <Check className="size-4" /> : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
              <PromptInputFooter>
                <PromptInputTools>
                  <PromptInputButton
                    type="button"
                    onClick={() => {
                      setToolsOpen((value) => {
                        if (value) setActiveTool(null);
                        return !value;
                      });
                    }}
                    aria-expanded={toolsOpen}
                    aria-label="أدوات الطلب"
                    title="الوسائط وإعدادات الطلب"
                    className={cn("size-9 rounded-lg", toolsOpen && "bg-primary/10 text-primary")}
                  >
                    <SlidersHorizontal className="size-4.5" />
                  </PromptInputButton>
                </PromptInputTools>
                <PromptInputSubmit
                  {...(busy ? { status: "streaming" as const, onStop: stopSending } : {})}
                  disabled={!busy && (!workspace || !draft.trim())}
                  aria-label={busy ? "إيقاف" : "إرسال"}
                  title={busy ? "إيقاف الطلب" : "إرسال"}
                  className="size-9 rounded-lg"
                />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>

        {embeddedTool?.mode === "expanded" ? (
          <section
            className="chat-embedded-tool"
            aria-label={embeddedTool.tool.title}
            style={toolStyle}
          >
            <header className="chat-tool-drag" {...dragHandlers}>
              <button
                type="button"
                onClick={() => setEmbeddedTool(null)}
                aria-label="العودة للمحادثة"
              >
                <ArrowRight className="size-4" />
              </button>
              <div>
                <strong>{embeddedTool.tool.title}</strong>
                <span>مفتوحة داخل نفس محادثة {member.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setEmbeddedTool({ tool: embeddedTool.tool, mode: "inline" })}
                title="تصغير داخل المحادثة"
              >
                <ArrowRight className="size-4" />
                <span>داخل الرسائل</span>
              </button>
            </header>
            <iframe src={`${embeddedTool.tool.to}?embedded=1`} title={embeddedTool.tool.title} />
          </section>
        ) : null}

        {barPanel ? (
          <>
            <button
              type="button"
              aria-label="إغلاق اللوحة"
              onClick={() => setBarPanel(null)}
              className="topbar-sheet-backdrop"
            />
            <section
              className="topbar-sheet"
              style={
                {
                  "--topbar-sheet-anchor-x": `${barPanelAnchor.x}px`,
                  "--topbar-sheet-anchor-top": `${barPanelAnchor.top}px`,
                } as React.CSSProperties
              }
              aria-label={
                barPanel === "apps"
                  ? `تكاملات ${member.name}`
                  : barPanel === "brand"
                    ? "عقل وصوت العلامة"
                    : barPanel === "chats"
                      ? `محادثات ${member.name}`
                      : `تشغيل ومتابعة ${member.name}`
              }
            >
              <div className="topbar-sheet-head">
                {barPanel === "apps" ? (
                  <PlugZap className="size-4 text-primary" />
                ) : barPanel === "chats" ? (
                  <History className="size-4 text-primary" />
                ) : barPanel === "work" ? (
                  <Bot className="size-4 text-primary" />
                ) : (
                  <Fingerprint className="size-4 text-primary" />
                )}
                <div>
                  <p>
                    {barPanel === "apps"
                      ? `تكاملات ${member.name}`
                      : barPanel === "brand"
                        ? "عقل وصوت العلامة"
                        : barPanel === "chats"
                          ? `محادثات ${member.name}`
                          : `تشغيل ومتابعة ${member.name}`}
                  </p>
                  <span>
                    {barPanel === "apps"
                      ? "اربط الحسابات التي يحتاجها من هنا مباشرة"
                      : barPanel === "brand"
                        ? "المصادر التي يقرأها ونبرة كتابته"
                        : barPanel === "chats"
                          ? "ابحث وبدّل وأدر السجل من هنا"
                          : "كل ما يستطيع تنفيذه ومتابعته"}
                  </span>
                </div>
                <button type="button" onClick={() => setBarPanel(null)} aria-label="إغلاق">
                  <X className="size-4" />
                </button>
              </div>

              {barPanel === "apps" ? (
                <div className="mt-1">
                  {member.apps.map((provider) => {
                    const row = owned.find((i) => i.provider === provider);
                    const connected = row?.status === "connected";
                    return (
                      <div key={provider} className="topbar-app-row">
                        <AppIcon name={provider} className="size-5 shrink-0" />
                        <span className="truncate">{appLabel(provider)}</span>
                        {connected ? (
                          <span className="is-connected">متصل</span>
                        ) : (
                          <span className="ms-auto shrink-0">
                            <ConnectNow
                              workspaceId={workspace?.id}
                              provider={provider}
                              size="sm"
                              label="اربط"
                            />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : barPanel === "brand" ? (
                <div className="mt-3 space-y-3">
                  <div className="rounded-2xl border border-border/70 p-3">
                    <p className="flex items-center gap-2 text-xs font-black">
                      <BookOpenText className="size-4 text-primary" /> عقل العلامة
                      <span className="ms-auto text-[0.66rem] font-bold text-muted-foreground">
                        {brainItems?.length ?? 0} مصادر
                      </span>
                    </p>
                    <div className="mt-2 space-y-1">
                      {(brainItems ?? []).slice(0, 5).map((item) => (
                        <p key={item.id} className="truncate text-[0.72rem] text-muted-foreground">
                          • {item.title}
                        </p>
                      ))}
                      {(brainItems ?? []).length === 0 ? (
                        <p className="text-[0.72rem] text-muted-foreground">
                          لا مصادر بعد — الصق رابط موقعك ليقرأه {member.name}.
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        value={brandSource}
                        onChange={(e) => setBrandSource(e.target.value)}
                        placeholder="رابط أو ملاحظة عن علامتك…"
                        dir="auto"
                        className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        disabled={!workspace || !brandSource.trim() || addBrainItem.isPending}
                        onClick={() =>
                          addBrainItem.mutate(
                            {
                              kind: brandSource.trim().startsWith("http") ? "link" : "note",
                              title: brandSource.trim().slice(0, 120),
                              body: brandSource.trim(),
                            },
                            { onSuccess: () => setBrandSource("") },
                          )
                        }
                        className="shrink-0 rounded-full bg-foreground px-3 py-2 text-[0.7rem] font-bold text-background disabled:opacity-50"
                      >
                        {addBrainItem.isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          "أضف"
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-3">
                    <p className="flex items-center gap-2 text-xs font-black">
                      <AudioLines className="size-4 text-primary" /> صوت العلامة
                      <span className="ms-auto text-[0.66rem] font-bold text-muted-foreground">
                        {hasVoiceGuide ? "جاهز" : "غير مضبوط"}
                      </span>
                    </p>
                    <div className="mt-2">
                      <BrandVoiceExtractor workspaceId={workspace?.id} compact />
                    </div>
                  </div>
                </div>
              ) : barPanel === "chats" ? (
                <div className="chat-history-sheet">
                  <label className="chat-history-search">
                    <Search className="size-4" />
                    <input
                      value={conversationSearch}
                      onChange={(event) => setConversationSearch(event.target.value)}
                      placeholder="ابحث في المحادثات…"
                      aria-label="البحث في المحادثات"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!workspace}
                    onClick={() => {
                      setStartingNewConversation(true);
                      setConversationId(undefined);
                      setBarPanel(null);
                      setDraft("");
                      setPending(null);
                      setError(null);
                      inputRef.current?.focus();
                    }}
                    className="chat-history-new"
                  >
                    <Plus className="size-4" />
                    محادثة جديدة
                  </button>
                  <div className="chat-history-list">
                    {filteredConversations.map((conversation) => (
                      <article
                        key={conversation.id}
                        className={cn(
                          "chat-history-row",
                          conversation.id === conversationId && "is-active",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setStartingNewConversation(false);
                            setConversationId(conversation.id);
                            setBarPanel(null);
                          }}
                          onDoubleClick={() => {
                            const title = window.prompt("اسم المحادثة", conversation.title)?.trim();
                            if (title) renameConversation.mutate({ id: conversation.id, title });
                          }}
                        >
                          <strong>{conversation.title}</strong>
                          <time dateTime={conversation.updated_at}>
                            <CalendarDays className="size-3.5" />
                            {conversationDate(conversation.updated_at)}
                          </time>
                        </button>
                        <button
                          type="button"
                          aria-label={`حذف ${conversation.title}`}
                          onClick={() => {
                            if (window.confirm("حذف هذه المحادثة ورسائلها؟"))
                              deleteConversation.mutate(conversation.id);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </article>
                    ))}
                    {!filteredConversations.length ? (
                      <p className="chat-history-empty">لا توجد محادثة تطابق البحث.</p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="chat-work-sheet">
                  <div className="chat-work-links" aria-label="أدوات التشغيل الأساسية">
                    {WORK_TOOLS.filter((tool) => !tool.sonnyOnly || id === "sonny").map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <article key={tool.id} className="chat-work-card">
                          <span className="chat-work-card-icon">
                            <Icon className="size-4" />
                          </span>
                          <div>
                            <strong>{tool.title}</strong>
                            <small>{tool.description}</small>
                          </div>
                          <div className="chat-work-card-actions">
                            <button
                              type="button"
                              onClick={() => {
                                setEmbeddedTool({ tool, mode: "inline" });
                                setBarPanel(null);
                              }}
                            >
                              داخل المحادثة
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEmbeddedTool({ tool, mode: "expanded" });
                                setBarPanel(null);
                              }}
                              aria-label={`فتح صفحة ${tool.title} داخل المحادثة`}
                              title="فتح بحجم كامل داخل المحادثة"
                            >
                              <ExternalLink className="size-3.5" />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <div className="chat-work-actions">
                    <p>إجراءات {member.name} المباشرة</p>
                    <ActionPanel
                      employeeId={id}
                      workspaceId={workspace?.id}
                      connected={(integrations ?? [])
                        .filter((integration) => integration.status === "connected")
                        .map((integration) => integration.provider)}
                    />
                  </div>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
