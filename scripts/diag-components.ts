import { pipedreamConfig } from "@/lib/pipedream.server";
import { pipedreamApps } from "@/data/pipedream-apps";
const c = (await pipedreamConfig())!;
const t = (await (
  await fetch("https://api.pipedream.com/v1/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: c.clientId,
      client_secret: c.clientSecret,
    }),
  })
).json()) as any;
const ids = new Set<string>();
for (const a of pipedreamApps) {
  if (a.publishComponent) ids.add(a.publishComponent);
  for (const k in a.actions ?? {}) ids.add(a.actions![k]!.component);
}
for (const id of [...ids]) {
  const r = await fetch(`https://api.pipedream.com/v1/components/${id}`, {
    headers: { Authorization: `Bearer ${t.access_token}` },
  });
  console.log(r.ok ? "OK  " : "MISS", id, r.ok ? "" : String(r.status));
}
process.exit(0);
