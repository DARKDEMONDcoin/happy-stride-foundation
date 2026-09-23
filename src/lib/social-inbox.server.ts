/**
 * صندوق التفاعل الاجتماعي: تعليقات ورسائل صفحات فيسبوك وحسابات إنستجرام
 * تُقرأ وتُردّ عليها عبر وكيل Pipedream — بلا أي توكن مخزّن لدينا.
 *
 * المنطق نفسه الذي يعتمده موظف السوشيال لدى Marblism: اقرأ الواقع أولاً
 * (تعليقات بلا رد، رسائل جديدة)، اعرضه على المالك، ثم نفّذ الرد بعد اعتماده.
 */
import { proxyRequest, type PipedreamConfig } from "./pipedream.server";

const GRAPH = "https://graph.facebook.com/v23.0";

export type PageTarget = { id: string; name: string; token: string; igId?: string };

type MeAccounts = {
  data?: {
    id: string;
    name?: string;
    access_token?: string;
    instagram_business_account?: { id: string };
  }[];
};

/** الصلاحيات التي منحها المستخدم فعلاً لتطبيق ميتا عند الربط. */
export async function metaPermissions(
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
): Promise<string[]> {
  const res = await proxyRequest<{ data?: { permission: string; status: string }[] }>(config, {
    workspaceId,
    accountId,
    url: `${GRAPH}/me/permissions`,
  });
  return (res.data ?? []).filter((p) => p.status === "granted").map((p) => p.permission);
}

/** الصلاحيات اللازمة للنشر على صفحة فيسبوك/إنستجرام. */
export const META_PUBLISH_SCOPES = ["pages_manage_posts", "pages_read_engagement"] as const;

/**
 * يتحقق أن الربط يسمح بالنشر فعلاً؛ وإلا يرمي رسالة عربية واضحة بالحل بدل خطأ Graph الخام.
 * السبب الشائع: تطبيق ميتا الافتراضي لدى الوسيط يطلب «عرض الصفحات» فقط.
 */
export async function assertMetaPublishScopes(
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
  provider: "facebook" | "instagram",
): Promise<void> {
  let granted: string[] = [];
  try {
    granted = await metaPermissions(config, workspaceId, accountId);
  } catch (firstError) {
    // محاولة ثانية قصيرة قبل الحكم — قد يكون ازدحاماً لحظياً لدى الوسيط.
    await new Promise((resolve) => setTimeout(resolve, 600));
    try {
      granted = await metaPermissions(config, workspaceId, accountId);
    } catch {
      console.error("[meta] permissions check failed twice", firstError);
      throw new Error(
        "تعذّر التحقق من أذونات النشر لدى ميتا الآن، فأوقفنا النشر حمايةً من إرسال ناقص. " +
          "أعد المحاولة بعد دقيقة، وإن تكرر الأمر افحص الربط من صفحة التكاملات.",
      );
    }
  }
  const needed: string[] = [...META_PUBLISH_SCOPES];
  if (provider === "instagram") needed.push("instagram_basic", "instagram_content_publish");
  const missing = needed.filter((s) => !granted.includes(s));
  if (!missing.length) return;
  throw new Error(missingMetaScopesMessage(provider, missing));
}

export function missingMetaScopesMessage(
  provider: "facebook" | "instagram",
  missing: string[],
): string {
  const name = provider === "facebook" ? "فيسبوك" : "إنستجرام";
  return (
    `${name} مربوط بصلاحية «عرض الصفحات» فقط، وينقصه إذن النشر (${missing.join("، ")}). ` +
    `نافذة الربط لدينا تطلب أذونات النشر كاملة، لكن ميتا لا تمنحها إلا لتطبيق معتمد لديها — ` +
    `لذلك إعادة الربط وحدها لا تكفي. الحل: اربط تطبيق ميتا الخاص بنا (App ID و App Secret) ` +
    `في إعدادات التكاملات، ثم أعد ربط ${name} واختر الصفحة ووافق على كل الأذونات ` +
    `وأنت مسؤول (Admin) عليها.`
  );
}

/** أول صفحة مرتبطة بالحساب مع توكن الصفحة اللازم للرد كصفحة. */
export async function pageTarget(
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
  preferredPageId?: string,
): Promise<PageTarget | null> {
  const res = await proxyRequest<MeAccounts>(config, {
    workspaceId,
    accountId,
    url: `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account&limit=5`,
  });
  const page =
    (preferredPageId
      ? res.data?.find((candidate) => candidate.id === preferredPageId)
      : undefined) ?? res.data?.[0];
  if (!page?.access_token) return null;
  return {
    id: page.id,
    name: page.name ?? page.id,
    token: page.access_token,
    ...(page.instagram_business_account?.id ? { igId: page.instagram_business_account.id } : {}),
  };
}

export type InboxComment = {
  id: string;
  from: string;
  message: string;
  createdAt: string;
  postId?: string;
  answered: boolean;
};

type FeedComments = {
  data?: {
    id: string;
    message?: string;
    created_time?: string;
    comments?: {
      data?: {
        id: string;
        message?: string;
        created_time?: string;
        from?: { name?: string };
        comment_count?: number;
      }[];
    };
  }[];
};

/** تعليقات آخر منشورات صفحة فيسبوك مع تمييز ما لم يُردّ عليه. */
export async function facebookComments(
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
  page: PageTarget,
  limit = 5,
): Promise<InboxComment[]> {
  const res = await proxyRequest<FeedComments>(config, {
    workspaceId,
    accountId,
    url: `${GRAPH}/${page.id}/feed?limit=${limit}&fields=id,message,created_time,comments.limit(10){id,message,created_time,from,comment_count}&access_token=${encodeURIComponent(page.token)}`,
  });
  const out: InboxComment[] = [];
  for (const post of res.data ?? []) {
    for (const c of post.comments?.data ?? []) {
      out.push({
        id: c.id,
        from: c.from?.name ?? "متابع",
        message: c.message ?? "",
        createdAt: c.created_time ?? "",
        postId: post.id,
        answered: (c.comment_count ?? 0) > 0,
      });
    }
  }
  return out;
}

type IgMedia = {
  data?: {
    id: string;
    caption?: string;
    comments?: {
      data?: {
        id: string;
        text?: string;
        timestamp?: string;
        username?: string;
        replies?: { data?: unknown[] };
      }[];
    };
  }[];
};

/** تعليقات آخر منشورات إنستجرام. */
export async function instagramComments(
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
  page: PageTarget,
  limit = 5,
): Promise<InboxComment[]> {
  if (!page.igId) return [];
  const res = await proxyRequest<IgMedia>(config, {
    workspaceId,
    accountId,
    url: `${GRAPH}/${page.igId}/media?limit=${limit}&fields=id,caption,comments.limit(10){id,text,timestamp,username,replies}&access_token=${encodeURIComponent(page.token)}`,
  });
  const out: InboxComment[] = [];
  for (const media of res.data ?? []) {
    for (const c of media.comments?.data ?? []) {
      out.push({
        id: c.id,
        from: c.username ?? "متابع",
        message: c.text ?? "",
        createdAt: c.timestamp ?? "",
        postId: media.id,
        answered: (c.replies?.data?.length ?? 0) > 0,
      });
    }
  }
  return out;
}

export type InboxMessage = {
  conversationId: string;
  participant: string;
  participantId: string;
  lastMessage: string;
  updatedAt: string;
  fromPage: boolean;
};

type Conversations = {
  data?: {
    id: string;
    updated_time?: string;
    participants?: { data?: { id: string; name?: string }[] };
    messages?: {
      data?: { message?: string; created_time?: string; from?: { id: string; name?: string } }[];
    };
  }[];
};

/** رسائل ماسنجر الواردة لصفحة فيسبوك. */
export async function facebookMessages(
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
  page: PageTarget,
  limit = 10,
): Promise<InboxMessage[]> {
  const res = await proxyRequest<Conversations>(config, {
    workspaceId,
    accountId,
    url: `${GRAPH}/${page.id}/conversations?platform=messenger&limit=${limit}&fields=id,updated_time,participants,messages.limit(1){message,created_time,from}&access_token=${encodeURIComponent(page.token)}`,
  });
  return (res.data ?? []).map((c) => {
    const last = c.messages?.data?.[0];
    const other = (c.participants?.data ?? []).find((p) => p.id !== page.id);
    return {
      conversationId: c.id,
      participant: other?.name ?? "عميل",
      participantId: other?.id ?? "",
      lastMessage: last?.message ?? "",
      updatedAt: c.updated_time ?? last?.created_time ?? "",
      fromPage: last?.from?.id === page.id,
    };
  });
}

/** الرد على تعليق فيسبوك كصفحة. */
export async function replyToFacebookComment(
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
  page: PageTarget,
  commentId: string,
  message: string,
): Promise<unknown> {
  return proxyRequest(config, {
    workspaceId,
    accountId,
    method: "POST",
    url: `${GRAPH}/${commentId}/comments?message=${encodeURIComponent(message)}&access_token=${encodeURIComponent(page.token)}`,
  });
}

/** الرد على تعليق إنستجرام. */
export async function replyToInstagramComment(
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
  page: PageTarget,
  commentId: string,
  message: string,
): Promise<unknown> {
  return proxyRequest(config, {
    workspaceId,
    accountId,
    method: "POST",
    url: `${GRAPH}/${commentId}/replies?message=${encodeURIComponent(message)}&access_token=${encodeURIComponent(page.token)}`,
  });
}

/** إخفاء تعليق مسيء بدل حذفه. */
export async function hideComment(
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
  page: PageTarget,
  commentId: string,
  hidden = true,
): Promise<unknown> {
  return proxyRequest(config, {
    workspaceId,
    accountId,
    method: "POST",
    url: `${GRAPH}/${commentId}?is_hidden=${hidden ? "true" : "false"}&access_token=${encodeURIComponent(page.token)}`,
  });
}

/** رد على رسالة ماسنجر (خلال نافذة الـ24 ساعة المسموح بها من ميتا). */
export async function replyToMessenger(
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
  page: PageTarget,
  recipientId: string,
  text: string,
): Promise<unknown> {
  return proxyRequest(config, {
    workspaceId,
    accountId,
    method: "POST",
    url: `${GRAPH}/${page.id}/messages?access_token=${encodeURIComponent(page.token)}`,
    body: { recipient: { id: recipientId }, messaging_type: "RESPONSE", message: { text } },
  });
}

/** ملخّص نصي موجز للتعليقات والرسائل يُمرّر للموظف كسياق إلزامي. */
export function inboxSummary(comments: InboxComment[], messages: InboxMessage[]): string {
  const lines: string[] = [];
  const pending = comments.filter((c) => !c.answered).slice(0, 12);
  if (pending.length) {
    lines.push("تعليقات بانتظار رد:");
    for (const c of pending) {
      lines.push(`- [${c.id}] ${c.from}: ${c.message.slice(0, 160)} (${c.createdAt})`);
    }
  }
  const waiting = messages.filter((m) => !m.fromPage).slice(0, 12);
  if (waiting.length) {
    lines.push("رسائل بانتظار رد:");
    for (const m of waiting) {
      lines.push(
        `- [${m.participantId}] ${m.participant}: ${m.lastMessage.slice(0, 160)} (${m.updatedAt})`,
      );
    }
  }
  return lines.join("\n");
}
