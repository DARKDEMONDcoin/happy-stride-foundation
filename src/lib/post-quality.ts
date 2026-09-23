/**
 * مقياس جودة المنشور قبل النشر (يعمل على المتصفح والخادم).
 *
 * الهدف: لا يخرج أي منشور من «سهل» بجودة أقل من معايير أفضل أدوات السوشيال العالمية.
 * كل بند هنا قاعدة قابلة للقياس (لا رأي): الهوك، الوعد، الثقة، الطول المناسب للمنصة،
 * دعوة الفعل، الهاشتاقات، القابلية للقراءة، الرموز التعبيرية، الكلمات الممنوعة،
 * الحشو التسويقي، وبصمة النص الآلي.
 */

import { PROVIDER_LABEL } from "./platforms";
import { normalizeArabic } from "./output-quality";

export type QualitySeverity = "pass" | "warn" | "fail";

export type QualityCheck = {
  id: string;
  label: string;
  severity: QualitySeverity;
  /** ما الذي يجب فعله لرفع الدرجة — بصيغة أمر مباشر. */
  hint: string;
  weight: number;
};

export type QualityReport = {
  score: number; // 0..100
  grade: "ممتاز" | "جيد" | "يحتاج تحسين" | "ضعيف";
  provider: string;
  providerLabel: string;
  chars: number;
  words: number;
  hashtags: string[];
  emojis: number;
  checks: QualityCheck[];
  blockers: QualityCheck[];
  strengths: QualityCheck[];
  quickFixes: QualityCheck[];
};

/** حدود ومعايير كل منصة — مبنية على أطوال المنصات الرسمية وأفضل الممارسات المنشورة. */
type Spec = {
  hardLimit: number;
  /** المدى الذي يحقق أعلى تفاعل عادةً. */
  sweet: [number, number];
  hashtags: [number, number];
  maxEmojis: number;
  needsMedia: boolean;
  maxLineLen: number;
};

const SPEC: Record<string, Spec> = {
  instagram: {
    hardLimit: 2200,
    sweet: [120, 700],
    hashtags: [3, 10],
    maxEmojis: 8,
    needsMedia: true,
    maxLineLen: 160,
  },
  facebook: {
    // الحد الرسمي للمنشور، مطابق لـplatform-limits.ts — الجودة تُقاس بالمدى المثالي لا بحدّ مخترع.
    hardLimit: 63206,
    sweet: [80, 600],
    hashtags: [0, 4],
    maxEmojis: 6,
    needsMedia: false,
    maxLineLen: 200,
  },
  linkedin: {
    hardLimit: 3000,
    // مطابق لحدود المنصات المكتوبة في platform-limits.ts (600–1200 حرفاً).
    sweet: [600, 1200],
    // مطابق لنص platform-limits.ts: «3 هاشتاقات كحد أقصى» — لا حد أدنى.
    hashtags: [0, 3],
    maxEmojis: 3,
    needsMedia: false,
    maxLineLen: 220,
  },
  x: {
    hardLimit: 280,
    sweet: [70, 260],
    hashtags: [0, 2],
    maxEmojis: 3,
    needsMedia: false,
    maxLineLen: 280,
  },
  pinterest: {
    // وصف البِن الرسمي 500 حرف، مطابق لـplatform-limits.ts.
    hardLimit: 500,
    sweet: [80, 400],
    hashtags: [0, 5],
    maxEmojis: 3,
    needsMedia: true,
    maxLineLen: 200,
  },
  youtube: {
    hardLimit: 5000,
    sweet: [100, 1200],
    hashtags: [0, 3],
    maxEmojis: 5,
    needsMedia: false,
    maxLineLen: 220,
  },
  telegram: {
    hardLimit: 4096,
    sweet: [80, 1024],
    hashtags: [0, 5],
    maxEmojis: 6,
    needsMedia: false,
    maxLineLen: 200,
  },
};

const DEFAULT_SPEC: Spec = {
  hardLimit: 3000,
  sweet: [80, 900],
  hashtags: [0, 6],
  maxEmojis: 6,
  needsMedia: false,
  maxLineLen: 200,
};

/** الحد الأقصى الرسمي لنص المنصة — مرجع واحد يستخدمه التنسيق والنشر أيضاً. */
export function platformHardLimit(provider: string): number {
  return (SPEC[provider] ?? DEFAULT_SPEC).hardLimit;
}

/** دعوات الفعل الشائعة بالعربية والإنجليزية. */
const CTA =
  /(اطلب|احجز|سجّل|سجل|اشترك|جرّب|جرب|تواصل|كلّمنا|كلمنا|راسلنا|زور|زر\s|حمّل|حمل\s|اضغط|شاركنا|علّق|علق\s|احفظ|تابعنا|استفد|اغتنم|رابط\s+ال|بالبايو|في\s+البايو|dm|link\s+in\s+bio|order|book|sign\s*up|subscribe)/iu;

/** أنماط هوك قوي في أول سطر: سؤال، رقم، مفاجأة، أو خطاب مباشر. */
const HOOK_QUESTION = /[؟?]/u;
const HOOK_NUMBER = /(\d|[٠-٩]|نصف|ضعف|أول|آخر)/u;
const HOOK_DIRECT = /(أنت|إنت|لو\s|إذا\s|تخيل|تخيّل|توقف|بلاش|لا\s+ت|كفاية|سر\s|٣|3\s+أسباب|هل\s)/u;
const WEAK_OPENING =
  /^(مرحباً|مرحبا|أهلاً|اهلا|يسرنا|يسعدنا|نقدّم لكم|نقدم لكم|هل تبحث عن|في عالم اليوم|في عصر)/iu;

/** قيمة واضحة للقارئ: فائدة، حل مشكلة، توفير، تعلّم، أو نتيجة ملموسة. */
const VALUE_PROMISE =
  /(كيف|لماذا|طريقة|خطوات|نصائح|دليل|تعلّم|تعلم|اكتشف|اعرف|وفّر|وفر|اختصر|خفّض|خفض|ارفع|حسّن|حسن|احصل|حل\s|مشكلة|نتيجة|عرض|خصم|تخفيض|أسرع|أسهل|أقل|save|learn|guide|tips|how\s+to|offer|discount)/iu;

/** تحديد واضح لمن نخاطبه — يرفع ملاءمة المنشور بدلاً من خطاب عام. */
const AUDIENCE_SIGNAL =
  /(أصحاب|لأصحاب|لـ|للـ|للشركات|للمطاعم|للمتاجر|للعيادات|للعقارات|للمديرين|للفريق|للعملاء|لو\s+(?:أنت|كنت)|إذا\s+(?:أنت|كنت)|لكل\s+من|for\s+(?:founders|teams|restaurants|clinics|stores|marketers))/iu;

/** إثبات أو سبب للثقة: نتيجة، تجربة، ضمان، رقم، مقارنة، أو دليل اجتماعي. */
const TRUST_SIGNAL =
  /(عميل|عملاء|تقييم|تجربة|نتيجة|قبل|بعد|ضمان|مرخّص|مرخص|معتمد|سنوات|حالة|دراسة|مراجعة|٪|%|\d|[٠-٩]|case\s+study|testimonial|review|proof)/iu;

/** إشارات تجعل المنشور قابلاً للحفظ/المشاركة لا مجرد إعلان مباشر. */
const SAVEABLE_SIGNAL =
  /(احفظ|شارك|أرسل|ارسل|قائمة|checklist|تذكّر|تذكر|قاعدة|خطوات|نصائح|أخطاء|أسرار|أسباب|مقارنة|قبل\s+ما|قبل\s+أن|save|share|checklist|mistakes|reasons)/iu;

/** حشو تسويقي مستهلك يخفض المصداقية — وأشهر بصمات النص المولّد آلياً. */
const FLUFF = [
  "الأفضل في العالم",
  "الأفضل على الإطلاق",
  "بدون منازع",
  "لا مثيل له",
  "حصري جداً",
  "فرصة العمر",
  "مجاناً 100%",
  "مجانا 100%",
  "ثورة حقيقية",
  "الحل السحري",
  "في عالم اليوم",
  "في عالم اليوم سريع التغير",
  "في عصرنا الحالي",
  "مما لا شك فيه",
  "انطلاقاً من",
  "نقدّم لكم بكل فخر",
  "نقدم لكم بكل فخر",
  "يسعدنا أن نعلن",
  "تجربة لا تُنسى",
  "تجربة لا تنسى",
  "نقلة نوعية",
  "الحل الأمثل",
  "لكل احتياجاتكم",
  "منتجاتنا الرائعة",
  "جودة عالية بأسعار تنافسية",
  "في المكان الصحيح",
  "غيّر قواعد اللعبة",
  "game changer",
  "مصمم خصيصاً لتلبية احتياجاتك",
  "نحن هنا لنساعدك",
];

/** تفصيلة ملموسة تجعل المنشور مصدقاً: رقم، سعر، وقت، مكان، أو مدة. */
const CONCRETE =
  /(\d|[٠-٩]|ريال|جنيه|درهم|دينار|دقيقة|دقايق|ساعة|ساعات|يوم|أسبوع|شهر|صباح|مساء|حي\s|شارع|فرع|جرام|سعرة|كيلو|%|٪)/u;

/** بقايا تقنية لا يجوز أن تصل للمنصة إطلاقاً. */
const ARTIFACTS = [
  /```/,
  /\{\s*"(?:reply|body|title|kind|channel|deliverables?)"/i,
  /!\[[^\]]*\]\(/,
  /\bimage_prompt\b/i,
  /https?:\/\/\S*\/storage\/v1\//i,
  /^\s*#{1,6}\s+\S/m,
  /\*\*[^*]+\*\*/,
  /^\s*\|.+\|\s*$/m,
  /^\s*(?:عنوان المنشور|نص المنشور|الكابشن|caption|post)\s*[:：]/im,
  /(إليك|هذا هو|يمكنك نشر|جاهز للنشر|آمل أن يعجبك)/iu,
];

/**
 * أسطر موجّهة لصاحب العمل تسرّبت داخل نص المنشور («الموضوع: …»، «مؤشر الأداء…»).
 * الجمهور لا يجب أن يقرأها أبداً، فهي حاجز نشر لا مجرد ملاحظة.
 */
const OWNER_NOTES = [
  /^\s*[-•*]?\s*(?:الموضوع|موضوع\s+المنشور|العنوان\s+الداخلي)\s*[:：]/mu,
  /^\s*[-•*]?\s*(?:مؤشر|مؤشرات)\s+(?:الأداء|الاداء|القياس|النجاح)/mu,
  /^\s*[-•*]?\s*(?:التوقيت|الموعد|وقت\s+النشر)\s+(?:المقترح|الأفضل|الافضل)\s*[:：]/mu,
  /^\s*[-•*]?\s*(?:الجمهور\s+المستهدف|زاوية\s+المحتوى|نوع\s+المنشور|المنصة|الهدف)\s*[:：]/mu,
  /^\s*[-•*]?\s*(?:سبب\s+(?:الاختيار|الزاوية)|لماذا\s+اخترت)/mu,
  /^\s*[-•*]?\s*نص\s+بديل\s*[:：]/mu,
  /(?:منشور|محتوى|نسخة)\s+مخصّ?ص(?:ة)?\s+(?:لمنصة|لـ)/u,
];

const EMOJI = /\p{Extended_Pictographic}/gu;

export function countEmojis(text: string): number {
  return (text.match(EMOJI) ?? []).length;
}

export function extractHashtags(text: string): string[] {
  return [...new Set(text.match(/#[\p{L}\p{N}_]+/gu) ?? [])];
}

function bodyWithoutTags(text: string): string {
  return text
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueWordRatio(core: string): number {
  const words = core
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}#]+|[^\p{L}\p{N}#]+$/gu, ""))
    .filter((w) => w.length > 2);
  if (words.length < 8) return 1;
  return new Set(words).size / words.length;
}

function firstLineScore(firstLine: string): QualitySeverity {
  if (!firstLine) return "fail";
  if (firstLine.length > 110 || WEAK_OPENING.test(firstLine)) return "warn";
  if (HOOK_QUESTION.test(firstLine) || HOOK_NUMBER.test(firstLine) || HOOK_DIRECT.test(firstLine))
    return "pass";
  return "warn";
}

function hashtagClusteredAtEnd(clean: string, hashtags: string[]): boolean {
  if (hashtags.length < 2) return true;
  const lines = clean
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const lastTwo = lines.slice(-2).join(" ");
  return hashtags.every((tag) => lastTwo.includes(tag));
}

type Input = {
  text: string;
  provider: string;
  hasMedia?: boolean;
  bannedWords?: string[];
};

/**
 * يفحص المنشور ويعيد درجة من ١٠٠ مع أسباب واضحة وإرشاد للإصلاح.
 * الدرجة = مجموع أوزان البنود الناجحة (نصف الوزن للتحذير) من إجمالي الأوزان.
 */
export function scorePost({
  text,
  provider,
  hasMedia = false,
  bannedWords = [],
}: Input): QualityReport {
  const spec = SPEC[provider] ?? DEFAULT_SPEC;
  const clean = text.trim();
  const core = bodyWithoutTags(clean);
  const chars = clean.length;
  const words = core ? core.split(/\s+/).length : 0;
  const hashtags = extractHashtags(clean);
  const emojis = countEmojis(clean);
  const lines = clean
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const firstLine = lines[0] ?? "";

  const checks: QualityCheck[] = [];
  const add = (
    id: string,
    label: string,
    weight: number,
    severity: QualitySeverity,
    hint: string,
  ) => checks.push({ id, label, weight, severity, hint });

  // ١) بقايا تقنية — حاجز نشر.
  const artifact = ARTIFACTS.some((re) => re.test(clean));
  add(
    "artifacts",
    "نص نظيف بلا رموز تنسيق أو أكواد",
    18,
    artifact ? "fail" : "pass",
    artifact
      ? "النص يحتوي تنسيق Markdown أو بقايا تقنية (**، ###، جدول، كود، رابط صورة) — احذفها قبل النشر."
      : "النص خالٍ من أي تنسيق تقني.",
  );

  // ١ب) كلام موجَّه للمالك داخل المنشور — حاجز نشر.
  const ownerNote = OWNER_NOTES.some((re) => re.test(clean));
  add(
    "owner-notes",
    "نص المنشور بلا ملاحظات موجّهة لصاحب العمل",
    16,
    ownerNote ? "fail" : "pass",
    ownerNote
      ? "النص يحتوي سطراً موجّهاً لك لا للجمهور (الموضوع، مؤشر الأداء، التوقيت المقترح، سبب الزاوية) — احذفه من المنشور."
      : "النص موجَّه للجمهور وحده.",
  );

  // ٢) الكلمات الممنوعة — حاجز نشر.
  // تطبيع عربي قبل المقارنة: «الإعلان» و«الاعلان» و«الاعلـان» كلمة واحدة —
  // نفس سلوك بوابة الجودة العامة (output-quality) حتى لا يختلف الحكم بحسب المسار.
  const normalizedClean = normalizeArabic(clean);
  const hitBanned = bannedWords
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && normalizedClean.includes(normalizeArabic(w)));
  add(
    "banned",
    "الالتزام بكلمات العلامة الممنوعة",
    14,
    hitBanned.length ? "fail" : "pass",
    hitBanned.length ? `احذف: ${hitBanned.join("، ")}` : "لا توجد كلمة ممنوعة.",
  );

  // ٣) حد المنصة — حاجز نشر.
  const effectiveLimit = provider === "telegram" && hasMedia ? 1024 : spec.hardLimit;
  const overLimit = chars > effectiveLimit;
  add(
    "limit",
    `الطول ضمن حد ${PROVIDER_LABEL[provider] ?? provider}`,
    12,
    overLimit ? "fail" : "pass",
    overLimit
      ? `النص ${chars} حرفاً والحد ${effectiveLimit}${provider === "telegram" && hasMedia ? " مع الوسائط" : ""} — اختصره وإلا سترفضه المنصة.`
      : `${chars} حرفاً من ${effectiveLimit}.`,
  );

  // ٤) الطول المثالي للتفاعل.
  const [lo, hi] = spec.sweet;
  const lengthOk = chars >= lo && chars <= hi;
  add(
    "sweet",
    "الطول في المدى الأعلى تفاعلاً",
    10,
    lengthOk ? "pass" : "warn",
    lengthOk
      ? `مناسب (${lo}–${hi} حرفاً).`
      : chars < lo
        ? `قصير جداً — المدى الأفضل ${lo}–${hi} حرفاً؛ أضف فائدة أو تفصيلة ملموسة.`
        : `أطول من المدى الأفضل ${lo}–${hi} حرفاً؛ احذف الحشو.`,
  );

  // ٥) الهوك في أول سطر.
  const hookLen = firstLine.length;
  const hookSeverity = firstLineScore(firstLine);
  add(
    "hook",
    "هوك قوي في أول سطر",
    14,
    hookSeverity,
    hookSeverity === "pass"
      ? "أول سطر يوقف التمرير."
      : hookLen > 110
        ? "اختصر أول سطر إلى أقل من ٩٠ حرفاً واجعله سؤالاً أو رقماً أو وعداً مباشراً."
        : WEAK_OPENING.test(firstLine)
          ? "استبدل الافتتاحية العامة بسؤال أو رقم أو نتيجة تهم القارئ فوراً."
          : "اجعل أول سطر قصيراً وفيه سؤال أو رقم أو خطاب مباشر للقارئ.",
  );

  // ٥ب) وعد قيمة واضح — المنشور العالمي يجيب: ماذا سيكسب القارئ؟
  const value = VALUE_PROMISE.test(core);
  add(
    "value",
    "وعد قيمة واضح للقارئ",
    12,
    value ? "pass" : "warn",
    value
      ? "القارئ يعرف المكسب من قراءة المنشور."
      : "أضف فائدة واضحة: توفير وقت/مال، حل مشكلة، نصيحة، خطوة، أو نتيجة محددة.",
  );

  // ٥ج) الجمهور المستهدف — يمنع المنشور من أن يبدو عاماً لكل الناس.
  const audience = AUDIENCE_SIGNAL.test(core);
  add(
    "audience",
    "مخاطبة جمهور محدد",
    8,
    audience ? "pass" : "warn",
    audience
      ? "المنشور يوضح لمن يتحدث."
      : "اذكر الجمهور صراحة: أصحاب مطاعم، متاجر، عيادات، مدراء، أو نوع العميل المقصود.",
  );

  // ٦) دعوة فعل واضحة.
  const hasCta = CTA.test(clean);
  add(
    "cta",
    "دعوة فعل واضحة",
    12,
    hasCta ? "pass" : "warn",
    hasCta
      ? "يوجد إجراء مطلوب من القارئ."
      : "أضف سطر دعوة فعل: احجز، اطلب، علّق، أو الرابط في البايو.",
  );

  // ٦ب) قابلية الحفظ أو المشاركة — من أقوى إشارات جودة المحتوى العضوي.
  const saveable = SAVEABLE_SIGNAL.test(core);
  add(
    "saveable",
    "قابل للحفظ أو المشاركة",
    7,
    // كان الطويل يمرّ دائماً والقصير وحده يُنبَّه — منطق مقلوب: غياب سبب الحفظ
    // ملاحظة في كل الأحوال، وأثرها أوضح في المنشور الطويل.
    saveable ? "pass" : "warn",
    saveable
      ? "فيه سبب واضح للحفظ أو المشاركة."
      : "حوّله إلى نقطة مفيدة قابلة للحفظ: قائمة، خطأ شائع، خطوة، أو مقارنة قصيرة.",
  );

  // ٧) الهاشتاقات حسب المنصة.
  const [htLo, htHi] = spec.hashtags;
  const htOk = hashtags.length >= htLo && hashtags.length <= htHi;
  add(
    "hashtags",
    "عدد هاشتاقات مناسب للمنصة",
    8,
    htOk ? "pass" : "warn",
    htOk
      ? `${hashtags.length} هاشتاق.`
      : hashtags.length < htLo
        ? `أضف هاشتاقات (${htLo}–${htHi}) مرتبطة بالمجال والسوق.`
        : `قلّل الهاشتاقات إلى ${htHi} كحد أقصى على هذه المنصة.`,
  );

  const tagsAtEnd = hashtagClusteredAtEnd(clean, hashtags);
  add(
    "hashtag-placement",
    "الهاشتاقات في آخر المنشور",
    4,
    tagsAtEnd ? "pass" : "warn",
    tagsAtEnd
      ? "الهاشتاقات لا تقطع قراءة النص."
      : "انقل الهاشتاقات إلى آخر سطر أو آخر سطرين حتى يبقى النص مقروءاً.",
  );

  // ٨) الرموز التعبيرية.
  const emojiOk = emojis <= spec.maxEmojis;
  add(
    "emoji",
    "رموز تعبيرية بلا مبالغة",
    5,
    emojiOk ? "pass" : "warn",
    emojiOk ? `${emojis} رمزاً.` : `قلّلها إلى ${spec.maxEmojis} كحد أقصى.`,
  );

  // ٩) قابلية القراءة: أسطر قصيرة وفقرات مفصولة.
  const longLine = lines.find((l) => l.length > spec.maxLineLen);
  // الحد الأدنى ٢٠ حرفاً: نص شديد القصر ليس «سهل القراءة» بل ناقص،
  // وكان يحصد نقاط القراءة والمسح مجاناً لمجرد قِصَره.
  const readable = !longLine && chars >= 20 && (chars < 220 || clean.includes("\n"));
  add(
    "readable",
    "سهولة القراءة على الجوال",
    9,
    readable ? "pass" : "warn",
    readable
      ? "الأسطر قصيرة والفقرات مفصولة."
      : "اكسر النص إلى فقرات قصيرة (سطر أو سطران) ليسهل قراءته على الجوال.",
  );

  const paragraphCount = lines.length;
  const scannable = (chars >= 20 && chars < 180) || (paragraphCount >= 2 && paragraphCount <= 8);
  add(
    "scan",
    "بنية سريعة المسح",
    7,
    scannable ? "pass" : "warn",
    scannable
      ? "التقسيم مناسب للقراءة السريعة."
      : "قسّم المنشور إلى ٢–٨ فقرات قصيرة؛ لا تتركه كتلة واحدة طويلة.",
  );

  // ١٠) الحشو التسويقي وبصمة النص الآلي — بندان يفصلان المنشور الاحترافي عن القالب.
  const fluff = FLUFF.filter((f) => clean.includes(f));
  add(
    "fluff",
    "بلا مبالغة أو حشو تسويقي",
    16,
    fluff.length >= 2 ? "fail" : fluff.length === 1 ? "warn" : "pass",
    fluff.length ? `استبدل بعبارات ملموسة: ${fluff.join("، ")}` : "الصياغة ملموسة.",
  );

  // ١٠ب) تفصيلة ملموسة (رقم/سعر/وقت/مكان) — بدونها المنشور كلام عام لا يبيع.
  const concrete = CONCRETE.test(core);
  add(
    "concrete",
    "تفصيلة ملموسة (رقم أو وقت أو مكان)",
    10,
    concrete ? "pass" : "warn",
    concrete
      ? "يوجد تفصيل محدد."
      : "أضف تفصيلة محددة: رقم، سعر، مدة، أو اسم مكان — العموميات لا تُقنع.",
  );

  const trust = TRUST_SIGNAL.test(core);
  add(
    "trust",
    "سبب ثقة أو إثبات",
    9,
    trust ? "pass" : "warn",
    trust
      ? "يوجد عنصر يرفع المصداقية."
      : "أضف سبب ثقة: رقم، تجربة عميل، ضمان، مقارنة قبل/بعد، أو نتيجة قابلة للتحقق.",
  );

  // ١١) الوسائط عندما تشترطها المنصة.
  if (spec.needsMedia) {
    add(
      "media",
      "صورة أو فيديو مرفق",
      10,
      hasMedia ? "pass" : "fail",
      hasMedia
        ? "الوسائط جاهزة."
        : `${PROVIDER_LABEL[provider] ?? provider} لا ينشر بدون صورة أو فيديو.`,
    );
  }

  // ١٢) تكرار داخلي.
  const sentences = core
    .split(/[.!؟\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 20);
  const repeated = sentences.length !== new Set(sentences).size;
  add(
    "repeat",
    "بلا جمل مكرّرة",
    6,
    repeated ? "warn" : "pass",
    repeated ? "توجد جملة مكررة — احذف النسخة الزائدة." : "لا تكرار.",
  );

  const richness = uniqueWordRatio(core);
  add(
    "lexical-richness",
    "تنوع لغوي بلا تكرار كلمات",
    6,
    richness >= 0.58 ? "pass" : richness >= 0.45 ? "warn" : "fail",
    richness >= 0.58
      ? "الكلمات متنوعة وطبيعية."
      : "قلّل تكرار نفس الكلمات واستبدل العموميات بتفاصيل محددة.",
  );

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce(
    (s, c) => s + (c.severity === "pass" ? c.weight : c.severity === "warn" ? c.weight * 0.5 : 0),
    0,
  );
  const score = Math.round((earned / total) * 100);
  const blockers = checks.filter((c) => c.severity === "fail");
  const quickFixes = checks
    .filter((c) => c.severity !== "pass")
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4);

  return {
    score,
    grade: score >= 90 ? "ممتاز" : score >= 75 ? "جيد" : score >= 55 ? "يحتاج تحسين" : "ضعيف",
    provider,
    providerLabel: PROVIDER_LABEL[provider] ?? provider,
    chars,
    words,
    hashtags,
    emojis,
    checks,
    blockers,
    strengths: checks.filter((c) => c.severity === "pass").sort((a, b) => b.weight - a.weight),
    quickFixes,
  };
}

/** يفحص كل المنصات المختارة ويعيد أضعف تقرير (الذي يجب إصلاحه أولاً). */
export function scoreForProviders(
  providers: string[],
  input: Omit<Input, "provider">,
): QualityReport[] {
  return providers
    .map((provider) => scorePost({ ...input, provider }))
    .sort((a, b) => a.score - b.score);
}
