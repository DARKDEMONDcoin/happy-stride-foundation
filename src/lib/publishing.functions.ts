import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * منصّات نشر إضافية لنور بربط مجاني بالكامل عبر رمز وصول (بدون تسجيل تطبيق OAuth):
 * - Shopify: تطبيق مخصص داخل المتجر (Admin API access token) → نشر مقالات المدونة.
 * - Webflow: رمز API للموقع (Site API token) → إنشاء عنصر في مجموعة CMS للمدونة.
 */

type ShopifyConfig = { shop: string; accessToken: string; blogId?: string };
type WebflowConfig = { siteId: string; collectionId: string; accessToken: string };

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

type Admin = Awaited<ReturnType<typeof assertOwner>>;

async function loadConfig<T>(admin: Admin, workspaceId: string, provider: string): Promise<T> {
  const { data, error } = await admin
    .from("integration_credentials")
    .select("config")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const { openConfig } = await import("./credential-crypto.server");
  const config = (await openConfig<T>(data?.config)) ?? undefined;
  if (!config) throw new Error("هذه المنصة غير مربوطة بعد — اربطها من صفحة التكاملات.");
  return config;
}

async function saveConnection(
  admin: Admin,
  workspaceId: string,
  provider: string,
  config: Record<string, unknown>,
  account: string,
) {
  // التوكنات لا تُكتب بنص صريح: تُشفَّر AES-GCM مثل ووردبريس تماماً.
  const { sealConfig } = await import("./credential-crypto.server");
  const { error } = await admin.from("integration_credentials").upsert(
    {
      workspace_id: workspaceId,
      provider,
      config: await sealConfig(config),
    },
    { onConflict: "workspace_id,provider" },
  );
  if (error) throw new Error(error.message);
  await admin
    .from("integrations")
    .update({ status: "connected", account })
    .eq("workspace_id", workspaceId)
    .eq("provider", provider);
}

async function logPublished(
  admin: Admin,
  workspaceId: string,
  channel: string,
  title: string,
  link: string | null,
  published: boolean,
) {
  await admin.from("tasks").insert({
    workspace_id: workspaceId,
    employee_id: "nour",
    title: published ? `نُشر: ${title}` : `مسودة على ${channel}: ${title}`,
    detail: link,
    channel,
    kind: "مقال",
    status: published ? "done" : "review",
  });
}

/* ------------------------------- Shopify ------------------------------- */

function shopDomain(input: string): string {
  const host = input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  if (!/^[a-z0-9-]+\.myshopify\.com$/.test(host)) {
    throw new Error("أدخل نطاق المتجر بالشكل: your-store.myshopify.com");
  }
  return host;
}

async function shopifyFetch(config: ShopifyConfig, path: string, init?: RequestInit) {
  const res = await fetch(`https://${config.shop}/admin/api/2024-10${path}`, {
    signal: AbortSignal.timeout(30_000),
    ...init,
    headers: {
      "X-Shopify-Access-Token": config.accessToken,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("رمز الوصول غير صحيح أو لا يملك صلاحية المدونة (write_content).");
    }
    throw new Error(`Shopify رفض الطلب [${res.status}]: ${text.slice(0, 180)}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("رد غير متوقع من Shopify.");
  }
}

export const connectShopify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        shop: z.string().min(6).max(200),
        accessToken: z.string().min(10).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const config: ShopifyConfig = {
      shop: shopDomain(data.shop),
      accessToken: data.accessToken.trim(),
    };
    const blogs = (await shopifyFetch(config, "/blogs.json")) as {
      blogs?: { id?: number; title?: string }[];
    };
    const first = blogs.blogs?.[0];
    if (!first?.id) throw new Error("لا توجد مدونة في هذا المتجر — أنشئ مدونة من Shopify أولاً.");
    config.blogId = String(first.id);
    const account = `${config.shop} · ${first.title ?? "Blog"}`;
    await saveConnection(admin, data.workspaceId, "shopify", config, account);
    return { ok: true as const, account };
  });

export const publishToShopify = createServerFn({ method: "POST" })
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
    const config = await loadConfig<ShopifyConfig>(admin, data.workspaceId, "shopify");
    if (!config.blogId) throw new Error("لم نجد مدونة المتجر — أعد الربط.");

    const created = (await shopifyFetch(config, `/blogs/${config.blogId}/articles.json`, {
      method: "POST",
      body: JSON.stringify({
        article: {
          title: data.title,
          body_html: data.content,
          summary_html: data.excerpt ?? "",
          published: data.status === "publish",
        },
      }),
    })) as { article?: { id?: number; handle?: string } };

    const handle = created.article?.handle;
    const link = handle ? `https://${config.shop}/blogs/news/${handle}` : null;

    let indexnow: { submitted: number; accepted: boolean } | null = null;
    if (data.status === "publish" && link) {
      const { submitIndexNowFor } = await import("./indexnow.functions");
      const result = await submitIndexNowFor(admin, data.workspaceId, [link]);
      // «تم الإرسال» وحدها كانت تُعرض حتى لو رفض بينج وياندكس الطلب.
      indexnow = result
        ? {
            submitted: result.submitted,
            accepted: result.endpoints.some((e) => e.status >= 200 && e.status < 300),
          }
        : null;
    }

    await logPublished(
      admin,
      data.workspaceId,
      "shopify",
      data.title,
      link,
      data.status === "publish",
    );
    return { ok: true as const, id: created.article?.id ?? null, link, indexnow };
  });

/* -------------------------------- Webflow -------------------------------- */

async function webflowFetch(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`https://api.webflow.com/v2${path}`, {
    signal: AbortSignal.timeout(30_000),
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("رمز Webflow غير صحيح أو لا يملك صلاحية CMS.");
    }
    throw new Error(`Webflow رفض الطلب [${res.status}]: ${text.slice(0, 180)}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("رد غير متوقع من Webflow.");
  }
}

/** يعيد مجموعات CMS المتاحة في موقع Webflow لاختيار مجموعة المدونة. */
export const listWebflowCollections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        accessToken: z.string().min(10).max(300),
        siteId: z.string().min(6).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, data.workspaceId);
    const result = (await webflowFetch(
      data.accessToken.trim(),
      `/sites/${data.siteId.trim()}/collections`,
    )) as { collections?: { id?: string; displayName?: string; slug?: string }[] };
    return {
      collections: (result.collections ?? [])
        .filter((c) => c.id)
        .map((c) => ({ id: c.id!, name: c.displayName ?? c.slug ?? c.id! })),
    };
  });

export const connectWebflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        accessToken: z.string().min(10).max(300),
        siteId: z.string().min(6).max(80),
        collectionId: z.string().min(6).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const config: WebflowConfig = {
      accessToken: data.accessToken.trim(),
      siteId: data.siteId.trim(),
      collectionId: data.collectionId.trim(),
    };
    const collection = (await webflowFetch(
      config.accessToken,
      `/collections/${config.collectionId}`,
    )) as { displayName?: string };
    const account = `Webflow · ${collection.displayName ?? config.collectionId}`;
    await saveConnection(admin, data.workspaceId, "webflow", config, account);
    return { ok: true as const, account };
  });

export const publishToWebflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        title: z.string().min(2).max(300),
        content: z.string().min(10).max(200_000),
        slug: z.string().max(200).optional(),
        status: z.enum(["draft", "publish"]).default("draft"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const config = await loadConfig<WebflowConfig>(admin, data.workspaceId, "webflow");
    const slug =
      (data.slug ?? data.title)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80) || `post-${Date.now()}`;

    const created = (await webflowFetch(
      config.accessToken,
      `/collections/${config.collectionId}/items`,
      {
        method: "POST",
        body: JSON.stringify({
          isArchived: false,
          isDraft: data.status !== "publish",
          fieldData: { name: data.title, slug, "post-body": data.content },
        }),
      },
    )) as { id?: string };

    if (data.status === "publish" && created.id) {
      await webflowFetch(config.accessToken, `/collections/${config.collectionId}/items/publish`, {
        method: "POST",
        body: JSON.stringify({ itemIds: [created.id] }),
      });
    }

    await logPublished(
      admin,
      data.workspaceId,
      "webflow",
      data.title,
      null,
      data.status === "publish",
    );
    return { ok: true as const, id: created.id ?? null };
  });

/* ————— Ghost (Admin API — مجاني مع أي تنصيب Ghost) ————— */

type GhostStored = { apiUrl: string; adminKey: string };

export const connectGhost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        apiUrl: z.string().min(6).max(300),
        adminKey: z.string().min(20).max(300),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const { ghostSite } = await import("./ghost.server");
    const config: GhostStored = { apiUrl: data.apiUrl.trim(), adminKey: data.adminKey.trim() };
    const title = await ghostSite(config);
    const account = `Ghost · ${title}`;
    await saveConnection(admin, data.workspaceId, "ghost", config, account);
    return { ok: true as const, account };
  });

export const publishToGhost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        title: z.string().min(2).max(200),
        content: z.string().min(20).max(200_000),
        status: z.enum(["draft", "publish"]).default("draft"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const config = await loadConfig<GhostStored>(admin, data.workspaceId, "ghost");
    const { ghostPublish } = await import("./ghost.server");
    const post = await ghostPublish(config, { title: data.title, html: data.content }, data.status);
    await logPublished(
      admin,
      data.workspaceId,
      "ghost",
      data.title,
      post.url,
      data.status === "publish",
    );
    return { ok: true as const, id: post.id, link: post.url };
  });
