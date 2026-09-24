import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BRAND_EMPLOYEE_IDS, sanitizeBrandKnowledge } from "./brand-context.server";

const input = z.object({
  workspaceId: z.string().uuid(),
  kind: z.enum(["note", "link"]),
  title: z.string().trim().min(2).max(180).optional(),
  value: z.string().trim().min(2).max(20_000),
});

export const saveBrandKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => input.parse(value))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    let title = data.title?.trim() || "ملاحظة عن العلامة";
    let body = sanitizeBrandKnowledge(data.value, 16_000);
    let meta = "ملاحظة · أضيفت يدوياً";

    if (data.kind === "link") {
      const { normalizeUrl } = await import("./brand-assets.server");
      const url = normalizeUrl(data.value);
      if (!url) throw new Error("الرابط غير صالح أو يشير إلى عنوان داخلي غير مسموح.");
      const { collectSiteText } = await import("./brand-voice.server");
      const site = await collectSiteText(url);
      if (site.text.trim().split(/\s+/).length < 30)
        throw new Error("تعذّرت قراءة محتوى كافٍ من هذا الرابط. جرّب صفحة أخرى أو أضف المعلومة كنص.");
      title = data.title?.trim() || site.taglines[0]?.slice(0, 180) || new URL(url).hostname;
      body = sanitizeBrandKnowledge(
        [`المصدر: ${url}`, ...site.headings.slice(0, 12), site.text].join("\n"),
        16_000,
      );
      meta = `رابط مقروء · ${site.urls.length} صفحة · ${new Date().toLocaleDateString("ar-EG")}`;
    }

    const duplicateQuery = supabase
      .from("brain_items")
      .select("id")
      .eq("workspace_id", data.workspaceId)
      .eq("title", title)
      .limit(1);
    const { data: duplicate, error: duplicateError } = await duplicateQuery;
    if (duplicateError) throw new Error(duplicateError.message);
    if (duplicate?.length) throw new Error("هذه المعرفة موجودة بالفعل في عقل العلامة.");

    const { data: row, error } = await supabase
      .from("brain_items")
      .insert({
        workspace_id: data.workspaceId,
        kind: data.kind,
        title,
        body,
        meta,
        used_by: [...BRAND_EMPLOYEE_IDS],
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, title, meta };
  });