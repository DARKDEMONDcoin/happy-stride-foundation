import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** بيانات ربط ووردبريس كما تُخزَّن على الخادم فقط. */
type WordPressConfig = {
  siteUrl: string;
  username: string;
  appPassword: string;
};

/** عناوين شبكات داخلية ممنوعة — تمنع استغلال الربط للوصول لخدمات داخلية (SSRF). */
export function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return true;
  if (host === "::1" || host === "0.0.0.0" || host.startsWith("fc") || host.startsWith("fd"))
    return true;
  if (host.startsWith("fe80:")) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true; // بيانات وصف السحابة
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export function normalizeSiteUrl(input: string): string {
  const raw = input.trim().replace(/\/+$/, "");
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withScheme);
  if (url.protocol !== "https:") {
    throw new Error("رابط الموقع يجب أن يكون https لأن كلمات مرور التطبيقات تتطلب اتصالاً آمناً.");
  }
  if (url.username || url.password) {
    throw new Error("رابط الموقع يجب ألا يحتوي على اسم مستخدم أو كلمة مرور بداخله.");
  }
  if (isPrivateHostname(url.hostname)) {
    throw new Error("لا يمكن ربط عنوان داخلي أو محلي — استخدم نطاق موقعك العام.");
  }
  if (url.port && url.port !== "443") {
    throw new Error("استخدم رابط الموقع العام على المنفذ القياسي (443) بلا منفذ مخصّص.");
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

function wpHeaders(config: WordPressConfig): HeadersInit {
  const token = btoa(`${config.username}:${config.appPassword}`);
  return {
    Authorization: `Basic ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function wpFetch(config: WordPressConfig, path: string, init?: RequestInit) {
  const response = await fetch(`${config.siteUrl}/wp-json/wp/v2${path}`, {
    signal: AbortSignal.timeout(30_000),
    ...init,
    headers: { ...wpHeaders(config), ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`[wordpress] ${path} failed [${response.status}]: ${text.slice(0, 500)}`);
    if (response.status === 401 || response.status === 403) {
      throw new Error("بيانات الربط غير صحيحة — تأكد من اسم المستخدم وكلمة مرور التطبيق.");
    }
    if (response.status === 404) {
      throw new Error(
        "لم نجد واجهة ووردبريس على هذا الرابط — تأكد من تفعيل الروابط الدائمة (Permalinks) وأن الرابط صحيح.",
      );
    }
    throw new Error(`ووردبريس رفض الطلب [${response.status}]: ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("جاء رد غير متوقع من الموقع — تأكد أن الرابط يشير إلى موقع ووردبريس.");
  }
}

/** يتحقق أن المستخدم يملك مساحة العمل ثم يعيد عميل الخدمة. */
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

async function loadWordPressConfig(
  admin: Awaited<ReturnType<typeof assertOwner>>,
  workspaceId: string,
): Promise<WordPressConfig> {
  const { data, error } = await admin
    .from("integration_credentials")
    .select("config")
    .eq("workspace_id", workspaceId)
    .eq("provider", "wordpress")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const { openConfig } = await import("./credential-crypto.server");
  const config = await openConfig<WordPressConfig>(data?.config);
  if (!config?.siteUrl || !config.username || !config.appPassword) {
    throw new Error("موقع ووردبريس غير مربوط بعد — اربطه من صفحة التكاملات.");
  }
  return config;
}

/** ربط موقع ووردبريس حقيقي عبر كلمة مرور تطبيق. */
export const connectWordPress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        siteUrl: z.string().min(4).max(300),
        username: z.string().min(1).max(120),
        appPassword: z.string().min(8).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const config: WordPressConfig = {
      siteUrl: normalizeSiteUrl(data.siteUrl),
      username: data.username.trim(),
      // كلمات مرور تطبيقات ووردبريس تُعرض بمسافات
      appPassword: data.appPassword.replace(/\s+/g, ""),
    };

    const me = (await wpFetch(config, "/users/me?context=edit")) as {
      name?: string;
      slug?: string;
      capabilities?: Record<string, boolean>;
    };
    if (me.capabilities && me.capabilities["publish_posts"] !== true) {
      throw new Error("هذا المستخدم لا يملك صلاحية نشر المقالات على الموقع.");
    }

    const host = new URL(config.siteUrl).host;
    const account = `${host} · ${me.name ?? config.username}`;

    const { sealConfig } = await import("./credential-crypto.server");
    const { error: credError } = await admin.from("integration_credentials").upsert(
      {
        workspace_id: data.workspaceId,
        provider: "wordpress",
        config: await sealConfig(config as unknown as Record<string, unknown>),
      },
      { onConflict: "workspace_id,provider" },
    );
    if (credError) throw new Error(credError.message);

    const { error: intError } = await admin
      .from("integrations")
      .update({ status: "connected", account })
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "wordpress");
    if (intError) throw new Error(intError.message);

    return { ok: true as const, account };
  });

/** فصل منصة وحذف بيانات ربطها من الخادم. */
export const disconnectProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workspaceId: z.string().uuid(), provider: z.string().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    await admin
      .from("integration_credentials")
      .delete()
      .eq("workspace_id", data.workspaceId)
      .eq("provider", data.provider);
    const { error } = await admin
      .from("integrations")
      .update({ status: "disconnected", account: null })
      .eq("workspace_id", data.workspaceId)
      .eq("provider", data.provider);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** فحص سريع لصلاحية الربط الحالي. */
export const testWordPress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const config = await loadWordPressConfig(admin, data.workspaceId);
    const me = (await wpFetch(config, "/users/me?context=edit")) as { name?: string };
    return {
      ok: true as const,
      site: new URL(config.siteUrl).host,
      user: me.name ?? config.username,
    };
  });

/** نشر أو حفظ مسودة مقال على ووردبريس. */
export const publishToWordPress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        title: z.string().min(2).max(300),
        content: z.string().min(10).max(200_000),
        excerpt: z.string().max(1000).optional(),
        status: z.enum(["draft", "publish"]).default("draft"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const config = await loadWordPressConfig(admin, data.workspaceId);

    const post = (await wpFetch(config, "/posts", {
      method: "POST",
      body: JSON.stringify({
        title: data.title,
        content: data.content,
        excerpt: data.excerpt ?? "",
        status: data.status,
      }),
    })) as { id?: number; link?: string; status?: string };

    // إشعار فوري ومجاني لمحركات البحث (IndexNow) عند النشر الفعلي
    let indexnow: { submitted: number; accepted: boolean } | null = null;
    if (data.status === "publish" && post.link) {
      const { submitIndexNowFor } = await import("./indexnow.functions");
      const result = await submitIndexNowFor(admin, data.workspaceId, [post.link]);
      // «تم الإرسال» وحدها كانت تُعرض حتى لو رفض بينج وياندكس الطلب.
      indexnow = result
        ? {
            submitted: result.submitted,
            accepted: result.endpoints.some((e) => e.status >= 200 && e.status < 300),
          }
        : null;
    }

    await admin.from("tasks").insert({
      workspace_id: data.workspaceId,
      employee_id: "nour",
      title:
        data.status === "publish" ? `نُشر: ${data.title}` : `مسودة على ووردبريس: ${data.title}`,
      detail: post.link ?? null,
      channel: "wordpress",
      kind: "مقال",
      status: data.status === "publish" ? "done" : "review",
    });

    return {
      ok: true as const,
      id: post.id ?? null,
      link: post.link ?? null,
      status: post.status ?? data.status,
      indexnow,
    };
  });
