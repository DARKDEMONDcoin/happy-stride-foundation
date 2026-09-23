/**
 * دالة الخادم لأفضل وقت نشر حقيقي — محمية بملكية مساحة العمل.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  workspaceId: z.string().uuid(),
  provider: z.string().min(1).max(40),
  /** إزاحة توقيت المستخدم بالدقائق (‎-new Date().getTimezoneOffset()‎). */
  tzOffsetMinutes: z.number().int().min(-840).max(840).default(0),
  /** نص المنشور الحالي — يرجّح المواعيد التي نجح فيها محتوى مشابه. */
  postText: z.string().max(6000).optional(),
});

export const bestPostingTimes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: owns, error } = await context.supabase.rpc("owns_workspace", {
      _workspace_id: data.workspaceId,
    });
    if (error) throw new Error(error.message);
    if (owns !== true) throw new Error("Forbidden: لا تملك هذه مساحة العمل.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { computeBestTimes } = await import("./best-time.server");
    return computeBestTimes(
      supabaseAdmin,
      data.workspaceId,
      data.provider,
      data.tzOffsetMinutes,
      data.postText,
    );
  });
