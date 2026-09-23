import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Briefing } from "./briefing.server";

export type { Briefing };

const ws = { workspaceId: z.string().uuid() };

/** إحاطة أمَل الصباحية لليوم (تُبنى مرة واحدة يومياً، ويمكن تحديثها يدوياً). */
export const getMorningBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ...ws, refresh: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<Briefing> => {
    const { data: own } = await context.supabase
      .from("workspaces")
      .select("id")
      .eq("id", data.workspaceId)
      .maybeSingle();
    if (!own) throw new Error("غير مصرّح.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ensureTodayBriefing } = await import("./briefing.server");
    return ensureTodayBriefing(supabaseAdmin, data.workspaceId, data.refresh === true);
  });
