/**
 * إجراءات إضافية عالية القيمة لكل منصة — تنفيذ مباشر على واجهة المنصة عبر وكيل Pipedream.
 *
 * الهدف: تغطية كل ما يحتاجه الموظف الرقمي فعلياً في كل تطبيق (نشر ريلز وستوري،
 * الرد داخل خط البريد، تسجيل الأنشطة في الـCRM، إدارة الحملات، تحديث المهام…)
 * وليس مجرد «إنشاء عنصر». لا يمرّ أي توكن على خوادمنا.
 */
import {
  api,
  v,
  opt,
  list,
  base64Url,
  mimeHeader,
  mailHeader,
  mimeBody,
  salesforceInstance,
  mailchimpBase,
  pipedriveBase,
  sheetTitle,
  type DirectContext,
} from "./direct-actions.server";
import { pageTarget, type PageTarget } from "./social-inbox.server";
import { whatsappPhoneId } from "./messaging-extra.server";

const GRAPH = "https://graph.facebook.com/v23.0";
const NOTION = { "notion-version": "2022-06-28" };
const LI = { "linkedin-version": "202401", "x-restli-protocol-version": "2.0.0" };

/* ————— مساعدات ————— */

async function page(ctx: DirectContext): Promise<PageTarget> {
  const target = await pageTarget(ctx.config, ctx.workspaceId, ctx.accountId);
  if (!target) throw new Error("لم يُعثر على صفحة فيسبوك مرتبطة بالحساب المربوط.");
  return target;
}

async function igUser(ctx: DirectContext): Promise<PageTarget & { igId: string }> {
  const target = await page(ctx);
  if (!target.igId) throw new Error("لا يوجد حساب إنستجرام احترافي مرتبط بالصفحة.");
  return target as PageTarget & { igId: string };
}

async function linkedinAuthor(ctx: DirectContext): Promise<string> {
  const org = opt(ctx, "organizationId");
  if (org) return `urn:li:organization:${org.replace(/^urn:li:organization:/, "")}`;
  const me = await api<{ sub?: string }>(ctx, "https://api.linkedin.com/v2/userinfo");
  if (!me.sub) throw new Error("تعذّر تحديد حساب لينكدإن.");
  return `urn:li:person:${me.sub}`;
}

async function twilioSid(ctx: DirectContext): Promise<string> {
  const explicit = opt(ctx, "accountSid");
  if (explicit) return explicit;
  const res = await api<{ accounts?: { sid?: string }[]; sid?: string }>(
    ctx,
    "https://api.twilio.com/2010-04-01/Accounts.json",
  );
  const sid = res.accounts?.[0]?.sid ?? res.sid;
  if (!sid) throw new Error("تعذّر تحديد حساب تويليو.");
  return sid;
}

/** نشر وسائط إنستجرام: إنشاء الحاوية ثم النشر. */
async function igPublish(
  ctx: DirectContext,
  igId: string,
  token: string,
  params: Record<string, string>,
): Promise<unknown> {
  const query = new URLSearchParams({ ...params, access_token: token }).toString();
  const container = await api<{ id?: string }>(ctx, `${GRAPH}/${igId}/media?${query}`, {
    method: "POST",
    text: "",
  });
  if (!container.id) throw new Error("تعذّر تجهيز الوسائط في إنستجرام.");
  return api(
    ctx,
    `${GRAPH}/${igId}/media_publish?creation_id=${container.id}&access_token=${encodeURIComponent(token)}`,
    { method: "POST", text: "" },
  );
}

/** رسالة بريد خام مع ترويسات الرد داخل نفس الخط. */
function replyRaw(params: {
  to: string;
  subject: string;
  body: string;
  messageId?: string;
}): string {
  const lines = [
    `To: ${mailHeader(params.to)}`,
    `Subject: ${mimeHeader(params.subject)}`,
    ...(params.messageId
      ? [
          `In-Reply-To: ${mailHeader(params.messageId)}`,
          `References: ${mailHeader(params.messageId)}`,
        ]
      : []),
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    mimeBody(params.body),
  ];
  return base64Url(lines.join("\r\n"));
}

function notionText(content: string) {
  return [{ type: "text", text: { content } }];
}

/* ————— السجل ————— */

export const extraDirectActions: Record<string, (ctx: DirectContext) => Promise<unknown>> = {
  /* ===== البريد والتقويم (أمَل) ===== */
  "eva-gmail-reply": async (ctx) => {
    const id = v(ctx, "messageId");
    const msg = await api<{
      threadId?: string;
      payload?: { headers?: { name: string; value: string }[] };
    }>(
      ctx,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Message-ID`,
    );
    const headers = msg.payload?.headers ?? [];
    const head = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
    const from = head("From");
    const subject = head("Subject");
    return api(ctx, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      json: {
        ...(msg.threadId ? { threadId: msg.threadId } : {}),
        raw: replyRaw({
          to: opt(ctx, "to") ?? from,
          subject: subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`,
          body: v(ctx, "body"),
          ...(head("Message-ID") ? { messageId: head("Message-ID") } : {}),
        }),
      },
    });
  },
  "eva-gmail-label": (ctx) =>
    api(
      ctx,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(v(ctx, "messageId"))}/modify`,
      {
        json: {
          addLabelIds: list(ctx, "addLabelIds"),
          removeLabelIds: list(ctx, "removeLabelIds"),
        },
      },
    ),
  "eva-gmail-search": (ctx) =>
    api(
      ctx,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(v(ctx, "query"))}&maxResults=${Math.max(1, Math.min(50, Number(v(ctx, "max") || "10") || 10))}`,
    ),
  "eva-outlook-reply": (ctx) =>
    api(
      ctx,
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(v(ctx, "messageId"))}/reply`,
      { json: { comment: v(ctx, "comment") } },
    ),
  "eva-outlook-draft": (ctx) =>
    api(ctx, "https://graph.microsoft.com/v1.0/me/messages", {
      json: {
        subject: v(ctx, "subject"),
        body: { contentType: "Text", content: v(ctx, "body") },
        toRecipients: list(ctx, "to").map((address) => ({ emailAddress: { address } })),
      },
    }),
  "eva-calendar-update": (ctx) =>
    api(
      ctx,
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(v(ctx, "eventId"))}?sendUpdates=all`,
      {
        method: "PATCH",
        json: {
          ...(opt(ctx, "summary") ? { summary: v(ctx, "summary") } : {}),
          ...(opt(ctx, "start") ? { start: { dateTime: v(ctx, "start") } } : {}),
          ...(opt(ctx, "end") ? { end: { dateTime: v(ctx, "end") } } : {}),
        },
      },
    ),
  "eva-calendar-cancel": (ctx) =>
    api(
      ctx,
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(v(ctx, "eventId"))}?sendUpdates=all`,
      { method: "DELETE" },
    ),
  "eva-calendar-freebusy": (ctx) =>
    api(ctx, "https://www.googleapis.com/calendar/v3/freeBusy", {
      json: {
        timeMin: v(ctx, "timeMin"),
        timeMax: v(ctx, "timeMax"),
        items: (list(ctx, "calendars").length ? list(ctx, "calendars") : ["primary"]).map((id) => ({
          id,
        })),
      },
    }),
  "eva-zoom-recordings": (ctx) =>
    api(
      ctx,
      `https://api.zoom.us/v2/meetings/${encodeURIComponent(v(ctx, "meetingId"))}/recordings`,
    ),
  "eva-whatsapp-media": async (ctx) => {
    const phoneId =
      opt(ctx, "phoneNumberId") ??
      (await whatsappPhoneId(ctx.config, ctx.workspaceId, ctx.accountId));
    if (!phoneId) throw new Error("تعذّر تحديد رقم واتساب للأعمال المرتبط بالحساب.");
    const kind = (opt(ctx, "type") ?? "image").toLowerCase();
    const media: Record<string, string> = { link: v(ctx, "link") };
    if (opt(ctx, "caption")) media["caption"] = v(ctx, "caption");
    return api(ctx, `${GRAPH}/${phoneId}/messages`, {
      json: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: v(ctx, "to"),
        type: kind,
        [kind]: media,
      },
    });
  },

  /* ===== نوشن (أمَل والفريق) ===== */
  "team-notion-append": (ctx) =>
    api(ctx, `https://api.notion.com/v1/blocks/${encodeURIComponent(v(ctx, "blockId"))}/children`, {
      method: "PATCH",
      json: {
        children: v(ctx, "content")
          .split("\n")
          .filter((line) => line.trim())
          .map((line) => ({
            object: "block",
            type: "paragraph",
            paragraph: { rich_text: notionText(line) },
          })),
      },
      headers: NOTION,
    }),
  "team-notion-query": (ctx) =>
    api(
      ctx,
      `https://api.notion.com/v1/databases/${encodeURIComponent(v(ctx, "databaseId"))}/query`,
      {
        json: { page_size: Math.max(1, Math.min(100, Number(v(ctx, "pageSize") || "20") || 20)) },
        headers: NOTION,
      },
    ),
  "team-notion-db-item": (ctx) =>
    api(ctx, "https://api.notion.com/v1/pages", {
      json: {
        parent: { database_id: v(ctx, "databaseId") },
        properties: {
          [opt(ctx, "titleProperty") ?? "Name"]: { title: notionText(v(ctx, "title")) },
        },
        ...(opt(ctx, "content")
          ? {
              children: [
                {
                  object: "block",
                  type: "paragraph",
                  paragraph: { rich_text: notionText(v(ctx, "content")) },
                },
              ],
            }
          : {}),
      },
      headers: NOTION,
    }),

  /* ===== لينكدإن (سِراج) ===== */
  "sonny-linkedin-post": async (ctx) => {
    const author = await linkedinAuthor(ctx);
    return api(ctx, "https://api.linkedin.com/rest/posts", {
      json: {
        author,
        commentary: v(ctx, "text"),
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      },
      headers: LI,
    });
  },
  "sonny-linkedin-article": async (ctx) => {
    const author = await linkedinAuthor(ctx);
    return api(ctx, "https://api.linkedin.com/rest/posts", {
      json: {
        author,
        commentary: v(ctx, "text"),
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        content: {
          article: {
            source: v(ctx, "url"),
            title: v(ctx, "title"),
            ...(opt(ctx, "description") ? { description: v(ctx, "description") } : {}),
          },
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      },
      headers: LI,
    });
  },
  "sonny-linkedin-stats": (ctx) =>
    api(
      ctx,
      `https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(`urn:li:organization:${v(ctx, "organizationId")}`)}`,
      { headers: LI },
    ),

  /* ===== إكس (سِراج) ===== */
  "sonny-x-post": (ctx) =>
    api(ctx, "https://api.twitter.com/2/tweets", { json: { text: v(ctx, "text") } }),
  "sonny-x-reply": (ctx) =>
    api(ctx, "https://api.twitter.com/2/tweets", {
      json: { text: v(ctx, "text"), reply: { in_reply_to_tweet_id: v(ctx, "tweetId") } },
    }),
  "sonny-x-dm": (ctx) =>
    api(
      ctx,
      `https://api.twitter.com/2/dm_conversations/with/${encodeURIComponent(v(ctx, "userId"))}/messages`,
      { json: { text: v(ctx, "text") } },
    ),
  "sonny-x-search": (ctx) =>
    api(
      ctx,
      `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(v(ctx, "query"))}&max_results=${Math.max(10, Math.min(100, Number(v(ctx, "max") || "10") || 10))}&tweet.fields=public_metrics,created_at`,
    ),

  /* ===== إنستجرام (سِراج) ===== */
  "sonny-ig-photo": async (ctx) => {
    const target = await igUser(ctx);
    return igPublish(ctx, target.igId, target.token, {
      image_url: v(ctx, "imageUrl"),
      ...(opt(ctx, "caption") ? { caption: v(ctx, "caption") } : {}),
    });
  },
  "sonny-ig-reel": async (ctx) => {
    const target = await igUser(ctx);
    return igPublish(ctx, target.igId, target.token, {
      media_type: "REELS",
      video_url: v(ctx, "videoUrl"),
      ...(opt(ctx, "caption") ? { caption: v(ctx, "caption") } : {}),
      ...(opt(ctx, "coverUrl") ? { thumb_offset: "0" } : {}),
    });
  },
  "sonny-ig-story": async (ctx) => {
    const target = await igUser(ctx);
    const imageUrl = opt(ctx, "imageUrl");
    return igPublish(ctx, target.igId, target.token, {
      media_type: "STORIES",
      ...(imageUrl ? { image_url: imageUrl } : { video_url: v(ctx, "videoUrl") }),
    });
  },
  "sonny-ig-carousel": async (ctx) => {
    const target = await igUser(ctx);
    const urls = list(ctx, "imageUrls");
    if (urls.length < 2) throw new Error("الكاروسيل يحتاج صورتين على الأقل.");
    const children: string[] = [];
    for (const url of urls.slice(0, 10)) {
      const query = new URLSearchParams({
        image_url: url,
        is_carousel_item: "true",
        access_token: target.token,
      }).toString();
      const child = await api<{ id?: string }>(ctx, `${GRAPH}/${target.igId}/media?${query}`, {
        method: "POST",
        text: "",
      });
      if (!child.id) throw new Error("تعذّر تجهيز إحدى صور الكاروسيل.");
      children.push(child.id);
    }
    return igPublish(ctx, target.igId, target.token, {
      media_type: "CAROUSEL",
      children: children.join(","),
      ...(opt(ctx, "caption") ? { caption: v(ctx, "caption") } : {}),
    });
  },
  "sonny-ig-insights": async (ctx) => {
    const target = await igUser(ctx);
    const mediaId = opt(ctx, "mediaId");
    const url = mediaId
      ? `${GRAPH}/${mediaId}/insights?metric=reach,likes,comments,saved,shares&access_token=${encodeURIComponent(target.token)}`
      : `${GRAPH}/${target.igId}/insights?metric=reach,follower_count&period=day&metric_type=total_value&access_token=${encodeURIComponent(target.token)}`;
    return api(ctx, url);
  },
  "sonny-ig-dm": async (ctx) => {
    const target = await igUser(ctx);
    return api(
      ctx,
      `${GRAPH}/${target.igId}/messages?access_token=${encodeURIComponent(target.token)}`,
      { json: { recipient: { id: v(ctx, "recipientId") }, message: { text: v(ctx, "text") } } },
    );
  },

  /* ===== فيسبوك (سِراج) ===== */
  "sonny-fb-post": async (ctx) => {
    const target = await page(ctx);
    return api(ctx, `${GRAPH}/${target.id}/feed`, {
      json: {
        message: v(ctx, "message"),
        ...(opt(ctx, "link") ? { link: v(ctx, "link") } : {}),
        access_token: target.token,
      },
    });
  },
  "sonny-fb-photo": async (ctx) => {
    const target = await page(ctx);
    return api(ctx, `${GRAPH}/${target.id}/photos`, {
      json: {
        url: v(ctx, "imageUrl"),
        ...(opt(ctx, "caption") ? { caption: v(ctx, "caption") } : {}),
        access_token: target.token,
      },
    });
  },
  "sonny-fb-insights": async (ctx) => {
    const target = await page(ctx);
    return api(
      ctx,
      `${GRAPH}/${target.id}/insights?metric=page_impressions,page_post_engagements,page_fans&period=${opt(ctx, "period") ?? "week"}&access_token=${encodeURIComponent(target.token)}`,
    );
  },

  /* ===== يوتيوب وتيك توك وبينترست (سِراج) ===== */
  "sonny-youtube-update": (ctx) =>
    api(ctx, "https://www.googleapis.com/youtube/v3/videos?part=snippet", {
      method: "PUT",
      json: {
        id: v(ctx, "videoId"),
        snippet: {
          title: v(ctx, "title"),
          categoryId: opt(ctx, "categoryId") ?? "22",
          ...(opt(ctx, "description") ? { description: v(ctx, "description") } : {}),
          ...(list(ctx, "tags").length ? { tags: list(ctx, "tags") } : {}),
        },
      },
    }),
  "sonny-youtube-comment": (ctx) =>
    api(ctx, "https://www.googleapis.com/youtube/v3/comments?part=snippet", {
      json: { snippet: { parentId: v(ctx, "parentId"), textOriginal: v(ctx, "text") } },
    }),
  "sonny-youtube-analytics": (ctx) => {
    const days = Math.max(1, Math.min(365, Number(v(ctx, "days") || "28") || 28));
    const end = new Date();
    const start = new Date(end.getTime() - days * 86_400_000);
    return api(
      ctx,
      `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel%3D%3DMINE&startDate=${start.toISOString().slice(0, 10)}&endDate=${end.toISOString().slice(0, 10)}&metrics=views,estimatedMinutesWatched,likes,subscribersGained`,
    );
  },
  "sonny-tiktok-publish": (ctx) =>
    api(ctx, "https://open.tiktokapis.com/v2/post/publish/video/init/", {
      json: {
        post_info: {
          title: v(ctx, "title"),
          privacy_level: opt(ctx, "privacy") ?? "SELF_ONLY",
          disable_comment: false,
        },
        source_info: { source: "PULL_FROM_URL", video_url: v(ctx, "videoUrl") },
      },
    }),
  "sonny-tiktok-status": (ctx) =>
    api(ctx, "https://open.tiktokapis.com/v2/post/publish/status/fetch/", {
      json: { publish_id: v(ctx, "publishId") },
    }),
  "sonny-pinterest-board": (ctx) =>
    api(ctx, "https://api.pinterest.com/v5/boards", {
      json: {
        name: v(ctx, "name"),
        ...(opt(ctx, "description") ? { description: v(ctx, "description") } : {}),
      },
    }),
  "sonny-pinterest-analytics": (ctx) => {
    const days = Math.max(1, Math.min(90, Number(v(ctx, "days") || "30") || 30));
    const end = new Date();
    const start = new Date(end.getTime() - days * 86_400_000);
    return api(
      ctx,
      `https://api.pinterest.com/v5/user_account/analytics?start_date=${start.toISOString().slice(0, 10)}&end_date=${end.toISOString().slice(0, 10)}&metric_types=IMPRESSION,ENGAGEMENT,PIN_CLICK`,
    );
  },
  "sonny-reddit-comment": (ctx) =>
    api(ctx, "https://oauth.reddit.com/api/comment", {
      form: { thing_id: v(ctx, "thingId"), text: v(ctx, "text"), api_type: "json" },
    }),
  "sonny-bluesky-reply": async (ctx) => {
    const session = await api<{ did?: string }>(
      ctx,
      "https://bsky.social/xrpc/com.atproto.server.getSession",
    );
    if (!session.did) throw new Error("تعذّر تحديد حساب بلوسكاي.");
    const root = { uri: v(ctx, "rootUri"), cid: v(ctx, "rootCid") };
    const parent = opt(ctx, "parentUri")
      ? { uri: v(ctx, "parentUri"), cid: opt(ctx, "parentCid") ?? root.cid }
      : root;
    return api(ctx, "https://bsky.social/xrpc/com.atproto.repo.createRecord", {
      json: {
        repo: session.did,
        collection: "app.bsky.feed.post",
        record: {
          text: v(ctx, "text"),
          createdAt: new Date().toISOString(),
          reply: { root, parent },
        },
      },
    });
  },
  "sonny-gbp-answer": (ctx) =>
    api(ctx, `https://mybusinessqanda.googleapis.com/v1/${v(ctx, "question")}/answers:upsert`, {
      json: { answer: { text: v(ctx, "text") } },
    }),

  /* ===== المبيعات والـCRM (سالم) ===== */
  "sam-hubspot-note": (ctx) =>
    api(ctx, "https://api.hubapi.com/crm/v3/objects/notes", {
      json: {
        properties: { hs_note_body: v(ctx, "body"), hs_timestamp: new Date().toISOString() },
        ...(opt(ctx, "contactId")
          ? {
              associations: [
                {
                  to: { id: v(ctx, "contactId") },
                  types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
                },
              ],
            }
          : {}),
      },
    }),
  "sam-hubspot-task": (ctx) =>
    api(ctx, "https://api.hubapi.com/crm/v3/objects/tasks", {
      json: {
        properties: {
          hs_task_subject: v(ctx, "subject"),
          hs_task_status: opt(ctx, "status") ?? "NOT_STARTED",
          hs_task_priority: opt(ctx, "priority") ?? "MEDIUM",
          hs_timestamp: opt(ctx, "dueAt") ?? new Date(Date.now() + 86_400_000).toISOString(),
          ...(opt(ctx, "body") ? { hs_task_body: v(ctx, "body") } : {}),
        },
      },
    }),
  "sam-hubspot-search": (ctx) =>
    api(ctx, "https://api.hubapi.com/crm/v3/objects/contacts/search", {
      json: {
        query: v(ctx, "query"),
        limit: Math.max(1, Math.min(50, Number(v(ctx, "limit") || "10") || 10)),
        properties: ["email", "firstname", "lastname", "company", "phone"],
      },
    }),
  "sam-sf-opportunity": async (ctx) => {
    const base = await salesforceInstance(ctx);
    return api(ctx, `${base}/services/data/v60.0/sobjects/Opportunity`, {
      json: {
        Name: v(ctx, "Name"),
        StageName: opt(ctx, "StageName") ?? "Prospecting",
        CloseDate: v(ctx, "CloseDate"),
        ...(opt(ctx, "Amount") ? { Amount: Number(v(ctx, "Amount")) || 0 } : {}),
        ...(opt(ctx, "AccountId") ? { AccountId: v(ctx, "AccountId") } : {}),
      },
    });
  },
  "sam-sf-task": async (ctx) => {
    const base = await salesforceInstance(ctx);
    return api(ctx, `${base}/services/data/v60.0/sobjects/Task`, {
      json: {
        Subject: v(ctx, "Subject"),
        Status: opt(ctx, "Status") ?? "Not Started",
        ...(opt(ctx, "ActivityDate") ? { ActivityDate: v(ctx, "ActivityDate") } : {}),
        ...(opt(ctx, "WhoId") ? { WhoId: v(ctx, "WhoId") } : {}),
        ...(opt(ctx, "Description") ? { Description: v(ctx, "Description") } : {}),
      },
    });
  },
  "sam-sf-query": async (ctx) => {
    const base = await salesforceInstance(ctx);
    return api(ctx, `${base}/services/data/v60.0/query?q=${encodeURIComponent(v(ctx, "soql"))}`);
  },
  "sam-mailchimp-campaign": async (ctx) => {
    const base = await mailchimpBase(ctx);
    const campaign = await api<{ id?: string }>(ctx, `${base}/3.0/campaigns`, {
      json: {
        type: "regular",
        recipients: { list_id: v(ctx, "listId") },
        settings: {
          subject_line: v(ctx, "subject"),
          title: opt(ctx, "title") ?? v(ctx, "subject"),
          from_name: v(ctx, "fromName"),
          reply_to: v(ctx, "replyTo"),
        },
      },
    });
    if (!campaign.id) throw new Error("تعذّر إنشاء الحملة في ميلتشمب.");
    await api(ctx, `${base}/3.0/campaigns/${campaign.id}/content`, {
      method: "PUT",
      json: { html: `<div dir="rtl">${v(ctx, "html")}</div>` },
    });
    return { campaignId: campaign.id };
  },
  "sam-mailchimp-send": async (ctx) => {
    const base = await mailchimpBase(ctx);
    return api(
      ctx,
      `${base}/3.0/campaigns/${encodeURIComponent(v(ctx, "campaignId"))}/actions/send`,
      { method: "POST", text: "" },
    );
  },
  "sam-mailchimp-tag": async (ctx) => {
    const base = await mailchimpBase(ctx);
    const hash = await api<{ members?: { id?: string }[] }>(
      ctx,
      `${base}/3.0/lists/${encodeURIComponent(v(ctx, "listId"))}/members?fields=members.id&count=1&unique_email_id=&email_address=${encodeURIComponent(v(ctx, "email").toLowerCase())}`,
    ).catch(() => ({ members: [] as { id?: string }[] }));
    const memberId = hash.members?.[0]?.id;
    if (!memberId) throw new Error("لم يُعثر على المشترك في هذه القائمة.");
    return api(
      ctx,
      `${base}/3.0/lists/${encodeURIComponent(v(ctx, "listId"))}/members/${memberId}/tags`,
      {
        method: "POST",
        json: { tags: list(ctx, "tags").map((name) => ({ name, status: "active" })) },
      },
    );
  },
  "sam-pipedrive-activity": async (ctx) => {
    const base = await pipedriveBase(ctx);
    return api(ctx, `${base}/activities`, {
      json: {
        subject: v(ctx, "subject"),
        type: opt(ctx, "type") ?? "call",
        ...(opt(ctx, "dueDate") ? { due_date: v(ctx, "dueDate") } : {}),
        ...(opt(ctx, "dealId") ? { deal_id: Number(v(ctx, "dealId")) } : {}),
        ...(opt(ctx, "personId") ? { person_id: Number(v(ctx, "personId")) } : {}),
      },
    });
  },
  "sam-pipedrive-note": async (ctx) => {
    const base = await pipedriveBase(ctx);
    return api(ctx, `${base}/notes`, {
      json: {
        content: v(ctx, "content"),
        ...(opt(ctx, "dealId") ? { deal_id: Number(v(ctx, "dealId")) } : {}),
        ...(opt(ctx, "personId") ? { person_id: Number(v(ctx, "personId")) } : {}),
      },
    });
  },
  "sam-intercom-contact": (ctx) =>
    api(ctx, "https://api.intercom.io/contacts", {
      json: {
        role: opt(ctx, "role") ?? "user",
        email: v(ctx, "email"),
        ...(opt(ctx, "name") ? { name: v(ctx, "name") } : {}),
        ...(opt(ctx, "phone") ? { phone: v(ctx, "phone") } : {}),
      },
      headers: { "intercom-version": "2.11" },
    }),
  "sam-intercom-reply": (ctx) =>
    api(
      ctx,
      `https://api.intercom.io/conversations/${encodeURIComponent(v(ctx, "conversationId"))}/reply`,
      {
        json: {
          message_type: opt(ctx, "messageType") ?? "comment",
          type: "admin",
          admin_id: v(ctx, "adminId"),
          body: v(ctx, "body"),
        },
        headers: { "intercom-version": "2.11" },
      },
    ),
  "sam-intercom-close": (ctx) =>
    api(
      ctx,
      `https://api.intercom.io/conversations/${encodeURIComponent(v(ctx, "conversationId"))}/parts`,
      {
        json: { message_type: "close", type: "admin", admin_id: v(ctx, "adminId") },
        headers: { "intercom-version": "2.11" },
      },
    ),
  "sam-twilio-call": async (ctx) => {
    const sid = await twilioSid(ctx);
    return api(ctx, `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
      form: {
        From: v(ctx, "from"),
        To: v(ctx, "to"),
        Twiml: `<Response><Say language="ar-SA">${v(ctx, "say")}</Say></Response>`,
      },
    });
  },
  "sam-twilio-whatsapp": async (ctx) => {
    const sid = await twilioSid(ctx);
    return api(ctx, `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      form: {
        From: `whatsapp:${v(ctx, "from").replace(/^whatsapp:/, "")}`,
        To: `whatsapp:${v(ctx, "to").replace(/^whatsapp:/, "")}`,
        Body: v(ctx, "body"),
      },
    });
  },
  "sam-stripe-subscription": (ctx) =>
    api(ctx, "https://api.stripe.com/v1/subscriptions", {
      form: {
        customer: v(ctx, "customer"),
        "items[0][price]": v(ctx, "priceId"),
        ...(opt(ctx, "trialDays") ? { trial_period_days: v(ctx, "trialDays") } : {}),
      },
    }),
  "sam-stripe-refund": (ctx) =>
    api(ctx, "https://api.stripe.com/v1/refunds", {
      form: {
        payment_intent: v(ctx, "paymentIntent"),
        ...(opt(ctx, "amount") ? { amount: v(ctx, "amount") } : {}),
      },
    }),
  "sam-stripe-charges": (ctx) =>
    api(
      ctx,
      `https://api.stripe.com/v1/charges?limit=${Math.max(1, Math.min(50, Number(v(ctx, "limit") || "10") || 10))}${opt(ctx, "customer") ? `&customer=${encodeURIComponent(v(ctx, "customer"))}` : ""}`,
    ),
  "sam-airtable-create": (ctx) =>
    api(
      ctx,
      `https://api.airtable.com/v0/${encodeURIComponent(v(ctx, "baseId"))}/${encodeURIComponent(v(ctx, "table"))}`,
      { json: { fields: JSON.parse(v(ctx, "fields") || "{}") as Record<string, unknown> } },
    ),
  "sam-airtable-update": (ctx) =>
    api(
      ctx,
      `https://api.airtable.com/v0/${encodeURIComponent(v(ctx, "baseId"))}/${encodeURIComponent(v(ctx, "table"))}/${encodeURIComponent(v(ctx, "recordId"))}`,
      {
        method: "PATCH",
        json: { fields: JSON.parse(v(ctx, "fields") || "{}") as Record<string, unknown> },
      },
    ),
  "sam-airtable-list": (ctx) =>
    api(
      ctx,
      `https://api.airtable.com/v0/${encodeURIComponent(v(ctx, "baseId"))}/${encodeURIComponent(v(ctx, "table"))}?maxRecords=${Math.max(1, Math.min(100, Number(v(ctx, "max") || "20") || 20))}${opt(ctx, "formula") ? `&filterByFormula=${encodeURIComponent(v(ctx, "formula"))}` : ""}`,
    ),

  /* ===== شيتس ودرايف (سالم/دانة) ===== */
  "sam-update-sheet-row": async (ctx) => {
    const title = await sheetTitle(ctx, v(ctx, "sheetId"), v(ctx, "worksheetId"));
    const range = `${title}!A${Math.max(1, Number(v(ctx, "rowNumber")) || 1)}`;
    return api(
      ctx,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(v(ctx, "sheetId"))}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      { method: "PUT", json: { values: [list(ctx, "row")] } },
    );
  },
  "adam-read-sheet": async (ctx) => {
    const title = await sheetTitle(ctx, v(ctx, "sheetId"), v(ctx, "worksheetId"));
    return api(
      ctx,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(v(ctx, "sheetId"))}/values/${encodeURIComponent(`${title}!A1:Z100`)}`,
    );
  },
  "dana-drive-share": (ctx) =>
    api(
      ctx,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(v(ctx, "fileId"))}/permissions`,
      {
        json: {
          role: opt(ctx, "role") ?? "reader",
          type: opt(ctx, "email") ? "user" : "anyone",
          ...(opt(ctx, "email") ? { emailAddress: v(ctx, "email") } : {}),
        },
      },
    ),
  "dana-figma-export": (ctx) =>
    api(
      ctx,
      `https://api.figma.com/v1/images/${encodeURIComponent(v(ctx, "fileId"))}?ids=${encodeURIComponent(v(ctx, "nodeIds"))}&format=${opt(ctx, "format") ?? "png"}&scale=${opt(ctx, "scale") ?? "2"}`,
    ),
  "dana-canva-export": (ctx) =>
    api(ctx, "https://api.canva.com/rest/v1/exports", {
      json: {
        design_id: v(ctx, "designId"),
        format: { type: (opt(ctx, "format") ?? "png").toLowerCase() },
      },
    }),

  /* ===== تواصل الفريق ===== */
  "team-slack-update": (ctx) =>
    api(ctx, "https://slack.com/api/chat.update", {
      json: { channel: v(ctx, "channel"), ts: v(ctx, "ts"), text: v(ctx, "text") },
    }),
  "team-slack-react": (ctx) =>
    api(ctx, "https://slack.com/api/reactions.add", {
      json: { channel: v(ctx, "channel"), timestamp: v(ctx, "ts"), name: v(ctx, "emoji") },
    }),
  "team-slack-dm": async (ctx) => {
    const convo = await api<{ channel?: { id?: string } }>(
      ctx,
      "https://slack.com/api/conversations.open",
      { json: { users: v(ctx, "userId") } },
    );
    const channel = convo.channel?.id;
    if (!channel) throw new Error("تعذّر فتح محادثة سلاك خاصة.");
    return api(ctx, "https://slack.com/api/chat.postMessage", {
      json: { channel, text: v(ctx, "text") },
    });
  },
  "team-discord-embed": (ctx) =>
    api(
      ctx,
      `https://discord.com/api/v10/channels/${encodeURIComponent(v(ctx, "channel"))}/messages`,
      {
        json: {
          embeds: [
            {
              title: v(ctx, "title"),
              description: v(ctx, "description"),
              ...(opt(ctx, "url") ? { url: v(ctx, "url") } : {}),
              color: 3_066_993,
            },
          ],
        },
      },
    ),
  "team-telegram-photo": (ctx) =>
    api(ctx, "https://api.telegram.org/bot{{$auth.token}}/sendPhoto", {
      json: {
        chat_id: v(ctx, "chatId"),
        photo: v(ctx, "photoUrl"),
        ...(opt(ctx, "caption") ? { caption: v(ctx, "caption") } : {}),
      },
    }),
  "team-trello-move": (ctx) =>
    api(
      ctx,
      `https://api.trello.com/1/cards/${encodeURIComponent(v(ctx, "cardId"))}?idList=${encodeURIComponent(v(ctx, "idList"))}`,
      { method: "PUT", text: "" },
    ),
  "team-trello-comment": (ctx) =>
    api(
      ctx,
      `https://api.trello.com/1/cards/${encodeURIComponent(v(ctx, "cardId"))}/actions/comments?text=${encodeURIComponent(v(ctx, "text"))}`,
      { method: "POST", text: "" },
    ),
  "team-asana-comment": (ctx) =>
    api(
      ctx,
      `https://app.asana.com/api/1.0/tasks/${encodeURIComponent(v(ctx, "taskId"))}/stories`,
      {
        json: { data: { text: v(ctx, "text") } },
      },
    ),
  "team-asana-complete": (ctx) =>
    api(ctx, `https://app.asana.com/api/1.0/tasks/${encodeURIComponent(v(ctx, "taskId"))}`, {
      method: "PUT",
      json: { data: { completed: (opt(ctx, "completed") ?? "true") !== "false" } },
    }),
  "team-jira-transition": (ctx) =>
    api(
      ctx,
      `https://api.atlassian.com/ex/jira/${encodeURIComponent(v(ctx, "cloudId"))}/rest/api/3/issue/${encodeURIComponent(v(ctx, "issueKey"))}/transitions`,
      { json: { transition: { id: v(ctx, "transitionId") } } },
    ),
  "team-jira-comment": (ctx) =>
    api(
      ctx,
      `https://api.atlassian.com/ex/jira/${encodeURIComponent(v(ctx, "cloudId"))}/rest/api/3/issue/${encodeURIComponent(v(ctx, "issueKey"))}/comment`,
      {
        json: {
          body: {
            type: "doc",
            version: 1,
            content: [{ type: "paragraph", content: [{ type: "text", text: v(ctx, "text") }] }],
          },
        },
      },
    ),
  "team-clickup-status": (ctx) =>
    api(ctx, `https://api.clickup.com/api/v2/task/${encodeURIComponent(v(ctx, "taskId"))}`, {
      method: "PUT",
      json: {
        ...(opt(ctx, "status") ? { status: v(ctx, "status") } : {}),
        ...(opt(ctx, "name") ? { name: v(ctx, "name") } : {}),
      },
    }),
  "team-clickup-comment": (ctx) =>
    api(
      ctx,
      `https://api.clickup.com/api/v2/task/${encodeURIComponent(v(ctx, "taskId"))}/comment`,
      { json: { comment_text: v(ctx, "text"), notify_all: false } },
    ),
  "team-monday-column": (ctx) =>
    api(ctx, "https://api.monday.com/v2", {
      json: {
        query:
          "mutation($board:ID!,$item:ID!,$vals:JSON!){change_multiple_column_values(board_id:$board,item_id:$item,column_values:$vals){id}}",
        variables: {
          board: v(ctx, "boardId"),
          item: v(ctx, "itemId"),
          vals: v(ctx, "columnValues"),
        },
      },
    }),
  "team-monday-update": (ctx) =>
    api(ctx, "https://api.monday.com/v2", {
      json: {
        query: "mutation($item:ID!,$body:String!){create_update(item_id:$item,body:$body){id}}",
        variables: { item: v(ctx, "itemId"), body: v(ctx, "body") },
      },
    }),

  /* ===== الإعلانات والقياس (آدم) ===== */
  "adam-ga4-realtime": (ctx) => {
    const property = v(ctx, "property").replace(/^properties\//, "");
    return api(
      ctx,
      `https://analyticsdata.googleapis.com/v1beta/properties/${property}:runRealtimeReport`,
      {
        json: {
          metrics: [{ name: "activeUsers" }],
          dimensions: [{ name: "unifiedScreenName" }],
        },
      },
    );
  },
  "adam-ga4-top-pages": (ctx) => {
    const property = v(ctx, "property").replace(/^properties\//, "");
    const days = Math.max(1, Math.min(365, Number(v(ctx, "days") || "28") || 28));
    return api(
      ctx,
      `https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`,
      {
        json: {
          dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
          dimensions: [{ name: "pagePath" }],
          metrics: [{ name: "screenPageViews" }, { name: "engagementRate" }],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: 20,
        },
      },
    );
  },
  "adam-meta-insights": (ctx) =>
    api(
      ctx,
      `${GRAPH}/act_${encodeURIComponent(v(ctx, "adAccountId").replace(/^act_/, ""))}/insights?fields=campaign_name,spend,impressions,clicks,ctr,cpc,actions&date_preset=${opt(ctx, "datePreset") ?? "last_30d"}&level=campaign&limit=25`,
    ),
  "adam-meta-campaign": (ctx) =>
    api(
      ctx,
      `${GRAPH}/act_${encodeURIComponent(v(ctx, "adAccountId").replace(/^act_/, ""))}/campaigns`,
      {
        json: {
          name: v(ctx, "name"),
          objective: opt(ctx, "objective") ?? "OUTCOME_TRAFFIC",
          status: "PAUSED",
          special_ad_categories: [],
          ...(opt(ctx, "dailyBudget") ? { daily_budget: v(ctx, "dailyBudget") } : {}),
        },
      },
    ),
  "adam-meta-toggle": (ctx) =>
    api(ctx, `${GRAPH}/${encodeURIComponent(v(ctx, "objectId"))}`, {
      json: { status: (opt(ctx, "status") ?? "PAUSED").toUpperCase() },
    }),
  "adam-gads-report": (ctx) =>
    api(
      ctx,
      `https://googleads.googleapis.com/v18/customers/${encodeURIComponent(v(ctx, "customerId").replace(/-/g, ""))}/googleAds:search`,
      {
        json: {
          query:
            opt(ctx, "query") ??
            "SELECT campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date DURING LAST_30_DAYS ORDER BY metrics.impressions DESC LIMIT 25",
        },
        headers: {
          ...(opt(ctx, "loginCustomerId")
            ? { "login-customer-id": v(ctx, "loginCustomerId").replace(/-/g, "") }
            : {}),
        },
      },
    ),
  "adam-gads-toggle": (ctx) =>
    api(
      ctx,
      `https://googleads.googleapis.com/v18/customers/${encodeURIComponent(v(ctx, "customerId").replace(/-/g, ""))}/campaigns:mutate`,
      {
        json: {
          operations: [
            {
              update: {
                resourceName: `customers/${v(ctx, "customerId").replace(/-/g, "")}/campaigns/${v(ctx, "campaignId")}`,
                status: (opt(ctx, "status") ?? "PAUSED").toUpperCase(),
              },
              updateMask: "status",
            },
          ],
        },
        headers: {
          ...(opt(ctx, "loginCustomerId")
            ? { "login-customer-id": v(ctx, "loginCustomerId").replace(/-/g, "") }
            : {}),
        },
      },
    ),

  /* ===== سيو (نور) ===== */
  "nour-gsc-pages": (ctx) => {
    const days = Math.max(1, Math.min(180, Number(v(ctx, "days") || "28") || 28));
    const end = new Date();
    const start = new Date(end.getTime() - days * 86_400_000);
    return api(
      ctx,
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(v(ctx, "siteUrl"))}/searchAnalytics/query`,
      {
        json: {
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
          dimensions: ["page"],
          rowLimit: 25,
        },
      },
    );
  },
  "nour-gsc-sitemap": (ctx) =>
    api(
      ctx,
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(v(ctx, "siteUrl"))}/sitemaps/${encodeURIComponent(v(ctx, "sitemapUrl"))}`,
      { method: "PUT" },
    ),
  "nour-gsc-inspect": (ctx) =>
    api(ctx, "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
      json: {
        inspectionUrl: v(ctx, "pageUrl"),
        siteUrl: v(ctx, "siteUrl"),
        languageCode: "ar",
      },
    }),
};
