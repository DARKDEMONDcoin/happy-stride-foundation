import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ws = { workspaceId: z.string().uuid() };

/** تخطيط تقويم محتوى: يُنشئ أفكاراً مجدولة (حالة idea) ليُولَّد كل منها لاحقاً. */
export const planContentCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ...ws,
        days: z.union([z.literal(7), z.literal(14), z.literal(30)]),
        perDay: z.number().int().min(1).max(3),
        providers: z.array(z.string()).min(1).max(6),
        topic: z.string().max(300).optional(),
        dialect: z.string().max(30).optional(),
        timezone: z.string().max(60).default("Africa/Cairo"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: own } = await context.supabase
      .from("workspaces")
      .select("id")
      .eq("id", data.workspaceId)
      .maybeSingle();
    if (!own) throw new Error("غير مصرّح.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { planCalendar } = await import("./content-calendar.server");
    return planCalendar(supabaseAdmin, {
      workspaceId: data.workspaceId,
      days: data.days,
      perDay: data.perDay,
      providers: data.providers,
      topic: data.topic,
      dialect: data.dialect,
      timezone: data.timezone,
    });
  });

/** يولّد منشوراً واحداً (نص + صورة) من فكرة — يُستدعى تباعاً من الواجهة مع شريط تقدّم. */
export const generateCalendarPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ...ws,
        id: z.string().uuid(),
        withImage: z.boolean().default(true),
        dialect: z.string().max(30).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: own } = await context.supabase
      .from("social_posts")
      .select("id")
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (!own) throw new Error("غير مصرّح.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateCalendarPost: gen } = await import("./content-calendar.server");
    try {
      return await gen(supabaseAdmin, data.workspaceId, data.id, {
        withImage: data.withImage,
        dialect: data.dialect,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "فشل التوليد";
      await supabaseAdmin
        .from("social_posts")
        .update({ meta: { error: message.slice(0, 200) } } as never)
        .eq("id", data.id);
      throw e;
    }
  });

/** يغيّر حالة منشور في التقويم: اعتماد (draft→scheduled)، إعادة لفكرة، حذف، تغيير الموعد أو النص. */
export const updateCalendarPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ...ws,
        id: z.string().uuid(),
        action: z.enum(["approve", "unapprove", "delete", "edit"]),
        body: z.string().max(3000).optional(),
        scheduledAt: z.string().datetime().optional(),
        imageUrl: z.string().url().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const q = context.supabase.from("social_posts");
    if (data.action === "delete") {
      const { error } = await q
        .delete()
        .eq("id", data.id)
        .eq("workspace_id", data.workspaceId)
        .neq("status", "published");
      if (error) throw new Error(error.message);
      return { ok: true as const };
    }
    const patch: Record<string, unknown> = {};
    if (data.action === "approve") {
      const { data: row } = await context.supabase
        .from("social_posts")
        .select("provider, image_url, scheduled_at")
        .eq("id", data.id)
        .maybeSingle();
      if (row?.provider === "instagram" && !row.image_url)
        throw new Error("إنستجرام يتطلب صورة — ولّد صورة أولاً.");
      const { data: acc } = await context.supabase
        .from("pipedream_accounts")
        .select("id")
        .eq("workspace_id", data.workspaceId)
        .eq("provider", row?.provider ?? "")
        .eq("status", "connected")
        .maybeSingle();
      if (!acc)
        throw new Error(
          `اربط حساب ${row?.provider ?? "المنصة"} من صفحة التكاملات حتى يُنشر في موعده.`,
        );
      patch["status"] = "scheduled";
      patch["locked_at"] = null;
      patch["attempts"] = 0;
      if (row && new Date(row.scheduled_at) < new Date())
        patch["scheduled_at"] = new Date(Date.now() + 5 * 60_000).toISOString();
    }
    if (data.action === "unapprove") patch["status"] = "draft";
    if (data.body !== undefined) patch["body"] = data.body;
    if (data.scheduledAt) patch["scheduled_at"] = data.scheduledAt;
    if (data.imageUrl !== undefined) patch["image_url"] = data.imageUrl;
    const { error } = await q
      .update(patch as never)
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId)
      .neq("status", "published");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** ينشر منشوراً من التقويم فوراً على المنصة المربوطة. */
export const publishCalendarPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ...ws, id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: own } = await context.supabase
      .from("social_posts")
      .select("id, provider, image_url")
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (!own) throw new Error("غير مصرّح.");
    if (own.provider === "instagram" && !own.image_url) throw new Error("إنستجرام يتطلب صورة.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // حجز ذرّي: ضغطتان متزامنتان على «انشر الآن» كانتا تنشران المنشور مرتين.
    // نشترط أن يكون غير منشور وغير محجوز حديثاً، والصف الراجع هو دليل الحجز.
    const staleLock = new Date(Date.now() - 2 * 60_000).toISOString();
    const { data: claimed } = await supabaseAdmin
      .from("social_posts")
      .update({
        status: "scheduled",
        attempts: 0,
        locked_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", data.id)
      .neq("status", "published")
      .or(`locked_at.is.null,locked_at.lt.${staleLock}`)
      .select("id")
      .maybeSingle();
    if (!claimed) throw new Error("المنشور منشور بالفعل أو جارٍ نشره الآن — انتظر لحظة قبل إعادة المحاولة.");
    const { publishQueuedPost } = await import("./social-queue.server");
    const result = await publishQueuedPost(supabaseAdmin, data.id);
    if (result.status !== "published") {
      // نحرّر الحجز فوراً كي يستطيع المالك إعادة المحاولة بعد إصلاح السبب.
      await supabaseAdmin.from("social_posts").update({ locked_at: null }).eq("id", data.id);
      throw new Error(result.error ?? "تعذّر النشر.");
    }
    return { ok: true as const };

  });

/** يقرأ أداء المنشورات الحقيقي ويستخلص «ما ينجح» ويحفظه في عقل العلامة. */
export const learnFromPerformanceNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object(ws).parse(input))
  .handler(async ({ data, context }) => {
    const { data: own } = await context.supabase
      .from("workspaces")
      .select("id")
      .eq("id", data.workspaceId)
      .maybeSingle();
    if (!own) throw new Error("غير مصرّح.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { learnFromPerformance } = await import("./content-calendar.server");
    return learnFromPerformance(supabaseAdmin, data.workspaceId);
  });
