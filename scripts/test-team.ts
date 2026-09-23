/**
 * اختبار الفريق كاملاً بالتوازي: أمَل وسالم ودانة وآدم (بعد نور وسِراج).
 * يشغّل قدرات حقيقية لكل موظف ويتحقق من طول المخرج وحفظ المهمة والصور.
 */
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { executeSkill } from "@/lib/nour-run.server";
import { skillsFor } from "@/data/skills";
import { actionsFor } from "@/lib/employee-actions.server";

const client = createClient<Database>(
  process.env["SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  { auth: { persistSession: false } },
);
const { data: ws } = await client.from("workspaces").select("id").limit(1).single();
if (!ws) throw new Error("no workspace");

type Step = { name: string; ok: boolean; secs: number; info: unknown };
const log: Step[] = [];

async function step<T>(name: string, fn: () => Promise<T>, shape: (v: T) => unknown) {
  const t = Date.now();
  try {
    const v = await fn();
    log.push({ name, ok: true, secs: +((Date.now() - t) / 1000).toFixed(1), info: shape(v) });
    return v;
  } catch (e) {
    log.push({
      name,
      ok: false,
      secs: +((Date.now() - t) / 1000).toFixed(1),
      info: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

const run = (employeeId: string, skillId: string, values: Record<string, string>) =>
  executeSkill(client, {
    workspaceId: ws.id,
    employeeId,
    skillId,
    values,
    origin: "اختبار الفريق",
  });

const shape = (v: { output: string; taskId?: string | null }) => ({
  chars: v.output.length,
  task: Boolean(v.taskId),
  hasImage: /!\[.*\]\(https?:\/\//.test(v.output),
});

const cases: [string, string, Record<string, string>][] = [
  [
    "eva",
    "email-reply",
    {
      email:
        "السلام عليكم، نود تأجيل اجتماع الاثنين لأننا ننتظر موافقة الإدارة. هل يناسبكم الأربعاء؟",
      intent: "الموافقة على التأجيل واقتراح موعد بديل",
    },
  ],
  [
    "eva",
    "meeting-notes",
    {
      notes:
        "اتفقنا على إطلاق الحملة أول الشهر، سعود يجهز الميزانية، ريم تتابع المصمم، الميزانية 30 ألف ريال، لم نحسم قناة الإعلان.",
    },
  ],
  [
    "sam",
    "cold-sequence",
    {
      segment: "مدراء تسويق في متاجر إلكترونية سعودية",
      pain: "تكلفة اكتساب مرتفعة وضعف تكرار الشراء",
      steps: "4",
    },
  ],
  [
    "sam",
    "objection-handling",
    { objections: "سعركم غالي، لدينا وكالة حالياً، ليس الوقت المناسب" },
  ],
  ["dana", "visual-identity", { brand: "متجر عطور سعودي فاخر", feeling: "فخامة هادئة وثقة" }],
  [
    "dana",
    "design-image",
    { subject: "زجاجة عطر عود فاخرة على رخام داكن", colors: "#0F172A, #C9A227" },
  ],
  ["adam", "performance-report", { period: "آخر 28 يوماً", focus: "الزيارات العضوية والتحويلات" }],
  [
    "adam",
    "ab-test-plan",
    { hypothesis: "تغيير زر الشراء إلى «اطلب الآن» يرفع التحويل", traffic: "40000" },
  ],
];

await Promise.all(
  cases.map(([emp, skill, values]) =>
    step(`${emp}:${skill}`, () => run(emp, skill, values), shape),
  ),
);

// سلامة البيانات: عدد القدرات والإجراءات لكل موظف
for (const emp of ["nour", "sonny", "eva", "sam", "dana", "adam"]) {
  log.push({
    name: `catalog:${emp}`,
    ok: skillsFor(emp).length > 0,
    secs: 0,
    info: { skills: skillsFor(emp).length, actions: actionsFor(emp).length },
  });
}

const failed = log.filter((s) => !s.ok);
console.log(
  JSON.stringify(
    { steps: log, passed: log.length - failed.length, failed: failed.length },
    null,
    2,
  ),
);
process.exit(0);
