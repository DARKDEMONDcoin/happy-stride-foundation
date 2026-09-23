import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StoredAsset = {
  id: string;
  url: string;
  alt: string | null;
  page_url: string | null;
  weight: number;
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
    const { data: ws } = await supabase
      .from("workspaces")
      .select("website")
      .eq("id", data.workspaceId)
      .maybeSingle();

    const target = data.url?.trim() || ws?.website || "";
    if (!target) return { ok: false as const, reason: "no-website" as const, count: 0 };

    const { harvestSiteImages, normalizeUrl } = await import("./brand-assets.server");
    const site = normalizeUrl(target);
    if (!site) return { ok: false as const, reason: "bad-url" as const, count: 0 };

    const found = await harvestSiteImages(site, 12);
    if (found.length) {
      await supabase.from("site_assets").upsert(
        found.map((a) => ({
          workspace_id: data.workspaceId,
          url: a.url,
          page_url: a.pageUrl,
          alt: a.alt || null,
          weight: a.weight,
          source: "website",
          kind: "image",
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
});

/** صور موقع المستخدم المحفوظة، مرتّبة حسب صلتها بنص البحث إن وُجد. */
export const listSiteAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("site_assets")
      .select("id, url, alt, page_url, weight")
      .eq("workspace_id", data.workspaceId)
      .order("weight", { ascending: false })
      .limit(120);

    const assets = (rows ?? []) as StoredAsset[];
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
      })),
      limit,
    );
    const byUrl = new Map(assets.map((a) => [a.url, a]));
    return { assets: ranked.map((r) => byUrl.get(r.url)!).filter(Boolean) };
  });
