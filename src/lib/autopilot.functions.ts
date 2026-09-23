/**
 * دوال الخادم لإعدادات «الطيار الآلي»: القراءة، الحفظ، والتشغيل الفوري.
 * كل الدوال محمية بملكية مساحة العمل.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

const idInput = z.object({ workspaceId: z.string().uuid() });

/** إعدادات الطيار الحالية (أو القيم الافتراضية إن لم تُضبط بعد). */
export const getAutopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("social_autopilot")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { autopilot: row };
  });

const saveInput = z.object({
  workspaceId: z.string().uuid(),
  active: z.boolean(),
  providers: z.array(z.string().min(1).max(40)).max(12),
  brief: z.string().max(4000).default(""),
  dialect: z.string().min(2).max(20).default("خليجية"),
  // مواعيد حرّة بصيغة HH:MM بتوقيت المستخدم — حتى ٢٤ موعداً في اليوم.
  slots: z
    .array(z.string().regex(/^\d{1,2}:\d{2}$/))
    .min(1)
    .max(24),
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([0, 1, 2, 3, 4, 5, 6]),
  timezone: z.string().min(3).max(60).default("Asia/Riyadh"),
  mode: z.enum(["auto", "review"]),
  withImage: z.boolean(),
});

/** حفظ الإعدادات وحساب الموعد القادم مباشرةً. */
export const saveAutopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const { nextRun, normalizeTiming } = await import("./autopilot.server");

    const timing = normalizeTiming({
      slots: data.slots,
      days: data.days,
      timezone: data.timezone,
    });
    const slots = timing.minutes.map(
      (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
    );
    const { data: row, error } = await admin
      .from("social_autopilot")
      .upsert(
        {
          workspace_id: data.workspaceId,
          employee_id: "sonny",
          active: data.active,
          providers: data.providers,
          brief: data.brief,
          dialect: data.dialect,
          posts_per_day: Math.min(slots.length, 32767),
          hours: timing.minutes.map((m) => Math.floor(m / 60)),
          slots,
          days: timing.days,
          timezone: timing.timezone,
          mode: data.mode,
          with_image: data.withImage,
          next_run_at: nextRun({
            slots,
            days: timing.days,
            timezone: timing.timezone,
          }).toISOString(),
          paused_reason: null,
          locked_at: null,
        },
        { onConflict: "workspace_id" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, autopilot: row };
  });

/** تشغيل الطيار الآن لمساحة العمل هذه — للاختبار أو لبدء أول منشور فوراً. */
export const runAutopilotNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const { data: row, error } = await admin
      .from("social_autopilot")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("اضبط إعدادات الطيار واحفظها أولاً.");

    const { runAutopilotRow } = await import("./autopilot.server");
    const report = await runAutopilotRow(admin, row);
    return { ok: true as const, report };
  });
