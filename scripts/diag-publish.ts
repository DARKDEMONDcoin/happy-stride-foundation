/**
 * تشخيص حيّ لمسار النشر عبر Pipedream — قراءة فقط + محاولة نشر اختيارية.
 * التشغيل: bun run scripts/diag-publish.ts [--publish]
 */
import { pipedreamConfig, listAccounts, proxyRequest } from "@/lib/pipedream.server";

const WS = process.env["DIAG_WS"] ?? "434b263e-2aa0-4fc6-9759-7cc2675d40e0";
const GRAPH = "https://graph.facebook.com/v21.0";
const out: Record<string, unknown> = {};

const config = await pipedreamConfig();
if (!config) throw new Error("no pipedream config");
out["env"] = config.environment;
out["projectId"] = config.projectId;

const accounts = await listAccounts(config, WS);
out["accounts"] = accounts.map((a) => ({
  id: a.id,
  name: a.name,
  healthy: a.healthy,
  dead: a.dead,
  app: typeof a.app === "string" ? a.app : a.app?.name_slug,
}));

const fb = accounts.find((a) =>
  (typeof a.app === "string" ? a.app : a.app?.name_slug)?.includes("facebook"),
);
out["fbAccount"] = fb?.id ?? null;

if (fb) {
  try {
    const perms = await proxyRequest<{ data?: { permission: string; status: string }[] }>(config, {
      workspaceId: WS,
      accountId: fb.id,
      url: `${GRAPH}/me/permissions`,
    });
    out["permissions"] = (perms.data ?? []).map((p) => `${p.permission}:${p.status}`);
  } catch (e) {
    out["permissions_error"] = String(e);
  }

  try {
    const pages = await proxyRequest<{
      data?: {
        id: string;
        name?: string;
        access_token?: string;
        instagram_business_account?: { id: string };
      }[];
    }>(config, {
      workspaceId: WS,
      accountId: fb.id,
      url: `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account&limit=10`,
    });
    out["pages"] = (pages.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      hasToken: Boolean(p.access_token),
      ig: p.instagram_business_account?.id ?? null,
    }));

    const page = pages.data?.[0];
    if (page?.access_token && process.argv.includes("--publish")) {
      const res = await proxyRequest<unknown>(config, {
        workspaceId: WS,
        accountId: fb.id,
        method: "POST",
        url: `${GRAPH}/${page.id}/feed?${new URLSearchParams({
          message: `اختبار نشر سِراج — ${new Date().toISOString()}`,
          access_token: page.access_token,
        }).toString()}`,
      });
      out["publish"] = res;
    }
  } catch (e) {
    out["pages_error"] = String(e);
  }
}

console.log(JSON.stringify(out, null, 2));
process.exit(0);
