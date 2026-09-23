import { pipedreamConfig, proxyRequest, listAccounts } from "@/lib/pipedream.server";
const WS = "434b263e-2aa0-4fc6-9759-7cc2675d40e0";
const config = (await pipedreamConfig())!;
const accounts = await listAccounts(config, WS, "facebook_pages");
console.log(
  "accounts:",
  accounts.map((a) => ({ id: a.id, name: a.name, dead: (a as any).dead, healthy: a.healthy })),
);
for (const a of accounts) {
  try {
    const perms = await proxyRequest<any>(config, {
      workspaceId: WS,
      accountId: a.id,
      url: `https://graph.facebook.com/v23.0/me/permissions`,
    });
    console.log(a.id, JSON.stringify(perms?.data ?? perms).slice(0, 600));
    const pages = await proxyRequest<any>(config, {
      workspaceId: WS,
      accountId: a.id,
      url: `https://graph.facebook.com/v23.0/me/accounts?fields=id,name,tasks`,
    });
    console.log("pages", JSON.stringify(pages?.data ?? pages).slice(0, 600));
  } catch (e) {
    console.log(a.id, "ERR", String(e).slice(0, 300));
  }
}
process.exit(0);
