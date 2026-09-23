import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * تتبّع ترتيب الكلمات المفتاحية عبر الزمن — لوحة تاريخية حقيقية:
 * نلتقط ترتيب نطاقك في نتائج البحث الحية لكل كلمة متتبَّعة ونخزّن لقطة بتاريخها،
 * فترى الاتجاه (تحسّن/تراجع) بأرقام فعلية لا تقديرات.
 */

const ws = { workspaceId: z.string().uuid() };

const cleanDomain = (value: string) =>
  value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();

export const listTrackedKeywords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object(ws).parse(input))
  .handler(async ({ data, context }) => {
    const [{ data: keywords, error }, { data: snapshots }] = await Promise.all([
      context.supabase
        .from("tracked_keywords")
        .select("*")
        .eq("workspace_id", data.workspaceId)
        .order("created_at", { ascending: true }),
      context.supabase
        .from("rank_snapshots")
        .select("keyword_id, position, url, captured_at, source, clicks, impressions, competitors")
        .eq("workspace_id", data.workspaceId)
        .order("captured_at", { ascending: true })
        .limit(1000),
    ]);
    if (error) throw new Error(error.message);

    const history: Record<
      string,
      {
        position: number | null;
        url: string | null;
        capturedAt: string;
        source: string | null;
        clicks: number | null;
        impressions: number | null;
        competitors: { host: string; url: string; position: number }[];
      }[]
    > = {};
    type Snap = {
      keyword_id: string;
      position: number | null;
      url: string | null;
      captured_at: string;
      source?: string | null;
      clicks?: number | null;
      impressions?: number | null;
      competitors?: unknown;
    };
    // أعمدة source/clicks/impressions/competitors أضيفت بترحيل لاحق ولم تُحدَّث الأنواع المولّدة بعد.
    for (const snap of (snapshots ?? []) as unknown as Snap[]) {
      (history[snap.keyword_id] ??= []).push({
        position: snap.position,
        url: snap.url,
        capturedAt: snap.captured_at,
        source: snap.source ?? null,
        clicks: snap.clicks ?? null,
        impressions: snap.impressions ?? null,
        competitors: Array.isArray(snap.competitors) ? (snap.competitors as never) : [],
      });
    }
    return { keywords: keywords ?? [], history };
  });

export const addTrackedKeyword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ...ws,
        keyword: z.string().min(2).max(120),
        domain: z.string().min(3).max(160),
        market: z.string().min(2).max(8).default("SA"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("tracked_keywords").insert({
      workspace_id: data.workspaceId,
      keyword: data.keyword.trim(),
      domain: cleanDomain(data.domain),
      market: data.market,
    });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true as const };
  });

export const removeTrackedKeyword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ...ws, id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tracked_keywords")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * يفحص كل الكلمات المفعّلة الآن ويخزّن لقطة ترتيب جديدة لكل واحدة.
 * المصدر بترتيب الموثوقية: Search Console (بيانات جوجل الفعلية) ← صفحة جوجل الحقيقية للسوق ← محركات بديلة.
 * كل لقطة تحمل مصدرها حتى لا يُعرض تقدير على أنه رقم جوجل.
 */
export const refreshRankings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object(ws).parse(input))
  .handler(async ({ data, context }) => {
    const [{ data: keywords, error }, { data: gsc }] = await Promise.all([
      context.supabase
        .from("tracked_keywords")
        .select("id, keyword, domain, market")
        .eq("workspace_id", data.workspaceId)
        .eq("active", true)
        .limit(50),
      context.supabase
        .from("pipedream_accounts")
        .select("id")
        .eq("workspace_id", data.workspaceId)
        .eq("provider", "search-console")
        .eq("status", "connected")
        .maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    if (!keywords?.length)
      return { checked: 0, sources: {} as Record<string, number>, gscConnected: Boolean(gsc) };

    const { checkRank } = await import("./rank-check.server");
    const now = new Date().toISOString();
    let checked = 0;
    const sources: Record<string, number> = {};

    for (const row of keywords) {
      try {
        const r = await checkRank({
          workspaceId: data.workspaceId,
          keyword: row.keyword,
          domain: row.domain,
          market: row.market ?? "EG",
          gscConnected: Boolean(gsc),
        });
        await context.supabase.from("rank_snapshots").insert({
          workspace_id: data.workspaceId,
          keyword_id: row.id,
          position: r.position,
          url: r.url,
          captured_at: now,
          source: r.source,
          clicks: r.clicks ?? null,
          impressions: r.impressions ?? null,
          competitors: r.competitors,
        } as never);
        await context.supabase
          .from("tracked_keywords")
          .update({ last_checked_at: now })
          .eq("id", row.id);
        sources[r.source] = (sources[r.source] ?? 0) + 1;
        checked += 1;
        // تباعد بسيط حتى لا يحجبنا جوجل عند فحص كلمات كثيرة
        await new Promise((res) => setTimeout(res, 700));
      } catch (e) {
        console.error("[nour] rank check failed:", e);
      }
    }
    return { checked, sources, gscConnected: Boolean(gsc) };
  });
