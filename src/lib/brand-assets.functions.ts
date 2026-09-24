import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StoredAsset = {
  id: string;
  url: string;
  alt: string | null;
  page_url: string | null;
  weight: number;
  kind: "image" | "video";
};

export type PublicAsset = {
  url: string;
  alt: string;
  pageUrl: string;
  weight: number;
  kind: "image" | "video";
  license: string;
  creator: string;
};

const syncSchema = z.object({
  workspaceId: z.string().uuid(),
  url: z.string().min(4).max(300).optional(),
});

/** يفحص موقع المستخدم ويحفظ صوره الحقيقية في مكتبة صور مساحة العمل. */
export const syncSiteAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => syncSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const [{ data: ws }, { data: brainLinks }] = await Promise.all([
      supabase.from("workspaces").select("website").eq("id", data.workspaceId).maybeSingle(),
      supabase
        .from("brain_items")
        .select("body, meta")
        .eq("workspace_id", data.workspaceId)
        .eq("kind", "link")
        .limit(12),
    ]);

    const target = data.url?.trim() || ws?.website || "";
    const linkedUrls = (brainLinks ?? [])
      .flatMap((item) => `${item.body ?? ""}\n${item.meta ?? ""}`.match(/https?:\/\/[^\s<>"')]+/gi) ?? [])
      .slice(0, 4);
    if (!target && !linkedUrls.length)
      return { ok: false as const, reason: "no-website" as const, count: 0 };

    const { harvestSiteAssets, normalizeUrl } = await import("./brand-assets.server");
    const sites = [...new Set([target, ...linkedUrls].map((url) => normalizeUrl(url)).filter(Boolean))] as string[];
    const site = sites[0];
    if (!site) return { ok: false as const, reason: "bad-url" as const, count: 0 };

    const found = (await Promise.all(sites.map((url) => harvestSiteAssets(url, 8))))
      .flat()
      .filter((asset, index, all) => all.findIndex((item) => item.url === asset.url) === index)
      .slice(0, 120);
    if (found.length) {
      await supabase.from("site_assets").upsert(
        found.map((a) => ({
          workspace_id: data.workspaceId,
          url: a.url,
          page_url: a.pageUrl,
          alt: a.alt || null,
          weight: a.weight,
          source: a.pageUrl.startsWith(new URL(site).origin) ? "website" : "brand-link",
          kind: a.kind,
        })),
        { onConflict: "workspace_id,url" },
      );
    }
    // نحفظ الموقع في الملف حتى لا يعيد المستخدم إدخاله.
    if (!ws?.website)
      await supabase.from("workspaces").update({ website: site }).eq("id", data.workspaceId);

    return { ok: true as const, count: found.length, site };
  });

const listSchema = z.object({
  workspaceId: z.string().uuid(),
  query: z.string().max(400).optional(),
  limit: z.number().int().min(1).max(40).optional(),
  kind: z.enum(["image", "video"]).optional(),
});

/** صور موقع المستخدم المحفوظة، مرتّبة حسب صلتها بنص البحث إن وُجد. */
export const listSiteAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("site_assets")
      .select("id, url, alt, page_url, weight, kind")
      .eq("workspace_id", data.workspaceId)
      .order("weight", { ascending: false })
      .limit(120);

    const assets = ((rows ?? []) as StoredAsset[]).filter((asset) => !data.kind || asset.kind === data.kind);
    const limit = data.limit ?? 24;
    const q = data.query?.trim();
    if (!q) return { assets: assets.slice(0, limit) };

    const { rankAssets } = await import("./brand-assets.server");
    const ranked = rankAssets(
      q,
      assets.map((a) => ({
        url: a.url,
        alt: a.alt ?? "",
        pageUrl: a.page_url ?? "",
        weight: a.weight,
        kind: a.kind,
      })),
      limit,
    );
    const byUrl = new Map(assets.map((a) => [a.url, a]));
    return { assets: ranked.map((r) => byUrl.get(r.url)!).filter(Boolean) };
  });

const publicSchema = z.object({
  workspaceId: z.string().uuid(),
  query: z.string().trim().max(180).optional(),
});

/** وسائط عامة قابلة لإعادة الاستخدام من Wikimedia Commons، مختارة بسياق عقل العلامة. */
export const findPublicBrandAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => publicSchema.parse(input))
  .handler(async ({ data, context }) => {
    const [{ data: workspace }, { data: brain }] = await Promise.all([
      context.supabase
        .from("workspaces")
        .select("name, industry")
        .eq("id", data.workspaceId)
        .maybeSingle(),
      context.supabase
        .from("brain_items")
        .select("title, body")
        .eq("workspace_id", data.workspaceId)
        .limit(12),
    ]);
    const contextText = [
      data.query,
      workspace?.name,
      workspace?.industry,
      ...(brain ?? []).flatMap((item) => [item.title, item.body?.slice(0, 180)]),
    ]
      .filter(Boolean)
      .join(" ");
    const { searchCommonsAssets } = await import("./brand-assets.server");
    return { assets: await searchCommonsAssets(contextText) };
  });
