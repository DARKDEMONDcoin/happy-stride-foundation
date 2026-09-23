/** يفحص ملفات الصلاحيات المتاحة لتطبيقات النشر لدى الوسيط. */
import { pipedreamConfig } from "@/lib/pipedream.server";

const config = await pipedreamConfig();
if (!config) throw new Error("no config");

const tok = await fetch("https://api.pipedream.com/v1/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
  }),
}).then((r) => r.json() as Promise<{ access_token: string }>);

const out: Record<string, unknown> = {};
for (const slug of [
  "facebook_pages",
  "instagram_business",
  "instagram",
  "linkedin",
  "twitter",
  "pinterest",
]) {
  const res = await fetch(`https://api.pipedream.com/v1/apps/${slug}`, {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    out[slug] = { status: res.status, body: text.slice(0, 200) };
    continue;
  }
  const json = JSON.parse(text) as {
    data?: {
      name?: string;
      auth_type?: string;
      scope_profiles?: { name?: string; scopes?: string[] }[];
      custom_fields_json?: unknown;
    };
  };
  out[slug] = {
    name: json.data?.name,
    auth: json.data?.auth_type,
    profiles: (json.data?.scope_profiles ?? []).map((p) => ({ name: p.name, scopes: p.scopes })),
  };
}

// هل يقبل المشروع عملاء OAuth مخصصين؟
const oc = await fetch(`https://api.pipedream.com/v1/connect/${config.projectId}/oauth_clients`, {
  headers: { Authorization: `Bearer ${tok.access_token}`, "x-pd-environment": config.environment },
});
out["oauth_clients"] = { status: oc.status, body: (await oc.text()).slice(0, 600) };

console.log(JSON.stringify(out, null, 2));
process.exit(0);
