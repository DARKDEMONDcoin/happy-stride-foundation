/** يبني رابط الربط بنفس منطق التطبيق ويطبعه للفحص. */
import { pipedreamConfig, createConnectToken, pickScopeProfile } from "@/lib/pipedream.server";
import { pipedreamApp } from "@/data/pipedream-apps";

const WS = "434b263e-2aa0-4fc6-9759-7cc2675d40e0";
const config = (await pipedreamConfig())!;
const out: Record<string, unknown> = {};

for (const provider of ["facebook", "instagram", "linkedin", "x", "pinterest"]) {
  const app = pipedreamApp(provider);
  if (!app) {
    out[provider] = "no app mapping";
    continue;
  }
  const required: Record<string, string[]> = {
    facebook: ["pages_manage_posts", "pages_read_engagement", "pages_show_list"],
    instagram: ["instagram_content_publish"],
  };
  const profile = required[provider]
    ? await pickScopeProfile(config, app.slug, required[provider]!)
    : null;
  const token = await createConnectToken(config, WS, ["http://localhost:8080"]);
  out[provider] = { slug: app.slug, profile, link: token.connect_link_url };
}

console.log(JSON.stringify(out, null, 2));
process.exit(0);
