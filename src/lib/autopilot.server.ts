/**
 * نواة «الطيار الآلي» لسِراج: يولّد منشوراً في كل موعد محدّد، يرفق له صورة،
 * ثم إمّا يضعه في طابور النشر ليخرج تلقائياً، أو يتركه بانتظار اعتمادك.
 *
 * قواعد التشغيل الخلفي: سقف صريح لكل تشغيلة، حجز يمنع التشغيل المزدوج،
 * تقدّم محفوظ في قاعدة البيانات، وقاطع دائرة يوقف الطيار عند رفض مزوّد الذكاء.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { scorePost } from "./post-quality";
import { localParts, zonedTimeToUtc } from "./timezone";

type Admin = SupabaseClient<Database>;
export type AutopilotRow = Database["public"]["Tables"]["social_autopilot"]["Row"];

/** أقصى عدد مساحات عمل في التشغيلة الواحدة. */
const BATCH = 25;
/** مدة الحجز: صف محجوز أقدم من هذا يُعتبر عالقاً ويُعاد التقاطه. */
const LOCK_MS = 15 * 60 * 1000;
/** أقصى عدد منصات في المنشور الواحد — سقف يمنع أي انفجار في عدد الطلبات. */
const MAX_PROVIDERS = 12;

/** المنصات التي يدعمها النشر المباشر اليوم. */
export const AUTOPILOT_PROVIDERS = [
  "instagram",
  "facebook",
  "linkedin",
  "x",
  "pinterest",
  "youtube",
] as const;

/** زوايا محتوى تتناوب يوماً بعد يوم حتى لا يتكرر المنشور نفسه. */
const ANGLES = [
  "فائدة عملية سريعة يطبّقها المتابع اليوم",
  "خلف الكواليس وقصة إنسانية عن العلامة",
  "خطأ شائع يقع فيه العملاء وكيف يتجنّبونه",
  "تجربة عميل أو نتيجة ملموسة",
  "سؤال يفتح نقاشاً مع المتابعين",
  "عرض أو دعوة فعل واضحة بلا مبالغة",
  "مقارنة بسيطة تساعد على قرار الشراء",
] as const;

export type AutopilotReport = {
  workspaceId: string;
  status: "generated" | "skipped" | "paused" | "failed";
  created: number;
  note?: string;
};

/** إعدادات التوقيت الحرّة: مواعيد بالساعة والدقيقة + أيام أسبوع + منطقة زمنية. */
export type Timing = {
  slots?: string[] | null;
  days?: number[] | null;
  timezone?: string | null;
  hours?: number[] | null;
};

// حساب المناطق الزمنية موحّد في src/lib/timezone.ts حتى لا تختلف الساعة بين الميزات.


/** يحوّل "HH:MM" إلى دقائق، ويتجاهل أي صيغة غير صالحة. */
function parseSlot(slot: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(slot.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** يوحّد الإعدادات: مواعيد بالدقيقة، أيام مسموحة، منطقة زمنية صالحة. */
export function normalizeTiming(t: Timing) {
  const fromSlots = (t.slots ?? []).map(parseSlot).filter((v): v is number => v !== null);
  const fromHours = (t.hours ?? [])
    .map(Number)
    .filter((h) => Number.isInteger(h) && h >= 0 && h <= 23)
    .map((h) => h * 60);
  const minutes = [...new Set(fromSlots.length ? fromSlots : fromHours)].sort((a, b) => a - b);
  const days = [...new Set((t.days ?? []).map(Number).filter((d) => d >= 0 && d <= 6))].sort();
  return {
    minutes: minutes.length ? minutes : [9 * 60],
    days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
    timezone: t.timezone?.trim() || "Asia/Riyadh",
  };
}

/**
 * الموعد التالي بالضبط: أقرب وقت قادم من المواعيد المختارة، في يوم مسموح،
 * محسوباً بالمنطقة الزمنية التي اختارها صاحب العلامة.
 */
export function nextRun(timing: Timing, from: Date = new Date()): Date {
  const { minutes, days, timezone } = normalizeTiming(timing);
  for (let add = 0; add <= 14; add += 1) {
    const base = new Date(from.getTime() + add * 86_400_000);
    const { y, m, d } = localParts(timezone, base);
    for (const mins of minutes) {
      const candidate = zonedTimeToUtc(timezone, y, m, d, Math.floor(mins / 60), mins % 60);
      if (candidate <= from) continue;
      if (!days.includes(localParts(timezone, candidate).dow)) continue;
      return candidate;
    }
  }
  return new Date(from.getTime() + 86_400_000);
}

/** توافقية: الحساب القديم بالساعات UTC. */
export function nextSlot(hours: number[], from: Date = new Date()): Date {
  return nextRun({ hours, timezone: "UTC" }, from);
}

/** أي سطر يمثّل عنوان قسم في مخرجات سِراج (**عنوان** أو ترقيم أو فاصل). */
function isHeading(line: string): boolean {
  return /^\s*(#{1,6}\s|\d[).]\s|-{3,}\s*$|\*\*[^*]{1,60}\*\*\s*:?\s*$)/.test(line);
}

/**
 * عناوين أقسام «ورقة العمل» التي تلي المنشور — عندها فقط نتوقف.
 * أي عنوان عريض آخر (مثل «الحل:») جزء من نص المنشور نفسه ولا يقطعه.
 */
const STOP_LABELS =
  /هاشتاق|وصف الصورة|نص بديل|\balt\b|أفضل وقت|السبب|مقياس|ملاحظ|بدائل|هوك|المصادر|توزيع|تنويه|جدول/i;

function isStop(line: string): boolean {
  return isHeading(line) && (STOP_LABELS.test(line) || /^\s*(-{3,}\s*$|\d[).]\s)/.test(line));
}

/** يستخرج نص المنشور والهاشتاقات ووصف/رابط الصورة من مخرج القدرة. */
export function extractPost(output: string): {
  caption: string;
  imagePrompt: string | null;
  imageUrl: string | null;
} {
  const clean = (t: string) =>
    t
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*/g, "")
      .replace(/^\s*\d[).]\s*/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  const lines = output.split("\n");
  const section = (label: RegExp): string | null => {
    const start = lines.findIndex((l) => isHeading(l) && label.test(l));
    if (start === -1) return null;
    const body: string[] = [];
    for (let i = start + 1; i < lines.length; i += 1) {
      const line = lines[i]!;
      if (isStop(line)) break;
      body.push(line);
    }
    return clean(body.join("\n")) || null;
  };

  const main = section(/نص المنشور|المنشور النهائي|الكابشن/);
  const tags = section(/هاشتاق/);
  const imagePrompt = section(/وصف الصورة/);

  const hashtags = tags
    ? [...new Set(tags.match(/#[\p{L}\p{N}_]+/gu) ?? [])].slice(0, 15).join(" ")
    : "";

  // الصورة المولّدة داخل القدرة نفسها — نعيد استخدامها بدل توليد صورة ثانية.
  const imageUrl = output.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/)?.[1] ?? null;

  const caption = [main ?? clean(output).slice(0, 1800), hashtags].filter(Boolean).join("\n\n");
  return {
    caption: caption.slice(0, 2200),
    imagePrompt: imagePrompt?.slice(0, 400) ?? null,
    imageUrl,
  };
}

/** نسخة إكس المختصرة — منطق موحّد مع لوحة النشر. */
import { shortForX } from "./post-format";
export { shortForX };

/** رفض دائم من مزوّد الذكاء (رصيد/سياسة) — يوقف الطيار بدل تكرار المحاولة. */
function isBlocked(message: string): boolean {
  return /\b(402|403)\b|رصيد|credit|payment required|forbidden/i.test(message);
}

/** تشغيلة واحدة لمساحة عمل: توليد منشور ثم جدولته أو رفعه للمراجعة. */
export async function runAutopilotRow(
  admin: Admin,
  row: AutopilotRow,
  now: Date = new Date(),
): Promise<AutopilotReport> {
  const timing: Timing = {
    slots: (row as { slots?: string[] | null }).slots ?? null,
    days: (row as { days?: number[] | null }).days ?? null,
    timezone: (row as { timezone?: string | null }).timezone ?? null,
    hours: (row.hours ?? []).map(Number),
  };
  const finish = async (patch: Record<string, unknown>) => {
    await admin
      .from("social_autopilot")
      .update({
        last_run_at: now.toISOString(),
        next_run_at: nextRun(timing, now).toISOString(),
        locked_at: null,
        ...patch,
      })
      .eq("id", row.id);
  };

  // منصات مطلوبة ومربوطة فعلاً فقط — لا نولّد محتوى لن يجد وجهة.
  const wanted = (row.providers ?? []).slice(0, MAX_PROVIDERS);
  if (!wanted.length) {
    await finish({ last_status: "لم تختر أي منصة بعد." });
    return {
      workspaceId: row.workspace_id,
      status: "skipped",
      created: 0,
      note: "لا منصات مختارة",
    };
  }

  const { data: accounts } = await admin
    .from("pipedream_accounts")
    .select("provider")
    .eq("workspace_id", row.workspace_id)
    .eq("status", "connected");
  const connected = new Set((accounts ?? []).map((a) => a.provider));
  const providers = wanted.filter((p) => connected.has(p));
  if (!providers.length) {
    await finish({ last_status: "المنصات المختارة غير مربوطة — اربطها من صفحة التكاملات." });
    return {
      workspaceId: row.workspace_id,
      status: "skipped",
      created: 0,
      note: "لا حسابات مربوطة",
    };
  }

  try {
    const { data: workspace } = await admin
      .from("workspaces")
      .select("name, industry, banned_words")
      .eq("id", row.workspace_id)
      .maybeSingle();

    const angle = ANGLES[Math.floor(now.getTime() / 86_400_000) % ANGLES.length]!;
    const brief = row.brief?.trim() || workspace?.industry || workspace?.name || "علامتنا";
    const topic = `${brief} — زاوية اليوم: ${angle}`;

    const { executeSkill } = await import("./nour-run.server");
    const run = await executeSkill(admin, {
      workspaceId: row.workspace_id,
      employeeId: row.employee_id,
      skillId: "social-post",
      values: {
        topic,
        platform: providers[0]!,
        dialect: row.dialect,
      },
      origin: "الطيار الآلي",
    });

    const { caption, imagePrompt, imageUrl: fromOutput } = extractPost(run.output);
    if (!caption.trim()) throw new Error("لم يخرج نص منشور صالح.");

    // القدرة نفسها قد تولّد الصورة — نعيد استخدامها ولا نولّد صورة ثانية بلا داعٍ.
    let imageUrl: string | null = row.with_image ? fromOutput : null;
    if (row.with_image && !imageUrl) {
      try {
        const { ownedHeroImage, heroPrompt } = await import("./image-gen.server");
        imageUrl =
          (await ownedHeroImage(
            admin as unknown as Parameters<typeof ownedHeroImage>[0],
            row.workspace_id,
            imagePrompt ?? heroPrompt(brief, workspace?.industry),
          )) || null;
      } catch (e) {
        console.error("[autopilot] image failed:", e);
      }
    }

    // وضع المراجعة: المهمة أُنشئت بالفعل داخل executeSkill بحالة «بانتظار الاعتماد».
    if (row.mode !== "auto") {
      await finish({ last_status: "جاهز بانتظار اعتمادك في صفحة الموافقات.", paused_reason: null });
      return {
        workspaceId: row.workspace_id,
        status: "generated",
        created: 0,
        note: "بانتظار المراجعة",
      };
    }

    const rows = providers
      // إنستجرام لا يقبل منشوراً بلا صورة — نتخطاه بدل فشل مؤكد وقت النشر.
      .filter((provider) => provider !== "instagram" || Boolean(imageUrl))
      .map((provider) => ({
        workspace_id: row.workspace_id,
        employee_id: row.employee_id,
        task_id: run.taskId,
        provider,
        // إكس يقصّ ما بعد ٢٨٠ حرفاً — نجهّز نسخة مختصرة تنتهي عند جملة كاملة.
        body: provider === "x" ? shortForX(caption) : caption,
        image_url: imageUrl,

        scheduled_at: now.toISOString(),
        status: "scheduled",
      }));

    if (!rows.length) {
      await finish({ last_status: "تعذّر تجهيز صورة، وإنستجرام يتطلب صورة." });
      return { workspaceId: row.workspace_id, status: "skipped", created: 0, note: "لا صورة" };
    }

    // Fail closed before scheduling any platform if a hard quality rule fails.
    for (const post of rows) {
      const report = scorePost({
        text: post.body,
        provider: post.provider,
        hasMedia: Boolean(post.image_url),
        bannedWords: workspace?.banned_words ?? [],
      });
      if (report.blockers.length) {
        throw new Error(
          `لم تتم الجدولة: ${report.blockers.map((check) => check.label).join("، ")}`,
        );
      }
    }
    const { error } = await admin.from("social_posts").insert(rows);
    if (error) throw new Error(error.message);

    await finish({
      last_status: `تم تجهيز ${rows.length} منشوراً للنشر التلقائي.`,
      paused_reason: null,
    });
    return { workspaceId: row.workspace_id, status: "generated", created: rows.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : "فشل غير معروف";
    if (isBlocked(message)) {
      await finish({
        active: false,
        paused_reason: `توقف الطيار: ${message.slice(0, 200)}`,
        last_status: "متوقف — يحتاج تدخلك.",
      });
      return { workspaceId: row.workspace_id, status: "paused", created: 0, note: message };
    }
    await finish({ last_status: `فشل: ${message.slice(0, 200)}` });
    return { workspaceId: row.workspace_id, status: "failed", created: 0, note: message };
  }
}

/** يلتقط دفعة محدودة من الطيارات المستحقة ويشغّلها واحداً تلو الآخر. */
export async function runDueAutopilots(
  admin: Admin,
  now: Date = new Date(),
): Promise<AutopilotReport[]> {
  const staleBefore = new Date(now.getTime() - LOCK_MS).toISOString();

  const { data: due, error } = await admin
    .from("social_autopilot")
    .select("*")
    .eq("active", true)
    .lte("next_run_at", now.toISOString())
    .or(`locked_at.is.null,locked_at.lt.${staleBefore}`)
    .order("next_run_at", { ascending: true })
    .limit(BATCH);
  if (error) throw new Error(error.message);
  if (!due?.length) return [];

  const report: AutopilotReport[] = [];
  for (const row of due) {
    // حجز ذرّي: التحديث ينجح مرة واحدة فقط لأن الشرط يتضمن الحجز السابق.
    const { data: claimed } = await admin
      .from("social_autopilot")
      .update({ locked_at: now.toISOString() })
      .eq("id", row.id)
      .eq("active", true)
      .or(`locked_at.is.null,locked_at.lt.${staleBefore}`)
      .select("id");
    if (!claimed?.length) continue;
    report.push(await runAutopilotRow(admin, row, now));
  }
  return report;
}
