/**
 * اختبار الضغط النهائي: الطلب الشامل الأصعب على نور من البداية للنهاية.
 * سلسلة واقعية: خريطة كلمات → موجز SERP → مقال كامل بصورة → ميتا → حزمة نشر
 * → أفكار يومية → تدقيق موقع، مع تتبّع الترتيب وأدوات البحث الحي بالتوازي.
 */
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { executeSkill } from "@/lib/nour-run.server";
import {
  auditPage,
  competitorInventory,
  contentBrief,
  serpSearch,
} from "@/lib/seo-research.server";

const client = createClient<Database>(
  process.env["SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  { auth: { persistSession: false } },
);
const { data: ws } = await client.from("workspaces").select("id").limit(1).single();
if (!ws) throw new Error("no workspace");

const DOMAIN = "perfume.sa";
const TOPIC = "أفضل عطور عربية رجالية 2026";
const KEYWORD = "عطور عربية رجالية";

type Step = { name: string; ok: boolean; secs: number; info: unknown };
const log: Step[] = [];

async function step<T>(
  name: string,
  fn: () => Promise<T>,
  shape: (v: T) => unknown,
): Promise<T | null> {
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

const run = (skillId: string, values: Record<string, string>) =>
  executeSkill(client, {
    workspaceId: ws.id,
    employeeId: "nour",
    skillId,
    values,
    origin: "اختبار ضغط شامل",
  });

// أ) أدوات البحث الحي بالتوازي (الأدلة الميدانية التي يبني عليها كل مخرج)
const evidence = step(
  "evidence:serp+brief+competitors+audit",
  async () => {
    const [serp, brief, inv, audit] = await Promise.all([
      serpSearch(`${KEYWORD} السعودية`),
      contentBrief(KEYWORD),
      competitorInventory(DOMAIN),
      auditPage("https://ar.wikipedia.org/wiki/عطر"),
    ]);
    return { serp, brief, inv, audit };
  },
  (v) => ({
    serpResults: v.serp.length,
    briefHeadings: v.brief.headingIdeas?.length ?? 0,
    briefTerms: v.brief.commonTerms?.length ?? 0,
    targetWords: v.brief.targetWordCount,
    competitorUrls: v.inv.urlCount,
    auditWords: v.audit.wordCount,
  }),
);

// ب) سلسلة المخرجات التحريرية (كل واحد يحتاج بحثاً حياً + LLM)
const editorial = (async () => {
  const map = await step(
    "skill:keyword-research",
    () =>
      run("keyword-research", {
        topic: `عطور عربية للمتجر ${DOMAIN}`,
        market: "السعودية",
      }),
    (v) => ({ chars: v.output.length, task: !!v.taskId }),
  );

  const brief = await step(
    "skill:serp-brief",
    () =>
      run("serp-brief", {
        keyword: KEYWORD,
        market: "السعودية",
      }),
    (v) => ({ chars: v.output.length }),
  );

  const article = await step(
    "skill:seo-article",
    () =>
      run("seo-article", {
        topic: TOPIC,
        keyword: KEYWORD,
      }),
    (v) => ({
      chars: v.output.length,
      hasHero: /!\[.*\]\(https:\/\/dtrgjaicmkqparenopdi\.supabase\.co/.test(v.output),
      hasTable: v.output.includes("|"),
      hasSchema: /schema|json-ld|JSON-LD/i.test(v.output),
    }),
  );

  const meta = await step(
    "skill:meta-pack",
    () =>
      run("meta-pack", {
        page: `صفحة ${TOPIC}`,
        keyword: KEYWORD,
      }),
    (v) => ({ chars: v.output.length }),
  );

  const pkg = article
    ? await step(
        "skill:publish-package",
        () =>
          run("publish-package", {
            content: article.output.slice(0, 6000),
            cms: "wordpress",
          }),
        (v) => ({ chars: v.output.length, hasHtml: /<h2|<p>|&lt;h2/i.test(v.output) }),
      )
    : null;

  return { map, brief, article, meta, pkg };
})();

// ج) الأفكار اليومية + التدقيق الشامل بالتوازي مع السلسلة
const daily = step(
  "skill:daily-ideas",
  () =>
    run("daily-ideas", {
      count: "5",
      topic: "عطور عربية",
      market: "السعودية",
    }),
  (v) => ({ chars: v.output.length }),
);

const audit = step(
  "skill:seo-audit",
  () =>
    run("seo-audit", {
      site: `متجر عطور سعودي — ${DOMAIN}`,
    }),
  (v) => ({ chars: v.output.length }),
);

await Promise.all([evidence, editorial, daily, audit]);

// د) تتبّع الترتيب: إضافة كلمة، لقطة ترتيب، ثم تنظيف
await step(
  "rank-tracker",
  async () => {
    const { data: kw, error } = await client
      .from("tracked_keywords")
      .insert({ workspace_id: ws.id, keyword: KEYWORD, domain: DOMAIN, market: "SA" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const results = await serpSearch(KEYWORD);
    const pos = results.findIndex((r) => r.url.includes(DOMAIN));
    await client.from("rank_snapshots").insert({
      workspace_id: ws.id,
      keyword_id: kw.id,
      position: pos >= 0 ? pos + 1 : null,
      url: pos >= 0 ? results[pos]!.url : null,
    });
    const { count } = await client
      .from("rank_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("keyword_id", kw.id);
    await client.from("tracked_keywords").delete().eq("id", kw.id);
    return { serp: results.length, position: pos >= 0 ? pos + 1 : "خارج أول 10", snapshots: count };
  },
  (v) => v,
);

const failed = log.filter((s) => !s.ok);
console.log(
  JSON.stringify(
    { steps: log, passed: log.length - failed.length, failed: failed.length },
    null,
    2,
  ),
);
process.exit(0);
