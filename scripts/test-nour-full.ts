/** اختبار شامل موازٍ لكل ما تقدّمه نور: بحث حي، مؤشرات، تدقيق، موجز، مهارات، محادثة. */
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { executeSkill } from "@/lib/nour-run.server";
import { freeChat } from "@/lib/nour-research.server";
import {
  auditPage,
  contentBrief,
  keywordExpansion,
  keywordMetrics,
  serpSearch,
  competitorInventory,
} from "@/lib/seo-research.server";

const client = createClient<Database>(
  process.env["SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  { auth: { persistSession: false } },
);
const { data: ws } = await client.from("workspaces").select("id").limit(1).single();
if (!ws) throw new Error("no workspace");

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

const skills = [
  { id: "keyword-research", values: { topic: "تأمين سيارات في السعودية", market: "السعودية" } },
  {
    id: "seo-article",
    values: { topic: "أفضل بطاقات ائتمان بدون رسوم في مصر", keyword: "بطاقات ائتمان بدون رسوم" },
  },
  { id: "serp-brief", values: { keyword: "أسعار الذهب اليوم", market: "مصر" } },
  { id: "meta-pack", values: { page: "صفحة أسعار تأمين السيارات", keyword: "تأمين سيارات" } },
  { id: "geo-answers", values: { topic: "كيف أختار شركة استضافة عربية" } },
  { id: "seo-audit", values: { site: "متجر عطور سعودي — perfume.sa" } },
  {
    id: "publish-package",
    values: {
      content:
        "# دليل تحسين المتاجر العربية\n\nمقدمة قصيرة عن تحسين متجر إلكتروني عربي وزيادة ظهوره في البحث.",
      cms: "wordpress",
    },
  },
];

const results = await Promise.all([
  timed(
    "serp",
    () => serpSearch("أفضل شركات تأمين في السعودية"),
    (v) => ({ n: v.length, first: v[0]?.url }),
  ),
  timed(
    "keywordExpansion",
    () => keywordExpansion("تأمين سيارات"),
    (v) => ({
      related: v.related?.length ?? 0,
      questions: v.questions?.length ?? 0,
    }),
  ),
  timed(
    "keywordMetrics",
    () => keywordMetrics("تأمين سيارات"),
    (v) => v,
  ),
  timed(
    "auditPage",
    () => auditPage("https://ar.wikipedia.org/wiki/سيو"),
    (v) => ({
      title: v.title?.slice(0, 60),
      words: v.wordCount,
      raw: v.rawWordCount,
      h1: v.h1?.length,
    }),
  ),
  timed(
    "contentBrief",
    () => contentBrief("أفضل بطاقات ائتمان في مصر"),
    (v) => ({
      headings: v.headingIdeas?.length ?? 0,
      terms: v.commonTerms?.length ?? 0,
      analyzed: v.analyzed,
      target: v.targetWordCount,
    }),
  ),
  timed(
    "competitorInventory",
    () => competitorInventory("almowafir.com"),
    (v) => ({
      urls: v.urlCount,
      samples: v.samples?.length ?? 0,
    }),
  ),
  timed(
    "freeChat",
    () =>
      freeChat(
        process.env["OPENROUTER_API_KEY"]!,
        [
          { role: "system", content: "أنت نور، خبيرة SEO عربية. أجيبي بإيجاز." },
          { role: "user", content: "اذكري 3 أخطاء SEO شائعة في المواقع العربية." },
        ],
        { maxTokens: 400 },
      ),
    (v) => ({ chars: v.length, head: v.slice(0, 90).replace(/\n/g, " ") }),
  ),
  ...skills.map((s) =>
    timed(
      `skill:${s.id}`,
      () =>
        executeSkill(client, {
          workspaceId: ws.id,
          employeeId: "nour",
          skillId: s.id,
          values: s.values,
          origin: "اختبار شامل",
        }),
      (v) => ({ chars: v.output.length, head: v.output.slice(0, 110).replace(/\n/g, " ") }),
    ),
  ),
]);

console.log(JSON.stringify(results, null, 2));
process.exit(0);
