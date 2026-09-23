/**
 * أصعب اختبار ممكن على سِراج: بريف مصري شامل من ٢٠ بنداً (استراتيجية + تقويم + إنتاج
 * + أزمات + تحليل + منافسين + تقارير) مع تشغيل كل القدرات بالتوازي في نفس اللحظة.
 */
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { freeChat } from "@/lib/nour-research.server";
import { executeSkill } from "@/lib/nour-run.server";
import { sonnySkills } from "@/data/skills-sonny";

const client = createClient<Database>(
  process.env["SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  { auth: { persistSession: false } },
);
const { data: ws } = await client.from("workspaces").select("id").limit(1).single();
if (!ws) throw new Error("no workspace");

const BIZ = "مطعم «بلدنا» للأكل الصحي — فرعان بالقاهرة والإسكندرية + توريد بالجملة للمطاعم";
const DIA = "مصرية";
const TONE = "ودودة";
const AUD = "أمهات ٢٥–٤٠ بالقاهرة الكبرى حساسات للسعر والنظافة، وشباب ١٨–٣٠ على تيك توك";
const RIVALS =
  "@zooba.eg: ٤٨٠ ألف متابع، ينشر يومياً، تفاعل ٣٢٠٠\n@kazouza: ١٢٠ ألف، ٤ ريلز أسبوعياً، تفاعل ٩٠٠";

const VALUES: Record<string, Record<string, string>> = {
  "social-brand-voice": {
    handle: "https://instagram.com/baladna.eg",
    samples: "النهاردة عندنا سلطة الكينوا بالرمان 🥗\nالتوصيل مجاني لأول طلب",
    audience: AUD,
    dialect: DIA,
  },
  "content-calendar": {
    goal: "زيادة الطلبات أونلاين ١٥٪",
    platform: "إنستغرام",
    perWeek: "6",
    audience: AUD,
    tone: TONE,
    dialect: DIA,
    occasions: "رمضان، عيد الأم المصري ٢١ مارس، بداية الدراسة",
  },
  "trend-watch": {
    niche: "مطاعم أكل صحي في القاهرة",
    competitors: "@zooba.eg\n@kazouza",
    platform: "تيك توك",
  },
  "quarterly-strategy": {
    business: BIZ,
    goal: "زيادة الطلبات أونلاين ١٥٪ ورفع التحويل من ٢٪ إلى ٣.٥٪ خلال ٩٠ يوماً",
    platforms: "إنستغرام، فيسبوك، تيك توك، لينكدإن",
    segments: "أمهات ٢٥–٤٠ حساسات للسعر\nشباب ١٨–٣٠ على تيك توك\nأصحاب مطاعم B2B على لينكدإن",
    market: "مصر",
    rivals: RIVALS,
    dialect: DIA,
    tone: TONE,
  },
  "crisis-playbook": {
    business: BIZ,
    scenarios:
      "شكوى فيروسية عن جسم غريب في الأكل\nانتقاد من مؤثر مصري كبير\nتسريب سعر عرض غلط\nحساسية دينية في توقيت بوست برمضان\nهجوم تقييمات منظم",
    facts: "شهادة سلامة غذاء سارية، استرجاع أو استبدال خلال ٢٤ ساعة، مطبخ مفتوح للزيارة",
    team: "مدير الفرع ثم مدير التشغيل ثم المالك",
    dialect: DIA,
  },
  "social-post": {
    topic: "إطلاق وجبة «فطار بلدنا» الصحية",
    platform: "إنستغرام",
    cta: "اطلب دلوقتي من اللينك في البايو",
    tone: TONE,
    dialect: DIA,
    audience: AUD,
  },
  carousel: {
    topic: "٧ حاجات بتاكلها فاكرها صحية وهي مش كده",
    slides: "8",
    tone: TONE,
    dialect: DIA,
  },
  "reel-script": {
    topic: "يوم في مطبخ بلدنا من ٦ الصبح",
    duration: "35",
    format: "خلف الكواليس",
    platform: "تيك توك",
    dialect: DIA,
  },
  "story-series": { goal: "تشويق لإطلاق منيو رمضان", count: "6", dialect: DIA },
  "post-visual": {
    topic: "طبق سلطة كينوا بالرمان على ترابيزة خشب بإضاءة طبيعية",
    style: "دافئ وطبيعي",
  },
  "launch-campaign": {
    product: "منيو رمضان + عرض السحور لشخصين",
    date: "أول رمضان",
    platform: "إنستغرام",
    tone: TONE,
    dialect: DIA,
    audience: AUD,
  },
  "weekly-batch": { business: BIZ, count: "5", platform: "إنستغرام", tone: TONE, dialect: DIA },
  "day-themes": { business: BIZ, platform: "إنستغرام", dialect: DIA },
  "engagement-replies": {
    comments:
      "الأكل ده بايظ من امبارح ولا ايه يا باشا؟\nبكام الوجبة العائلية؟\nالتوصيل بيوصل الإسكندرية؟\nوالله أحلى أكل صحي جربته\nطلبت وجالي ناقص صنف وزعلت جداً\nاشتريت وحسيت بمغص بعدها",
    policy:
      "الوجبة العائلية ٤٥٠ جنيه، التوصيل للقاهرة والإسكندرية خلال ٩٠ دقيقة، استبدال خلال ٢٤ ساعة",
    tone: TONE,
    dialect: DIA,
  },
  "repurpose-social": {
    source:
      "# ازاي تفرق بين الأكل الصحي الحقيقي والتسويقي\nكلمة «لايت» مش معناها قليل سعرات. اقرا جدول القيم الغذائية وركز على الدهون المضافة والسكر المخفي.",
    platforms: "إنستغرام، تيك توك، لينكدإن، إكس",
    dialect: DIA,
  },
  "ugc-testimonial": {
    testimonial: "بقالي شهرين باطلب من بلدنا وخسيت ٤ كيلو من غير حرمان",
    dialect: DIA,
  },
  "social-report": {
    metrics:
      "بوست ١: وصول ٥٢٠٠، تفاعل ٣٤٠، حفظ ٥١\nبوست ٢: وصول ٩٠٠، تفاعل ٣٣، حفظ ٢\nريلز ٣: وصول ٤١٠٠٠، تفاعل ٢٦٠٠، حفظ ٨٩٠",
    goal: "زيادة الحفظ والطلبات",
    platform: "إنستغرام",
  },
  "bio-optimize": { business: BIZ + " — توصيل ٩٠ دقيقة", current: "أكل صحي | ديليفري" },
  "social-daily-ideas": {
    business: BIZ,
    context: "النهاردة نزل منيو جديد وامبارح جالنا ريفيو ٥ نجوم من مؤثرة",
    platform: "إنستغرام",
    dialect: DIA,
  },
  "competitor-benchmark": {
    us: "متابعون ٤٨٠٠٠، ٥ منشورات أسبوعياً، متوسط تفاعل ٦٢٠",
    rivals: RIVALS,
    platform: "إنستغرام",
  },
  "hashtag-lab": { topic: "أكل صحي دايت", city: "القاهرة", platform: "إنستغرام" },
  "predict-performance": {
    draft:
      "هوك: بطلت تفطر صح؟\nفطار بلدنا الجديد: بيض بلدي وعيش سن مع أفوكادو، ٢٩٠ سعرة بس.\nاطلب دلوقتي من اللينك في البايو.",
    platform: "إنستغرام",
    past: "بوست تعليمي: وصول ٥٢٠٠ / بوست عرض: وصول ١٩٠٠",
  },
  "ab-test-social": {
    post: "سحور بلدنا لشخصين بـ ٢٩٩ جنيه بس — يوصلك لحد باب البيت قبل الإمساك بساعة.",
    variable: "الهوك",
    platform: "إنستغرام",
    reach: "4000",
    dialect: DIA,
  },
  "evergreen-recycle": {
    winners:
      "بوست «ازاي تقرا جدول القيم الغذائية» — وصول ٣٨ ألف، حفظ ١٢٤٠\nريلز «٣ فطارات تحت ٣٠٠ سعرة» — وصول ٦٢ ألف، حفظ ٢١٠٠",
    platform: "إنستغرام",
    gap: "من ٤ إلى ٨ شهور",
  },
  "cross-post-pack": {
    idea: "إطلاق منيو رمضان: سحور صحي يوصل قبل الإمساك بساعة",
    platforms: "إنستغرام، تيك توك، لينكدإن، إكس",
    dialect: DIA,
  },
  "video-avatar-script": { topic: "قصة تأسيس بلدنا بصوت المؤسس", duration: "45", dialect: DIA },
  "link-in-bio": { business: BIZ, goal: "زيادة الطلبات أونلاين" },
  "monthly-social-report": {
    numbers:
      "إنستغرام: وصول ٤١٠ ألف، تفاعل ٢٢ ألف، متابعون +٣١٠٠\nتيك توك: وصول ٩٨٠ ألف، تفاعل ٦٤ ألف\nفيسبوك: وصول ١٢٠ ألف، تفاعل ٣٤٠٠",
    goal: "زيادة الطلبات ١٥٪",
    prev: "إنستغرام: وصول ٣٦٠ ألف، تفاعل ١٩ ألف",
    metrics: "الطلبات من السوشيال ٨٤٠ طلب",
  },
};

const BRIEF = `أنا صاحب ${BIZ}. عايز في رد واحد منظم بالعامية المصرية:
١) استراتيجية ٩٠ يوم لكل منصة (إنستجرام/فيسبوك/تيك توك/لينكدإن) بصوت وهدف مختلف لكل واحدة.
٢) ٤ ركائز محتوى بنسب مئوية مجموعها ١٠٠٪.
٣) تقويم مناسبات مصري وإزاي رمضان بيغير التوقيتات والنبرة.
٤) ٥ كوبشن جاهزة بالعامية المصرية مش فصحى مترجمة.
٥) دليل أزمات لسيناريو شكوى تسمم فيروسية: رد أول ساعة + تصعيد + بيان.
٦) ٨ مؤشرات أداء وداشبورد أسبوعي بألوان.
٧) تحليل المنافسين ${RIVALS.replace(/\n/g, " و ")} والفجوة اللي نستغلها.
٨) رد على كومنت ساخر: «يا باشا الأكل ده بايظ من امبارح ولا ايه؟» — وضّح ازاي فرقت بين السخرية والشكوى.
اختصر وركّز واستخدم عناوين وجداول.`;

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

const results = await Promise.all([
  timed(
    "freeChat:brief",
    () =>
      freeChat(
        "",
        [
          {
            role: "system",
            content:
              "أنت سِراج، مدير سوشيال ميديا عربي محترف يعمل في السوق المصري. نفّذ البريف كاملاً بلا مقدمات.",
          },
          { role: "user", content: BRIEF },
        ],
        { maxTokens: 3200, timeoutMs: 55_000 },
      ),
    (v) => ({ chars: v.length, head: v.slice(0, 160).replace(/\n/g, " ") }),
  ),
  ...sonnySkills.map((s) =>
    timed(
      `skill:${s.id}`,
      () =>
        executeSkill(client, {
          workspaceId: ws.id,
          employeeId: "sonny",
          skillId: s.id,
          values: VALUES[s.id] ?? {},
          origin: "اختبار البريف المصري الشامل",
        }),
      (v) => ({
        chars: v.output.length,
        img: v.output.includes("!["),
        head: v.output.slice(0, 120).replace(/\n/g, " "),
      }),
    ),
  ),
]);

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify(results, null, 2));
console.log(
  `\nSUMMARY: ${results.length - failed.length}/${results.length} ok | failed: ${failed.map((f) => `${f.name} (${(f as { error?: string }).error})`).join(" | ") || "none"}`,
);
process.exit(0);
