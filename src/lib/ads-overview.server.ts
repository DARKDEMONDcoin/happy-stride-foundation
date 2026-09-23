/**
 * ملخّص مُهيكل لأداء حملات ميتا (آخر ٣٠ يوماً) لعرضه في نظرة عامة.
 * لا أرقام مُختلقة: كل قيمة تأتي من Marketing API عبر وكيل Pipedream.
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
    actions?: { action_type: string; value: string }[];
  }[];
};

export type AdsCampaign = {
  name: string;
  spend: number;
  clicks: number;
  ctr: number;
  conversions: number;
};

export type AdsOverview = {
  account: string;
  currency: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  campaigns: AdsCampaign[];
};

const num = (v?: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const conversionsOf = (actions?: { action_type: string; value: string }[]) =>
  (actions ?? [])
    .filter((a) => a.action_type === "lead" || a.action_type.includes("purchase"))
    .reduce((sum, a) => sum + num(a.value), 0);

export async function metaAdsOverview(
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
): Promise<AdsOverview | null> {
  const accounts = await proxyRequest<AdAccounts>(config, {
    workspaceId,
    accountId,
    url: "https://graph.facebook.com/v23.0/me/adaccounts?fields=id,name,currency&limit=5",
  });
  const act = accounts.data?.[0];
  if (!act) return null;

  const url =
    `https://graph.facebook.com/v23.0/${act.id}/insights?` +
    new URLSearchParams({
      level: "campaign",
      date_preset: "last_30d",
      fields: "campaign_name,spend,impressions,clicks,ctr,actions",
      limit: "25",
    }).toString();

  const res = await proxyRequest<Insights>(config, { workspaceId, accountId, url });
  const rows = res.data ?? [];
  if (!rows.length) return null;

  const campaigns: AdsCampaign[] = rows.map((r) => ({
    name: r.campaign_name ?? "حملة",
    spend: num(r.spend),
    clicks: num(r.clicks),
    ctr: num(r.ctr),
    conversions: conversionsOf(r.actions),
  }));

  const spend = campaigns.reduce((s, c) => s + c.spend, 0);
  const clicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const conversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const impressions = rows.reduce((s, r) => s + num(r.impressions), 0);

  return {
    account: act.name ?? act.id,
    currency: act.currency ?? "",
    spend,
    impressions,
    clicks,
    ctr: impressions ? (clicks / impressions) * 100 : 0,
    conversions,
    campaigns: campaigns.sort((a, b) => b.spend - a.spend).slice(0, 3),
  };
}
