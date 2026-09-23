/**
 * سياق نور التشغيلي — ما تفتقده أدوات السيو العالمية: حلقة مغلقة بين ما كُتب،
 * وما ظهر فعلاً في Google، وما يجب فعله تالياً.
 *  1) أسرع المكاسب من Search Console الحقيقي (المركز 8–20، ضعف النقر، تعارض الصفحات).
 *  2) الكلمات المتتبَّعة وترتيبها الأخير واتجاهه.
 *  3) ما نشرته نور سابقاً حتى لا تكرر موضوعاً ولا تتنافس صفحتان.
 *  4) قنوات النشر والفهرسة المربوطة فعلاً (ووردبريس/Shopify/Webflow/Ghost/IndexNow/GSC).
 * كل ذلك من بيانات مساحة العمل نفسها ومن واجهات مجانية — بلا أي خدمة مدفوعة.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** كتلة نصية جاهزة للحقن في تعليمات نور (فارغة إن لم تتوفر بيانات). */
export async function nourContext(client: Client, workspaceId: string): Promise<string> {
  const [gsc, keywordsRes, publishedRes, connectedRes] = await Promise.all([
    (async () => {
      try {
        const { gscOpportunities } = await import("./gsc.functions");
        return await gscOpportunities(workspaceId, 28);
      } catch {
        return null;
      }
    })(),
    client
      .from("tracked_keywords")
      .select("id, keyword, domain, market, last_checked_at")
      .eq("workspace_id", workspaceId)
      .eq("active", true)
      .limit(25),
    client
      .from("tasks")
      .select("title, status, created_at")
      .eq("workspace_id", workspaceId)
      .eq("employee_id", "nour")
      .order("created_at", { ascending: false })
      .limit(25),
    client
      .from("integrations")
      .select("provider")
      .eq("workspace_id", workspaceId)
      .eq("status", "connected"),
  ]);

  const sections: string[] = [];

  // 1) أسرع المكاسب من Search Console
  if (gsc?.data) {
    const d = gsc.data;
    const rows: string[] = [];
    if (d.strikingDistance.length) {
      rows.push(
        `**على حافة الصفحة الأولى (المركز 8–20 — أعلى عائد):**\n${d.strikingDistance
          .slice(0, 8)
          .map(
            (r) =>
              `  - «${r.key}» · المركز ${r.position.toFixed(1)} · ${r.impressions} ظهور · ${r.clicks} نقرة`,
          )
          .join("\n")}`,
      );
    }
    if (d.lowCtr.length) {
      rows.push(
        `**ظهور عالٍ ونقر منخفض (المشكلة العنوان/الوصف لا الترتيب):**\n${d.lowCtr
          .slice(0, 6)
          .map(
            (r) =>
              `  - «${r.key}» · المركز ${r.position.toFixed(1)} · ${r.impressions} ظهور · نقر ${pct(r.ctr)}`,
          )
          .join("\n")}`,
      );
    }
    if (d.cannibalization.length) {
      rows.push(
        `**تعارض صفحات على نفس الاستعلام (ادمج أو فرّق النية):**\n${d.cannibalization
          .slice(0, 5)
          .map(
            (c) =>
              `  - «${c.key}» ← ${c.pages.length} صفحات: ${c.pages.map((p) => p.url).join(" | ")}`,
          )
          .join("\n")}`,
      );
    }
    if (rows.length)
      sections.push(
        `### أرقام موقعك الحقيقية من Search Console (${d.site} · ${d.range.start} ← ${d.range.end})\n${rows.join("\n")}\nهذه أرقام موثّقة: اذكرها بمصدرها، وابنِ الأولويات عليها قبل اقتراح أي محتوى جديد.`,
      );
  } else if (gsc?.status?.state && gsc.status.state !== "ok") {
    sections.push(
      `### حالة Search Console\n${gsc.status.message}\nلا تخترع أرقام ترتيب أو نقرات: صرّح بأن التقدير مبني على أنماط القطاع، واطلب الربط بسطر واحد فقط عند الحاجة الفعلية.`,
    );
  }

  // 2) الكلمات المتتبَّعة وآخر ترتيب لها
  const keywords = keywordsRes.data ?? [];
  if (keywords.length) {
    const { data: snaps } = await client
      .from("rank_snapshots")
      .select("keyword_id, position, captured_at, source")
      .eq("workspace_id", workspaceId)
      .in(
        "keyword_id",
        keywords.map((k) => k.id),
      )
      .order("captured_at", { ascending: false })
      .limit(200);

    const latest = new Map<
      string,
      { position: number | null; source: string; captured_at: string }
    >();
    const previous = new Map<string, number>();
    for (const s of snaps ?? []) {
      if (!latest.has(s.keyword_id)) latest.set(s.keyword_id, s);
      else if (!previous.has(s.keyword_id) && s.position != null)
        previous.set(s.keyword_id, s.position);
    }
    const lines = keywords.slice(0, 15).map((k) => {
      const l = latest.get(k.id);
      if (!l || l.position == null) return `  - «${k.keyword}» (${k.market}) · لم يُقَس بعد`;
      const prev = previous.get(k.id);
      const move =
        prev == null
          ? ""
          : prev === l.position
            ? " · ثابت"
            : prev > l.position
              ? ` · ▲ تحسّن ${prev - l.position}`
              : ` · ▼ تراجع ${l.position - prev}`;
      return `  - «${k.keyword}» (${k.market}) · المركز ${l.position}${move} · المصدر ${l.source}`;
    });
    sections.push(
      `### الكلمات المتتبَّعة لهذا الموقع (آخر قياس)\n${lines.join("\n")}\nعند الحديث عن الترتيب استخدم هذه الأرقام حرفياً بمصدرها، ولا تقدّر ترتيباً لكلمة موجودة هنا.`,
    );
  }

  // 3) ما أنتجته نور سابقاً — منع التكرار والتعارض
  const published = publishedRes.data ?? [];
  if (published.length) {
    const done = published.filter((t) => t.status === "done").slice(0, 12);
    const pending = published.filter((t) => t.status === "review").slice(0, 6);
    const rows = [
      done.length ? `**منشور/منجز:**\n${done.map((t) => `  - ${t.title}`).join("\n")}` : "",
      pending.length
        ? `**بانتظار اعتماد المستخدم:**\n${pending.map((t) => `  - ${t.title}`).join("\n")}`
        : "",
    ].filter(Boolean);
    if (rows.length)
      sections.push(
        `### ما أنتجتِه سابقاً لهذه العلامة\n${rows.join("\n")}\nقبل اقتراح موضوع جديد: إن كان قريباً من موضوع قائم فحدّثه أو وسّعه أو اربطه داخلياً بدل إنشاء صفحة تنافسه.`,
      );
  }

  // 4) قنوات النشر والفهرسة
  const connected = new Set((connectedRes.data ?? []).map((r) => r.provider));
  const channels = [
    { id: "wordpress", label: "ووردبريس (نشر كمسودة)" },
    { id: "shopify", label: "Shopify" },
    { id: "webflow", label: "Webflow" },
    { id: "ghost", label: "Ghost" },
    { id: "indexnow", label: "IndexNow (إخطار فوري لمحركات البحث)" },
    { id: "search-console", label: "Search Console" },
  ];
  const on = channels.filter((c) => connected.has(c.id));
  const off = channels.filter((c) => !connected.has(c.id));
  sections.push(
    [
      "### قنوات النشر والفهرسة",
      on.length
        ? `مربوط فعلاً: ${on.map((c) => c.label).join("، ")} — استخدمها في خطوة النشر ولا تطلب ربطها مجدداً.`
        : "لا توجد قناة نشر مربوطة بعد.",
      off.length
        ? `غير مربوط: ${off.map((c) => c.label).join("، ")} — اطلب الربط فقط لحظة الحاجة الفعلية وبسطر واحد.`
        : "",
      connected.has("indexnow")
        ? "بعد اعتماد أي صفحة جديدة أو محدّثة: ذكّر بإرسالها عبر IndexNow في سطر واحد ضمن «الخطوة التالية»."
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return sections.length
    ? `## سياق نور التشغيلي (بيانات حقيقية من مساحة العمل)\n${sections.join("\n\n")}`
    : "";
}
