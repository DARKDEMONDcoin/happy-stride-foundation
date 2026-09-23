/**
 * أصعب طلب شامل ممكن على سِراج (مدير السوشيال ميديا):
 * علامة واحدة، ٢٦ مهارة، كلها تعمل بالتوازي + محادثة حرة بطلب مركّب.
 */
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { freeChat } from "@/lib/nour-research.server";
import { executeSkill } from "@/lib/nour-run.server";

const client = createClient<Database>(
  process.env["SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  { auth: { persistSession: false } },
);
const { data: ws } = await client.from("workspaces").select("id").limit(1).single();
if (!ws) throw new Error("no workspace");

const BRAND = "متجر «رَند» للعطور الشرقية — الرياض، توصيل لكل الخليج";
const TONE = "دافئ وودود";
const DIALECT = "سعودي";
const AUD = "نساء ورجال ٢٥–٤٥، مهتمون بالعود والمسك، شراء أونلاين";

const skills: { id: string; values: Record<string, string> }[] = [
  {
    id: "social-brand-voice",
    values: {
      handle: "https://instagram.com/rand.perfume",
      samples: "وصلتنا شحنة عود كمبودي جديدة 🤍\nخصم نهاية الأسبوع على المسك الأبيض",
      tone: TONE,
      dialect: DIALECT,
    },
  },
  {
    id: "content-calendar",
    values: {
      business: BRAND,
      goal: "زيادة الطلبات من إنستغرام ٤٠٪ خلال شهر",
      perWeek: "6",
      platform: "إنستغرام",
      occasions: "اليوم الوطني، الجمعة البيضاء",
      tone: TONE,
      dialect: DIALECT,
      audience: AUD,
    },
  },
  {
    id: "trend-watch",
    values: {
      niche: "عطور شرقية في السعودية",
      competitors: "@abdulsamad\n@arabianoud",
      platform: "تيك توك",
    },
  },
  {
    id: "social-post",
    values: {
      topic: "إطلاق عطر «رَند ليل» بمزيج عود ومسك",
      platform: "إنستغرام",
      cta: "اطلبه الآن من رابط البايو",
      tone: TONE,
      dialect: DIALECT,
      audience: AUD,
    },
  },
  {
    id: "carousel",
    values: { topic: "٧ أخطاء عند شراء العود الأصلي", slides: "8", tone: TONE, dialect: DIALECT },
  },
  {
    id: "reel-script",
    values: {
      topic: "كيف تفرّق بين العود الأصلي والمقلّد",
      duration: "35",
      format: "تعليمي سريع",
      platform: "تيك توك",
      dialect: DIALECT,
    },
  },
  {
    id: "story-series",
    values: { goal: "تشويق لإطلاق عطر رَند ليل", count: "6", dialect: DIALECT },
  },
  { id: "post-visual", values: { topic: "زجاجة عطر عود على رخام مع ضوء ذهبي", style: "فاخر" } },
  {
    id: "launch-campaign",
    values: {
      product: "عطر رَند ليل + خصم إطلاق ٢٥٪",
      date: "٢٨ نوفمبر",
      platform: "إنستغرام",
      tone: TONE,
      dialect: DIALECT,
      audience: AUD,
    },
  },
  {
    id: "weekly-batch",
    values: {
      business: BRAND + " — تركيز على العود",
      count: "5",
      platform: "إنستغرام",
      tone: TONE,
      dialect: DIALECT,
    },
  },
  { id: "day-themes", values: { business: BRAND, platform: "إنستغرام", dialect: DIALECT } },
  {
    id: "engagement-replies",
    values: {
      comments:
        "كم سعر رَند ليل؟\nالتوصيل يوصل الدمام؟\nطلبت قبل شهر ووصل متأخر وزعلت\nفيه عينات تجربة؟",
      policy: "السعر ٣٢٠ ريال، التوصيل ٢–٤ أيام لكل الخليج، الاسترجاع خلال ٧ أيام",
      tone: TONE,
      dialect: DIALECT,
    },
  },
  {
    id: "repurpose-social",
    values: {
      source:
        "# كيف تختار العود المناسب لك\nالعود الكمبودي أخف والهندي أثقل. الجودة تُعرف من الدهن واللون والرائحة بعد ساعتين من التطبيق.",
      platforms: "إنستغرام، تيك توك، لينكدإن، إكس",
      dialect: DIALECT,
    },
  },
  {
    id: "ugc-testimonial",
    values: {
      testimonial: "جربت رَند ليل وثبت معي من الصبح للمغرب، وأكثر من شخص سألني عنه",
      dialect: DIALECT,
    },
  },
  {
    id: "social-report",
    values: {
      metrics:
        "منشور ١: وصول ٤٢٠٠، تفاعل ٣١٠، حفظ ٤٥\nمنشور ٢: وصول ١١٠٠، تفاعل ٤٠، حفظ ٣\nريلز ٣: وصول ٢٨٠٠٠، تفاعل ١٩٠٠، حفظ ٦٢٠",
      goal: "زيادة الحفظ والمشاركة",
      platform: "إنستغرام",
    },
  },
  {
    id: "bio-optimize",
    values: { business: BRAND + " — عود أصلي مع ضمان استرجاع", current: "متجر عطور | توصيل" },
  },
  {
    id: "social-daily-ideas",
    values: {
      business: BRAND,
      context: "وصلت شحنة عود كمبودي وأمس صار عندنا تقييم ٥ نجوم",
      platform: "إنستغرام",
      dialect: DIALECT,
    },
  },
  {
    id: "competitor-benchmark",
    values: {
      us: "متابعون ٨٤٠٠، ٤ منشورات أسبوعياً، متوسط تفاعل ٢١٠",
      rivals:
        "@brand1: ٣٢ ألف متابع، ينشر يومياً، تفاعل ٩٠٠\n@brand2: ١٢ ألف، ٣ ريلز أسبوعياً، تفاعل ٦٠٠",
    },
  },
  { id: "hashtag-lab", values: { topic: "عطر عود فاخر", city: "الرياض", platform: "إنستغرام" } },
  {
    id: "predict-performance",
    values: { topic: "منشور إطلاق عطر رَند ليل", platform: "إنستغرام" },
  },
  {
    id: "ab-test-social",
    values: { topic: "إعلان خصم إطلاق ٢٥٪", platform: "إنستغرام", dialect: DIALECT },
  },
  {
    id: "evergreen-recycle",
    values: { topic: "كيف تفرّق بين العود الأصلي والمقلّد", platform: "إنستغرام" },
  },
  {
    id: "cross-post-pack",
    values: {
      topic: "إطلاق عطر رَند ليل",
      platforms: "إنستغرام، تيك توك، لينكدإن، إكس",
      dialect: DIALECT,
    },
  },
  {
    id: "video-avatar-script",
    values: { topic: "جولة داخل معمل تعتيق العود", duration: "45", dialect: DIALECT },
  },
  { id: "link-in-bio", values: { business: BRAND, goal: "زيادة الطلبات" } },
  {
    id: "monthly-social-report",
    values: {
      metrics: "الوصول ٣٢٠ ألف، التفاعل ١٨ ألف، المتابعون +٢٤٠٠، الطلبات من إنستغرام ٣١٢",
      goal: "نمو الطلبات ٤٠٪",
    },
  },
];

async function timed<T>(name: string, fn: () => Promise<T>, shape: (v: T) => unknown) {
  const t = Date.now();
  try {
    const v = await fn();
    return { name, ok: true, secs: +((Date.now() - t) / 1000).toFixed(1), out: shape(v) };
  } catch (e) {
    return {
      name,
      ok: false,
      secs: +((Date.now() - t) / 1000).toFixed(1),
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

const HARD_BRIEF = `أنا صاحب ${BRAND}. أبي منك في رد واحد:
١) خطة إطلاق ٦٠ يوم لعطر جديد على ٤ منصات مع توزيع أسبوعي.
٢) ميزانية إعلانية ١٥ ألف ريال موزعة بالأرقام مع مبرر لكل بند.
٣) ٥ زوايا محتوى مختلفة + هوك لكل زاوية.
٤) مؤشرات نجاح رقمية وسيناريو إنقاذ لو الوصول نزل ٣٠٪.
٥) رد جاهز على أزمة تعليقات تقول إن العود مقلّد.
اكتب مختصراً منظماً بعناوين، وبالعربية السعودية.`;

const results = await Promise.all([
  timed(
    "freeChat:brief",
    () =>
      freeChat(
        process.env["OPENROUTER_API_KEY"] ?? "",
        [
          {
            role: "system",
            content: "أنت سِراج، مدير سوشيال ميديا عربي محترف. أجب بتنظيم وإيجاز.",
          },
          { role: "user", content: HARD_BRIEF },
        ],
        { maxTokens: 1800 },
      ),
    (v) => ({ chars: v.length, head: v.slice(0, 140).replace(/\n/g, " ") }),
  ),
  ...skills.map((s) =>
    timed(
      `skill:${s.id}`,
      () =>
        executeSkill(client, {
          workspaceId: ws.id,
          employeeId: "sonny",
          skillId: s.id,
          values: s.values,
          origin: "اختبار شامل موازٍ",
        }),
      (v) => ({ chars: v.output.length, head: v.output.slice(0, 110).replace(/\n/g, " ") }),
    ),
  ),
]);

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify(results, null, 2));
console.log(
  `\nSUMMARY: ${results.length - failed.length}/${results.length} ok | failed: ${failed.map((f) => f.name).join(", ") || "none"}`,
);
process.exit(0);
