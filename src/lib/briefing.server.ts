import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { timezoneForCountry } from "./time-awareness.server";
import { staleBefore } from "./task-freshness";

type Admin = SupabaseClient<Database>;

/**
 * الإحاطة الصباحية لأمَل (مثل Marblism Eva): ملخص يومي واحد لكل مساحة عمل —
 * ما ينتظر موافقتك، ما سيُنشر اليوم، تغيّر الترتيب، حسابات تحتاج انتباهاً،
 * و3 أفكار منشورات جاهزة للطلب من سِراج. مبنية على بيانات حقيقية فقط.
 */
export type Briefing = {
  day: string;
  greeting: string;
  headline: string;
  approvals: { id: string; title: string; employee: string }[];
  todayPosts: {
    id: string;
    provider: string;
    at: string;
    status: string;
    title: string;
    image: string | null;
  }[];
  rankMoves: { keyword: string; from: number | null; to: number | null; delta: number }[];
  attention: string[];
  ideas: { title: string; hook: string; provider: string; prompt: string }[];
  stats: { done7d: number; published7d: number; scheduled: number };
};

function todayIso(tz: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function localHour(tz: string) {
  try {
    return Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", hour12: false }).format(
        new Date(),
      ),
    );
  } catch {
    return new Date().getUTCHours();
  }
}

export async function buildBriefing(admin: Admin, workspaceId: string): Promise<Briefing> {
  const { data: ws } = await admin
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!ws) throw new Error("مساحة العمل غير موجودة.");
  const { data: auto } = await admin
    .from("social_autopilot")
    .select("timezone, dialect")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  const tz = auto?.timezone ?? timezoneForCountry((ws as { country?: string | null }).country);
  const day = todayIso(tz);
  const dayStart = new Date(`${day}T00:00:00`);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [
    { data: review },
    { data: posts },
    { data: doneTasks },
    { data: integrations },
    { data: keywords },
  ] = await Promise.all([
    admin
      .from("tasks")
      .select("id, title, employee_id, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .eq("status", "review")
      .gte("updated_at", staleBefore())
      .order("created_at", { ascending: false })
      .limit(6),
    admin
      .from("social_posts")
      .select("id, provider, scheduled_at, status, image_url, meta, body, published_at")
      .eq("workspace_id", workspaceId)
      .gte("scheduled_at", new Date(dayStart.getTime() - 12 * 3_600_000).toISOString())
      .lte("scheduled_at", new Date(dayEnd.getTime() + 12 * 3_600_000).toISOString())
      .order("scheduled_at"),
    admin
      .from("tasks")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("status", "done")
      .gte("updated_at", weekAgo),
    admin
      .from("integrations")
      .select("provider, status")
      .eq("workspace_id", workspaceId)
      .eq("status", "error"),
    admin
      .from("tracked_keywords")
      .select("id, keyword")
      .eq("workspace_id", workspaceId)
      .eq("active", true)
      .limit(30),
  ]);

  const { count: published7d } = await admin
    .from("social_posts")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .gte("published_at", weekAgo);
  const { count: scheduled } = await admin
    .from("social_posts")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "scheduled");

  // تغيّر الترتيب: آخر لقطتين لكل كلمة
  const rankMoves: Briefing["rankMoves"] = [];
  if (keywords?.length) {
    const { data: snaps } = await admin
      .from("rank_snapshots")
      .select("keyword_id, position, captured_at")
      .eq("workspace_id", workspaceId)
      .in(
        "keyword_id",
        keywords.map((k) => k.id),
      )
      .order("captured_at", { ascending: false })
      .limit(200);
    const byKw = new Map<string, (number | null)[]>();
    for (const s of snaps ?? []) {
      const arr = byKw.get(s.keyword_id) ?? [];
      if (arr.length < 2) arr.push(s.position);
      byKw.set(s.keyword_id, arr);
    }
    for (const k of keywords) {
      const [to, from] = byKw.get(k.id) ?? [];
      if (to == null || from == null || to === from) continue;
      rankMoves.push({ keyword: k.keyword, from, to, delta: from - to });
    }
    rankMoves.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }

  const attention: string[] = [];
  for (const i of integrations ?? []) attention.push(`حساب ${i.provider} يحتاج إعادة ربط.`);
  const failed = (posts ?? []).filter((p) => p.status === "failed");
  if (failed.length) attention.push(`${failed.length} منشور فشل نشره اليوم — راجع الطابور.`);
  const ideasPending = (posts ?? []).filter(
    (p) => p.status === "idea" || p.status === "draft",
  ).length;
  if (ideasPending)
    attention.push(`${ideasPending} منشور اليوم بانتظار الاعتماد في تقويم المحتوى.`);

  let ideas: Briefing["ideas"] = [];
  try {
    const { dailyIdeas } = await import("./content-calendar.server");
    ideas = await dailyIdeas(admin, workspaceId, auto?.dialect ?? null);
  } catch (e) {
    console.error("[briefing] ideas failed", e instanceof Error ? e.message : e);
  }

  const h = localHour(tz);
  const greeting = h < 12 ? "صباح الخير" : h < 18 ? "مساء الخير" : "مساء النور";
  // العدد الحقيقي للمخرجات الحيّة المنتظرة — لا طول القائمة المقطوعة عند 6،
  // فقد كانت الإحاطة تقول «6 بانتظار موافقتك» مهما كان العدد الفعلي.
  const { count: reviewCount } = await admin
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "review")
    .gte("updated_at", staleBefore());
  const pendingCount = reviewCount ?? review?.length ?? 0;
  const parts: string[] = [];
  if (pendingCount) parts.push(`${pendingCount} بانتظار موافقتك`);
  if (posts?.length) parts.push(`${posts.length} منشور اليوم`);
  if (rankMoves.length) parts.push(`${rankMoves.filter((m) => m.delta > 0).length} كلمة تقدّمت`);
  const headline = parts.length ? parts.join(" · ") : "يوم هادئ — استغلّه بفكرة جديدة من سِراج.";

  return {
    day,
    greeting,
    headline,
    approvals: (review ?? []).map((t) => ({ id: t.id, title: t.title, employee: t.employee_id })),
    todayPosts: (posts ?? []).slice(0, 8).map((p) => {
      const meta = (p.meta ?? {}) as { title?: string };
      return {
        id: p.id,
        provider: p.provider,
        at: p.scheduled_at,
        status: p.status,
        title: meta.title || p.body.split("\n")[0]!.slice(0, 80),
        image: p.image_url,
      };
    }),
    rankMoves: rankMoves.slice(0, 5),
    attention,
    ideas,
    stats: {
      done7d: doneTasks?.length ?? 0,
      published7d: published7d ?? 0,
      scheduled: scheduled ?? 0,
    },
  };
}

/** يبني الإحاطة ويحفظها مرة واحدة لليوم (idempotent). */
export async function ensureTodayBriefing(
  admin: Admin,
  workspaceId: string,
  force = false,
): Promise<Briefing> {
  const { data: auto } = await admin
    .from("social_autopilot")
    .select("timezone")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  const day = todayIso(auto?.timezone ?? "Asia/Riyadh");
  if (!force) {
    const { data: existing } = await admin
      .from("briefings")
      .select("content")
      .eq("workspace_id", workspaceId)
      .eq("employee_id", "eva")
      .eq("day", day)
      .maybeSingle();
    if (existing?.content && Object.keys(existing.content as object).length)
      return existing.content as unknown as Briefing;
  }
  const briefing = await buildBriefing(admin, workspaceId);
  await admin
    .from("briefings")
    .upsert(
      { workspace_id: workspaceId, employee_id: "eva", day, content: briefing as never },
      { onConflict: "workspace_id,day" },
    );
  return briefing;
}

/** تشغيل الكرون: يبني إحاطة اليوم لكل مساحة لم تُبنَ بعد (محدود العدد). */
export async function runMorningBriefings(admin: Admin, limit = 25) {
  const { data: spaces } = await admin
    .from("workspaces")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(200);
  const report: { workspaceId: string; ok: boolean; error?: string }[] = [];
  let built = 0;
  for (const ws of spaces ?? []) {
    if (built >= limit) break;
    const { data: auto } = await admin
      .from("social_autopilot")
      .select("timezone")
      .eq("workspace_id", ws.id)
      .maybeSingle();
    const tz = auto?.timezone ?? "Asia/Riyadh";
    if (localHour(tz) < 6) continue; // لا نبني قبل السادسة بتوقيت المستخدم
    const day = todayIso(tz);
    const { data: existing } = await admin
      .from("briefings")
      .select("id")
      .eq("workspace_id", ws.id)
      .eq("employee_id", "eva")
      .eq("day", day)
      .maybeSingle();
    if (existing) continue;
    try {
      await ensureTodayBriefing(admin, ws.id);
      built++;
      report.push({ workspaceId: ws.id, ok: true });
    } catch (e) {
      report.push({
        workspaceId: ws.id,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    // تعلّم سِراج من أداء المنشورات الحقيقية — مرة كل أسبوع (الأحد) بلا تدخل من المستخدم.
    try {
      const { data: learned } = await admin
        .from("brain_items")
        .select("id")
        .eq("workspace_id", ws.id)
        .eq("kind", "learning")
        .maybeSingle();
      const isSunday = new Date().getUTCDay() === 0;
      if (!learned || isSunday) {
        const { learnFromPerformance } = await import("./content-calendar.server");
        await learnFromPerformance(admin, ws.id);
      }
    } catch (e) {
      console.error("[siraj] weekly learning failed:", e instanceof Error ? e.message : e);
    }
  }
  return report;
}
