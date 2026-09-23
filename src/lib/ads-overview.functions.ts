import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AdsOverview } from "./ads-overview.server";

/**
 * نتائج الإعلانات لآخر ٣٠ يوماً — تُعيد null بهدوء إن لم يوجد حساب إعلاني مرتبط
 * أو لم تتوفر بيانات، حتى لا تظهر بطاقة فارغة في مساحة العمل.
 */
export const adsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<AdsOverview | null> => {
    const { data: owns } = await context.supabase.rpc("owns_workspace", {
      _workspace_id: data.workspaceId,
    });
    if (owns !== true) return null;

    const { data: rows } = await context.supabase
      .from("pipedream_accounts")
      .select("account_id, app_slug")
      .eq("workspace_id", data.workspaceId)
      .eq("status", "connected")
      .in("app_slug", ["facebook", "facebook_pages", "instagram"]);

    const account = rows?.[0];
    if (!account) return null;

    try {
      const { pipedreamConfig } = await import("./pipedream.server");
      const config = await pipedreamConfig();
      if (!config) return null;
      const { metaAdsOverview } = await import("./ads-overview.server");
      return await metaAdsOverview(config, data.workspaceId, account.account_id);
    } catch {
      return null;
    }
  });
