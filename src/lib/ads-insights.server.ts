/**
 * قراءة أداء الحملات الإعلانية عبر وكيل Pipedream — بلا أي توكن لدينا.
 * ميتا (فيسبوك/إنستجرام) عبر Marketing API.
 */
import { proxyRequest, type PipedreamConfig } from "./pipedream.server";

type AdAccounts = { data?: { id: string; name?: string; currency?: string }[] };
type Insights = {
  data?: {
    campaign_name?: string;
    spend?: string;
    impressions?: string;
    clicks?: string;
    ctr?: string;
    cpc?: string;
    actions?: { action_type: string; value: string }[];
  }[];
};

/** ملخص أداء آخر ٣٠ يوماً لحملات ميتا. */
export async function metaAdsSummary(
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
): Promise<string> {
  const accounts = await proxyRequest<AdAccounts>(config, {
    workspaceId,
    accountId,
    url: "https://graph.facebook.com/v23.0/me/adaccounts?fields=id,name,currency&limit=5",
  });
  const act = accounts.data?.[0];
  if (!act) return "لا حساب إعلاني مرتبط.";

  const url =
    `https://graph.facebook.com/v23.0/${act.id}/insights?` +
    new URLSearchParams({
      level: "campaign",
      date_preset: "last_30d",
      fields: "campaign_name,spend,impressions,clicks,ctr,cpc,actions",
      limit: "15",
    }).toString();

  const res = await proxyRequest<Insights>(config, { workspaceId, accountId, url });
  const rows = res.data ?? [];
  if (!rows.length) return `الحساب الإعلاني ${act.name ?? act.id}: لا بيانات في آخر ٣٠ يوماً.`;

  const lines = rows.map((r) => {
    const leads =
      r.actions?.find((a) => a.action_type === "lead" || a.action_type === "purchase")?.value ??
      "-";
    return `- ${r.campaign_name ?? "?"} | صرف: ${r.spend ?? "-"} ${act.currency ?? ""} | ظهور: ${r.impressions ?? "-"} | نقرات: ${r.clicks ?? "-"} | CTR: ${r.ctr ?? "-"} | CPC: ${r.cpc ?? "-"} | تحويلات: ${leads}`;
  });
  return `الحساب: ${act.name ?? act.id}\n${lines.join("\n")}`;
}
