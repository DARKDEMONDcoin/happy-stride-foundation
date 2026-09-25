/**
 * أدوات نقية لمحادثة فريق سهل على تيليجرام: اختيار الموظف وتنسيق الرد.
 * بلا اعتماديات سيرفر حتى تُختبر مباشرة.
 */
export type TeamMember = { id: string; name: string; cmd: string; names: string[]; topic: RegExp; working: string };

export const TEAM: TeamMember[] = [
  {
    id: "sonny", name: "سِراج", cmd: "siraj", names: ["سراج", "سِراج", "siraj", "sonny"],
    topic: /بوست|منشور|سوشيال|انستا|فيس|تويتر|إكس|لينكد|تيك\s*توك|ريلز|هاشتاق|كابشن|تريند|ترند/i,
    working: "سِراج بيجهّز لك",
  },
  {
    id: "nour", name: "نور", cmd: "nour", names: ["نور", "nour"],
    topic: /مقال|سيو|seo|كلمات مفتاحية|مدونة|ووردبريس|محتوى الموقع|ابحث|بحث عن/i,
    working: "نور بتبحث وتكتب",
  },
  {
    id: "dana", name: "دانة", cmd: "dana", names: ["دانة", "دانه", "dana"],
    topic: /تصميم|هوية|لوجو|شعار|بوستر|جرافيك|صورة|ألوان|الوان/i,
    working: "دانة بتشتغل على التصميم",
  },
  {
    id: "adam", name: "آدم", cmd: "adam", names: ["آدم", "ادم", "adam"],
    topic: /إعلان|اعلان|ميزانية|حملة ممولة|تحليل|أرقام|ارقام|تقرير أداء|analytics|بورصة|اقتصاد/i,
    working: "آدم بيحلل الأرقام",
  },
  {
    id: "eva", name: "إيفا", cmd: "eva", names: ["إيفا", "ايفا", "eva"],
    topic: /إيميل|ايميل|بريد|رسالة للعميل|موعد|اجتماع|ذكّرني|ذكرني|جدول/i,
    working: "إيفا بتجهّز",
  },
  {
    id: "sam", name: "سام", cmd: "sam", names: ["سام", "sam"],
    topic: /مبيعات|عميل|عملاء|عرض سعر|تسعير|منافس|صفقة|crm|سعر/i,
    working: "سام بيدرس السوق",
  },
];

export const byId = (id: string) => TEAM.find((m) => m.id === id);

const END = "(?=[\\s،,:.!؟?]|$)";

export type Parsed =
  | { kind: "command"; command: "team" | "new" | "start" | "help"; rest: string }
  | { kind: "message"; employeeId: string | null; text: string };

/**
 * يقرأ الرسالة: أمر (/nour، /team، /new) أو نداء باسم الموظف في أولها
 * («يا نور …»، «دانة، …»). الاسم يُنزع من النص حتى لا يربك الموظف.
 */
export function parseTelegramText(raw: string): Parsed {
  const text = raw.trim();
  const cmd = /^\/([a-z]+)(?:@\w+)?\s*([\s\S]*)$/i.exec(text);
  if (cmd) {
    const name = cmd[1]!.toLowerCase();
    const rest = (cmd[2] ?? "").trim();
    if (name === "team" || name === "new" || name === "start" || name === "help") {
      return { kind: "command", command: name, rest };
    }
    const member = TEAM.find((m) => m.cmd === name || m.id === name);
    if (member) return { kind: "message", employeeId: member.id, text: rest };
  }
  for (const m of TEAM) {
    for (const n of m.names) {
      const re = new RegExp(`^(?:يا\\s*|ya\\s+)?${n}${END}[\\s،,:.!]*`, "i");
      if (re.test(text)) return { kind: "message", employeeId: m.id, text: text.replace(re, "").trim() };
    }
  }
  return { kind: "message", employeeId: null, text };
}

/** أول رسالة بلا اسم: نختار الموظف حسب موضوع الطلب، وإلا سِراج. */
export function guessEmployee(text: string): string {
  return TEAM.find((m) => m.topic.test(text))?.id ?? "sonny";
}

/** طلب نشر صريح لسِراج → مسار المسودة والموافقة الحالي. */
export function isPublishRequest(text: string): boolean {
  return /(انشر|أنشر|نزّل|نزل|انزل|جدول|جدولة)/.test(text) && /(بوست|منشور|تغريدة|ستوري|ريلز|على\s|ع\s)/.test(text);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Markdown الموظف → HTML الذي يفهمه تيليجرام (b / i / code / a فقط). */
export function markdownToTelegramHtml(md: string): string {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let inCode = false;
  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      out.push(inCode ? "</pre>" : "<pre>");
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      out.push(esc(line));
      continue;
    }
    let l = esc(line);
    if (/^\s*#{1,6}\s+/.test(l)) l = `<b>${l.replace(/^\s*#{1,6}\s+/, "")}</b>`;
    else if (/^\s*[-*]\s+/.test(l)) l = l.replace(/^\s*[-*]\s+/, "• ");
    else if (/^\s*(---|\*\*\*)\s*$/.test(l)) l = "—";
    else if (/^\s*&gt;\s?/.test(l)) l = l.replace(/^\s*&gt;\s?/, "▎");
    l = l
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, t, u) => `<a href="${u.replace(/"/g, "%22")}">${t}</a>`)
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/__([^_]+)__/g, "<b>$1</b>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,،!؟?]|$)/g, "$1<i>$2</i>");
    out.push(l);
  }
  if (inCode) out.push("</pre>");
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** يقسّم نصاً طويلاً على حدود الفقرات ثم الأسطر (حد تيليجرام 4096). */
export function splitForTelegram(text: string, max = 3800): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let buf = "";
  const push = () => {
    if (buf.trim()) parts.push(buf.trim());
    buf = "";
  };
  for (const para of text.split(/\n\n/)) {
    if ((buf + "\n\n" + para).length <= max) {
      buf = buf ? `${buf}\n\n${para}` : para;
      continue;
    }
    push();
    if (para.length <= max) {
      buf = para;
      continue;
    }
    for (const line of para.split("\n")) {
      if ((buf + "\n" + line).length > max) push();
      if (line.length > max) {
        for (let i = 0; i < line.length; i += max) parts.push(line.slice(i, i + max));
      } else buf = buf ? `${buf}\n${line}` : line;
    }
  }
  push();
  return parts;
}

export function teamCard(activeId?: string | null): string {
  return [
    "<b>فريق سهل معاك هنا 👋</b>",
    "اكتب اسم الموظف في أول رسالتك أو استخدم الأمر:",
    ...TEAM.map((m) => `${m.id === activeId ? "▶️" : "•"} <b>${m.name}</b> — /${m.cmd}`),
    "",
    "/new محادثة جديدة مع نفس الموظف · /team عرض الفريق",
    "🎙️ تقدر تبعت رسالة صوتية، أو صورة، أو ملف.",
  ].join("\n");
}
