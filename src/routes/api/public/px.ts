import { createFileRoute } from "@tanstack/react-router";

/**
 * نقطة تسجيل زيارة واحدة لموقع المستخدم — تُستدعى من سطر التتبّع في موقعه.
 * لا تُخزَّن أي بيانات شخصية: نُنشئ بصمة يومية مجهولة لا يمكن الرجوع منها للزائر.
 */
const GIF = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

const pixel = () =>
  new Response(GIF, {
    headers: {
      "content-type": "image/gif",
      "cache-control": "no-store, no-cache, must-revalidate",
      "access-control-allow-origin": "*",
    },
  });

async function hash(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)]
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sourceOf(referrer: string, host: string) {
  if (!referrer) return "مباشر";
  try {
    const h = new URL(referrer).host.replace(/^www\./, "").toLowerCase();
    if (!h || h === host) return "زيارة داخلية";
    return h;
  } catch {
    return "مباشر";
  }
}

export const Route = createFileRoute("/api/public/px")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const workspaceId = url.searchParams.get("w") ?? "";
          if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return pixel();

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: cred } = await supabaseAdmin
            .from("integration_credentials")
            .select("config")
            .eq("workspace_id", workspaceId)
            .eq("provider", "web-analytics")
            .maybeSingle();
          const allowedHost = (
            (cred?.config as { host?: string } | undefined)?.host ?? ""
          ).toLowerCase();
          if (!allowedHost) return pixel();

          const host = (url.searchParams.get("h") ?? "").replace(/^www\./, "").toLowerCase();
          if (host && host !== allowedHost && !host.endsWith(`.${allowedHost}`)) return pixel();

          const referrer = url.searchParams.get("r") ?? "";
          const country =
            request.headers.get("cf-ipcountry") ?? request.headers.get("x-vercel-ip-country") ?? "";
          const ip =
            request.headers.get("cf-connecting-ip") ??
            (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ??
            "";
          const ua = request.headers.get("user-agent") ?? "";
          const visitor = await hash(
            `${workspaceId}|${ip}|${ua}|${new Date().toISOString().slice(0, 10)}`,
          );

          await supabaseAdmin.from("site_visits").insert({
            workspace_id: workspaceId,
            host: host || allowedHost,
            path: (url.searchParams.get("p") || "/").slice(0, 300),
            referrer: referrer.slice(0, 300) || null,
            source: sourceOf(referrer, allowedHost),
            country: country ? country.toUpperCase().slice(0, 2) : null,
            visitor_hash: visitor,
          });
        } catch (e) {
          console.error("[px] failed:", e instanceof Error ? e.message : e);
        }
        return pixel();
      },
    },
  },
});
