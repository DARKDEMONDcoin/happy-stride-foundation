/**
 * دوال الخادم لربط الحسابات عبر Pipedream Connect.
 * لا تُخزَّن أي بيانات اعتماد لدينا — فقط معرّف الحساب لدى Pipedream.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pipedreamApp } from "@/data/pipedream-apps";

/** الصلاحيات اللازمة فعلياً للنشر على كل منصة (لاختيار ملف الصلاحيات عند الربط). */
const PUBLISH_SCOPES: Record<string, string[]> = {
  facebook: ["pages_manage_posts", "pages_read_engagement", "pages_show_list"],
  instagram: ["instagram_content_publish"],
};

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

/** هل ضُبطت مفاتيح Pipedream؟ تُستخدم لعرض الحالة في الواجهة. */
export const pipedreamStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { pipedreamConfig } = await import("./pipedream.server");
    const config = await pipedreamConfig();
    return { ready: Boolean(config), environment: config?.environment ?? null };
  });

/** يبدأ ربط منصة: يعيد رابط Pipedream الجاهز لفتحه في نافذة الربط. */
export const startPipedreamConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        provider: z.string().min(1).max(40),
        origin: z.string().url(),
        returnTo: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // مساحة التجربة مشتركة بين الزوار — يُمنع ربط حسابات حقيقية بها.
    if (typeof context.claims?.email === "string" && context.claims.email === "guest@sahl.app") {
      throw new Error(
        "أنت في وضع التجربة — سجّل دخولك بحسابك ثم اربط منصاتك ليُحفظ الربط في مساحتك.",
      );
    }
    await assertOwner(context.supabase, data.workspaceId);
    const app = pipedreamApp(data.provider);
    if (!app) throw new Error("هذه المنصة لا تُدار عبر Pipedream.");

    const { pipedreamConfig, createConnectToken, missingConfigError, pickScopeProfile } =
      await import("./pipedream.server");
    const config = await pipedreamConfig();
    if (!config) throw missingConfigError();

    const origin = new URL(data.origin).origin;
    const successUri =
      `${origin}/app/integrations?pd=connected&provider=${data.provider}` +
      (data.returnTo && data.returnTo.startsWith("/")
        ? `&back=${encodeURIComponent(data.returnTo)}`
        : "");
    const errorUri = `${origin}/app/integrations?pd=failed`;
    // مسارات العودة تُضبط عند إنشاء التوكن (هذا ما يعتمده الوسيط رسمياً).
    const token = await createConnectToken(config, data.workspaceId, [origin], {
      success: successUri,
      error: errorUri,
    });

    const base =
      token.connect_link_url ??
      `https://pipedream.com/_static/connect.html?token=${encodeURIComponent(token.token)}`;
    const url = new URL(base);
    url.searchParams.set("app", app.slug);
    url.searchParams.set("connectLink", "true");
    url.searchParams.set("success_redirect_uri", successUri);
    url.searchParams.set("error_redirect_uri", errorUri);

    // ملف الصلاحيات المناسب للنشر (وإلا يفتح فيسبوك نافذة «قراءة فقط»).
    const required = PUBLISH_SCOPES[data.provider];
    if (required) {
      const profile = await pickScopeProfile(config, app.slug, required);
      if (profile) {
        url.searchParams.set("oauthScopeProfile", profile);
        url.searchParams.set("oauth_scope_profile", profile);
      }
    }

    // تطبيق OAuth خاص بنا لهذه المنصة (مثلاً تطبيق ميتا المعتمد بصلاحيات النشر) إن كان مضبوطاً.
    try {
      const { getSecrets } = await import("./secrets.server");
      const key = `PIPEDREAM_OAUTH_APP_${data.provider.toUpperCase().replace(/-/g, "_")}`;
      const found: Record<string, string> = await getSecrets([key]);
      if (found[key]) url.searchParams.set("oauthAppId", found[key]);
    } catch {
      /* الافتراضي: تطبيق الوسيط */
    }

    return { url: url.toString(), app: app.slug, label: app.label };
  });

/** يزامن الحسابات المربوطة من Pipedream إلى قاعدتنا ويحدّث حالة التكاملات. */
export const syncPipedreamAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const { pipedreamConfig, listAccounts, missingConfigError, accountUsable } =
      await import("./pipedream.server");
    const { pipedreamApps } = await import("@/data/pipedream-apps");
    const config = await pipedreamConfig();
    if (!config) throw missingConfigError();

    const accounts = await listAccounts(config, data.workspaceId);
    const slugToProvider = new Map(pipedreamApps.map((a) => [a.slug, a.provider]));

    const seen: string[] = [];
    const warnings: { provider: string; message: string }[] = [];
    for (const account of accounts) {
      const slug = typeof account.app === "string" ? account.app : (account.app?.name_slug ?? "");
      const provider = slugToProvider.get(slug);
      if (!provider) continue;
      seen.push(provider);

      // فيسبوك/إنستجرام: نتحقق فوراً أن الربط يملك صلاحية النشر، لا العرض فقط.
      let scopeError: string | null = null;
      const usable = accountUsable(account);
      if ((provider === "facebook" || provider === "instagram") && usable) {
        try {
          const { metaPermissions, META_PUBLISH_SCOPES, missingMetaScopesMessage } =
            await import("./social-inbox.server");
          const granted = await metaPermissions(config, data.workspaceId, account.id);
          const missing = META_PUBLISH_SCOPES.filter((s) => !granted.includes(s));
          if (missing.length) scopeError = missingMetaScopesMessage(provider, missing);
        } catch {
          /* تعذّر الفحص — لا نعطّل الربط */
        }
      }
      if (scopeError) warnings.push({ provider, message: scopeError });

      const { error: accountError } = await admin.from("pipedream_accounts").upsert(
        {
          workspace_id: data.workspaceId,
          provider,
          app_slug: slug,
          account_id: account.id,
          account_name: account.name ?? null,
          status: usable ? "connected" : "error",
          healthy: usable,
          last_error: scopeError,
        },
        { onConflict: "workspace_id,provider,account_id" },
      );
      if (accountError) {
        warnings.push({ provider, message: `تعذّر حفظ الحساب المربوط: ${accountError.message}` });
        continue;
      }
      await admin
        .from("integrations")
        .update({
          status: usable ? "connected" : "error",
          account: account.name ?? slug,
        })
        .eq("workspace_id", data.workspaceId)
        .eq("provider", provider);
    }

    // أي منصة كانت مربوطة عبر Pipedream ولم تعد موجودة → نُرجعها إلى «غير مربوطة».
    const { data: stored } = await admin
      .from("pipedream_accounts")
      .select("id, provider, account_id")
      .eq("workspace_id", data.workspaceId);
    const liveIds = new Set(accounts.map((a) => a.id));
    for (const row of stored ?? []) {
      if (liveIds.has(row.account_id)) continue;
      await admin.from("pipedream_accounts").delete().eq("id", row.id);
      // قد يكون هذا حساباً قديماً أُعيد ربطه بحساب جديد لنفس المنصة؛ لا نمسح
      // حالة الربط التي حفظها الحساب الجديد أثناء نفس المزامنة.
      if (seen.includes(row.provider)) continue;
      await admin
        .from("integrations")
        .update({ status: "disconnected", account: null })
        .eq("workspace_id", data.workspaceId)
        .eq("provider", row.provider);
    }

    return { ok: true as const, connected: seen, warnings };
  });

/** فصل منصة مربوطة عبر Pipedream (يُلغى الحساب لدى Pipedream أيضاً). */
export const disconnectPipedream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workspaceId: z.string().uuid(), provider: z.string().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const { pipedreamConfig, deleteAccount } = await import("./pipedream.server");
    const config = await pipedreamConfig();

    const { data: rows } = await admin
      .from("pipedream_accounts")
      .select("account_id")
      .eq("workspace_id", data.workspaceId)
      .eq("provider", data.provider);

    if (config) {
      for (const row of rows ?? []) {
        try {
          await deleteAccount(config, row.account_id);
        } catch (error) {
          console.error("[pipedream] delete account failed", error);
        }
      }
    }

    await admin
      .from("pipedream_accounts")
      .delete()
      .eq("workspace_id", data.workspaceId)
      .eq("provider", data.provider);
    await admin
      .from("integrations")
      .update({ status: "disconnected", account: null })
      .eq("workspace_id", data.workspaceId)
      .eq("provider", data.provider);

    return { ok: true as const };
  });

/** نشر نص/صورة على منصة مربوطة عبر إجراء Pipedream الجاهز. */
export const publishViaPipedream = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        provider: z.string().min(1).max(40),
        text: z.string().min(1).max(20_000),
        imageUrl: z.string().url().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const { publishToPlatform } = await import("./pipedream-publish.server");
    const published = await publishToPlatform(admin, {
      workspaceId: data.workspaceId,
      provider: data.provider,
      text: data.text,
      ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
    });
    return {
      ok: true as const,
      provider: published.provider,
      accountId: published.accountId,
      result: JSON.stringify(published.result ?? null).slice(0, 4000),
    };
  });
