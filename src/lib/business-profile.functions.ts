import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { BusinessProfile } from "@/lib/business-profile.server";

/**
 * تحليل موقع المستخدم وحفظ «ملف العلامة» في مساحة العمل وعقل العلامة،
 * فيقرأه الموظفون الستة تلقائياً في كل محادثة وقدرة.
 */
export const profileMyWebsite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        url: z.string().trim().min(4).max(300),
        /** حفظ النتيجة مباشرة (الإعداد الأولي) أو إعادتها للمراجعة فقط. */
        save: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ profile: BusinessProfile; saved: boolean }> => {
    const { profileWebsite } = await import("./business-profile.server");
    const profile = await profileWebsite(data.url);
    if (!data.save) return { profile, saved: false };
    await saveProfile(context.supabase, data.workspaceId, data.url, profile);
    return { profile, saved: true };
  });

/** حفظ ملف معدَّل يدوياً من المستخدم (تصحيح ما فهمناه). */
export const saveBusinessProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        url: z.string().trim().max(300).default(""),
        profile: z.record(z.string(), z.unknown()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await saveProfile(
      context.supabase,
      data.workspaceId,
      data.url,
      data.profile as unknown as BusinessProfile,
    );
    return { ok: true as const };
  });

type Client = SupabaseClient<Database>;

async function saveProfile(
  supabase: Client,
  workspaceId: string,
  url: string,
  profile: BusinessProfile,
) {
  const website = url ? (/^https?:\/\//i.test(url) ? url : `https://${url}`) : null;
  const patch: Record<string, unknown> = {
    profile,
    ...(website ? { website } : {}),
    ...(profile.country ? { country: profile.country } : {}),
    ...(profile.name ? { name: profile.name, initials: profile.name.slice(0, 2) } : {}),
    ...(profile.industry && profile.industry !== "عام" ? { industry: profile.industry } : {}),
  };
  const { error } = await supabase
    .from("workspaces")
    .update(patch as never)
    .eq("id", workspaceId);
  if (error) throw new Error(error.message);

  // نسخة مقروءة في عقل العلامة (يستفيد منها الاسترجاع الدلالي) — نستبدل القديمة.
  const body = [
    profile.summary,
    profile.products.length ? `المنتجات/الخدمات: ${profile.products.join("، ")}` : "",
    profile.audience ? `الجمهور: ${profile.audience}` : "",
    profile.usp ? `ما يميزنا: ${profile.usp}` : "",
    profile.locations.length ? `المدن/الفروع: ${profile.locations.join("، ")}` : "",
    profile.competitors.length ? `منافسون: ${profile.competitors.join("، ")}` : "",
    profile.platform ? `منصة الموقع: ${profile.platform}` : "",
    profile.dialect ? `لهجة الموقع: ${profile.dialect}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  await supabase
    .from("brain_items")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("title", "ملف العلامة");
  await supabase.from("brain_items").insert({
    workspace_id: workspaceId,
    kind: "note",
    title: "ملف العلامة",
    meta: `مستخرج تلقائياً من ${website ?? "الموقع"} · ${profile.pagesRead.length} صفحات`,
    body,
    used_by: ["sonny", "eva", "sam", "nour", "dana", "adam"],
  });
}
