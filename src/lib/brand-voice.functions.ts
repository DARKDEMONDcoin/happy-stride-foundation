import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BrandVoiceResult } from "@/lib/brand-voice.server";

const input = z
  .object({
    workspaceId: z.string().uuid(),
    url: z.string().trim().max(300).optional(),
    samples: z.string().trim().max(20_000).optional(),
    save: z.boolean().default(true),
  })
  .refine((v) => (v.url && v.url.length > 3) || (v.samples && v.samples.length > 80), {
    message: "أدخل رابط موقعك أو الصق عينات نصية كافية (٨٠ حرفًا على الأقل).",
  });

/**
 * استخراج صوت العلامة من موقع أو عينات نصية، وحفظه كقاعدة نبرة إلزامية
 * في عقل العلامة حتى يلتزم بها كل الموظفين فورًا.
 */
export const extractBrandVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }): Promise<BrandVoiceResult & { savedId: string | null }> => {
    const supabase = context.supabase;
    const { data: workspace, error } = await supabase
      .from("workspaces")
      .select("id, name, industry")
      .eq("id", data.workspaceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!workspace) throw new Error("مساحة العمل غير موجودة.");

    const { collectSiteText, analyzeStyle, synthesizeVoice, voiceRuleText } =
      await import("./brand-voice.server");

    let text = data.samples ?? "";
    let urls: string[] = [];
    let headings: string[] = [];
    let taglines: string[] = [];

    if (data.url) {
      const site = await collectSiteText(data.url);
      urls = site.urls;
      headings = site.headings;
      taglines = site.taglines;
      text = [site.text, headings.join("\n"), taglines.join("\n"), data.samples ?? ""]
        .filter(Boolean)
        .join("\n\n");
    }

    // آخر شبكة أمان: نستعين بما هو مخزون في عقل العلامة (ملف العلامة، الملاحظات، المستندات)
    if (text.trim().split(/\s+/).filter(Boolean).length < 40) {
      const { data: items } = await supabase
        .from("brain_items")
        .select("title, body")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false })
        .limit(12);
      const fromBrain = (items ?? [])
        .map((i) => [i.title, i.body].filter(Boolean).join("\n"))
        .join("\n\n")
        .slice(0, 16_000);
      text = [text, fromBrain].filter(Boolean).join("\n\n");
    }

    if (text.trim().split(/\s+/).filter(Boolean).length < 40) {
      throw new Error(
        "لم نجد نصًا كافيًا لموقعك (قد يعتمد على جافاسكريبت بالكامل) ولا في عقل العلامة — الصق ٣ منشورات أو فقرات من موقعك في خيار «من نصوص ألصقها».",
      );
    }

    const stats = analyzeStyle(text, taglines);
    const profile = await synthesizeVoice(
      { name: workspace.name, industry: workspace.industry },
      stats,
      text,
      headings,
    );
    const rule = voiceRuleText(profile, stats);

    let savedId: string | null = null;
    if (data.save) {
      // نستبدل أي دليل سابق حتى لا تتضارب القواعد
      await supabase
        .from("brain_items")
        .delete()
        .eq("workspace_id", workspace.id)
        .eq("title", "دليل صوت العلامة");
      const { data: row, error: insErr } = await supabase
        .from("brain_items")
        .insert({
          workspace_id: workspace.id,
          kind: "note",
          title: "دليل صوت العلامة",
          meta: `قاعدة نبرة إلزامية · استُخرج ${urls.length ? `من ${urls.length} صفحات` : "من عينات نصية"} · ${new Date().toLocaleDateString("ar-EG")}`,
          body: rule,
          used_by: ["sonny", "eva", "sam", "nour", "dana", "adam"],
        })
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);
      savedId = row.id;
    }

    return { sourceUrls: urls, stats, profile, rule, savedId };
  });
