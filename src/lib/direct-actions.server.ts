/**
 * تنفيذ إجراءات الموظفين مباشرة على واجهات المنصات عبر وكيل Pipedream (Connect Proxy).
 *
 * لماذا؟ «الإجراءات الجاهزة» (actions/run) غير متاحة في وضع الإنتاج على خطة الوسيط الحالية،
 * أمّا الوكيل فيعمل في الإنتاج والتطوير معاً. لذلك كل إجراء لدينا له تنفيذ مباشر مضمون،
 * ويبقى الإجراء الجاهز مجرد احتياطي.
 *
 * لا يمرّ أي توكن على خوادمنا: الوكيل هو من يضيف بيانات اعتماد الحساب المربوط.
 */
import { proxyRequest, type PipedreamConfig } from "./pipedream.server";

export type DirectContext = {
  config: PipedreamConfig;
  workspaceId: string;
  accountId: string;
  values: Record<string, string>;
};

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** بصمة ثابتة لمحتوى الطلب — أساس مفتاح منع التكرار. */
function stableHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(36)}${h2.toString(36)}`;
}

/** نداء مباشر لواجهة المنصة عبر الوكيل. */
export async function api<T = unknown>(
  ctx: DirectContext,
  url: string,
  init: {
    method?: Method;
    json?: unknown;
    form?: Record<string, string>;
    text?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  let rawBody: string | undefined;
  const method0 = init.method ?? (init.json || init.form || init.text !== undefined ? "POST" : "GET");
  if (init.form) {
    rawBody = new URLSearchParams(init.form).toString();
    headers["content-type"] = "application/x-www-form-urlencoded";
  } else if (init.text !== undefined) {
    rawBody = init.text;
    headers["content-type"] = headers["content-type"] ?? "text/plain";
  }
  // منع التكرار المالي: إعادة المحاولة على نفس الطلب لا تُنشئ فاتورة/اشتراك/استرجاعاً ثانياً.
  if (method0 !== "GET" && /(^|\.)stripe\.com$/.test(new URL(url).hostname)) {
    headers["idempotency-key"] =
      headers["idempotency-key"] ??
      `sahl-${ctx.workspaceId}-${stableHash(`${url}|${rawBody ?? ""}|${init.json ? JSON.stringify(init.json) : ""}`)}`;
  }

  try {
    return await proxyRequest<T>(ctx.config, {
      workspaceId: ctx.workspaceId,
      accountId: ctx.accountId,
      url,
      method: method0,
      ...(init.json === undefined ? {} : { body: init.json }),
      ...(rawBody === undefined ? {} : { rawBody }),
      ...(Object.keys(headers).length ? { headers } : {}),
    });
  } catch (error) {
    // ماكرو لم يُعوَّض (مثل توكن بوت تيليجرام أو حقول الحساب): الرسالة الخام
    // تقنية وتنسب الخطأ للمكان الخطأ — نترجمها إلى خطوة يفهمها المالك.
    const message = error instanceof Error ? error.message : String(error);
    if (/\{\{|custom_fields|\$auth\./.test(message)) {
      const host = new URL(url).hostname.replace(/^www\./, "");
      throw new Error(
        `ربط ${host} ناقص: بيانات الحساب لم تصل من التكامل. افتح صفحة التكاملات وأعد ربط الحساب ثم أعد المحاولة.`,
      );
    }
    throw error;
  }
}

export const v = (ctx: DirectContext, name: string): string => (ctx.values[name] ?? "").trim();
export const opt = (ctx: DirectContext, name: string): string | undefined => {
  const value = v(ctx, name);
  return value ? value : undefined;
};
export const list = (ctx: DirectContext, name: string): string[] =>
  v(ctx, name)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** ترميز base64url لرسالة RFC822 (جيميل). */
export function base64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** ترميز عنوان/موضوع عربي في ترويسة البريد. */
export function mailHeader(value: string): string {
  if (/[\r\n\0]/.test(value)) throw new Error("ترويسة البريد تحتوي على محارف غير مسموحة.");
  return value;
}

export function mimeBase64(value: string): string {
  const encoded = base64Url(value).replace(/-/g, "+").replace(/_/g, "/");
  return encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
}

export function mimeBody(value: string): string {
  return (
    mimeBase64(value)
      .match(/.{1,76}/g)
      ?.join("\r\n") ?? ""
  );
}

export function mimeHeader(value: string): string {
  mailHeader(value);
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  const chunks: string[] = [];
  let chunk = "";
  for (const char of value) {
    if (new TextEncoder().encode(chunk + char).length > 42) {
      chunks.push(`=?UTF-8?B?${mimeBase64(chunk)}?=`);
      chunk = "";
    }
    chunk += char;
  }
  if (chunk) chunks.push(`=?UTF-8?B?${mimeBase64(chunk)}?=`);
  return chunks.join("\r\n ");
}

export function rfc822(to: string, subject: string, body: string): string {
  return [
    `To: ${mailHeader(to)}`,
    `Subject: ${mimeHeader(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    mimeBody(body),
  ].join("\r\n");
}

/* ————— مساعدات تحديد نطاق الحساب لبعض المنصات ————— */

export async function salesforceInstance(ctx: DirectContext): Promise<string> {
  const info = await api<{ urls?: { rest?: string } }>(
    ctx,
    "https://login.salesforce.com/services/oauth2/userinfo",
  );
  const rest = info.urls?.rest ?? "";
  const base = rest.replace(/\/services\/data\/.*$/, "");
  if (!base) throw new Error("تعذّر تحديد نطاق حساب سيلزفورس.");
  return base;
}

export async function mailchimpBase(ctx: DirectContext): Promise<string> {
  const meta = await api<{ api_endpoint?: string }>(
    ctx,
    "https://login.mailchimp.com/oauth2/metadata",
  );
  if (!meta.api_endpoint) throw new Error("تعذّر تحديد سيرفر حساب ميلتشمب.");
  return meta.api_endpoint.replace(/\/$/, "");
}

export async function pipedriveBase(ctx: DirectContext): Promise<string> {
  const me = await api<{ data?: { company_domain?: string } }>(
    ctx,
    "https://api.pipedrive.com/v1/users/me",
  );
  const domain = me.data?.company_domain;
  return domain ? `https://${domain}.pipedrive.com/api/v1` : "https://api.pipedrive.com/v1";
}

export async function sheetTitle(
  ctx: DirectContext,
  sheetId: string,
  gid: string,
): Promise<string> {
  const meta = await api<{
    sheets?: { properties?: { sheetId?: number; title?: string } }[];
  }>(
    ctx,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}?fields=sheets.properties`,
  );
  const wanted = Number(gid) || 0;
  const sheets = meta.sheets ?? [];
  const hit = sheets.find((s) => (s.properties?.sheetId ?? -1) === wanted) ?? sheets[0];
  const title = hit?.properties?.title;
  if (!title) throw new Error("لم يُعثر على الورقة المطلوبة داخل ملف شيتس.");
  return title;
}

export async function driveUpload(
  ctx: DirectContext,
  params: { name: string; content: string; parentId?: string; mimeType?: string },
): Promise<{ id?: string; name?: string; webViewLink?: string }> {
  const file = await api<{ id?: string }>(ctx, "https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    json: {
      name: params.name,
      mimeType: params.mimeType ?? "text/plain",
      ...(params.parentId ? { parents: [params.parentId] } : {}),
    },
  });
  if (!file.id) throw new Error("تعذّر إنشاء الملف في درايف.");
  return api(
    ctx,
    `https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media&fields=id,name,webViewLink`,
    {
      method: "PATCH",
      text: params.content,
      headers: { "content-type": "text/plain; charset=UTF-8" },
    },
  );
}

/* ————— سجل التنفيذ المباشر: معرّف الإجراء ← دالة ————— */

export const directActions: Record<string, (ctx: DirectContext) => Promise<unknown>> = {
  /* البريد والتقويم */
  "eva-send-email": (ctx) =>
    api(ctx, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      json: { raw: base64Url(rfc822(v(ctx, "to"), v(ctx, "subject"), v(ctx, "body"))) },
    }),
  "eva-draft-email": (ctx) =>
    api(ctx, "https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
      json: {
        message: { raw: base64Url(rfc822(v(ctx, "to"), v(ctx, "subject"), v(ctx, "body"))) },
      },
    }),
  "eva-outlook-send": (ctx) =>
    api(ctx, "https://graph.microsoft.com/v1.0/me/sendMail", {
      json: {
        message: {
          subject: v(ctx, "subject"),
          body: { contentType: "Text", content: v(ctx, "body") },
          toRecipients: [{ emailAddress: { address: v(ctx, "to") } }],
        },
        saveToSentItems: true,
      },
    }),
  "eva-create-event": (ctx) =>
    api(ctx, "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all", {
      json: {
        summary: v(ctx, "summary"),
        start: { dateTime: v(ctx, "start") },
        end: { dateTime: v(ctx, "end") },
        attendees: list(ctx, "attendees").map((email) => ({ email })),
      },
    }),
  "eva-zoom-meeting": (ctx) =>
    api(ctx, "https://api.zoom.us/v2/users/me/meetings", {
      json: {
        topic: v(ctx, "topic"),
        type: 2,
        ...(opt(ctx, "start_time") ? { start_time: v(ctx, "start_time") } : {}),
        ...(opt(ctx, "duration") ? { duration: Number(v(ctx, "duration")) || 30 } : {}),
      },
    }),

  /* CRM ومبيعات */
  "sam-create-contact": (ctx) =>
    api(ctx, "https://api.hubapi.com/crm/v3/objects/contacts", {
      json: {
        properties: {
          email: v(ctx, "email"),
          ...(opt(ctx, "firstname") ? { firstname: v(ctx, "firstname") } : {}),
          ...(opt(ctx, "lastname") ? { lastname: v(ctx, "lastname") } : {}),
          ...(opt(ctx, "company") ? { company: v(ctx, "company") } : {}),
        },
      },
    }),
  "sam-create-deal": (ctx) =>
    api(ctx, "https://api.hubapi.com/crm/v3/objects/deals", {
      json: {
        properties: {
          dealname: v(ctx, "dealname"),
          pipeline: v(ctx, "pipeline"),
          dealstage: v(ctx, "dealstage"),
          ...(opt(ctx, "amount") ? { amount: v(ctx, "amount") } : {}),
          ...(opt(ctx, "closedate") ? { closedate: v(ctx, "closedate") } : {}),
        },
      },
    }),
  "sam-create-lead": async (ctx) => {
    const base = await salesforceInstance(ctx);
    return api(ctx, `${base}/services/data/v60.0/sobjects/Lead`, {
      json: {
        LastName: v(ctx, "LastName"),
        Company: v(ctx, "Company"),
        ...(opt(ctx, "Email") ? { Email: v(ctx, "Email") } : {}),
        ...(opt(ctx, "Phone") ? { Phone: v(ctx, "Phone") } : {}),
      },
    });
  },
  "sam-add-subscriber": async (ctx) => {
    const base = await mailchimpBase(ctx);
    return api(ctx, `${base}/3.0/lists/${encodeURIComponent(v(ctx, "listId"))}/members`, {
      json: {
        email_address: v(ctx, "email").toLowerCase(),
        status: opt(ctx, "status") ?? "subscribed",
      },
    });
  },
  "sam-pipedrive-deal": async (ctx) => {
    const base = await pipedriveBase(ctx);
    return api(ctx, `${base}/deals`, {
      json: {
        title: v(ctx, "title"),
        ...(opt(ctx, "value") ? { value: Number(v(ctx, "value")) || 0 } : {}),
        ...(opt(ctx, "currency") ? { currency: v(ctx, "currency") } : {}),
        ...(opt(ctx, "personId") ? { person_id: Number(v(ctx, "personId")) } : {}),
      },
    });
  },
  "sam-pipedrive-person": async (ctx) => {
    const base = await pipedriveBase(ctx);
    return api(ctx, `${base}/persons`, {
      json: {
        name: v(ctx, "name"),
        ...(opt(ctx, "email") ? { email: [v(ctx, "email")] } : {}),
        ...(opt(ctx, "phone") ? { phone: [v(ctx, "phone")] } : {}),
      },
    });
  },
  "sam-intercom-message": (ctx) =>
    api(ctx, "https://api.intercom.io/messages", {
      json: {
        message_type: "inapp",
        subject: v(ctx, "subject"),
        body: v(ctx, "body"),
        from: { type: "admin", id: v(ctx, "fromId") },
        to: { type: "user", id: v(ctx, "toId") },
      },
      headers: { "intercom-version": "2.11" },
    }),
  "sam-twilio-sms": async (ctx) => {
    const account = await api<{ sid?: string }>(
      ctx,
      "https://api.twilio.com/2010-04-01/Accounts.json",
    );
    const sid =
      opt(ctx, "accountSid") ??
      (account as unknown as { accounts?: { sid?: string }[] }).accounts?.[0]?.sid ??
      account.sid;
    if (!sid) throw new Error("تعذّر تحديد حساب تويليو.");
    return api(ctx, `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      form: { From: v(ctx, "from"), To: v(ctx, "to"), Body: v(ctx, "body") },
    });
  },

  /* سترايب */
  "sam-stripe-customer": (ctx) =>
    api(ctx, "https://api.stripe.com/v1/customers", {
      form: {
        name: v(ctx, "name"),
        ...(opt(ctx, "email") ? { email: v(ctx, "email") } : {}),
        ...(opt(ctx, "phone") ? { phone: v(ctx, "phone") } : {}),
      },
    }),
  "sam-stripe-invoice": (ctx) =>
    api(ctx, "https://api.stripe.com/v1/invoices", {
      form: {
        customer: v(ctx, "customer"),
        collection_method: "send_invoice",
        days_until_due: opt(ctx, "daysUntilDue") ?? "7",
        ...(opt(ctx, "description") ? { description: v(ctx, "description") } : {}),
      },
    }),
  "sam-stripe-payment": async (ctx) => {
    // رابط الدفع في سترايب يحتاج سعراً قائماً، فننشئ المنتج والسعر أولاً.
    const price = await api<{ id?: string }>(ctx, "https://api.stripe.com/v1/prices", {
      form: {
        unit_amount: String(Math.max(1, Number(v(ctx, "amount")) || 1)),
        currency: (v(ctx, "currency") || "sar").toLowerCase(),
        "product_data[name]": opt(ctx, "description") ?? "طلب دفع",
      },
    });
    if (!price.id) throw new Error("تعذّر إنشاء السعر في سترايب.");
    return api(ctx, "https://api.stripe.com/v1/payment_links", {
      form: {
        "line_items[0][price]": price.id,
        "line_items[0][quantity]": "1",
      },
    });
  },

  /* شيتس ودرايف */
  "sam-log-sheet": async (ctx) => {
    const title = await sheetTitle(ctx, v(ctx, "sheetId"), v(ctx, "worksheetId"));
    return api(
      ctx,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(v(ctx, "sheetId"))}/values/${encodeURIComponent(title)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { json: { values: [list(ctx, "row")] } },
    );
  },
  "dana-drive-text-file": (ctx) =>
    driveUpload(ctx, {
      name: v(ctx, "name"),
      content: v(ctx, "content"),
      ...(opt(ctx, "parentId") ? { parentId: v(ctx, "parentId") } : {}),
    }),

  /* تواصل الفريق */
  "team-slack-note": (ctx) =>
    api(ctx, "https://slack.com/api/chat.postMessage", {
      json: { channel: v(ctx, "channel"), text: v(ctx, "text"), mrkdwn: true },
    }),
  "team-discord-send": (ctx) =>
    api(
      ctx,
      `https://discord.com/api/v10/channels/${encodeURIComponent(v(ctx, "channel"))}/messages`,
      {
        json: { content: v(ctx, "message") },
      },
    ),
  "team-notion-page": (ctx) =>
    api(ctx, "https://api.notion.com/v1/pages", {
      json: {
        parent: { page_id: v(ctx, "parentId") },
        properties: { title: [{ text: { content: v(ctx, "title") } }] },
        ...(opt(ctx, "content")
          ? {
              children: [
                {
                  object: "block",
                  type: "paragraph",
                  paragraph: {
                    rich_text: [{ type: "text", text: { content: v(ctx, "content") } }],
                  },
                },
              ],
            }
          : {}),
      },
      headers: { "notion-version": "2022-06-28" },
    }),

  /* إدارة المشاريع */
  "team-trello-card": (ctx) =>
    api(
      ctx,
      `https://api.trello.com/1/cards?idList=${encodeURIComponent(v(ctx, "idList"))}&name=${encodeURIComponent(v(ctx, "name"))}${opt(ctx, "desc") ? `&desc=${encodeURIComponent(v(ctx, "desc"))}` : ""}${opt(ctx, "due") ? `&due=${encodeURIComponent(v(ctx, "due"))}` : ""}`,
      { method: "POST", text: "" },
    ),
  "team-asana-task": (ctx) =>
    api(ctx, "https://app.asana.com/api/1.0/tasks", {
      json: {
        data: {
          name: v(ctx, "name"),
          projects: [v(ctx, "project")],
          ...(opt(ctx, "workspace") ? { workspace: v(ctx, "workspace") } : {}),
          ...(opt(ctx, "notes") ? { notes: v(ctx, "notes") } : {}),
          ...(opt(ctx, "due_on") ? { due_on: v(ctx, "due_on") } : {}),
        },
      },
    }),
  "team-jira-issue": (ctx) =>
    api(
      ctx,
      `https://api.atlassian.com/ex/jira/${encodeURIComponent(v(ctx, "cloudId"))}/rest/api/3/issue`,
      {
        json: {
          fields: {
            project: { id: v(ctx, "projectId") },
            issuetype: { id: v(ctx, "issueTypeId") },
            summary: v(ctx, "summary"),
          },
        },
      },
    ),
  "team-clickup-task": (ctx) =>
    api(ctx, `https://api.clickup.com/api/v2/list/${encodeURIComponent(v(ctx, "listId"))}/task`, {
      json: {
        name: v(ctx, "name"),
        ...(opt(ctx, "description") ? { description: v(ctx, "description") } : {}),
      },
    }),
  "team-monday-item": (ctx) =>
    api(ctx, "https://api.monday.com/v2", {
      json: {
        query:
          "mutation($board:ID!,$name:String!){create_item(board_id:$board,item_name:$name){id name}}",
        variables: { board: v(ctx, "boardId"), name: v(ctx, "itemName") },
      },
    }),

  /* سوشيال إضافي */
  "sonny-reddit-post": (ctx) =>
    api(ctx, "https://oauth.reddit.com/api/submit", {
      form: {
        sr: v(ctx, "subreddit"),
        title: v(ctx, "title"),
        api_type: "json",
        ...(opt(ctx, "url")
          ? { kind: "link", url: v(ctx, "url") }
          : { kind: "self", text: v(ctx, "text") }),
      },
    }),
  "sonny-bluesky-post": async (ctx) => {
    const session = await api<{ did?: string }>(
      ctx,
      "https://bsky.social/xrpc/com.atproto.server.getSession",
    );
    if (!session.did) throw new Error("تعذّر تحديد حساب بلوسكاي.");
    return api(ctx, "https://bsky.social/xrpc/com.atproto.repo.createRecord", {
      json: {
        repo: session.did,
        collection: "app.bsky.feed.post",
        record: { text: v(ctx, "text"), createdAt: new Date().toISOString() },
      },
    });
  },
  "sonny-gbp-post": (ctx) =>
    api(
      ctx,
      `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(v(ctx, "account"))}/locations/${encodeURIComponent(v(ctx, "location"))}/localPosts`,
      { json: { topicType: "STANDARD", languageCode: "ar", summary: v(ctx, "summary") } },
    ),
  "sonny-gbp-reply": (ctx) =>
    api(
      ctx,
      `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(v(ctx, "account"))}/locations/${encodeURIComponent(v(ctx, "location"))}/reviews/${encodeURIComponent(v(ctx, "review"))}/reply`,
      { method: "PUT", json: { comment: v(ctx, "comment") } },
    ),

  /* تيليجرام: الوكيل يعوّض توكن البوت في الرابط. */
  "team-telegram-send": (ctx) =>
    api(ctx, "https://api.telegram.org/bot{{$auth.token}}/sendMessage", {
      json: { chat_id: v(ctx, "chatId"), text: v(ctx, "text") },
    }),

  /* سيو وقياس */
  "nour-gsc-performance": (ctx) => {
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
          dimensions: ["query"],
          rowLimit: 25,
        },
      },
    );
  },
  "nour-gsc-index": (ctx) =>
    api(ctx, "https://indexing.googleapis.com/v3/urlNotifications:publish", {
      json: { url: v(ctx, "siteUrl"), type: "URL_UPDATED" },
    }),
  "adam-ga4-report": (ctx) => {
    const days = Math.max(1, Math.min(365, Number(v(ctx, "days") || "28") || 28));
    const property = v(ctx, "property").replace(/^properties\//, "");
    return api(
      ctx,
      `https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`,
      {
        json: {
          dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
          metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "conversions" }],
          dimensions: [{ name: "sessionDefaultChannelGroup" }],
        },
      },
    );
  },
  "adam-log-sheet": async (ctx) => {
    const title = await sheetTitle(ctx, v(ctx, "sheetId"), v(ctx, "worksheetId"));
    return api(
      ctx,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(v(ctx, "sheetId"))}/values/${encodeURIComponent(title)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { json: { values: [list(ctx, "row")] } },
    );
  },

  /* تصميم */
  "dana-canva-design": (ctx) =>
    api(ctx, "https://api.canva.com/rest/v1/designs", {
      json: {
        design_type: { type: "preset", name: v(ctx, "designType") },
        ...(opt(ctx, "title") ? { title: v(ctx, "title") } : {}),
      },
    }),
  "dana-figma-comment": (ctx) =>
    api(ctx, `https://api.figma.com/v1/files/${encodeURIComponent(v(ctx, "fileId"))}/comments`, {
      json: { message: v(ctx, "message") },
    }),
};

/** هل للإجراء تنفيذ مباشر؟ */
export function hasDirect(actionId: string): boolean {
  return Boolean(directActions[actionId]);
}
