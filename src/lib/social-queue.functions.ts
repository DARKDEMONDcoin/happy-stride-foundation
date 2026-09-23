/**
 * دوال الخادم لطابور النشر الاجتماعي: جدولة منشور، نشره فوراً، وإلغاؤه.
 * كل الدوال محمية بملكية مساحة العمل.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractPostText } from "./post-format";

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

async function assertConnected(
  admin: Awaited<ReturnType<typeof assertOwner>>,
  workspaceId: string,
  provider: string,
) {
  const { data: account } = await admin
    .from("pipedream_accounts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .eq("status", "connected")
    .order("connected_at", { ascending: false })
    .limit(1);
  let connected = Boolean(account?.length);
  if (!connected && provider === "telegram") {
    const { data: direct } = await admin
      .from("integration_credentials")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("provider", "telegram")
      .limit(1);
    connected = Boolean(direct?.length);
  }
  if (!connected && (provider === "facebook" || provider === "instagram")) {
    const { data: meta } = await admin
      .from("meta_connections")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("status", "connected")
      .limit(1);
    connected = Boolean(meta?.length);
  }
  if (!connected) throw new Error("هذه المنصة غير مربوطة بعد — اربطها ثم أعد المحاولة.");
}

const scheduleInput = z.object({
  workspaceId: z.string().uuid(),
  employeeId: z.string().min(1).max(40).default("sonny"),
  taskId: z.string().uuid().nullish(),
  provider: z.string().min(1).max(40),
  body: z.string().min(1).max(20_000),
  imageUrl: z.string().url().nullish(),
  /** فيديو مرفوع من جهاز المستخدم (فيسبوك/إنستجرام Reels). */
  videoUrl: z.string().url().nullish(),
  /** وسائط متعددة: ألبوم فيسبوك أو كاروسيل إنستجرام (حتى ١٠ عناصر). */
  media: z
    .array(z.object({ url: z.string().url(), kind: z.enum(["image", "video"]) }))
    .max(10)
    .nullish(),
  scheduledAt: z.string().datetime(),
});

/** يبني حقل meta المحفوظ مع المنشور. */
function metaOf(data: {
  videoUrl?: string | null | undefined;
  media?: { url: string; kind: "image" | "video" }[] | null | undefined;
}) {
  return {
    ...(data.videoUrl ? { videoUrl: data.videoUrl } : {}),
    ...(data.media?.length ? { media: data.media } : {}),
  };
}

function cleanPublishBody(body: string): string {
  const clean = extractPostText(body);
  if (!clean) throw new Error("نص المنشور فارغ بعد إزالة ملاحظات الموظف.");
  return clean;
}

/** أقصى حجم وسائط يُرفع من الجهاز: ٥٠ ميجابايت. */
const MAX_UPLOAD = 50 * 1024 * 1024;

/**
 * يرفع صورة/فيديو من معرض المستخدم إلى مخزن مساحة العمل ويعيد رابطاً عاماً طويل الأمد
 * صالحاً للنشر على المنصات.
 */
export const uploadSocialMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    if (!(input instanceof FormData)) throw new Error("صيغة الرفع غير صالحة.");
    const workspaceId = z.string().uuid().parse(input.get("workspaceId"));
    const file = input.get("file");
    if (!(file instanceof File)) throw new Error("لم يُرفق ملف.");
    if (file.size > MAX_UPLOAD) throw new Error("حجم الملف أكبر من ٥٠ ميجابايت.");
    const kind = file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("image/")
        ? "image"
        : null;
    if (!kind) throw new Error("يُقبل فقط صور (JPG/PNG/WebP) أو فيديو (MP4/MOV).");
    return { workspaceId, file, kind } as const;
  })
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const ext = (data.file.name.split(".").pop() ?? (data.kind === "video" ? "mp4" : "jpg"))
      .toLowerCase()
      .slice(0, 5);
    const path = `${data.workspaceId}/uploads/${crypto.randomUUID()}.${ext}`;
    const bucket = admin.storage.from("nour-media");
    const { error } = await bucket.upload(path, data.file, {
      contentType: data.file.type,
      upsert: false,
    });
    if (error) throw new Error(`تعذّر رفع الملف: ${error.message}`);
    const { data: signed } = await bucket.createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    if (!signed?.signedUrl) throw new Error("تعذّر إنشاء رابط الملف.");
    return { ok: true as const, url: signed.signedUrl, kind: data.kind, name: data.file.name };
  });

/** يضيف منشوراً إلى طابور النشر بموعد محدد. */
export const scheduleSocialPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => scheduleInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    await assertConnected(admin, data.workspaceId, data.provider);
    if (new Date(data.scheduledAt).getTime() <= Date.now())
      throw new Error("اختر موعداً قادماً للجدولة.");

    const { data: row, error } = await admin
      .from("social_posts")
      .insert({
        workspace_id: data.workspaceId,
        employee_id: data.employeeId,
        task_id: data.taskId ?? null,
        provider: data.provider,
        body: cleanPublishBody(data.body),
        image_url: data.imageUrl ?? null,
        meta: metaOf(data),

        scheduled_at: data.scheduledAt,
        status: "scheduled",
      })
      .select("id, scheduled_at")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: row.id, scheduledAt: row.scheduled_at };
  });

/** ينشر الآن: يضيف المنشور ثم ينفّذه فوراً بنفس نواة الطابور. */
export const publishSocialNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => scheduleInput.omit({ scheduledAt: true }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    await assertConnected(admin, data.workspaceId, data.provider);
    const { data: row, error } = await admin
      .from("social_posts")
      .insert({
        workspace_id: data.workspaceId,
        employee_id: data.employeeId,
        task_id: data.taskId ?? null,
        provider: data.provider,
        body: cleanPublishBody(data.body),
        image_url: data.imageUrl ?? null,
        meta: metaOf(data),
        scheduled_at: new Date().toISOString(),
        status: "scheduled",
        locked_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { publishQueuedPost } = await import("./social-queue.server");
    const result = await publishQueuedPost(admin, row.id);
    if (result.status !== "published") throw new Error(result.error ?? "تعذّر النشر.");
    return { ok: true as const, id: row.id };
  });

/** يعيد محاولة منشور فشل أو يلغي منشوراً مجدولاً. */
export const updateSocialPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        id: z.string().uuid(),
        action: z.enum(["cancel", "retry", "reschedule"]),
        scheduledAt: z.string().datetime().nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);

    if (data.action === "cancel") {
      const { error } = await admin
        .from("social_posts")
        .update({ status: "cancelled", locked_at: null })
        .eq("id", data.id)
        .eq("workspace_id", data.workspaceId)
        .neq("status", "published");
      if (error) throw new Error(error.message);
      return { ok: true as const };
    }

    if (data.action === "reschedule") {
      if (!data.scheduledAt) throw new Error("الموعد الجديد مطلوب.");
      if (new Date(data.scheduledAt).getTime() <= Date.now())
        throw new Error("اختر موعداً قادماً للجدولة.");
      const { error } = await admin
        .from("social_posts")
        .update({ scheduled_at: data.scheduledAt, status: "scheduled", locked_at: null })
        .eq("id", data.id)
        .eq("workspace_id", data.workspaceId)
        .neq("status", "published");
      if (error) throw new Error(error.message);
      return { ok: true as const };
    }

    const { data: retried, error: retryError } = await admin
      .from("social_posts")
      .update({
        status: "scheduled",
        attempts: 0,
        locked_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId)
      .neq("status", "published")
      .select("id");
    if (retryError) throw new Error(retryError.message);
    if (!retried?.length) throw new Error("هذا المنشور نُشر بالفعل ولا يمكن إعادة نشره.");

    const { publishQueuedPost } = await import("./social-queue.server");
    const result = await publishQueuedPost(admin, data.id);
    if (result.status !== "published") throw new Error(result.error ?? "تعذّر النشر.");
    return { ok: true as const };
  });
