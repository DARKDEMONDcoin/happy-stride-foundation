/**
 * دوال الخادم لتنفيذ إجراءات الموظفين الحقيقية بعد اعتماد المالك.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { actionsFor } from "./employee-actions.server";

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

/** قائمة الإجراءات المتاحة لموظف معيّن. */
export const listEmployeeActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ employeeId: z.string().min(2).max(20) }).parse(input),
  )
  .handler(({ data }) =>
    actionsFor(data.employeeId).map((a) => ({
      id: a.id,
      provider: a.provider,
      label: a.label,
      inputs: a.inputs,
    })),
  );

/** تنفيذ إجراء فعلي (إرسال بريد، حجز موعد، تحديث CRM…). */
export const runEmployeeAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        actionId: z.string().min(3).max(60),
        values: z.record(z.string(), z.string()).default({}),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const { runEmployeeActionServer } = await import("./employee-actions.server");
    const res = await runEmployeeActionServer(admin, {
      workspaceId: data.workspaceId,
      actionId: data.actionId,
      values: data.values,
    });
    return { actionId: res.actionId, provider: res.provider, ok: true as const };
  });
