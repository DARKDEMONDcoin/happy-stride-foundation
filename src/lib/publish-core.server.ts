/**
 * نشر تلقائي من الخادم (بدون جلسة مستخدم) — يُستخدم في الجدولة التلقائية.
 * يختار أول منصة نشر مربوطة لمساحة العمل بالترتيب: ووردبريس → Ghost → Shopify،
 * ويحفظ المخرج كمسودة افتراضياً حتى لا يُنشر شيء بلا رغبة صريحة من صاحب العلامة.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { ghostPublish } from "./ghost.server";

type Admin = SupabaseClient<Database>;

export type AutoPublishResult = {
  provider: string;
  link: string | null;
  status: "draft" | "publish";
  /** سبب الفشل إن حاولنا النشر وفشل — لا يُترك null غامضاً يخلط «غير مربوط» بـ«فشل». */
  error?: string;
};

async function config<T>(admin: Admin, workspaceId: string, provider: string): Promise<T | null> {
  const { data } = await admin
    .from("integration_credentials")
    .select("config")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .maybeSingle();
  const { openConfig } = await import("./credential-crypto.server");
  return (await openConfig<T>(data?.config)) ?? null;
}

async function connectedProviders(admin: Admin, workspaceId: string): Promise<Set<string>> {
  const { data } = await admin
    .from("integrations")
    .select("provider")
    .eq("workspace_id", workspaceId)
    .eq("status", "connected");
  return new Set((data ?? []).map((r) => r.provider));
}

export async function autoPublish(
  admin: Admin,
  workspaceId: string,
  article: { title: string; html: string },
  status: "draft" | "publish" = "draft",
): Promise<AutoPublishResult | null> {
  const connected = await connectedProviders(admin, workspaceId);
  // نجمع أسباب الفشل بدل ابتلاعها في console، حتى يفرّق المستدعي بين «لا منصة مربوطة»
  // و«حاولنا وفشلنا» فيعرض السبب للمستخدم ويعيد المحاولة بوعي.
  const failures: string[] = [];

  if (connected.has("wordpress")) {
    const wp = await config<{ siteUrl: string; username: string; appPassword: string }>(
      admin,
      workspaceId,
      "wordpress",
    );
    if (wp?.siteUrl) {
      const res = await fetch(`${wp.siteUrl}/wp-json/wp/v2/posts`, {
        signal: AbortSignal.timeout(30_000),
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${wp.username}:${wp.appPassword}`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: article.title, content: article.html, status }),
      });
      if (res.ok) {
        const post = (await res.json()) as { link?: string };
        return { provider: "wordpress", link: post.link ?? null, status };
      }
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      failures.push(`ووردبريس [${res.status}]${detail ? `: ${detail}` : ""}`);
    }
  }

  if (connected.has("ghost")) {
    const gh = await config<{ apiUrl: string; adminKey: string }>(admin, workspaceId, "ghost");
    if (gh?.apiUrl) {
      try {
        const post = await ghostPublish(gh, article, status);
        return { provider: "ghost", link: post.url ?? null, status };
      } catch (error) {
        failures.push(`Ghost: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  if (connected.has("shopify")) {
    const sh = await config<{ shop: string; accessToken: string; blogId?: string }>(
      admin,
      workspaceId,
      "shopify",
    );
    if (sh?.shop && sh.blogId) {
      const res = await fetch(
        `https://${sh.shop}/admin/api/2024-10/blogs/${sh.blogId}/articles.json`,
        {
          signal: AbortSignal.timeout(30_000),
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": sh.accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            article: {
              title: article.title,
              body_html: article.html,
              published: status === "publish",
            },
          }),
        },
      );
      if (res.ok) {
        const created = (await res.json()) as { article?: { handle?: string } };
        return {
          provider: "shopify",
          link: created.article?.handle
            ? `https://${sh.shop}/blogs/news/${created.article.handle}`
            : null,
          status,
        };
      }
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      failures.push(`Shopify [${res.status}]${detail ? `: ${detail}` : ""}`);
    }
  }

  if (failures.length) {
    return { provider: "auto", link: null, status, error: failures.join(" | ") };
  }
  return null;
}
