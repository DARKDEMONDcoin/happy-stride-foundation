/** إعادة اختبار القدرات الستّ التي سقطت في الجولة المتوازية، بحقول صحيحة وعلى دفعتين. */
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { executeSkill } from "@/lib/nour-run.server";

const client = createClient<Database>(
  process.env["SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  { auth: { persistSession: false } },
);
const { data: ws } = await client.from("workspaces").select("id").limit(1).single();
if (!ws) throw new Error("no workspace");

const POST = "وصلتنا شحنة عود كمبودي جديدة 🤍 ثبات ٨ ساعات وسعر يبدأ من ٣٢٠ ريال — اطلبه من البايو";

const cases: { id: string; values: Record<string, string> }[] = [
  {
    id: "predict-performance",
    values: {
      draft: POST,
      platform: "إنستغرام",
      past: "منشور تعليمي: وصول ٥٢٠٠ / منشور عرض: وصول ١٩٠٠",
    },
  },
  {
    id: "ab-test-social",
    values: { post: POST, variable: "الهوك", platform: "إنستغرام", reach: "4000" },
  },
  {
    id: "evergreen-recycle",
    values: { winners: POST + " — وصول ٢٨٠٠٠، حفظ ٦٢٠", gap: "من ٣ إلى ٩ أشهر" },
  },
  {
    id: "cross-post-pack",
    values: { idea: "إطلاق عطر رَند ليل", platforms: "إنستغرام، تيك توك، لينكدإن، إكس" },
  },
  {
    id: "monthly-social-report",
    values: {
      numbers:
        "إنستغرام: وصول ٢٢٠ ألف، تفاعل ١٢ ألف، متابعون +١٨٠٠\nتيك توك: وصول ١٠٠ ألف، تفاعل ٦ آلاف",
      goal: "زيادة الطلبات ٤٠٪",
      prev: "إنستغرام: وصول ١٦٠ ألف، تفاعل ٩ آلاف",
    },
  },
  {
    id: "content-calendar",
    values: {
      business: "متجر «رَند» للعطور الشرقية — الرياض",
      goal: "زيادة الطلبات من إنستغرام ٤٠٪",
      perWeek: "6",
      platform: "إنستغرام",
      occasions: "اليوم الوطني، الجمعة البيضاء",
    },
  },
  {
    id: "social-report",
    values: {
      metrics: "منشور ١: وصول ٤٢٠٠، تفاعل ٣١٠، حفظ ٤٥\nريلز ٣: وصول ٢٨٠٠٠، تفاعل ١٩٠٠، حفظ ٦٢٠",
      goal: "زيادة الحفظ",
      platform: "إنستغرام",
    },
  },
];

async function run(c: (typeof cases)[number]) {
  const t = Date.now();
  try {
    const v = await executeSkill(client, {
      workspaceId: ws!.id,
      employeeId: "sonny",
      skillId: c.id,
      values: c.values,
      origin: "إعادة اختبار",
    });
    return {
      name: c.id,
      ok: true,
      secs: +((Date.now() - t) / 1000).toFixed(1),
      chars: v.output.length,
      head: v.output.slice(0, 100).replace(/\n/g, " "),
    };
  } catch (e) {
    return {
      name: c.id,
      ok: false,
      secs: +((Date.now() - t) / 1000).toFixed(1),
      error: (e as Error).message.slice(0, 160),
    };
  }
}

const out: unknown[] = [];
for (const chunk of [cases.slice(0, 4), cases.slice(4)]) {
  out.push(...(await Promise.all(chunk.map(run))));
}
for (const r of out as { name: string; ok: boolean; secs: number }[])
  console.log(JSON.stringify(r));
process.exit(0);
