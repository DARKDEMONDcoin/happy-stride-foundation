/**
 * دوال الخادم لربط ميتا المباشر واختباره والنشر عليه.
 * التوكنات لا تغادر الخادم إطلاقاً — الواجهة ترى الحالة والأسماء فقط.
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

/** حالة ربط ميتا المباشر + تشخيص الأذونات لكل صفحة. */
export const metaStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const { metaDiagnose } = await import("./meta.server");
    return metaDiagnose(admin, data.workspaceId);
  });

/** يبدأ ربط ميتا: يعيد رابط تفويض فيسبوك بكل أذونات النشر. */
export const startMetaConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        origin: z.string().url(),
        returnTo: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, data.workspaceId);
    const meta = await import("./meta.server");
    const config = await meta.metaConfig();
    if (!config) throw meta.metaMissingConfigError();
    const returnTo =
      data.returnTo && data.returnTo.startsWith("/") ? data.returnTo : "/app/integrations";
    const state = await meta.signState(config, data.workspaceId, returnTo);
    const redirectUri = meta.metaRedirectUri(data.origin);
    return {
      url: meta.metaAuthorizeUrl(config, redirectUri, state),
      redirectUri,
      scopes: [...meta.META_SCOPES],
    };
  });

/** فصل ربط ميتا المباشر (كل الصفحات أو صفحة واحدة). */
export const disconnectMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ workspaceId: z.string().uuid(), pageId: z.string().max(60).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    let query = admin.from("meta_connections").delete().eq("workspace_id", data.workspaceId);
    if (data.pageId) query = query.eq("page_id", data.pageId);
    const { error } = await query;
    if (error) throw new Error(error.message);
    if (!data.pageId) {
      await admin
        .from("integrations")
        .update({ status: "disconnected", account: null })
        .eq("workspace_id", data.workspaceId)
        .in("provider", ["facebook", "instagram"]);
    }
    return { ok: true };
  });

/** نشر مباشر عبر ميتا (يُستخدم أيضاً كاختبار حي مع إعادة معرّف المنشور). */
export const publishMetaDirect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        provider: z.enum(["facebook", "instagram"]),
        text: z.string().min(1).max(5000),
        imageUrl: z.string().url().optional(),
        videoUrl: z.string().url().optional(),
        pageId: z.string().max(60).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const { metaPublish } = await import("./meta.server");
    const result = await metaPublish(admin, data.workspaceId, data.provider, {
      text: data.text,
      imageUrl: data.imageUrl,
      videoUrl: data.videoUrl,
      pageId: data.pageId,
    });
    return {
      postId: result.postId,
      permalink: result.permalink,
      pageId: result.pageId,
      pageName: result.pageName,
    };
  });

/** اختبار تلقائي: ينشر منشوراً تجريبياً على كل منصة ميتا جاهزة ويُرجع تشخيصاً دقيقاً. */
export const runMetaSelfTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        providers: z.array(z.enum(["facebook", "instagram"])).min(1),
        imageUrl: z.string().url().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const { metaPublish, metaDiagnose } = await import("./meta.server");
    const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
    const diagnostics = await metaDiagnose(admin, data.workspaceId);

    const results: {
      provider: "facebook" | "instagram";
      ok: boolean;
      postId?: string;
      permalink?: string | null;
      error?: string;
      missing?: string[];
    }[] = [];

    for (const provider of data.providers) {
      const diag = diagnostics.connections.find((c) => c.kind === provider);
      if (!diag) {
        results.push({ provider, ok: false, error: "لا يوجد ربط مباشر لهذه المنصة بعد." });
        continue;
      }
      if (!diag.canPublish) {
        results.push({
          provider,
          ok: false,
          error:
            diag.missing.length > 0
              ? `أذونات ناقصة: ${diag.missing.join("، ")} — أعد الربط ووافق على كل الأذونات.`
              : "الصفحة غير مرتبطة بحساب إنستجرام احترافي.",
          missing: diag.missing,
        });
        continue;
      }
      try {
        const res = await metaPublish(admin, data.workspaceId, provider, {
          text: `اختبار نشر تلقائي من سِراج — ${stamp}`,
          ...(provider === "instagram" || data.imageUrl
            ? { imageUrl: data.imageUrl ?? "https://picsum.photos/1080/1080" }
            : {}),
        });
        results.push({ provider, ok: true, postId: res.postId, permalink: res.permalink });
      } catch (e) {
        results.push({
          provider,
          ok: false,
          error: e instanceof Error ? e.message : "فشل غير معروف",
        });
      }
    }

    return { results, diagnostics };
  });
