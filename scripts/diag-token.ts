/** يجرّب أشكال طلب ملف الصلاحيات عند إنشاء توكن الربط، ويختبر إصدارات Graph. */
import { pipedreamConfig, proxyRequest, listAccounts } from "@/lib/pipedream.server";

const WS = "434b263e-2aa0-4fc6-9759-7cc2675d40e0";
const config = (await pipedreamConfig())!;
const out: Record<string, unknown> = {};

const tok = (await (
  await fetch("https://api.pipedream.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  })
).json()) as { access_token: string };

async function mkToken(extra: Record<string, unknown>) {
  const res = await fetch(`https://api.pipedream.com/v1/connect/${config.projectId}/tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tok.access_token}`,
      "x-pd-environment": config.environment,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_user_id: `ws_${WS}`,
      allowed_origins: ["http://localhost:8080"],
      ...extra,
    }),
  });
  const text = await res.text();
  return { status: res.status, body: text.slice(0, 500) };
}

out["plain"] = await mkToken({});
out["oauth_scope_profile"] = await mkToken({ oauth_scope_profile: "admin" });
out["oauth_scope_profile_app"] = await mkToken({
  app: "facebook_pages",
  oauth_scope_profile: "admin",
});
out["oauth_app_id"] = await mkToken({ oauth_app_id: "admin" });

// إصدارات Graph المدعومة عبر الحساب المربوط
const accounts = await listAccounts(config, WS, "facebook_pages");
const fb = accounts[0];
if (fb) {
  for (const v of ["v21.0", "v23.0", "v25.0", "v26.0"]) {
    try {
      const r = await proxyRequest<{ id?: string }>(config, {
        workspaceId: WS,
        accountId: fb.id,
        url: `https://graph.facebook.com/${v}/me?fields=id`,
      });
      out[`graph_${v}`] = r.id ? "ok" : JSON.stringify(r).slice(0, 120);
    } catch (e) {
      out[`graph_${v}`] = String(e).slice(0, 160);
    }
  }
}

console.log(JSON.stringify(out, null, 2));
process.exit(0);
