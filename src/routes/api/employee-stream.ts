import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { askEmployeeInput, runEmployeeTurn, type TurnEvent } from "@/lib/ai.functions";

/** مفاتيح Supabase الحديثة نصوص مبهمة لا JWT — تُرسل في apikey فقط. */
function supabaseFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (
      (key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) &&
      headers.get("Authorization") === `Bearer ${key}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

/**
 * بثّ حقيقي لتنفيذ طلب الموظف: مراحل العمل الفعلية + نص الرد وهو يُكتب.
 * نفس منطق askEmployee تماماً — لا تكرار ولا اختلاف في النتيجة النهائية.
 */
export const Route = createFileRoute("/api/employee-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) return new Response("Supabase not configured", { status: 500 });

        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (!token || token.split(".").length !== 3) {
          return new Response("Unauthorized", { status: 401 });
        }

        const supabase = createClient<Database>(url, key, {
          global: { fetch: supabaseFetch(key), headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
        if (claimsError || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const parsed = askEmployeeInput.safeParse(payload);
        if (!parsed.success) return new Response("Bad request", { status: 400 });

        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            let closed = false;
            const send = (event: Record<string, unknown>) => {
              if (closed) return;
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              } catch {
                closed = true;
              }
            };
            void (async () => {
              try {
                const result = await runEmployeeTurn(
                  parsed.data,
                  { supabase },
                  (event: TurnEvent) => send(event),
                );
                send({ type: "done", result });
              } catch (error) {
                send({
                  type: "error",
                  message: error instanceof Error ? error.message : "تعذّر إتمام الطلب",
                });
              } finally {
                closed = true;
                try {
                  controller.close();
                } catch {
                  /* أُغلق مسبقاً */
                }
              }
            })();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
