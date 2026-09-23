import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function owns(supabase: SupabaseClient<Database>, workspaceId: string) {
  const { data, error } = await supabase.rpc("owns_workspace", { _workspace_id: workspaceId });
  if (error || data !== true) throw new Error("غير مصرح لك بهذه المساحة.");
}

/**
 * التعلّم ذاتي بالكامل: الموظفون يقيسون أنفسهم ويرقّون دروسهم في الدورة الليلية،
 * فلا توجد لوحة أو أزرار تحكم للمالك — فقط تسجيل الإشارات أدناه.
 */

export const saveLearningFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        taskId: z.string().uuid(),
        employeeId: z.string().min(1),
        kind: z.enum(["approved", "edited", "rejected", "published", "metric", "note"]),
        reason: z.string().max(700).nullish(),
        originalText: z.string().max(20000).nullish(),
        editedText: z.string().max(20000).nullish(),
        metrics: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await owns(context.supabase, data.workspaceId);
    const { recordTaskFeedback, buildLearningCandidates } = await import("./learning.server");
    await recordTaskFeedback(context.supabase, {
      workspaceId: data.workspaceId,
      taskId: data.taskId,
      employeeId: data.employeeId,
      kind: data.kind,
      reason: data.reason ?? null,
      originalText: data.originalText ?? null,
      editedText: data.editedText ?? null,
      metrics: data.metrics ?? {},
    });
    await buildLearningCandidates(context.supabase, data.workspaceId, data.employeeId);
    return { ok: true };
  });

/**
 * إشارة ضمنية من المحادثة: أعاد المالك التوليد، أو أخذ النص ليعدّله بنفسه.
 * تُسجَّل بلا نصّ درس — دليل رسوب يدخل بوابة الأمان في دورة القياس الليلية.
 */
export const saveChatSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        employeeId: z.string().min(1),
        messageId: z.string().uuid(),
        kind: z.enum(["edited", "rejected"]),
        originalText: z.string().max(20000).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await owns(context.supabase, data.workspaceId);
    const { recordChatSignal } = await import("./learning.server");
    return recordChatSignal(context.supabase, {
      workspaceId: data.workspaceId,
      employeeId: data.employeeId,
      messageId: data.messageId,
      kind: data.kind,
      originalText: data.originalText ?? null,
    });
  });
