import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SearchConsoleConfig = {
  refreshToken?: string;
  siteUrl?: string;
  email?: string;
};

/** يبدأ ربط Search Console ويُعيد رابط موافقة Google. */
export const startSearchConsoleOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: owns, error } = await context.supabase.rpc("owns_workspace", {
      _workspace_id: data.workspaceId,
    });
    if (error) throw new Error(error.message);
    if (owns !== true) throw new Error("Forbidden: لا تملك هذه مساحة العمل.");

    const origin = new URL(getRequest().url).origin;
    const { pipedreamConfig, createConnectToken, missingConfigError } =
      await import("./pipedream.server");
    const config = await pipedreamConfig();
    if (!config) throw missingConfigError();
    const token = await createConnectToken(config, data.workspaceId, [origin]);
    const url = new URL(
      token.connect_link_url ??
        `https://pipedream.com/_static/connect.html?token=${encodeURIComponent(token.token)}`,
    );
    url.searchParams.set("app", "google_search_console");
    url.searchParams.set("success_redirect_uri", `${origin}/app/integrations?pd=connected`);
    url.searchParams.set("error_redirect_uri", `${origin}/app/integrations?pd=failed`);
    return { url: url.toString(), redirectUri: `${origin}/app/integrations` };
  });

export async function loadConfig(workspaceId: string): Promise<SearchConsoleConfig> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("integration_credentials")
    .select("config")
    .eq("workspace_id", workspaceId)
    .eq("provider", "search-console")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const config = data?.config as SearchConsoleConfig | undefined;
  if (!config) return {};
  return config;
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

/** قائمة المواقع المتحقَّقة في حساب Search Console المربوط. */
export const listSearchConsoleSites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, data.workspaceId);
    const saved = await loadConfig(data.workspaceId).catch(() => null);
    const { googleDataRequest } = await import("./google-data.server");
    const { siteEntry = [] } = await googleDataRequest<{
      siteEntry?: { siteUrl: string; permissionLevel?: string }[];
    }>(
      data.workspaceId,
      "search-console",
      "https://searchconsole.googleapis.com/webmasters/v3/sites",
    );
    return {
      sites: siteEntry
        .filter((s) => s.permissionLevel !== "siteUnverifiedUser")
        .map((s) => s.siteUrl),
      selected: saved?.siteUrl ?? null,
    };
  });

/** اختيار الموقع الذي ستقرأ نور بياناته. */
export const selectSearchConsoleSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workspaceId: z.string().uuid(), siteUrl: z.string().min(4).max(300) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, data.workspaceId);
    const config: SearchConsoleConfig = await loadConfig(data.workspaceId).catch(() => ({
      refreshToken: "",
    }));
    const { googleDataRequest } = await import("./google-data.server");
    const { siteEntry = [] } = await googleDataRequest<{
      siteEntry?: { siteUrl: string; permissionLevel?: string }[];
    }>(
      data.workspaceId,
      "search-console",
      "https://searchconsole.googleapis.com/webmasters/v3/sites",
    );
    const match = siteEntry.find(
      (s) => s.siteUrl === data.siteUrl && s.permissionLevel !== "siteUnverifiedUser",
    );
    if (!match) throw new Error("هذا الموقع غير متحقَّق في الحساب المربوط.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("integration_credentials").upsert(
      {
        workspace_id: data.workspaceId,
        provider: "search-console",
        config: { ...config, siteUrl: match.siteUrl } as unknown as Record<string, string>,
      },
      { onConflict: "workspace_id,provider" },
    );
    await supabaseAdmin
      .from("integrations")
      .update({
        status: "connected",
        account: `${match.siteUrl}${config.email ? ` · ${config.email}` : ""}`,
      })
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "search-console");
    return { ok: true as const, siteUrl: match.siteUrl };
  });

export type GscRow = {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscSnapshot = {
  site: string;
  range: { start: string; end: string };
  queries: GscRow[];
  pages: GscRow[];
};
export type SourceState = "ok" | "not_connected" | "not_selected" | "error";
export type SourceStatus = { state: SourceState; message: string };

/** هل حساب Google المربوط عبر Pipedream موجود لهذا المزوّد؟ */
export async function hasGoogleAccount(
  workspaceId: string,
  provider: "search-console" | "analytics",
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("pipedream_accounts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .eq("status", "connected")
    .maybeSingle();
  return Boolean(data);
}

/**
 * لقطة Search Console مع حالة صريحة: غير مربوط / لم يُختر موقع / خطأ فعلي / جاهز.
 * لا تبتلع الأخطاء — تعيدها كنص مفهوم للواجهة.
 */
export async function gscSnapshotDetailed(
  workspaceId: string,
  days = 28,
): Promise<{ status: SourceStatus; snapshot: GscSnapshot | null }> {
  try {
    if (!(await hasGoogleAccount(workspaceId, "search-console"))) {
      return {
        status: {
          state: "not_connected",
          message:
            "Search Console غير مربوط — اربط حساب Google بضغطة من قسم «الترتيب» أو «التقارير».",
        },
        snapshot: null,
      };
    }
    const config = await loadConfig(workspaceId);
    if (!config.siteUrl) {
      return {
        status: {
          state: "not_selected",
          message: "الحساب مربوط لكن لم تختر موقعاً بعد — اختر الموقع من قسم «الترتيب».",
        },
        snapshot: null,
      };
    }
    const { googleDataRequest } = await import("./google-data.server");
    const end = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
    const start = new Date(Date.now() - (days + 3) * 86_400_000).toISOString().slice(0, 10);

    const query = async (dimension: "query" | "page"): Promise<GscRow[]> => {
      const { rows = [] } = await googleDataRequest<{
        rows?: {
          keys: string[];
          clicks: number;
          impressions: number;
          ctr: number;
          position: number;
        }[];
      }>(
        workspaceId,
        "search-console",
        `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.siteUrl!)}/searchAnalytics/query`,
        {
          method: "POST",
          body: { startDate: start, endDate: end, dimensions: [dimension], rowLimit: 25 },
        },
      );
      return rows.map((r) => ({
        key: r.keys[0] ?? "",
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      }));
    };

    const [queries, pages] = await Promise.all([query("query"), query("page")]);
    return {
      status: { state: "ok", message: `Search Console · ${config.siteUrl}` },
      snapshot: { site: config.siteUrl, range: { start, end }, queries, pages },
    };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const message = /401|403|invalid_grant|unauth/i.test(raw)
      ? "انتهت صلاحية ربط Google — أعد ربط Search Console بضغطة من قسم «الترتيب»."
      : `تعذّر جلب بيانات Search Console: ${raw.slice(0, 160)}`;
    console.error("[gsc] snapshot failed", raw);
    return { status: { state: "error", message }, snapshot: null };
  }
}

/** لقطة Search Console للاستخدام الداخلي — ترجع null إن لم يكن الربط جاهزاً. */
export async function gscSnapshotFor(workspaceId: string, days = 28): Promise<GscSnapshot | null> {
  return (await gscSnapshotDetailed(workspaceId, days)).snapshot;
}

/** أعلى الاستعلامات والصفحات في آخر ٢٨ يوماً — بيانات حقيقية لنور. */
export const searchConsoleSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, data.workspaceId);
    const config = await loadConfig(data.workspaceId);
    if (!config.siteUrl) throw new Error("اختر موقعاً من قائمة Search Console أولاً.");
    const { googleDataRequest } = await import("./google-data.server");

    const end = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
    const start = new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10);

    const query = async (dimension: "query" | "page") => {
      const { rows = [] } = await googleDataRequest<{
        rows?: {
          keys: string[];
          clicks: number;
          impressions: number;
          ctr: number;
          position: number;
        }[];
      }>(
        data.workspaceId,
        "search-console",
        `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.siteUrl!)}/searchAnalytics/query`,
        {
          method: "POST",
          body: { startDate: start, endDate: end, dimensions: [dimension], rowLimit: 25 },
        },
      );
      return rows.map((r) => ({
        key: r.keys[0] ?? "",
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      }));
    };

    const [queries, pages] = await Promise.all([query("query"), query("page")]);
    return { site: config.siteUrl, range: { start, end }, queries, pages };
  });

export type GscOpportunities = {
  site: string;
  range: { start: string; end: string };
  /** استعلامات على حافة الصفحة الأولى (مركز 8-20) — أسرع مكسب ممكن. */
  strikingDistance: { key: string; position: number; impressions: number; clicks: number }[];
  /** ظهور عالٍ ونقر منخفض — العنوان/الوصف هو المشكلة لا الترتيب. */
  lowCtr: { key: string; position: number; impressions: number; ctr: number }[];
  /** أكثر من صفحة تتنافس على نفس الاستعلام (تآكل داخلي). */
  cannibalization: { key: string; pages: { url: string; clicks: number; position: number }[] }[];
};

/** تحليل فرص حقيقي من Search Console: حافة الصفحة الأولى، ضعف النقر، وتآكل الصفحات. */
export async function gscOpportunities(
  workspaceId: string,
  days = 28,
): Promise<{ status: SourceStatus; data: GscOpportunities | null }> {
  try {
    if (!(await hasGoogleAccount(workspaceId, "search-console")))
      return {
        status: {
          state: "not_connected",
          message: "Search Console غير مربوط — اربطه بضغطة من قسم «الترتيب» أو «التقارير».",
        },
        data: null,
      };
    const config = await loadConfig(workspaceId);
    if (!config.siteUrl)
      return {
        status: {
          state: "not_selected",
          message: "الحساب مربوط لكن لم تختر موقعاً بعد — اختره من قسم «الترتيب».",
        },
        data: null,
      };

    const { googleDataRequest } = await import("./google-data.server");
    const end = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
    const start = new Date(Date.now() - (days + 3) * 86_400_000).toISOString().slice(0, 10);
    const { rows = [] } = await googleDataRequest<{
      rows?: {
        keys: string[];
        clicks: number;
        impressions: number;
        ctr: number;
        position: number;
      }[];
    }>(
      workspaceId,
      "search-console",
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        body: { startDate: start, endDate: end, dimensions: ["query", "page"], rowLimit: 500 },
      },
    );

    const strikingDistance = rows
      .filter((r) => r.position >= 8 && r.position <= 20 && r.impressions >= 10)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 12)
      .map((r) => ({
        key: r.keys[0] ?? "",
        position: r.position,
        impressions: r.impressions,
        clicks: r.clicks,
      }));

    const lowCtr = rows
      .filter((r) => r.position <= 10 && r.impressions >= 50 && r.ctr < 0.02)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10)
      .map((r) => ({
        key: r.keys[0] ?? "",
        position: r.position,
        impressions: r.impressions,
        ctr: r.ctr,
      }));

    const byQuery = new Map<string, { url: string; clicks: number; position: number }[]>();
    for (const r of rows) {
      const q = r.keys[0] ?? "";
      const p = r.keys[1] ?? "";
      if (!q || !p) continue;
      byQuery.set(q, [
        ...(byQuery.get(q) ?? []),
        { url: p, clicks: r.clicks, position: r.position },
      ]);
    }
    const cannibalization = [...byQuery.entries()]
      .filter(([, pages]) => pages.length > 1 && pages.some((p) => p.position <= 30))
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 8)
      .map(([key, pages]) => ({
        key,
        pages: pages.sort((a, b) => a.position - b.position).slice(0, 4),
      }));

    return {
      status: { state: "ok", message: `Search Console · ${config.siteUrl}` },
      data: {
        site: config.siteUrl,
        range: { start, end },
        strikingDistance,
        lowCtr,
        cannibalization,
      },
    };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return {
      status: { state: "error", message: `تعذّر تحليل Search Console: ${raw.slice(0, 160)}` },
      data: null,
    };
  }
}
