/** اختبار موازٍ لخدمات نور: قدرات متعددة + محادثة حرة، بقياس الزمن ورصد الأخطاء. */
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { executeSkill } from "@/lib/nour-run.server";

const client = createClient<Database>(
  process.env["SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  { auth: { persistSession: false } },
);

const { data: ws } = await client.from("workspaces").select("id, name").limit(1).single();
if (!ws) throw new Error("no workspace");
console.log("workspace:", ws.name, ws.id);

const cases: { skillId: string; values: Record<string, string> }[] = JSON.parse(
  process.argv[2] ?? "[]",
);

const results = await Promise.all(
  cases.map(async (c) => {
    const t = Date.now();
    try {
      const run = await executeSkill(client, {
        workspaceId: ws.id,
        employeeId: "nour",
        skillId: c.skillId,
        values: c.values,
        origin: "اختبار",
      });
      return {
        skill: c.skillId,
        ok: true,
        secs: +((Date.now() - t) / 1000).toFixed(1),
        chars: run.output.length,
        head: run.output.slice(0, 160).replace(/\n/g, " "),
      };
    } catch (e) {
      return {
        skill: c.skillId,
        ok: false,
        secs: +((Date.now() - t) / 1000).toFixed(1),
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }),
);
console.log(JSON.stringify(results, null, 2));
