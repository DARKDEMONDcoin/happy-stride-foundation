import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { localParts, zonedTimeToUtc } from "./timezone";

/**
 * جدولة مهام نور: تعمل تلقائياً (يومياً/أسبوعياً/شهرياً) بنفس نواة التنفيذ اليدوية،
 * فتحصل على مخرجات جاهزة بلا أي طلب منك — وهذا ما يجعل نور موظفة تعمل لا أداة تنتظر.
 */

export const cadences = ["daily", "weekly", "monthly"] as const;
export type Cadence = (typeof cadences)[number];

/**
 * يحسب موعد التشغيل القادم بالمنطقة الزمنية التي يعيش فيها صاحب العمل:
 * الساعة التي يختارها تعني ساعته هو، لا توقيت غرينتش.
 */
export function nextRun(
  cadence: Cadence,
  dayOfWeek: number,
  hour: number,
  from: Date = new Date(),
  timezone = "Africa/Cairo",
): Date {
  const tz = timezone.trim() || "Africa/Cairo";
  const startOfToday = localParts(tz, from);

  for (let add = 0; add <= 400; add += 1) {
    const candidate = zonedTimeToUtc(
      tz,
      startOfToday.y,
      startOfToday.m,
      startOfToday.d + add,
      hour,
      0,
    );
    if (candidate <= from) continue;
    const { dow, d } = localParts(tz, candidate);

    if (cadence === "daily") return candidate;
    if (cadence === "weekly") {
      if (dow === dayOfWeek) return candidate;
      continue;
    }
    // شهرياً: أول يوم مطابق ليوم الأسبوع المختار داخل الشهر
    if (dow === dayOfWeek && d <= 7) return candidate;
  }
  return new Date(from.getTime() + 86_400_000);
}


const base = {
  workspaceId: z.string().uuid(),
};

export const listAutomations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object(base).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("automations")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { automations: rows ?? [] };
  });

export const saveAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ...base,
        id: z.string().uuid().optional(),
        employeeId: z.string().min(1).default("nour"),
        skillId: z.string().min(1),
        label: z.string().min(2).max(160),
        values: z.record(z.string(), z.string()),
        cadence: z.enum(cadences),
        dayOfWeek: z.number().int().min(0).max(6),
        hour: z.number().int().min(0).max(23),
        timezone: z.string().min(2).max(64).default("Africa/Cairo"),
        autoPublish: z.boolean().default(false),
        active: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const row = {
      workspace_id: data.workspaceId,
      employee_id: data.employeeId,
      skill_id: data.skillId,
      label: data.label,
      values: data.values,
      cadence: data.cadence,
      day_of_week: data.dayOfWeek,
      hour: data.hour,
      timezone: data.timezone,
      auto_publish: data.autoPublish,
      active: data.active,
      next_run_at: nextRun(
        data.cadence,
        data.dayOfWeek,
        data.hour,
        new Date(),
        data.timezone,
      ).toISOString(),
    };

    if (data.id) {
      const { error } = await context.supabase
        .from("automations")
        .update(row)
        .eq("id", data.id)
        .eq("workspace_id", data.workspaceId);
      if (error) throw new Error(error.message);
      return { ok: true as const, id: data.id };
    }

    const { data: created, error } = await context.supabase
      .from("automations")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: created.id };
  });

export const toggleAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ...base, id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("automations")
      .update({ active: data.active })
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ...base, id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("automations")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** تشغيل فوري لجدولة محددة (لتجربتها قبل انتظار موعدها). */
export const runAutomationNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ...base, id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("automations")
      .select("*")
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("الجدولة غير موجودة.");

    const { executeSkill } = await import("./nour-run.server");
    const run = await executeSkill(context.supabase, {
      workspaceId: data.workspaceId,
      employeeId: row.employee_id,
      skillId: row.skill_id,
      values: (row.values as Record<string, string> | null) ?? {},
      origin: "تشغيل يدوي للجدولة",
    });

    await context.supabase
      .from("automations")
      .update({ last_run_at: new Date().toISOString(), last_status: "نجح" })
      .eq("id", data.id);

    return { ok: true as const, taskId: run.taskId, title: run.title };
  });
