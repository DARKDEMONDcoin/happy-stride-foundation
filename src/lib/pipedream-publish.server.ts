/**
 * النشر الفعلي على المنصات الاجتماعية عبر إجراءات Pipedream الجاهزة.
 * يُستخدم من دالة الخادم (بطلب المستخدم) ومن الجدولة التلقائية بنفس المنطق.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { pipedreamApp } from "@/data/pipedream-apps";
import {
  pipedreamConfig,
  runAction,
  proxyRequest,
  missingConfigError,
  listAccounts,
  accountUsable,
  type PipedreamConfig,
} from "./pipedream.server";
import { assertMetaPublishScopes, pageTarget } from "./social-inbox.server";

type Admin = SupabaseClient<Database>;

export type PublishResult = {
  provider: string;
  accountId: string;
  result: unknown;
};

/**
 * كل الحسابات المرشحة للنشر لهذا المزوّد: المحفوظة لدينا أولاً ثم الحية لدى الوسيط.
 * نعيد قائمة (لا حساباً واحداً) لأن مساحة العمل قد تحتوي أكثر من ربط للمنصة نفسها،
 * وبعضها قديم بصلاحيات ناقصة — فنختار لاحقاً الربط الذي يسمح بالنشر فعلاً.
 */
async function resolveAccountCandidates(
  admin: Admin,
  config: PipedreamConfig,
  workspaceId: string,
  provider: string,
  appSlug?: string,
): Promise<string[]> {
  const ids: string[] = [];
  const { data: stored } = await admin
    .from("pipedream_accounts")
    .select("account_id, status")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .order("connected_at", { ascending: false });
  for (const row of stored ?? []) {
    if (row.status === "connected" && row.account_id) ids.push(row.account_id);
  }
  if (!appSlug) return ids;

  let live: Awaited<ReturnType<typeof listAccounts>> = [];
  try {
    live = await listAccounts(config, workspaceId, appSlug);
  } catch (error) {
    console.error("[publish] live account lookup failed", error);
    return ids;
  }
  const usable = live.filter((a) => accountUsable(a));
  for (const account of usable.length ? usable : live) {
    if (!ids.includes(account.id)) ids.push(account.id);
    const { error: saveError } = await admin.from("pipedream_accounts").upsert(
      {
        workspace_id: workspaceId,
        provider,
        app_slug: appSlug,
        account_id: account.id,
        account_name: account.name ?? null,
        status: accountUsable(account) ? "connected" : "error",
        healthy: accountUsable(account),
      },
      { onConflict: "workspace_id,provider,account_id" },
    );
    if (saveError) console.error("[publish] failed to persist account", saveError);
  }
  const first = usable[0] ?? live[0];
  if (first) {
    await admin
      .from("integrations")
      .update({ status: "connected", account: first.name ?? appSlug })
      .eq("workspace_id", workspaceId)
      .eq("provider", provider);
  }
  return ids;
}

/**
 * يختار من المرشحين الربط الذي يملك صلاحيات النشر فعلاً على ميتا،
 * ويعلّم الروابط الناقصة بأنها بحاجة إعادة ربط حتى لا تُختار مرة أخرى.
 */
async function pickMetaAccount(
  admin: Admin,
  config: PipedreamConfig,
  workspaceId: string,
  provider: "facebook" | "instagram",
  candidates: string[],
): Promise<string> {
  let lastError: unknown = null;
  for (const id of candidates) {
    try {
      await assertMetaPublishScopes(config, workspaceId, id, provider);
      return id;
    } catch (error) {
      lastError = error;
      await admin
        .from("pipedream_accounts")
        .update({ status: "error", healthy: false })
        .eq("workspace_id", workspaceId)
        .eq("provider", provider)
        .eq("account_id", id);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("لا يوجد ربط بصلاحيات النشر على ميتا — أعد الربط من صفحة التكاملات.");
}

/**
 * منع النشر المكرر: إعادة المحاولة (أو ضغطة ثانية) كانت تنشر النص مرتين على
 * المنصة. نرفض نصاً مطابقاً نُشر على المنصة نفسها خلال آخر ١٠ دقائق.
 */
async function assertNotDuplicate(
  admin: Admin,
  workspaceId: string,
  provider: string,
  text: string,
): Promise<void> {
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data } = await admin
    .from("social_posts")
    .select("id, body")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .eq("status", "published")
    .gte("published_at", since)
    .limit(20);
  const target = text.trim();
  if ((data ?? []).some((row) => (row.body ?? "").trim() === target)) {
    throw new Error(
      `هذا النص نُشر بالفعل على ${provider} خلال آخر ١٠ دقائق — منعنا نشره مرتين. عدّل النص أو انتظر قليلاً.`,
    );
  }
}

/**
 * قفل قصير داخل العملية: فحص قاعدة البيانات وحده لا يمنع طلبين متزامنين
 * (كلاهما يقرأ «لا يوجد» قبل أن يكتب الآخر). المفتاح = مساحة العمل + المنصة + النص.
 */
const inFlight = new Map<string, number>();

function claimInFlight(workspaceId: string, provider: string, text: string): () => void {
  const key = `${workspaceId}|${provider}|${text.trim()}`;
  const now = Date.now();
  for (const [k, at] of inFlight) if (now - at > 5 * 60_000) inFlight.delete(k);
  if (inFlight.has(key)) {
    throw new Error(`نفس النص قيد النشر الآن على ${provider} — منعنا نشره مرتين.`);
  }
  inFlight.set(key, now);
  return () => inFlight.delete(key);
}

type PublishParams = {
  workspaceId: string;
  provider: string;
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  /** وسائط متعددة: ألبوم فيسبوك أو كاروسيل إنستجرام. */
  media?: { url: string; kind: "image" | "video" }[];
};

export async function publishToPlatform(
  admin: Admin,
  params: PublishParams,
): Promise<PublishResult> {
  const release = claimInFlight(params.workspaceId, params.provider, params.text);
  try {
    return await publishToPlatformInner(admin, params);
  } finally {
    release();
  }
}

async function publishToPlatformInner(
  admin: Admin,
  params: PublishParams,
): Promise<PublishResult> {
  const app = pipedreamApp(params.provider);
  const metaProxy = params.provider === "instagram" || params.provider === "facebook";

  await assertNotDuplicate(admin, params.workspaceId, params.provider, params.text);

  const allMedia = (
    params.media?.length
      ? params.media
      : [
          ...(params.imageUrl ? [{ url: params.imageUrl, kind: "image" as const }] : []),
          ...(params.videoUrl ? [{ url: params.videoUrl, kind: "video" as const }] : []),
        ]
  ).slice(0, 10);
  const firstImage = allMedia.find((m) => m.kind === "image")?.url;
  const firstVideo = allMedia.find((m) => m.kind === "video")?.url;

  // تيليجرام: نشر مباشر ببوت العميل نفسه (بلا وسيط).
  if (params.provider === "telegram") {
    const { loadTelegramConfig, telegramPublish } = await import("./telegram.server");
    const telegramConfig = await loadTelegramConfig(admin, params.workspaceId);
    if (!telegramConfig?.chatId) {
      throw new Error(
        "تيليجرام غير مربوط بالبوت المباشر بعد — افتح الإعدادات ← تيليجرام، اختر المحادثة ثم احفظ الربط.",
      );
    }
    const result = await telegramPublish(admin, params.workspaceId, {
      text: params.text,
      ...(firstImage ? { imageUrl: firstImage } : {}),
      ...(firstVideo ? { videoUrl: firstVideo } : {}),
      ...(allMedia.length ? { media: allMedia } : {}),
    });
    return { provider: "telegram", accountId: `telegram:${result.chatId}`, result };
  }

  // المسار الهجين: إن كان ميتا مربوطاً مباشرةً بتطبيقنا الخاص (توكن صفحة محفوظ)،
  // ننشر عبر Graph API مباشرة — أدق وأسرع ولا يقيّده تطبيق الوسيط المشترك.
  if (metaProxy) {
    const { hasMetaDirect, metaPublish } = await import("./meta.server");
    const provider = params.provider as "facebook" | "instagram";
    if (await hasMetaDirect(admin, params.workspaceId, provider)) {
      const result = await metaPublish(admin, params.workspaceId, provider, {
        text: params.text,
        imageUrl: firstImage,
        videoUrl: firstVideo,
        media: allMedia,
      });
      return { provider: params.provider, accountId: `meta:${result.pageId}`, result };
    }
  }

  if (!metaProxy && (!app?.publishComponent || !app.accountProp)) {
    throw new Error(`النشر المباشر غير متاح بعد على ${app?.label ?? params.provider}.`);
  }

  const config = await pipedreamConfig();
  if (!config) throw missingConfigError();

  const candidates = await resolveAccountCandidates(
    admin,
    config,
    params.workspaceId,
    params.provider,
    app?.slug,
  );
  if (!candidates.length)
    throw new Error(`${app?.label ?? params.provider} غير مربوط بعد — اربطه من صفحة التكاملات.`);
  const accountId = metaProxy
    ? await pickMetaAccount(
        admin,
        config,
        params.workspaceId,
        params.provider as "facebook" | "instagram",
        candidates,
      )
    : candidates[0]!;
  const account = { account_id: accountId };

  // ميتا (إنستجرام/فيسبوك): ننشر عبر Graph API مباشرة من خلال وكيل Pipedream،
  // لأن الإجراءات الجاهزة لا تدعم النص الكامل مع الصورة على إنستجرام.
  if (metaProxy) {
    const result = await publishMeta(
      admin,
      config,
      params.workspaceId,
      account.account_id,
      params.provider as "instagram" | "facebook",
      params.text,
      firstImage,
      firstVideo,
      allMedia,
    );
    return { provider: params.provider, accountId: account.account_id, result };
  }
  if (!app?.publishComponent || !app.accountProp) {
    throw new Error(`النشر المباشر غير متاح بعد على ${params.provider}.`);
  }

  if (firstVideo)
    throw new Error(
      `نشر الفيديو متاح حالياً على فيسبوك وإنستجرام فقط — على ${app.label} انشر نصاً أو صورة.`,
    );

  // المسار المباشر (واجهة المنصة عبر وكيل الوسيط) أسرع وأدق من الإجراءات الجاهزة،
  // ويعمل في بيئة الإنتاج دون قيود باقة الإجراءات.
  const direct = await publishDirect(
    config,
    params.workspaceId,
    account.account_id,
    params.provider,
    params.text,
    firstImage,
  );
  if (direct !== undefined) {
    return { provider: params.provider, accountId: account.account_id, result: direct };
  }

  const props: Record<string, unknown> = {
    [app.accountProp]: { authProvisionId: account.account_id },
    ...textProps(params.provider, params.text),
  };
  if (firstImage) Object.assign(props, imageProps(params.provider, firstImage));

  const result = await runAction(config, {
    workspaceId: params.workspaceId,
    componentId: app.publishComponent,
    configuredProps: props,
  });

  return { provider: params.provider, accountId: account.account_id, result };
}

/** إكس يقصّ ما زاد عن 280 حرفاً — نرفض بدل أن نبتر النص بلا علم صاحبه. */
function assertXLength(text: string): string {
  const value = text.trim();
  if (value.length > 280) {
    throw new Error(
      `نص إكس ${value.length} حرفاً والحد 280 — اطلب من الموظف اختصاره ثم أعد النشر (لن نبتر نصك).`,
    );
  }
  return value;
}

/**
 * نشر مباشر على واجهة المنصة نفسها عبر وكيل Pipedream (بلا توكنات لدينا).
 * يعيد undefined إن لم يكن للمنصة مسار مباشر بعد.
 */
async function publishDirect(
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
  provider: string,
  text: string,
  imageUrl?: string,
): Promise<unknown | undefined> {
  if (provider === "x") {
    return proxyRequest(config, {
      workspaceId,
      accountId,
      method: "POST",
      url: "https://api.twitter.com/2/tweets",
      body: { text: assertXLength(text) },
    });
  }

  if (provider === "linkedin") {
    const me = await proxyRequest<{ sub?: string }>(config, {
      workspaceId,
      accountId,
      url: "https://api.linkedin.com/v2/userinfo",
    });
    if (!me.sub) throw new Error("تعذّر تحديد حساب لينكدإن — أعد الربط من صفحة التكاملات.");
    return proxyRequest(config, {
      workspaceId,
      accountId,
      method: "POST",
      url: "https://api.linkedin.com/v2/ugcPosts",
      headers: { "X-Restli-Protocol-Version": "2.0.0" },
      body: {
        author: `urn:li:person:${me.sub}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text },
            shareMediaCategory: "NONE",
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      },
    });
  }

  if (provider === "pinterest") {
    if (!imageUrl) throw new Error("بينترست يتطلب صورة مع البِن.");
    const boards = await proxyRequest<{ items?: { id?: string }[] }>(config, {
      workspaceId,
      accountId,
      url: "https://api.pinterest.com/v5/boards?page_size=1",
    });
    const boardId = boards.items?.[0]?.id;
    if (!boardId)
      throw new Error("لا يوجد لوح (Board) في حساب بينترست — أنشئ لوحاً ثم أعد المحاولة.");
    return proxyRequest(config, {
      workspaceId,
      accountId,
      method: "POST",
      url: "https://api.pinterest.com/v5/pins",
      body: {
        board_id: boardId,
        title: text.split("\n")[0]!.slice(0, 90),
        description: text.slice(0, 480),
        media_source: { source_type: "image_url", url: imageUrl },
      },
    });
  }

  return undefined;
}

const GRAPH = "https://graph.facebook.com/v23.0";

/** نشر على إنستجرام (حاوية ثم نشر) أو على صفحة فيسبوك — عبر وكيل Pipedream. */
async function publishMeta(
  admin: Admin,
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
  provider: "instagram" | "facebook",
  text: string,
  imageUrl?: string,
  videoUrl?: string,
  media: { url: string; kind: "image" | "video" }[] = [],
): Promise<unknown> {
  // نتحقق أولاً أن الربط يملك صلاحية النشر — وإلا نشرح السبب والحل بوضوح.
  await assertMetaPublishScopes(config, workspaceId, accountId, provider);
  const { data: link } = await admin
    .from("pipedream_accounts")
    .select("page_id")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .eq("account_id", accountId)
    .limit(1);
  const page = await pageTarget(config, workspaceId, accountId, link?.[0]?.page_id ?? undefined);
  if (!page)
    throw new Error(
      "تعذّر تحديد الصفحة المرتبطة بحسابك على ميتا — تأكد أنك مسؤول عن الصفحة ثم أعد الربط.",
    );
  if (!link?.[0]?.page_id) {
    const { error: pageSaveError } = await admin
      .from("pipedream_accounts")
      .update({ page_id: page.id, instagram_business_id: page.igId ?? null })
      .eq("workspace_id", workspaceId)
      .eq("provider", provider)
      .eq("account_id", accountId);
    if (pageSaveError)
      console.error("[publish] failed to persist Meta page selection", pageSaveError);
  }

  const items = media.length
    ? media
    : [
        ...(imageUrl ? [{ url: imageUrl, kind: "image" as const }] : []),
        ...(videoUrl ? [{ url: videoUrl, kind: "video" as const }] : []),
      ];
  const images = items.filter((m) => m.kind === "image").map((m) => m.url);

  /** ينتظر جاهزية حاوية إنستجرام (فيديو أو كاروسيل). */
  const waitReady = async (containerId: string) => {
    for (let i = 0; i < 18; i += 1) {
      await new Promise((r) => setTimeout(r, 5_000));
      const st = await proxyRequest<{ status_code?: string }>(config, {
        workspaceId,
        accountId,
        url: `${GRAPH}/${containerId}?fields=status_code&access_token=${page.token}`,
      });
      if (st.status_code === "FINISHED") return;
      if (st.status_code === "ERROR")
        throw new Error(
          "إنستجرام رفض الوسائط — استخدم MP4 عمودياً (9:16) أقل من ٩٠ ثانية أو صوراً JPG.",
        );
    }
    // لا نكمل النشر على حاوية غير جاهزة: نُبلغ بدل أن نفشل صامتين.
    throw new Error(
      "إنستجرام لم ينهِ معالجة الوسائط خلال دقيقة ونصف — جرّب النشر بعد قليل أو استخدم ملفاً أخف.",
    );
  };

  if (provider === "facebook") {
    // فيديو من جهاز المستخدم: يُرفع إلى الصفحة عبر رابطه العام.
    if (videoUrl) {
      return proxyRequest<unknown>(config, {
        workspaceId,
        accountId,
        method: "POST",
        url: `${GRAPH}/${page.id}/videos?${new URLSearchParams({
          file_url: videoUrl,
          description: text,
          access_token: page.token,
        }).toString()}`,
      });
    }
    // أكثر من صورة: ألبوم واحد بمنشور واحد.
    if (images.length > 1) {
      const ids: string[] = [];
      for (const url of images) {
        const photo = await proxyRequest<{ id?: string }>(config, {
          workspaceId,
          accountId,
          method: "POST",
          url: `${GRAPH}/${page.id}/photos?${new URLSearchParams({
            url,
            published: "false",
            access_token: page.token,
          }).toString()}`,
        });
        if (photo.id) ids.push(photo.id);
      }
      if (!ids.length) throw new Error("تعذّر رفع صور المنشور إلى فيسبوك.");
      const feed = new URLSearchParams({ message: text, access_token: page.token });
      ids.forEach((id, i) => feed.set(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
      return proxyRequest<unknown>(config, {
        workspaceId,
        accountId,
        method: "POST",
        url: `${GRAPH}/${page.id}/feed?${feed.toString()}`,
      });
    }
    // صورة واحدة: نرفعها كصورة حقيقية على /photos (لا كمعاينة رابط في /feed).
    if (images[0]) {
      return proxyRequest<unknown>(config, {
        workspaceId,
        accountId,
        method: "POST",
        url: `${GRAPH}/${page.id}/photos?${new URLSearchParams({
          url: images[0],
          caption: text,
          published: "true",
          access_token: page.token,
        }).toString()}`,
      });
    }
    return proxyRequest<unknown>(config, {
      workspaceId,
      accountId,
      method: "POST",
      url: `${GRAPH}/${page.id}/feed?${new URLSearchParams({
        message: text,
        access_token: page.token,
      }).toString()}`,
    });
  }

  if (!page.igId) throw new Error("لا يوجد حساب إنستجرام احترافي مرتبط بالصفحة.");
  if (!items.length) throw new Error("إنستجرام يتطلب صورة أو فيديو مع المنشور.");

  /** ينشئ حاوية عنصر واحد. */
  const makeContainer = async (
    item: { url: string; kind: "image" | "video" },
    extra: Record<string, string>,
  ) => {
    const created = await proxyRequest<{ id?: string }>(config, {
      workspaceId,
      accountId,
      method: "POST",
      url: `${GRAPH}/${page.igId}/media?${new URLSearchParams({
        ...(item.kind === "video" ? { video_url: item.url } : { image_url: item.url }),
        ...extra,
        access_token: page.token,
      }).toString()}`,
    });
    if (!created.id) throw new Error("تعذّر تجهيز وسائط إنستجرام.");
    if (item.kind === "video") await waitReady(created.id);
    return created.id;
  };

  let creationId: string;
  if (items.length > 1) {
    const children: string[] = [];
    for (const item of items)
      children.push(await makeContainer(item, { is_carousel_item: "true" }));
    const carousel = await proxyRequest<{ id?: string }>(config, {
      workspaceId,
      accountId,
      method: "POST",
      url: `${GRAPH}/${page.igId}/media?${new URLSearchParams({
        media_type: "CAROUSEL",
        children: children.join(","),
        caption: text,
        access_token: page.token,
      }).toString()}`,
    });
    if (!carousel.id) throw new Error("تعذّر تجهيز الكاروسيل على إنستجرام.");
    creationId = carousel.id;
    await waitReady(creationId);
  } else {
    const only = items[0]!;
    creationId = await makeContainer(only, {
      caption: text,
      ...(only.kind === "video" ? { media_type: "REELS" } : {}),
    });
  }

  return proxyRequest<unknown>(config, {
    workspaceId,
    accountId,
    method: "POST",
    url: `${GRAPH}/${page.igId}/media_publish?${new URLSearchParams({
      creation_id: creationId,
      access_token: page.token,
    }).toString()}`,
  });
}

/** اسم حقل النص يختلف بين إجراءات كل منصة. */
function textProps(provider: string, text: string): Record<string, string> {
  switch (provider) {
    case "x":
      return { text: assertXLength(text) };
    case "linkedin":
      return { text };
    case "slack":
      return { text };
    case "gmail":
      return { body: text };
    case "pinterest":
      return { title: text.split("\n")[0]!.slice(0, 90), description: text.slice(0, 480) };
    default:
      return { text };
  }
}

function imageProps(provider: string, imageUrl: string): Record<string, string> {
  switch (provider) {
    case "pinterest":
      return { imageUrl, mediaSource: imageUrl };
    default:
      return { imageUrl };
  }
}
