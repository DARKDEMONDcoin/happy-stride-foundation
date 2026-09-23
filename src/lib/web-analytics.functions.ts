import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * تحليلات زوار الموقع — مدمجة داخل المنصة نفسها.
 * المستخدم يضع رابط موقعه فقط، ونحن نجمع الزيارات ونعرض الأرقام الحقيقية:
 * عدد الزوار، المشاهدات، جنسيات الزوار، أهم الصفحات، ومصادر الزيارات.
 */
export type VisitorsSnapshot = {
  days: number;
  totals: { visitors: number; pageviews: number };
  countries: { code: string; label: string; visitors: number }[];
  pages: { path: string; views: number }[];
  sources: { source: string; visitors: number }[];
  daily: { day: string; visitors: number }[];
};

const COUNTRY_AR = new Intl.DisplayNames(["ar"], { type: "region" });
function countryLabel(code: string) {
  const c = (code || "").toUpperCase();
  if (c.length !== 2) return "غير معروف";
  try {
    return COUNTRY_AR.of(c) ?? c;
  } catch {
    return c;
  }
}

function hostOf(raw: string): string {
  const value = raw.trim();
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).host
      .replace(/^www\./i, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

async function assertOwner(
  supabase: {
    rpc: (
      fn: "owns_workspace",
      args: { _workspace_id: string },
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  },
  workspaceId: string,
) {
  const { data, error } = await supabase.rpc("owns_workspace", { _workspace_id: workspaceId });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Forbidden: لا تملك هذه مساحة العمل.");
}

/** يحفظ رابط الموقع ويفعّل تتبّع الزوار له. */
export const saveWebAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ workspaceId: z.string().uuid(), url: z.string().trim().min(3).max(300) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase as never, data.workspaceId);
    const host = hostOf(data.url);
    if (!host || !host.includes(".")) throw new Error("رابط الموقع غير صحيح — مثال: example.com");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("integration_credentials")
      .select("id")
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "web-analytics")
      .maybeSingle();

    const config = { host, enabled: true };
    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from("integration_credentials")
        .update({ config })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("integration_credentials")
        .insert({ workspace_id: data.workspaceId, provider: "web-analytics", config });
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin
      .from("workspaces")
      .update({ website: `https://${host}` })
      .eq("id", data.workspaceId);
    return { host };
  });

/** يوقف تتبّع الزوار ويزيل رابط الموقع المحفوظ للتتبّع. */
export const disconnectWebAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase as never, data.workspaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("integration_credentials")
      .delete()
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "web-analytics");
    return { ok: true };
  });

/** لقطة زوار حقيقية من بيانات التتبّع الخاصة بنا. */
export const visitorsSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        days: z.number().int().min(1).max(365).default(30),
      })
      .parse(data),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      connected: boolean;
      host: string | null;
      snapshot: VisitorsSnapshot | null;
      error: string | null;
    }> => {
      await assertOwner(context.supabase as never, data.workspaceId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: cred } = await supabaseAdmin
        .from("integration_credentials")
        .select("config")
        .eq("workspace_id", data.workspaceId)
        .eq("provider", "web-analytics")
        .maybeSingle();

      const host = ((cred?.config as { host?: string } | undefined)?.host ?? null) || null;
      if (!host) return { connected: false, host: null, snapshot: null, error: null };

      const since = new Date(Date.now() - data.days * 86400_000).toISOString();
      const { data: rows, error } = await supabaseAdmin
        .from("site_visits")
        .select("path, country, source, visitor_hash, created_at")
        .eq("workspace_id", data.workspaceId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50000);

      if (error) return { connected: true, host, snapshot: null, error: error.message };

      const list = rows ?? [];
      const visitors = new Set<string>();
      const byCountry = new Map<string, Set<string>>();
      const byPage = new Map<string, number>();
      const bySource = new Map<string, Set<string>>();
      const byDay = new Map<string, Set<string>>();

      for (const r of list) {
        const v = r.visitor_hash ?? "anon";
        visitors.add(v);

        const country = (r.country ?? "").toUpperCase() || "??";
        if (!byCountry.has(country)) byCountry.set(country, new Set());
        byCountry.get(country)!.add(v);

        const path = r.path || "/";
        byPage.set(path, (byPage.get(path) ?? 0) + 1);

        const source = r.source || "مباشر";
        if (!bySource.has(source)) bySource.set(source, new Set());
        bySource.get(source)!.add(v);

        const day = String(r.created_at).slice(0, 10);
        if (!byDay.has(day)) byDay.set(day, new Set());
        byDay.get(day)!.add(v);
      }

      const snapshot: VisitorsSnapshot = {
        days: data.days,
        totals: { visitors: visitors.size, pageviews: list.length },
        countries: [...byCountry.entries()]
          .map(([code, set]) => ({ code, label: countryLabel(code), visitors: set.size }))
          .sort((a, b) => b.visitors - a.visitors)
          .slice(0, 10),
        pages: [...byPage.entries()]
          .map(([path, views]) => ({ path, views }))
          .sort((a, b) => b.views - a.views)
          .slice(0, 10),
        sources: [...bySource.entries()]
          .map(([source, set]) => ({ source, visitors: set.size }))
          .sort((a, b) => b.visitors - a.visitors)
          .slice(0, 10),
        daily: [...byDay.entries()]
          .map(([day, set]) => ({ day, visitors: set.size }))
          .sort((a, b) => (a.day < b.day ? -1 : 1))
          .slice(-30),
      };

      return { connected: true, host, snapshot, error: null };
    },
  );
