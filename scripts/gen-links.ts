import { pipedreamConfig, createConnectToken } from "@/lib/pipedream.server";
const WS = "434b263e-2aa0-4fc6-9759-7cc2675d40e0";
const O = "https://id-preview--0ce5e558-cbb1-4a64-8022-50705199c70c.lovable.app";
const c = (await pipedreamConfig())!;
for (const app of ["linkedin", "pinterest", "gmail", "google_my_business"]) {
  const t = await createConnectToken(c, WS, [O], {
    success: `${O}/app/integrations?pd=connected`,
    error: `${O}/app/integrations?pd=failed`,
  });
  const u = new URL(t.connect_link_url!);
  u.searchParams.set("app", app);
  console.log(app, u.toString());
}
process.exit(0);
