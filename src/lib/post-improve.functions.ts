import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  text: z.string().min(20),
  provider: z.string().min(1),
  hasMedia: z.boolean().optional(),
  bannedWords: z.array(z.string()).optional(),
  tone: z.string().optional(),
  industry: z.string().optional(),
  city: z.string().optional(),
  variants: z.number().int().min(1).max(3).optional(),
});

/** يرفع جودة نص المنشور ويعيد نسخاً بديلة مرتبة بالدرجة. */
export const improvePostQuality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const { improvePost } = await import("@/lib/post-improve.server");
    return improvePost(data);
  });
