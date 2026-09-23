import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Google Analytics 4 (مجاني بالكامل) — يستخدم نفس ربط Google الخاص بـ Search Console.
 * يُكمل حلقة القياس: من الظهور والنقرات في البحث إلى الجلسات والتحويل على الموقع.
 */
export type Ga4Snapshot = {
  property: string;
  range: { start: string; end: string };
  totals: { sessions: number; users: number; engagedSessions: number };
  organicLandingPages: { page: string; sessions: number }[];
  channels: { channel: string; sessions: number }[];
};

type Ga4Config = { propertyId?: string };

async function loadGa4Config(workspaceId: string): Promise<Ga4Config> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("integration_credentials")
    .select("config")
    .eq("workspace_id", workspaceId)
    .eq("provider", "analytics")
    .maybeSingle();
  return (data?.config as Ga4Config | undefined) ?? {};
}

async function runReport(
  workspaceId: string,
  propertyId: string,
  body: Record<string, unknown>,
): Promise<{
  rows: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[];
}> {
  const { googleDataRequest } = await import("./google-data.server");
  return googleDataRequest(
    workspaceId,
    "analytics",
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`,
    { method: "POST", body },
  );
}

/** يختار خاصية GA4 تلقائياً حين تكون واحدة فقط، ويحفظها للمرات القادمة. */
async function autoSelectProperty(
  workspaceId: string,
): Promise<{ propertyId?: string; empty: boolean }> {
  try {
    const { googleDataRequest } = await import("./google-data.server");
    const parsed = await googleDataRequest<{
      accountSummaries?: { propertySummaries?: { property?: string }[] }[];
    }>(
      workspaceId,
      "analytics",
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=50",
    );
    const ids = (parsed.accountSummaries ?? [])
      .flatMap((a) =>
        (a.propertySummaries ?? []).map((p) => (p.property ?? "").replace("properties/", "")),
      )
      .filter(Boolean);
    if (ids.length !== 1) return { empty: ids.length === 0 };
    const propertyId = ids[0]!;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("integration_credentials").upsert(
      {
        workspace_id: workspaceId,
        provider: "analytics",
        config: { propertyId } as unknown as Record<string, string>,
      },
      { onConflict: "workspace_id,provider" },
    );
    await supabaseAdmin
      .from("integrations")
      .update({ status: "connected", account: `GA4 · ${propertyId}` })
      .eq("workspace_id", workspaceId)
      .eq("provider", "analytics");
    return { propertyId, empty: false };
  } catch {
    return { empty: false };
  }
}

/** لقطة GA4 داخلية لنور — ترجع null إن لم يكن الربط جاهزاً. */
export async function ga4SnapshotFor(workspaceId: string, days = 28): Promise<Ga4Snapshot | null> {
  return (await ga4SnapshotDetailed(workspaceId, days)).snapshot;
}

/** لقطة GA4 مع حالة صريحة بدل null الصامت. */
export async function ga4SnapshotDetailed(
  workspaceId: string,
  days = 28,
): Promise<{ status: import("./gsc.functions").SourceStatus; snapshot: Ga4Snapshot | null }> {
  try {
    const { hasGoogleAccount } = await import("./gsc.functions");
    if (!(await hasGoogleAccount(workspaceId, "analytics"))) {
      return {
        status: {
          state: "not_connected",
          message: "Google Analytics 4 غير مربوط — اربط حساب Google من صفحة التكاملات.",
        },
        snapshot: null,
      };
    }
    let { propertyId } = await loadGa4Config(workspaceId);
    let noProperties = false;
    if (!propertyId) {
      // اختيار تلقائي حين لا يملك الحساب سوى خاصية واحدة — لا نطلب من المستخدم خطوة إضافية بلا داعٍ.
      const auto = await autoSelectProperty(workspaceId);
      propertyId = auto.propertyId;
      noProperties = auto.empty;
    }
    if (!propertyId) {
      return {
        status: {
          state: "not_selected",
          message: noProperties
            ? "حساب Google مربوط لكن لا توجد به أي خاصية Google Analytics 4 — أنشئ خاصية GA4 لموقعك ثم أعد المحاولة."
            : "الحساب مربوط لكن لم تختر خاصية GA4 بعد — اختر الخاصية من صفحة التكاملات.",
        },
        snapshot: null,
      };
    }

    const start = `${days}daysAgo`;
    const end = "yesterday";
    const dateRanges = [{ startDate: start, endDate: end }];

    const [totals, landing, channels] = await Promise.all([
      runReport(workspaceId, propertyId, {
        dateRanges,
        metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "engagedSessions" }],
      }),
      runReport(workspaceId, propertyId, {
        dateRanges,
        dimensions: [{ name: "landingPagePlusQueryString" }],
        metrics: [{ name: "sessions" }],
        dimensionFilter: {
          filter: {
            fieldName: "sessionDefaultChannelGroup",
            stringFilter: { value: "Organic Search" },
          },
        },
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 15,
      }),
      runReport(workspaceId, propertyId, {
        dateRanges,
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 8,
      }),
    ]);

    const num = (v?: string) => Number(v ?? 0) || 0;
    const t = totals.rows?.[0]?.metricValues ?? [];

    const snapshot: Ga4Snapshot = {
      property: propertyId,
      range: { start, end },
      totals: {
        sessions: num(t[0]?.value),
        users: num(t[1]?.value),
        engagedSessions: num(t[2]?.value),
      },
      organicLandingPages: (landing.rows ?? []).map((r) => ({
        page: r.dimensionValues?.[0]?.value ?? "",
        sessions: num(r.metricValues?.[0]?.value),
      })),
      channels: (channels.rows ?? []).map((r) => ({
        channel: r.dimensionValues?.[0]?.value ?? "",
        sessions: num(r.metricValues?.[0]?.value),
      })),
    };
    return { status: { state: "ok", message: `GA4 · ${propertyId}` }, snapshot };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const message = /401|403|invalid_grant|unauth|PERMISSION_DENIED/i.test(raw)
      ? "انتهت صلاحية ربط Google أو لا تملك صلاحية على هذه الخاصية — أعد ربط Analytics من صفحة التكاملات."
      : `تعذّر جلب بيانات GA4: ${raw.slice(0, 160)}`;
    console.error("[ga4] snapshot failed", raw);
    return { status: { state: "error", message }, snapshot: null };
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
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** قائمة خصائص GA4 المتاحة في حساب Google المربوط. */
export const listGa4Properties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, data.workspaceId);
    const { googleDataRequest } = await import("./google-data.server");
    const parsed = await googleDataRequest<{
      accountSummaries?: {
        displayName?: string;
        propertySummaries?: { property?: string; displayName?: string }[];
      }[];
    }>(
      data.workspaceId,
      "analytics",
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=50",
    );
    const properties = (parsed.accountSummaries ?? []).flatMap((a) =>
      (a.propertySummaries ?? []).map((p) => ({
        id: (p.property ?? "").replace("properties/", ""),
        name: `${a.displayName ?? ""} · ${p.displayName ?? ""}`.trim(),
      })),
    );
    return { properties: properties.filter((p) => p.id) };
  });

/** اختيار خاصية GA4 التي ستقرأ منها نور. */
export const selectGa4Property = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ workspaceId: z.string().uuid(), propertyId: z.string().min(1).max(40) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const { error } = await admin.from("integration_credentials").upsert(
      {
        workspace_id: data.workspaceId,
        provider: "analytics",
        config: { propertyId: data.propertyId } as unknown as Record<string, string>,
      },
      { onConflict: "workspace_id,provider" },
    );
    if (error) throw new Error(error.message);
    await admin
      .from("integrations")
      .update({ status: "connected", account: `GA4 · ${data.propertyId}` })
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "analytics");
    return { ok: true as const };
  });

/** لقطة GA4 للعرض في الواجهة. */
export const ga4Snapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, data.workspaceId);
    const snap = await ga4SnapshotFor(data.workspaceId);
    if (!snap) throw new Error("اختر خاصية GA4 أولاً بعد ربط Google.");
    return snap;
  });
