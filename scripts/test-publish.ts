/**
 * اختبار مسارات النشر لنور مقابل خوادم وهمية محلية (ووردبريس / Ghost / Shopify)،
 * ثم تنظيف كل ما أُنشئ. لا يلمس أي حساب خارجي حقيقي.
 */
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { autoPublish } from "@/lib/publish-core.server";
import { ghostPublish, ghostSite, ghostToken } from "@/lib/ghost.server";

const admin = createClient<Database>(
  process.env["SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  { auth: { persistSession: false } },
);

const log: Record<string, unknown> = {};

/* ---------------- خوادم وهمية ---------------- */
const received: Record<string, unknown[]> = { wp: [], ghost: [], shopify: [] };

const wp = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/wp-json/wp/v2/posts" && req.method === "POST") {
      const auth = req.headers.get("authorization") ?? "";
      if (!auth.startsWith("Basic ")) return new Response("no auth", { status: 401 });
      const body = (await req.json()) as { title: string; status: string };
      received.wp!.push({ auth: atob(auth.slice(6)), ...body });
      return Response.json({ id: 11, link: `${url.origin}/?p=11`, status: body.status });
    }
    if (url.pathname === "/wp-json/wp/v2/users/me") return Response.json({ name: "mock", id: 1 });
    return new Response("nf", { status: 404 });
  },
});

const ghost = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    const auth = req.headers.get("authorization") ?? "";
    if (!/^Ghost [\w-]+\.[\w-]+\.[\w-]+$/.test(auth)) {
      return new Response(JSON.stringify({ errors: [{ message: "bad token" }] }), { status: 401 });
    }
    if (url.pathname.endsWith("/site/")) return Response.json({ site: { title: "Mock Ghost" } });
    if (url.pathname.endsWith("/posts/") && req.method === "POST") {
      const body = (await req.json()) as { posts: { title: string; status: string }[] };
      received.ghost!.push(body.posts[0]!);
      return Response.json({
        posts: [{ id: "g1", url: `${url.origin}/mock-post/`, status: body.posts[0]!.status }],
      });
    }
    return new Response("nf", { status: 404 });
  },
});

const shopify = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.headers.get("x-shopify-access-token") !== "shpat_mock") {
      return new Response("unauthorized", { status: 401 });
    }
    if (url.pathname.endsWith("/blogs.json"))
      return Response.json({ blogs: [{ id: 7, title: "News" }] });
    if (url.pathname.includes("/articles.json") && req.method === "POST") {
      const body = (await req.json()) as { article: { title: string; published: boolean } };
      received.shopify!.push(body.article);
      return Response.json({ article: { id: 99, handle: "mock-article" } });
    }
    return new Response("nf", { status: 404 });
  },
});

// توجيه نطاق Shopify الوهمي إلى الخادم المحلي (Shopify يفرض https + myshopify.com)
const realFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (raw.startsWith("https://mock-store.myshopify.com")) {
    const rewritten = raw.replace(
      "https://mock-store.myshopify.com",
      `http://localhost:${shopify.port}`,
    );
    return realFetch(rewritten, init as RequestInit);
  }
  return realFetch(input as RequestInfo, init);
}) as typeof fetch;

/* ---------------- مساحة عمل اختبارية ---------------- */
const { data: ws } = await admin.from("workspaces").select("id, name").limit(1).single();
if (!ws) throw new Error("no workspace");
log["workspace"] = ws.name;

async function connect(provider: string, config: Record<string, unknown>) {
  await admin.from("integration_credentials").upsert(
    { workspace_id: ws!.id, provider, config: config as never },
    {
      onConflict: "workspace_id,provider",
    },
  );
  const { data: existing } = await admin
    .from("integrations")
    .select("id")
    .eq("workspace_id", ws!.id)
    .eq("provider", provider)
    .maybeSingle();
  if (existing) {
    await admin
      .from("integrations")
      .update({ status: "connected", account: `mock ${provider}` })
      .eq("id", existing.id);
  } else {
    await admin.from("integrations").insert({
      workspace_id: ws!.id,
      provider,
      status: "connected",
      account: `mock ${provider}`,
    });
  }
}

async function reset(provider: string) {
  await admin
    .from("integrations")
    .update({ status: "disconnected", account: null })
    .eq("workspace_id", ws!.id)
    .eq("provider", provider);
  await admin
    .from("integration_credentials")
    .delete()
    .eq("workspace_id", ws!.id)
    .eq("provider", provider);
}

const article = { title: "اختبار نشر نور", html: "<p>محتوى تجريبي للتحقق من مسار النشر.</p>" };

/* 1) ووردبريس عبر autoPublish */
await connect("wordpress", {
  siteUrl: `http://localhost:${wp.port}`,
  username: "admin",
  appPassword: "pass word",
});
log["wordpress_draft"] = await autoPublish(admin, ws.id, article, "draft");
log["wordpress_publish"] = await autoPublish(admin, ws.id, article, "publish");
await reset("wordpress");

/* 2) Ghost: توليد JWT + معلومات الموقع + نشر مباشر وعبر autoPublish */
const key = `640f0e9f8a1b2c3d4e5f6071:${"ab".repeat(32)}`;
const cfg = { apiUrl: `http://localhost:${ghost.port}`, adminKey: key };
log["ghost_token_parts"] = (await ghostToken(key)).split(".").length;
log["ghost_site"] = await ghostSite(cfg);
log["ghost_direct"] = await ghostPublish(cfg, article, "draft");
await connect("ghost", cfg);
log["ghost_auto"] = await autoPublish(admin, ws.id, article, "publish");
await reset("ghost");

/* 3) Shopify عبر autoPublish */
await connect("shopify", {
  shop: "mock-store.myshopify.com",
  accessToken: "shpat_mock",
  blogId: "7",
});
log["shopify_auto"] = await autoPublish(admin, ws.id, article, "publish");
await reset("shopify");

/* 4) لا منصة مربوطة → يجب أن يعيد null بدون استثناء */
log["no_provider"] = await autoPublish(admin, ws.id, article, "draft");

/* 5) أخطاء المصادقة لا تُسقط المسار */
await connect("wordpress", {
  siteUrl: `http://localhost:${wp.port}`,
  username: "",
  appPassword: "",
});
log["wordpress_bad_auth"] = await autoPublish(admin, ws.id, article, "draft");
await reset("wordpress");

log["requests_received"] = received;

/* تنظيف مهام السجل الناتجة عن الاختبار */
await admin.from("tasks").delete().eq("workspace_id", ws.id).like("title", "%اختبار نشر نور%");

console.log(JSON.stringify(log, null, 2));
wp.stop(true);
ghost.stop(true);
shopify.stop(true);
process.exit(0);
