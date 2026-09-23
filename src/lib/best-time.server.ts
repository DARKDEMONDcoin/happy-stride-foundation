/**
 * أفضل وقت نشر حقيقي لكل مساحة عمل — لا جدول ثابت.
 * الترتيب: جمهورك الحيّ (إنستجرام online_followers) ← سجلّ منشوراتك وتفاعلها الفعلي ← متوسطات عامة كخيار أخير.
 * كل الحسابات تتم بتوقيت المستخدم المحلي (يُمرَّر كإزاحة دقائق من المتصفح).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { GRAPH, metaTarget } from "./meta.server";
import { bestTimeFor } from "./post-format";

type Admin = SupabaseClient<Database>;

export type BestTimeSlot = {
  /** ISO للحظة المقترحة القادمة. */
  at: string;
  hour: number;
  weekday: number;
  score: number;
};

export type BestTimeResult = {
  source: "audience" | "history" | "baseline";
  samples: number;
  note: string;
  slots: BestTimeSlot[];
};

/** يحوّل لحظة UTC إلى مكوّنات التوقيت المحلي للمستخدم. */
function local(date: Date, offsetMin: number) {
  const shifted = new Date(date.getTime() + offsetMin * 60_000);
  return { hour: shifted.getUTCHours(), weekday: shifted.getUTCDay() };
}

/** أقرب لحظة قادمة عند ساعة محلية معيّنة (ويوم أسبوع اختياري). */
function nextAt(hour: number, weekday: number | null, offsetMin: number, from = new Date()): Date {
  for (let step = 0; step < 14 * 24; step += 1) {
    const candidate = new Date(from.getTime() + 20 * 60_000);
    candidate.setTime(candidate.getTime() + step * 3_600_000);
    const l = local(candidate, offsetMin);
    if (l.hour !== hour) continue;
    if (weekday !== null && l.weekday !== weekday) continue;
    // نضبط الدقائق على رأس الساعة المحلية.
    const rounded = new Date(candidate.getTime() + offsetMin * 60_000);
    rounded.setUTCMinutes(0, 0, 0);
    return new Date(rounded.getTime() - offsetMin * 60_000);
  }
  return new Date(from.getTime() + 3_600_000);
}

/** يجمع نقاط التفاعل من رد Graph بصيغتيه (insights أو حقول مباشرة). */
function scoreOf(payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0;
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return 0;
  let total = 0;
  for (const entry of data) {
    const values = (entry as { values?: { value?: unknown }[] }).values ?? [];
    for (const v of values) if (typeof v.value === "number") total += v.value;
    const tv = (entry as { total_value?: { value?: unknown } }).total_value?.value;
    if (typeof tv === "number") total += tv;
  }
  return total;
}

async function graph(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

/** كلمات المنشور المميّزة — تُستخدم لمطابقة المحتوى الشبيه في سجلّ المستخدم. */
function keywords(text: string): Set<string> {
  const cleaned = text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s#]/gu, " ")
    .toLowerCase();
  const stop = new Set([
    "من",
    "في",
    "على",
    "الى",
    "إلى",
    "عن",
    "مع",
    "هذا",
    "هذه",
    "التي",
    "الذي",
    "كل",
    "أو",
    "او",
    "ما",
    "لا",
    "the",
    "and",
    "for",
    "with",
    "you",
    "your",
  ]);
  return new Set(
    cleaned
      .split(/\s+/)
      .map((w) => w.replace(/^#/, ""))
      .filter((w) => w.length >= 3 && !stop.has(w))
      .slice(0, 120),
  );
}

/** تشابه جاكارد بين منشور المستخدم الحالي ومنشور سابق (0..1). */
function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/** إشارة الجمهور الحيّة لفيسبوك: عدد المعجبين المتصلين في كل ساعة. */
async function facebookAudienceHours(
  admin: Admin,
  workspaceId: string,
  offsetMin: number,
): Promise<{ hour: number; score: number }[] | null> {
  const target = await metaTarget(admin, workspaceId, "facebook");
  if (!target?.pageId || !target.pageToken) return null;
  const payload = await graph(
    `${GRAPH}/${target.pageId}/insights?metric=page_fans_online_per_day&period=day&access_token=${encodeURIComponent(target.pageToken)}`,
  );
  const data = (payload as { data?: { values?: { value?: unknown }[] }[] } | null)?.data;
  if (!Array.isArray(data) || !data.length) return null;

  const totals = new Map<number, number>();
  for (const entry of data) {
    for (const point of entry.values ?? []) {
      const value = point.value;
      if (!value || typeof value !== "object") continue;
      for (const [rawHour, count] of Object.entries(value as Record<string, unknown>)) {
        const utcHour = Number(rawHour);
        if (!Number.isFinite(utcHour) || typeof count !== "number") continue;
        const localHour = (((utcHour + Math.round(offsetMin / 60)) % 24) + 24) % 24;
        totals.set(localHour, (totals.get(localHour) ?? 0) + count);
      }
    }
  }
  if (!totals.size) return null;
  return [...totals].map(([hour, score]) => ({ hour, score }));
}

/** إشارة الجمهور الحيّة لإنستجرام: عدد المتابعين المتصلين في كل ساعة. */
async function instagramAudienceHours(
  admin: Admin,
  workspaceId: string,
  offsetMin: number,
): Promise<{ hour: number; score: number }[] | null> {
  const target = await metaTarget(admin, workspaceId, "instagram");
  if (!target?.igUserId || !target.pageToken) return null;
  const payload = await graph(
    `${GRAPH}/${target.igUserId}/insights?metric=online_followers&period=lifetime&access_token=${encodeURIComponent(target.pageToken)}`,
  );
  const data = (payload as { data?: { values?: { value?: unknown }[] }[] } | null)?.data;
  if (!Array.isArray(data) || !data.length) return null;

  // القيم مفهرسة بالساعة بتوقيت UTC — نحوّلها لساعات المستخدم المحلية.
  const totals = new Map<number, number>();
  for (const entry of data) {
    for (const point of entry.values ?? []) {
      const value = point.value;
      if (!value || typeof value !== "object") continue;
      for (const [rawHour, count] of Object.entries(value as Record<string, unknown>)) {
        const utcHour = Number(rawHour);
        if (!Number.isFinite(utcHour) || typeof count !== "number") continue;
        const localHour = (((utcHour + Math.round(offsetMin / 60)) % 24) + 24) % 24;
        totals.set(localHour, (totals.get(localHour) ?? 0) + count);
      }
    }
  }
  if (!totals.size) return null;
  return [...totals].map(([hour, score]) => ({ hour, score }));
}

/** تفاعل منشور واحد على ميتا (مع تخزينه في social_posts.metrics حتى لا نكرّر الطلب). */
async function engagementOf(
  admin: Admin,
  post: { id: string; provider: string; remote_ref: string | null; metrics: unknown },
  token: string,
): Promise<number> {
  const cached =
    post.metrics && typeof post.metrics === "object"
      ? (post.metrics as { engagement?: unknown }).engagement
      : null;
  if (typeof cached === "number") return cached;
  if (!post.remote_ref) return 0;

  const url =
    post.provider === "instagram"
      ? `${GRAPH}/${post.remote_ref}/insights?metric=reach,likes,comments,saved&access_token=${encodeURIComponent(token)}`
      : `${GRAPH}/${post.remote_ref}/insights?metric=post_impressions_unique,post_engaged_users&access_token=${encodeURIComponent(token)}`;
  const score = scoreOf(await graph(url));
  await admin
    .from("social_posts")
    .update({ metrics: { engagement: score, measuredAt: new Date().toISOString() } })
    .eq("id", post.id);
  return score;
}

/** يحسب أفضل ثلاثة مواعيد حقيقية للمنصة المطلوبة (ويراعي نص المنشور نفسه حين يتوفّر). */
export async function computeBestTimes(
  admin: Admin,
  workspaceId: string,
  provider: string,
  offsetMin: number,
  postText?: string,
): Promise<BestTimeResult> {
  const now = new Date();
  const wanted = postText ? keywords(postText) : null;

  // ١) جمهورك الحيّ على المنصة — أقوى إشارة حين تتوفّر.
  if (provider === "instagram" || provider === "facebook") {
    const audience =
      provider === "instagram"
        ? await instagramAudienceHours(admin, workspaceId, offsetMin)
        : await facebookAudienceHours(admin, workspaceId, offsetMin);
    if (audience?.length) {
      const top = audience.sort((a, b) => b.score - a.score).slice(0, 3);
      return {
        source: "audience",
        samples: audience.length,
        note:
          provider === "instagram"
            ? "محسوبة من ساعات تواجد متابعيك فعلياً على إنستجرام."
            : "محسوبة من ساعات تواجد معجبي صفحتك فعلياً على فيسبوك.",
        slots: top.map((h) => {
          const at = nextAt(h.hour, null, offsetMin, now);
          return {
            at: at.toISOString(),
            hour: h.hour,
            weekday: local(at, offsetMin).weekday,
            score: h.score,
          };
        }),
      };
    }
  }

  // ٢) سجلّ نشرك أنت وتفاعله الفعلي خلال ٩٠ يوماً.
  const since = new Date(now.getTime() - 90 * 86_400_000).toISOString();
  const { data: published } = await admin
    .from("social_posts")
    .select("id, provider, published_at, remote_ref, metrics, body")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .eq("status", "published")
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(40);

  const rows = (published ?? []).filter((p) => p.published_at);
  if (rows.length >= 3) {
    let token: string | null = null;
    if (provider === "facebook" || provider === "instagram") {
      const target = await metaTarget(admin, workspaceId, provider);
      token = target?.pageToken ?? null;
    }

    const buckets = new Map<string, { hour: number; weekday: number; score: number; n: number }>();
    let matched = 0;
    for (const post of rows) {
      const when = new Date(post.published_at as string);
      const { hour, weekday } = local(when, offsetMin);
      const engagement = token ? await engagementOf(admin, post, token) : 0;
      // وزن المحتوى: منشور سابق شبيه بنص المستخدم الحالي يُحسب أثقل — لأن جمهور
      // هذا النوع من المحتوى تحديداً هو من يهمّنا، لا كل الجمهور.
      const sim = wanted ? similarity(wanted, keywords(post.body ?? "")) : 0;
      if (sim >= 0.12) matched += 1;
      const weight = 1 + sim * 2;
      const key = `${weekday}-${hour}`;
      const cur = buckets.get(key) ?? { hour, weekday, score: 0, n: 0 };
      // ١ نقطة لمجرد النشر الناجح + التفاعل الحقيقي حين يتوفر، مضروبة في وزن التشابه.
      cur.score += (1 + engagement) * weight;
      cur.n += 1;
      buckets.set(key, cur);
    }

    const measured = [...buckets.values()].some((b) => b.score > b.n);
    const top = [...buckets.values()].sort((a, b) => b.score / b.n - a.score / a.n).slice(0, 3);
    if (top.length) {
      const base = measured
        ? `محسوبة من تفاعل ${rows.length} منشوراً حقيقياً من حسابك.`
        : `محسوبة من مواعيد ${rows.length} منشوراً ناجحاً من حسابك (التفاعل لم يُتَح بعد).`;
      return {
        source: "history",
        samples: rows.length,
        note: matched
          ? `${base} ورجّحنا ${matched.toLocaleString("ar-EG")} منشوراً قريباً من موضوع منشورك الحالي.`
          : base,
        slots: top.map((b) => {
          const at = nextAt(b.hour, b.weekday, offsetMin, now);
          return {
            at: at.toISOString(),
            hour: b.hour,
            weekday: b.weekday,
            score: Math.round(b.score),
          };
        }),
      };
    }
  }

  // ٣) متوسطات عامة — مؤقتاً حتى يتكوّن سجلّك (تُطبَّق بساعات المستخدم المحلية).
  const hours = new Set<number>();
  let cursor = now;
  while (hours.size < 3) {
    const at = bestTimeFor(provider, cursor);
    hours.add(at.getHours());
    cursor = new Date(at.getTime() + 60_000);
  }
  const slots: BestTimeSlot[] = [...hours].map((hour) => {
    const at = nextAt(hour, null, offsetMin, now);
    return { at: at.toISOString(), hour, weekday: local(at, offsetMin).weekday, score: 0 };
  });
  return {
    source: "baseline",
    samples: rows.length,
    note: "متوسطات عامة مؤقتة — بعد أول منشورات لك نحسبها من بيانات جمهورك أنت.",
    slots,
  };
}
