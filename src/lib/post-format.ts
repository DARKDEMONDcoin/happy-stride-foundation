/**
 * تكييف نص المنشور لكل منصة + اقتراح أفضل وقت للنشر.
 * ملف محايد (يعمل على المتصفح والخادم) حتى تستعمله لوحة النشر والطيار الآلي بنفس المنطق.
 */
import { platformHardLimit } from "./post-quality";

/**
 * أسطر «كلام الموظف» التي لا يجوز أن تُنشر أبداً على المنصة:
 * إرشادات الأزرار، قسم الافتراضات، معرض صور الموقع، وأي تعليق موجّه للمستخدم.
 */
const CUT_FROM = [
  /^\s*#{0,6}\s*(?:📸|📷)?\s*صور\s+من\s+موقعك/u,
  /^\s*#{0,6}\s*\**\s*افتراضات\s*[:：]?/u,
  /^\s*#{0,6}\s*\**\s*(?:ملاحظة\s+(?:للمستخدم|من\s+\S+)|تعليمات)\s*[:：]/u,
  // أقسام حوار الشات — لا تُنشر أبداً داخل المنشور.
  /^\s*#{0,6}\s*\**\s*الخطوة\s+التالية\s*\**\s*[:：]?\s*$/u,
  /^\s*#{0,6}\s*\**\s*الخطوات\s+التالية\s*\**\s*[:：]?\s*$/u,
  /^\s*#{0,6}\s*\**\s*المطلوب\s*(?:منك)?\s*\**\s*[:：]?\s*$/u,
  /^\s*#{0,6}\s*\**\s*(?:ما\s+أحتاجه|أحتاج\s+منك)\s*\**\s*[:：]?\s*$/u,
  // أقسام «تسليم» يكتبها الموظف بعد نص المنشور — وصف الصورة والتوقيت والقياس.
  /^\s*#{0,6}\s*\**\s*(?:الصورة\s*\/?\s*(?:و\s*)?الفيديو|الوسائط(?:\s+المقترحة)?|المقترح\s+البصري|وصف\s+الصورة)\s*\**\s*[:：]?\s*$/u,
  /^\s*#{0,6}\s*\**\s*(?:التوقيت\s+والقياس|القياس\s+والتوقيت|التوقيت\s+المقترح|المؤشرات?|القياس)\s*\**\s*[:：]?\s*$/u,
  /^\s*#{0,6}\s*\**\s*(?:المصادر?|مصادر)\s*\**\s*[:：]?\s*$/u,
  // تذييلات استراتيجية قد يضيفها الموظف بعد النص («منشور مخصص…»، «مؤشر القياس…»).
  // هي ملاحظات للمالك وليست جزءاً مما يراه جمهوره.
  /^\s*(?:منشور|محتوى|نسخة)\s+مخصّ?ص(?:ة)?\s+(?:لمنصة|لـ)\s*[^:：\n]{1,40}[:：]/u,
  /^\s*(?:هدف|أهداف)\s+(?:المنشور|المحتوى|النشر)\s*[:：]/u,
];

/**
 * ملاحظات إدارية من سطر واحد («مؤشر القياس بعد ٤٨ ساعة: …»، «التوقيت المقترح: …»).
 * تُحذف سطراً سطراً لا بقطع ما بعدها، حتى لا تضيع الهاشتاقات التي تليها.
 */
const OWNER_NOTE_LINE = [
  /^\s*[-•*]?\s*\**\s*(?:مؤشر|مؤشرات)\s+(?:القياس|الأداء|الاداء|النجاح)[^\n]{0,80}[:：]/u,
  /^\s*[-•*]?\s*\**\s*(?:القياس|المقياس)\s+بعد\s+[^\n]{0,40}[:：]/u,
  /^\s*[-•*]?\s*\**\s*(?:التوقيت|الموعد|وقت\s+النشر)\s+(?:المقترح|الأفضل|الافضل)\s*\**\s*[:：]/u,
  /^\s*[-•*]?\s*\**\s*(?:سبب\s+(?:الاختيار|الزاوية)|لماذا\s+(?:اخترت|هذه))\b/u,
  /^\s*[-•*]?\s*\**\s*(?:الجمهور\s+المستهدف|زاوية\s+المحتوى|نوع\s+المنشور|المنصة|الهدف)\s*\**\s*[:：]/u,
];

const DROP_LINE = [
  /انشر\s*الآن/u,
  /«?\s*جدولة\s*»?\s*(?:أسفل|من)/u,
  /اربط\s+حساب/u,
  /أسفل\s+المخرج/u,
  /اعتمده?\s+من\s+(?:صفحة\s+)?(?:الموافقات|الاعتمادات)/u,
  /اختر\s+أي\s+صورة/u,
  /الصورة\s+المولّدة/u,
  /المنشور\s+جاهز/u,
  /راقب\s+الوصول/u,
  /^\s*جاهز\s+أكتب/u,
  /أرسل\s+.*(?:لأجهّزه|لأجهزه|في\s+رسالة\s+واحدة)/u,
  // عناوين تسليم داخل سطر واحد لا تُنشر.
  /^\s*\**\s*(?:الهاشتاقات|الهاشتاجات|الوسوم)\s*\**\s*[:：]?\s*$/u,
  /^\s*\**\s*نص\s+بديل\s*\**\s*[:：]/u,
  // شرح الهاشتاقات («- واسعة: #عطور») توضيح للموظف لا جزء من المنشور.
  /^\s*[-•*]\s*[^:：\n#]{1,24}[:：]\s*#[\p{L}\p{N}_]+\s*$/u,
  /^\s*[-•]?\s*\**\s*(?:الموعد\s+المقترح|المؤشر|المصدر)\s*\**\s*[:：]/u,
  // «الموضوع: …» عنوان داخلي يكتبه الموظف قبل المنشور — لا يراه جمهور المنصة.
  /^\s*[-•*]?\s*\**\s*(?:الموضوع|موضوع\s+المنشور|العنوان\s+الداخلي)\s*\**\s*[:：]/u,
  // سطر تصنيف مفرد يكتبه الموظف فوق المنشور («إعلان»، «منشور») — ليس جزءاً من النص.
  /^\s*\**\s*(?:إعلان|اعلان|منشور|بوست|تغريدة|كابشن)\s*\**\s*$/u,
  // كلام المساعد الموجَّه لصاحب العمل: «عملتلك…»، «جهزت لك…»، «تحت أمرك»…
  // هذه الأسطر تُقال في الشات ولا يجوز أن يقرأها متابعو العميل داخل المنشور.
  /^\s*(?:تمام|تمّام|حاضر|أوكي|اوكي|أكيد|طبعاً|طبعا|ماشي)(?:[\s،,!؟.:👌🙌✅]|$)[^\n]{0,120}$/u,
  /(?:عملت|عملتل|جهّزت|جهزت|كتبت|حضّرت|حضرت|صمّمت|صممت|أعددت|اعددت|راجعت|ظبطت|ضبطت)\s*(?:ل|لك|لكم|لحضرتك)/u,
  /^\s*(?:إليك|اليك|إليكم|اليكم|دي|دة|ده|هذا|هذه)\s+(?:المنشور|البوست|النسخة|الصيغة|المسودة|التصميم|النص)\b/u,
  /(?:تحت\s+أمرك|في\s+خدمتك|جاهز\s+لل?نشر|جاهزة\s+لل?نشر|تقدر\s+تنشر|تحبّ?\s+أعدّل|تحب\s+اعدل|قولّ?ي|قول\s*لي|أخبرني|اخبرني|لو\s+(?:عايز|تحب|حابب|أردت|اردت))/u,
  /(?:هل\s+(?:تريد|تحب|تودّ|تود)|أنشره?\s+(?:الآن|دلوقتي)[؟?]|ننشر(?:ه)?\s*[؟?])/u,
];

/**
 * ينظّف نص المنشور: يزيل صيغ الماركداون وكل ما هو موجَّه للمستخدم داخل الشات،
 * ويُبقي نص المنشور نفسه فقط. يُطبَّق في الواجهة وفي الخادم قبل الإرسال للمنصة.
 */
export function sanitizePostBody(input: string | null | undefined): string {
  if (!input) return "";
  let text = input
    // أكواد وبقايا JSON لا تُنشر أبداً.
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*\{[\s\S]*?\}\s*$/gm, "")
    .replace(
      /^\s*["']?(?:reply|body|title|kind|channel|scheduled|image_prompt|deliverables?)["']?\s*:.*$/gim,
      "",
    )
    // اقتباسات الحواشي («استندت إلى…»، تذييل الأدوات) كلام موظف لا منشور.
    .replace(/^\s*>.*$/gm, "")
    .replace(/^\s*—\s*استندت.*$/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(/!\[([^\]]*)\]/g, "$1")

    // روابط الوسائط المؤقتة (تخزين سوبابيز/صور موقّعة) لا مكان لها داخل نص المنشور.
    .replace(/\(?https?:\/\/\S*(?:\/storage\/v1\/|\.(?:jpe?g|png|webp|gif|mp4)(?:\?\S*)?)\)?/gi, "")
    .replace(/^\s*(?:---|\*\*\*|___)\s*$/gm, "")
    // عناوين ماركداون فقط (# متبوعة بمسافة) — لا نلمس الهاشتاقات مثل #جدة.
    .replace(/^#{1,6}[ \t]+/gm, "")
    .replace(/\*\*/g, "")
    // جملة قياس بين قوسين داخل السطر: «(يُقاس التفاعل بعد ٤٨ ساعة بعدد الرسائل…)».
    // كلام موجّه للمالك حتى لو دُسّ داخل جملة موجّهة للجمهور.
    .replace(
      /\s*[（(][^()（）\n]{0,160}(?:يُقاس|يقاس|القياس|مؤشر|المؤشر)[^()（）\n]{0,160}[)）]/gu,
      "",
    )
    // بقايا أقواس فارغة بعد إزالة الروابط.
    .replace(/\[\s*\]|\(\s*\)/g, "");

  const lines = text.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    if (CUT_FROM.some((re) => re.test(line))) break;
    if (line.trim() && DROP_LINE.some((re) => re.test(line))) continue;
    if (line.trim() && OWNER_NOTE_LINE.some((re) => re.test(line))) continue;
    kept.push(line);
  }
  text = dedupeParagraphs(kept.join("\n"));

  return text
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * يحذف قسم «المخرج» الذي يكرّر نصاً ظهر قبله في الرد نفسه.
 * النموذج أحياناً يكتب المخرج في الصدر ثم يعيده تحت عنوان «المخرج» حرفياً،
 * فيرى المالك نفس النص مرتين. نُبقي أول ظهور فقط.
 */
const ECHO_HEADING =
  /^\s*(?:#{1,6}\s*)?\**\s*(?:المخرج|المخرج\s+النهائي|النص\s+النهائي|النسخة\s+النهائية)\s*\**\s*[:：]?\s*$/u;

const normalizeEcho = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/[*_#>`]/g, "")
    .trim()
    .toLowerCase();

export function dropEchoedSection(input: string): string {
  const lines = input.split("\n");
  const at = lines.findIndex((line) => ECHO_HEADING.test(line));
  if (at < 0) return input;
  const before = normalizeEcho(lines.slice(0, at).join("\n"));
  const section = lines.slice(at + 1);
  const meaningful = section.filter((line) => normalizeEcho(line).length > 24);
  if (!meaningful.length) return input;
  const echoed = meaningful.filter((line) => before.includes(normalizeEcho(line)));
  if (echoed.length / meaningful.length < 0.8) return input;
  return lines
    .slice(0, at)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** يحذف الفقرات المكرّرة حرفياً (تكرار الملخص ونص المنشور في الرد نفسه). */
export function dedupeParagraphs(input: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const block of input.split(/\n{2,}/)) {
    const key = block
      .replace(/\s+/g, " ")
      .replace(/[*_#>`]/g, "")
      .trim()
      .toLowerCase();
    if (key.length > 24) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(block);
  }
  return out.join("\n\n");
}

/**
 * هل الرد مجرد كلام موظف (اعتذار/رفض/سؤال/توضيح) وليس منشوراً؟
 * يُستخدم لمنع ظهور لوحة النشر بنص ليس منشوراً أصلاً.
 */
const REFUSAL = [
  /لا\s+(?:يمكنني|أستطيع|أقدر)/u,
  /لست\s+قادراً/u,
  /خارج\s+نطاق/u,
  // الاعتذار وحده ليس رفضاً: منشورات الأزمات والاعتذار العلني تبدأ بـ«نعتذر…»
  // ويجب أن تُنشر. نعتبره رفضاً فقط حين يقترن بعجز عن التنفيذ.
  /عذرا?ً?[،,]?\s*(?:لا\s+(?:يمكنني|أستطيع|أقدر)|لن\s+أستطيع|هذا\s+خارج)/u,
  /آسف[،,]?\s*(?:لا\s+(?:يمكنني|أستطيع|أقدر)|لن\s+أستطيع|هذا\s+خارج)/u,
  /هل\s+تريد(?:ني)?\s+أن/u,
  /وضّح\s+لي/u,
  /أحتاج\s+منك/u,
  /^\s*جاهز\s+(?:أكتب|أجهّز|أجهز)/u,
  /أرسل\s+.*(?:لأجهّزه|لأجهزه)/u,
  /ما\s+تخصص/u,
];

/** عناوين يستخدمها الموظف قبل نص المنشور — نبدأ من بعدها. */
const POST_LABEL =
  /^\s*(?:#{1,6}\s*)?\**\s*(?:نص\s+المنشور|المنشور|الكابشن|نص\s+البوست|البوست|التغريدة)\s*\**\s*[:：]?\s*$/u;

/** أسطر تعليق الموظف التي تبدأ كلاماً موجّهاً للمستخدم بعد المنشور. */
const AFTER_POST =
  /^\s*(?:#{1,6}\s*)?\**\s*(?:ملاحظة\s+للمستخدم|ما\s+عملته|اللي\s+عملته|لماذا\s+اخترت|ليه\s+اخترت|الخطوة\s+التالية|الخطوات\s+التالية|قرارك|قرار\s+واحد|المتبقي|الباقي|رأيي|تقرير\s+الأثر|المصادر?|الصورة\s*\/?\s*(?:و\s*)?الفيديو|الوسائط(?:\s+المقترحة)?|المقترح\s+البصري|وصف\s+الصورة|نص\s+بديل|التوقيت\s+والقياس|القياس\s+والتوقيت|التوقيت\s+المقترح|مؤشر\s+(?:الأداء|الاداء|النجاح|القياس)|مؤشرات\s+(?:الأداء|الاداء|القياس)|سبب\s+(?:الاختيار|الزاوية)|الجمهور\s+المستهدف|زاوية\s+المحتوى)\b/u;

/**
 * يستخرج نص المنشور وحده من رد الموظف: يبدأ بعد عنوان «نص المنشور» إن وُجد،
 * ويتوقف عند فاصل الماركداون أو أول سطر تعليق موجّه للمستخدم.
 * وإن كان ما بعد العنوان مجرد تمهيد قصير («النص جاهز أدناه…») بينما المنشور
 * الحقيقي في قسم لاحق، نختار أطول قسم فعلي بدل التمهيد.
 */
export function extractPostText(input: string | null | undefined): string {
  if (!input) return "";
  const lines = input.split("\n");
  const labelAt = lines.findIndex((l) => POST_LABEL.test(l));
  const start = labelAt >= 0 ? labelAt + 1 : 0;
  const kept: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^\s*(?:---|\*\*\*|___)\s*$/.test(line) && kept.join("").trim().length > 40) break;
    if (AFTER_POST.test(line)) break;
    kept.push(line);
  }
  const labelled = sanitizePostBody(kept.join("\n"));

  // وجود عنوان صريح «نص المنشور» عقدٌ بنيوي: لا نستبدله لاحقاً بقسم شرح أطول.
  if (labelAt >= 0 && labelled) return labelled;

  // أقسام العناوين: نُقيّم كل قسم على حدة ونأخذ أطول نص صالح للنشر.
  const sections: string[][] = [[]];
  for (const line of lines) {
    if (/^\s*#{1,6}\s+\S/.test(line)) sections.push([]);
    else sections[sections.length - 1]!.push(line);
  }
  let best = labelled;
  for (const section of sections) {
    const text = sanitizePostBody(section.join("\n"));
    if (text.length > best.length) best = text;
  }

  return best || labelled || sanitizePostBody(input);
}

/** هل طلب المستخدم فعلاً مخرجاً قابلاً للنشر (منشور/ريلز/مقال…)؟ */
export function askedForPublishableOutput(request: string | null | undefined): boolean {
  if (!request) return false;
  return /(منشور|بوست|post|ريلز?|reel|ستور(?:ي|يز)|story|تغريدة|تويت|tweet|كابشن|caption|مقال|بلوج|بلوق|blog|انشر|أنشر|نشر|اعلان|إعلان|كاروسيل|carousel|محتوى)/iu.test(
    request,
  );
}

export function isNonPostReply(input: string | null | undefined): boolean {
  const text = sanitizePostBody(input);
  if (!text) return true;
  const head = text.split("\n").slice(0, 6).join("\n");
  if (REFUSAL.some((re) => re.test(head))) return true;
  // نص قصير جداً بعد التنظيف = بقايا حوار لا منشور.
  return text.replace(/\s+/g, " ").trim().length < 40;
}

/** نسخة مختصرة تناسب حدّ إكس (٢٨٠ حرفاً) وتنتهي عند جملة كاملة مع أهم هاشتاقين. */
export function shortForX(caption: string): string {
  const tags = (caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).slice(0, 2).join(" ");
  const text = caption
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
  const budget = 275 - (tags ? tags.length + 1 : 0);
  if (text.length <= budget) return [text, tags].filter(Boolean).join("\n");
  const cut = text.slice(0, budget);
  const stop = Math.max(
    cut.lastIndexOf("."),
    cut.lastIndexOf("!"),
    cut.lastIndexOf("؟"),
    cut.lastIndexOf("\n"),
  );
  return [(stop > 80 ? cut.slice(0, stop + 1) : cut).trim(), tags].filter(Boolean).join("\n");
}

/**
 * حدود النص المعروفة لكل منصة — مشتقة من نفس جدول الجودة (post-quality) حتى لا
 * يمرّ منشور من بوابة الجودة ثم يُقصّ هنا في منتصف الجملة بحدّ أقل.
 */
const LIMIT: Record<string, number> = {
  x: platformHardLimit("x"),
  instagram: platformHardLimit("instagram"),
  facebook: platformHardLimit("facebook"),
  linkedin: platformHardLimit("linkedin"),
  pinterest: platformHardLimit("pinterest"),
  youtube: platformHardLimit("youtube"),
  telegram: platformHardLimit("telegram"),
};

/** يعيد نص المنشور مكيّفاً لحدود المنصة المطلوبة. */
export function adaptForProvider(provider: string, rawCaption: string): string {
  const caption = sanitizePostBody(rawCaption) || rawCaption;
  if (provider === "x") return shortForX(caption);
  const limit = LIMIT[provider];
  return limit && caption.length > limit ? `${caption.slice(0, limit - 1).trim()}…` : caption;
}

/** أفضل ساعات النشر (بالتوقيت المحلي للمستخدم) لكل منصة — متوسطات تفاعل معروفة. */
const BEST_HOURS: Record<string, number[]> = {
  instagram: [11, 14, 20],
  facebook: [10, 13, 21],
  linkedin: [8, 10, 12],
  x: [9, 12, 18],
  pinterest: [14, 20, 22],
  youtube: [16, 19, 21],
};

/** أقرب «أفضل وقت» قادم للمنصة (بعد ٢٠ دقيقة على الأقل من الآن). */
export function bestTimeFor(provider: string, from: Date = new Date()): Date {
  const hours = BEST_HOURS[provider] ?? [10, 14, 20];
  const floor = new Date(from.getTime() + 20 * 60_000);
  for (let day = 0; day < 2; day += 1) {
    for (const hour of hours) {
      const candidate = new Date(floor);
      candidate.setDate(floor.getDate() + day);
      candidate.setHours(hour, 0, 0, 0);
      if (candidate > floor) return candidate;
    }
  }
  // احتياطي: لا نقترح أبداً وقتاً بين منتصف الليل والسادسة صباحاً — الجمهور نائم.
  const fallback = new Date(floor.getTime() + 3_600_000);
  if (fallback.getHours() < 6) {
    fallback.setHours(hours[0] ?? 10, 0, 0, 0);
    if (fallback <= floor) fallback.setDate(fallback.getDate() + 1);
  }
  return fallback;
}
