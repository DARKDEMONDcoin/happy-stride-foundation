/**
 * دوال الخادم لسجل القرارات: عرض القرارات النشطة وأرشفتها.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listDecisions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        employeeId: z.string().min(2).max(20).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("decisions")
      .select(
        "id, employee_id, conversation_id, kind, title, decision, rationale, status, created_at",
      )
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.employeeId) query = query.eq("employee_id", data.employeeId);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const archiveDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workspaceId: z.string().uuid(), decisionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("decisions")
      .update({ status: "archived" })
      .eq("id", data.decisionId)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
