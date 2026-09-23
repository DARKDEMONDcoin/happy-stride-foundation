import { pipedreamConfig, createConnectToken } from "@/lib/pipedream.server";
const WS = "434b263e-2aa0-4fc6-9759-7cc2675d40e0";
const config = (await pipedreamConfig())!;
const t = await createConnectToken(
  config,
  WS,
  ["https://id-preview--0ce5e558-cbb1-4a64-8022-50705199c70c.lovable.app"],
  {
    success:
      "https://id-preview--0ce5e558-cbb1-4a64-8022-50705199c70c.lovable.app/app/integrations?pd=connected",
    error:
      "https://id-preview--0ce5e558-cbb1-4a64-8022-50705199c70c.lovable.app/app/integrations?pd=failed",
  },
);
const u = new URL(t.connect_link_url!);
u.searchParams.set("app", "facebook_pages");
u.searchParams.set("oauthScopeProfile", "admin");
console.log(u.toString());
process.exit(0);
