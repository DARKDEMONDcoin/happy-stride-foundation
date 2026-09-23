/**
 * «الأدلة الحيّة» من حسابات المستخدم المربوطة عبر Pipedream.
 *
 * المبدأ: قبل أن يكتب أي موظف مخرجاً، نقرأ واقع حسابات العلامة فعلياً
 * (بريد، تقويم، CRM، شيتس، صفحات التواصل) عبر وكيل Pipedream — بلا أي توكن لدينا —
 * ثم نمرّر ما قرأناه للموظف كسياق إلزامي. هذا ما يجعل المخرج «شغل حقيقي» لا نصاً عاماً.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { pipedreamApp } from "@/data/pipedream-apps";
import { pipedreamConfig, proxyRequest } from "./pipedream.server";
import {
  pageTarget,
  facebookComments,
  instagramComments,
  facebookMessages,
  inboxSummary,
} from "./social-inbox.server";
import { readPinterest, readTikTok } from "./social-extra.server";
import { metaAdsSummary } from "./ads-insights.server";
import { readDrive } from "./messaging-extra.server";

/** منشورات ميتا + صندوق التعليقات والرسائل غير المُجاب عليها. */
async function readMetaWithInbox(
  config: Config,
  workspaceId: string,
  accountId: string,
  provider: "facebook" | "instagram",
): Promise<string> {
  const posts = await readMeta(config, workspaceId, accountId, provider);
  try {
    const page = await pageTarget(config, workspaceId, accountId);
    if (!page) return posts;
    const [comments, messages] = await Promise.all([
      provider === "instagram"
        ? instagramComments(config, workspaceId, accountId, page)
        : facebookComments(config, workspaceId, accountId, page),
      provider === "facebook"
        ? facebookMessages(config, workspaceId, accountId, page)
        : Promise.resolve([]),
    ]);
    const inbox = inboxSummary(comments, messages);
    return inbox ? `${posts}\n\n${inbox}` : posts;
  } catch (error) {
    console.error("[live] social inbox failed:", error);
    return posts;
  }
}

type Admin = SupabaseClient<Database>;

export type LiveContext = { block: string; used: string[] };

const EMPTY: LiveContext = { block: "", used: [] };

/** المنصات التي يقرأ منها كل موظف سياقه الحيّ قبل التنفيذ. */
export const employeeReadProviders: Record<string, string[]> = {
  eva: ["gmail", "outlook", "calendar"],
  sam: ["hubspot", "gmail", "calendar"],
  sonny: ["instagram", "facebook", "pinterest", "tiktok"],
  adam: ["meta-ads"],
  dana: [],
  nour: [],
};

async function accountFor(
  admin: Admin,
  workspaceId: string,
  provider: string,
): Promise<string | null> {
  // limit(1) لا maybeSingle: مساحة العمل قد تربط أكثر من حساب لنفس المنصة،
  // وكان ذلك يُرجع خطأ «صفوف متعددة» يُبتلع فيظهر الموظف كأن المنصة غير مربوطة.
  const { data, error } = await admin
    .from("pipedream_accounts")
    .select("account_id")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .eq("status", "connected")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) {
    console.warn(`[live-context] ${provider} account lookup failed:`, error.message);
    return null;
  }
  return data?.[0]?.account_id ?? null;
}

/** يجمع سياقاً حيّاً موجزاً لكل منصات الموظف المربوطة (يتحمّل الفشل بصمت). */
export async function liveContextFor(
  admin: Admin,
  employeeId: string,
  workspaceId: string,
  limitMs = 12_000,
): Promise<LiveContext> {
  const providers = employeeReadProviders[employeeId] ?? [];
  if (!providers.length) return EMPTY;

  const config = await pipedreamConfig();
  if (!config) return EMPTY;

  const parts = await Promise.all(
    providers.map(async (provider) => {
      const accountId = await accountFor(admin, workspaceId, provider);
      if (!accountId) return null;
      try {
        const text = await withTimeout(
          readProvider(config, workspaceId, provider, accountId),
          limitMs,
        );
        return text ? { provider, text } : null;
      } catch (error) {
        console.error(`[live] ${provider} failed:`, error);
        return null;
      }
    }),
  );

  const ok = parts.filter(Boolean) as { provider: string; text: string }[];
  if (!ok.length) return EMPTY;

  return {
    block: ok
      .map((p) => `### ${pipedreamApp(p.provider)?.label ?? p.provider}\n${p.text}`)
      .join("\n\n"),
    used: ok.map((p) => pipedreamApp(p.provider)?.label ?? p.provider),
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

type Config = NonNullable<Awaited<ReturnType<typeof pipedreamConfig>>>;

async function readProvider(
  config: Config,
  workspaceId: string,
  provider: string,
  accountId: string,
): Promise<string> {
  switch (provider) {
    case "gmail":
      return readGmail(config, workspaceId, accountId);
    case "outlook":
      return readOutlook(config, workspaceId, accountId);
    case "calendar":
      return readCalendar(config, workspaceId, accountId);
    case "hubspot":
      return readHubspot(config, workspaceId, accountId);
    case "facebook":
    case "instagram":
      return readMetaWithInbox(config, workspaceId, accountId, provider);
    case "pinterest":
      return readPinterest(config, workspaceId, accountId);
    case "tiktok":
      return readTikTok(config, workspaceId, accountId);
    case "meta-ads":
      return metaAdsSummary(config, workspaceId, accountId);
    default:
      return "";
  }
}

/* ————— أوتلوك: رسائل غير مقروءة عبر Microsoft Graph ————— */

type GraphMessages = {
  value?: {
    subject?: string;
    bodyPreview?: string;
    receivedDateTime?: string;
    from?: { emailAddress?: { name?: string; address?: string } };
  }[];
};

async function readOutlook(
  config: Config,
  workspaceId: string,
  accountId: string,
): Promise<string> {
  const res = await proxyRequest<GraphMessages>(config, {
    workspaceId,
    accountId,
    url: "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=12&$filter=isRead eq false&$select=subject,bodyPreview,receivedDateTime,from",
  });
  const items = res.value ?? [];
  if (!items.length) return "لا رسائل غير مقروءة في أوتلوك.";
  return items
    .map(
      (m) =>
        `- من: ${m.from?.emailAddress?.name ?? m.from?.emailAddress?.address ?? "?"} | الموضوع: ${m.subject ?? "بلا عنوان"} | ${m.receivedDateTime ?? ""}\n  ${(m.bodyPreview ?? "").slice(0, 200)}`,
    )
    .join("\n");
}

/* ————— ميتا: آخر منشورات الصفحة / حساب إنستجرام ————— */

type MetaAccounts = {
  data?: { id: string; name?: string; instagram_business_account?: { id: string } }[];
};
type MetaPosts = {
  data?: {
    message?: string;
    caption?: string;
    created_time?: string;
    timestamp?: string;
    permalink?: string;
    like_count?: number;
    comments_count?: number;
  }[];
};

async function readMeta(
  config: Config,
  workspaceId: string,
  accountId: string,
  provider: "facebook" | "instagram",
): Promise<string> {
  const accounts = await proxyRequest<MetaAccounts>(config, {
    workspaceId,
    accountId,
    url: "https://graph.facebook.com/v23.0/me/accounts?fields=id,name,instagram_business_account&limit=5",
  });
  const page = accounts.data?.[0];
  if (!page) return "لا صفحة مرتبطة بالحساب.";

  const target = provider === "instagram" ? page.instagram_business_account?.id : page.id;
  if (!target) return "لا حساب إنستجرام احترافي مرتبط بالصفحة.";

  const url =
    provider === "instagram"
      ? `https://graph.facebook.com/v23.0/${target}/media?fields=caption,timestamp,permalink,like_count,comments_count&limit=10`
      : `https://graph.facebook.com/v23.0/${target}/posts?fields=message,created_time,permalink_url&limit=10`;

  const posts = await proxyRequest<MetaPosts>(config, { workspaceId, accountId, url });
  const items = posts.data ?? [];
  if (!items.length) return "لا منشورات حديثة.";
  return items
    .map(
      (p) =>
        `- ${p.timestamp ?? p.created_time ?? "?"} | ${(p.caption ?? p.message ?? "").slice(0, 160)}${
          p.like_count != null ? ` | إعجابات: ${p.like_count}` : ""
        }${p.comments_count != null ? ` | تعليقات: ${p.comments_count}` : ""}`,
    )
    .join("\n");
}

/* ————— جيميل: آخر الرسائل غير المقروءة في صندوق الوارد ————— */

type GmailList = { messages?: { id: string }[] };
type GmailMessage = {
  snippet?: string;
  payload?: { headers?: { name: string; value: string }[] };
};

async function readGmail(config: Config, workspaceId: string, accountId: string): Promise<string> {
  const list = await proxyRequest<GmailList>(config, {
    workspaceId,
    accountId,
    url: "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=12&q=is:unread in:inbox newer_than:3d",
  });
  const ids = (list.messages ?? []).slice(0, 12).map((m) => m.id);
  if (!ids.length) return "لا رسائل غير مقروءة في آخر ٣ أيام.";

  const rows = await Promise.all(
    ids.map(async (id) => {
      try {
        const msg = await proxyRequest<GmailMessage>(config, {
          workspaceId,
          accountId,
          url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        });
        const head = (name: string) =>
          msg.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? "";
        return `- من: ${head("from")} | الموضوع: ${head("subject")} | ${head("date")}\n  ${(msg.snippet ?? "").slice(0, 200)}`;
      } catch {
        return null;
      }
    }),
  );
  return rows.filter(Boolean).join("\n") || "تعذّرت قراءة تفاصيل الرسائل.";
}

/* ————— تقويم جوجل: مواعيد الأيام السبعة القادمة ————— */

type CalendarList = {
  items?: {
    summary?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    attendees?: { email?: string }[];
    location?: string;
  }[];
};

async function readCalendar(
  config: Config,
  workspaceId: string,
  accountId: string,
): Promise<string> {
  const now = new Date();
  const week = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const url =
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?" +
    new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: week.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "25",
    }).toString();

  const res = await proxyRequest<CalendarList>(config, { workspaceId, accountId, url });
  const items = res.items ?? [];
  if (!items.length) return "لا مواعيد في الأيام السبعة القادمة.";
  return items
    .map(
      (e) =>
        `- ${e.start?.dateTime ?? e.start?.date ?? "?"} → ${e.end?.dateTime ?? e.end?.date ?? "?"} | ${e.summary ?? "بلا عنوان"}${
          e.attendees?.length ? ` | حضور: ${e.attendees.length}` : ""
        }${e.location ? ` | ${e.location}` : ""}`,
    )
    .join("\n");
}

/* ————— هابسبوت: أحدث الصفقات وجهات الاتصال ————— */

type HubspotDeals = {
  results?: { properties?: Record<string, string | null> }[];
};

async function readHubspot(
  config: Config,
  workspaceId: string,
  accountId: string,
): Promise<string> {
  const [deals, contacts] = await Promise.all([
    proxyRequest<HubspotDeals>(config, {
      workspaceId,
      accountId,
      url: "https://api.hubapi.com/crm/v3/objects/deals?limit=15&sorts=-hs_lastmodifieddate&properties=dealname,amount,dealstage,closedate",
    }).catch(() => ({ results: [] }) as HubspotDeals),
    proxyRequest<HubspotDeals>(config, {
      workspaceId,
      accountId,
      url: "https://api.hubapi.com/crm/v3/objects/contacts?limit=15&properties=firstname,lastname,email,company,lifecyclestage",
    }).catch(() => ({ results: [] }) as HubspotDeals),
  ]);

  const dealLines = (deals.results ?? []).map((d) => {
    const p = d.properties ?? {};
    return `- صفقة: ${p["dealname"] ?? "?"} | مرحلة: ${p["dealstage"] ?? "?"} | قيمة: ${p["amount"] ?? "-"} | إغلاق: ${p["closedate"] ?? "-"}`;
  });
  const contactLines = (contacts.results ?? []).map((c) => {
    const p = c.properties ?? {};
    return `- جهة اتصال: ${[p["firstname"], p["lastname"]].filter(Boolean).join(" ") || p["email"] || "?"} | ${p["company"] ?? "-"} | ${p["lifecyclestage"] ?? "-"}`;
  });

  const all = [...dealLines, ...contactLines];
  return all.length ? all.join("\n") : "لا بيانات CRM متاحة حالياً.";
}
