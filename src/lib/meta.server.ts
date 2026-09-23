/**
 * النشر المباشر على منصات ميتا (صفحات فيسبوك + إنستجرام بزنس) بتطبيق ميتا الخاص بنا.
 *
 * لماذا مسار مباشر بجانب Pipedream؟ تطبيق ميتا المشترك لدى الوسيط لا يمنح صلاحيات
 * النشر (pages_manage_posts…)، فيبقى الربط «قراءة فقط». هنا نستخدم App ID/Secret
 * الخاصين بنا، نطلب أذونات النشر كاملة، نبدّل التوكن القصير بتوكن طويل المدى،
 * ونحفظ توكن الصفحة ومعرّف حساب إنستجرام في جدول meta_connections (خادم فقط).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export const GRAPH = "https://graph.facebook.com/v23.0";

/** الأذونات المطلوبة أثناء ربط المستخدم لحسابه. */
export const META_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
] as const;

export type MetaConfig = { appId: string; appSecret: string };

export type MetaConnection = {
  id: string;
  kind: "facebook" | "instagram";
  pageId: string;
  pageName: string | null;
  pageToken: string;
  igUserId: string | null;
  igUsername: string | null;
  scopes: string[];
  status: string;
  expiresAt: string | null;
};

/** مفاتيح تطبيق ميتا من طبقة الأسرار الموحّدة (app_secrets ثم البيئة). */
export async function metaConfig(): Promise<MetaConfig | null> {
  const { getSecrets } = await import("./secrets.server");
  const found = await getSecrets(["META_APP_ID", "META_APP_SECRET"] as const);
  const appId = found.META_APP_ID?.trim();
  const appSecret = found.META_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

export function metaMissingConfigError(): Error {
  return new Error(
    "لم تُضبط مفاتيح تطبيق ميتا بعد. أضف META_APP_ID و META_APP_SECRET في الإعدادات ← المفاتيح.",
  );
}

/* ------------------------------- حالة موقّعة ------------------------------- */

function b64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64url(new Uint8Array(sig));
}

/** أذونات قناة واتساب للأعمال — ربط بضغطة واحدة بلا إدخال أي معرّفات. */
export const WHATSAPP_SCOPES = [
  "whatsapp_business_management",
  "whatsapp_business_messaging",
  "business_management",
] as const;

/** حالة OAuth موقّعة: تحمل مساحة العمل ووقت الإصدار بلا حاجة لجدول مؤقت. */
export async function signState(
  config: MetaConfig,
  workspaceId: string,
  returnTo: string,
  kind: "meta" | "whatsapp" = "meta",
): Promise<string> {
  const payload = b64url(
    new TextEncoder().encode(
      JSON.stringify({ w: workspaceId, t: Date.now(), r: returnTo, k: kind }),
    ),
  );
  return `${payload}.${await hmac(config.appSecret, payload)}`;
}

export async function verifyState(
  config: MetaConfig,
  state: string,
): Promise<{ workspaceId: string; returnTo: string; kind: "meta" | "whatsapp" } | null> {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const { secretsMatch } = await import("./timing-safe");
  if (!secretsMatch(sig, await hmac(config.appSecret, payload))) return null;
  try {
    const json = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(payload.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
          c.charCodeAt(0),
        ),
      ),
    ) as { w?: string; t?: number; r?: string; k?: string };
    if (!json.w || !json.t) return null;
    if (Date.now() - json.t > 30 * 60 * 1000) return null; // صالحة نصف ساعة
    return {
      workspaceId: json.w,
      returnTo: typeof json.r === "string" ? json.r : "/app/integrations",
      kind: json.k === "whatsapp" ? "whatsapp" : "meta",
    };
  } catch {
    return null;
  }
}

/* --------------------------------- OAuth --------------------------------- */

/**
 * أصل ثابت لرابط العودة — لأن نطاق المعاينة يتغيّر (lovableproject.com / id-preview)
 * بينما لوحة ميتا تقبل روابط مسجّلة فقط. نستخدم النطاق الثابت للمشروع دائماً.
 * يُضبط عبر META_REDIRECT_ORIGIN؛ القيمة أدناه احتياطية فقط لبيئة المعاينة.
 */
const META_FALLBACK_ORIGIN = "https://project--541025ee-163e-49a6-8c43-600f36bcb147.lovable.app";

export function metaCanonicalOrigin(): string {
  const configured = process.env["META_REDIRECT_ORIGIN"] || process.env["PUBLIC_SITE_ORIGIN"] || "";
  try {
    if (configured) return new URL(configured).origin;
  } catch {
    console.error("[meta] META_REDIRECT_ORIGIN غير صالح — استُخدم الأصل الاحتياطي.");
  }
  return META_FALLBACK_ORIGIN;
}

/** @deprecated استخدم metaCanonicalOrigin() — يبقى للتوافق مع الاستدعاءات القديمة. */
export const META_CANONICAL_ORIGIN = META_FALLBACK_ORIGIN;

export function metaRedirectUri(_origin?: string): string {
  return `${metaCanonicalOrigin()}/api/public/meta/callback`;
}

export function metaAuthorizeUrl(
  config: MetaConfig,
  redirectUri: string,
  state: string,
  scopes: readonly string[] = META_SCOPES,
): string {
  const url = new URL("https://www.facebook.com/v23.0/dialog/oauth");
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(","));
  return url.toString();
}

/* ------------------------------ اكتشاف واتساب ----------------------------- */

export type WabaPhone = { id: string; displayNumber: string; name?: string; wabaId: string };

/**
 * يكتشف حسابات واتساب للأعمال وأرقامها من توكن المستخدم مباشرة —
 * بلا أي معرّفات يكتبها المستخدم. المسار الأول: الأذونات الممنوحة (debug_token)،
 * وإن لم تُرجِع شيئاً نمرّ على شركات المستخدم.
 */
export async function discoverWabaPhones(
  config: MetaConfig,
  userToken: string,
): Promise<WabaPhone[]> {
  const wabaIds = new Set<string>();
  const discoveryErrors: string[] = [];

  try {
    const debug = await graph<{
      data?: { granular_scopes?: { scope: string; target_ids?: string[] }[] };
    }>(
      `${GRAPH}/debug_token?input_token=${encodeURIComponent(userToken)}` +
        `&access_token=${encodeURIComponent(`${config.appId}|${config.appSecret}`)}`,
    );
    for (const g of debug.data?.granular_scopes ?? []) {
      if (g.scope.startsWith("whatsapp_business"))
        for (const id of g.target_ids ?? []) wabaIds.add(id);
    }
  } catch (error) {
    discoveryErrors.push(error instanceof Error ? error.message : "تعذّر فحص صلاحيات واتساب");
  }

  try {
    const businesses = await graph<{ data?: { id: string }[] }>(
      `${GRAPH}/me/businesses?limit=100&access_token=${encodeURIComponent(userToken)}`,
    );
    for (const business of businesses.data ?? []) {
      // قد يكون الحساب مملوكاً للشركة أو ممنوحاً لها من شركة أخرى؛ كلاهما صالح
      // للمستخدم المسؤول ولا ينبغي إجباره على إدخال أي معرّف يدوياً.
      for (const edge of [
        "owned_whatsapp_business_accounts",
        "client_whatsapp_business_accounts",
      ] as const) {
        try {
          const accounts = await graph<{ data?: { id: string }[] }>(
            `${GRAPH}/${business.id}/${edge}?limit=100&access_token=${encodeURIComponent(userToken)}`,
          );
          for (const waba of accounts.data ?? []) wabaIds.add(waba.id);
        } catch (error) {
          discoveryErrors.push(error instanceof Error ? error.message : `تعذّر فحص ${edge}`);
        }
      }
    }
  } catch (error) {
    discoveryErrors.push(error instanceof Error ? error.message : "تعذّر قراءة أنشطة ميتا");
  }

  const phones: WabaPhone[] = [];
  for (const wabaId of wabaIds) {
    try {
      const res = await graph<{
        data?: { id: string; display_phone_number?: string; verified_name?: string }[];
      }>(`${GRAPH}/${wabaId}/phone_numbers?limit=25&access_token=${encodeURIComponent(userToken)}`);
      for (const p of res.data ?? []) {
        phones.push({
          id: p.id,
          displayNumber: p.display_phone_number ?? "",
          wabaId,
          ...(p.verified_name ? { name: p.verified_name } : {}),
        });
      }
    } catch (error) {
      discoveryErrors.push(error instanceof Error ? error.message : `تعذّر قراءة أرقام ${wabaId}`);
    }
  }
  if (!phones.length && discoveryErrors.length) {
    console.error("[whatsapp] WABA discovery failed", [...new Set(discoveryErrors)].join(" | "));
  }
  return phones;
}

/** يشترك تطبيقنا في ويبهوك حساب واتساب حتى تصل الرسائل بلا إعداد يدوي. */
export async function subscribeWaba(wabaId: string, userToken: string): Promise<void> {
  await graph(`${GRAPH}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ access_token: userToken }).toString(),
  });
}

/** أخطاء ميتا العابرة: ازدحام أو حد طلبات أو عطل مؤقت — تستحق إعادة محاولة. */
export function isTransientMetaFailure(status: number, code?: number): boolean {
  if (status === 429 || status >= 500) return true;
  return code === 1 || code === 2 || code === 4 || code === 17 || code === 32 || code === 341;
}

const GRAPH_RETRY_DELAYS_MS = [400, 1200, 3000];

/** مهلة بين المحاولات — قابلة للاستبدال في الاختبارات. */
async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function graph<T>(url: string, init?: RequestInit): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= GRAPH_RETRY_DELAYS_MS.length; attempt += 1) {
    let res: Response;
    try {
      // مهلة لكل محاولة: تعليق نداء ميتا كان يجمّد النشر بلا رسالة.
      res = await fetch(url, { signal: AbortSignal.timeout(30_000), ...init });
    } catch (networkError) {
      lastError =
        networkError instanceof Error ? networkError : new Error("تعذّر الاتصال بخوادم ميتا.");
      const delay = GRAPH_RETRY_DELAYS_MS[attempt];
      if (delay === undefined) break;
      await wait(delay);
      continue;
    }
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }
    if (res.ok) return json as T;

    const err = (json as { error?: { message?: string; code?: number; error_subcode?: number } })
      .error;
    lastError = new Error(
      explainMetaError(err) ?? `ميتا رفضت الطلب [${res.status}]: ${text.slice(0, 200)}`,
    );
    const delay = GRAPH_RETRY_DELAYS_MS[attempt];
    if (delay === undefined || !isTransientMetaFailure(res.status, err?.code)) break;
    await wait(delay);
  }
  throw lastError ?? new Error("تعذّر إتمام الطلب مع ميتا.");
}

/** ترجمة أخطاء Graph إلى سبب وحل بالعربية. */
export function explainMetaError(
  err?: { message?: string; code?: number; error_subcode?: number } | null,
): string | null {
  if (!err) return null;
  const message = err.message ?? "";
  const code = err.code;
  if (/verification code|authorization code/i.test(message))
    return "انتهت محاولة الربط أو استُخدم رمزها من قبل — ابدأ محاولة ربط جديدة.";
  if (code === 190) return "انتهت صلاحية الربط مع ميتا — أعد ربط الحساب من صفحة التكاملات.";
  if (code === 200 || code === 283 || /pages_manage_posts|permission/i.test(message))
    return (
      "ميتا رفضت النشر لنقص الأذونات (pages_manage_posts / pages_read_engagement). " +
      "أعد الربط ووافق على كل الأذونات، وتأكد أنك مسؤول (Admin) على الصفحة."
    );
  if (code === 10)
    return "التطبيق لا يملك الإذن لهذا الإجراء على هذه الصفحة — تأكد أنك مسؤول عنها.";
  if (code === 368) return "ميتا حظرت النشر مؤقتاً على هذه الصفحة — حاول لاحقاً.";
  if (code === 4 || code === 17 || code === 32 || code === 9)
    return "تجاوزت حد الطلبات لدى ميتا — انتظر قليلاً ثم أعد المحاولة.";
  if (code === 100 && /image|media|url/i.test(message))
    return "ميتا رفضت الوسائط — تأكد أن الرابط عام ومباشر (JPG/PNG أو MP4).";
  return message ? `ميتا: ${message}` : null;
}

/** تبديل رمز OAuth بتوكن مستخدم قصير المدى. */
export async function exchangeCode(
  config: MetaConfig,
  code: string,
  redirectUri: string,
): Promise<string> {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("client_secret", config.appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);
  const res = await graph<{ access_token: string }>(url.toString());
  return res.access_token;
}

/** تبديل التوكن القصير بتوكن طويل المدى (~60 يوماً). */
export async function longLivedToken(
  config: MetaConfig,
  shortToken: string,
): Promise<{ token: string; expiresAt: string | null }> {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("client_secret", config.appSecret);
  url.searchParams.set("fb_exchange_token", shortToken);
  const res = await graph<{ access_token: string; expires_in?: number }>(url.toString());
  return {
    token: res.access_token,
    expiresAt: res.expires_in ? new Date(Date.now() + res.expires_in * 1000).toISOString() : null,
  };
}

/** الأذونات الممنوحة فعلاً لهذا التوكن. */
export async function grantedScopes(userToken: string): Promise<string[]> {
  const res = await graph<{ data?: { permission: string; status: string }[] }>(
    `${GRAPH}/me/permissions?access_token=${encodeURIComponent(userToken)}`,
  );
  return (res.data ?? []).filter((p) => p.status === "granted").map((p) => p.permission);
}

export type MetaPage = {
  id: string;
  name?: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
};

/** صفحات المستخدم مع توكن كل صفحة وحساب إنستجرام المرتبط بها. */
export async function fetchPages(userToken: string): Promise<MetaPage[]> {
  const res = await graph<{ data?: MetaPage[] }>(
    `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=50&access_token=${encodeURIComponent(userToken)}`,
  );
  return (res.data ?? []).filter((p) => p.access_token);
}

/** يحفظ (أو يحدّث) كل الصفحات وحسابات إنستجرام لمساحة العمل. */
export async function saveConnections(
  admin: Admin,
  workspaceId: string,
  params: { userToken: string; expiresAt: string | null; scopes: string[]; pages: MetaPage[] },
): Promise<{ facebook: number; instagram: number }> {
  let facebook = 0;
  let instagram = 0;
  for (const page of params.pages) {
    const base = {
      workspace_id: workspaceId,
      page_id: page.id,
      page_name: page.name ?? null,
      page_access_token: page.access_token,
      user_access_token: params.userToken,
      token_expires_at: params.expiresAt,
      scopes: params.scopes,
      status: "connected",
      last_error: null,
    };
    const { error } = await admin
      .from("meta_connections")
      .upsert({ ...base, kind: "facebook" }, { onConflict: "workspace_id,kind,page_id" });
    if (error) throw new Error(error.message);
    facebook += 1;

    if (page.instagram_business_account?.id) {
      const { error: igError } = await admin.from("meta_connections").upsert(
        {
          ...base,
          kind: "instagram",
          ig_user_id: page.instagram_business_account.id,
          ig_username: page.instagram_business_account.username ?? null,
        },
        { onConflict: "workspace_id,kind,page_id" },
      );
      if (igError) throw new Error(igError.message);
      instagram += 1;
    }
  }

  // نعكس الحالة على شاشة التكاملات العامة أيضاً.
  for (const provider of ["facebook", ...(instagram ? ["instagram"] : [])]) {
    await admin
      .from("integrations")
      .update({ status: "connected", account: params.pages[0]?.name ?? "Meta" })
      .eq("workspace_id", workspaceId)
      .eq("provider", provider);
  }
  return { facebook, instagram };
}

function toConnection(row: {
  id: string;
  kind: string;
  page_id: string;
  page_name: string | null;
  page_access_token: string;
  ig_user_id: string | null;
  ig_username: string | null;
  scopes: string[] | null;
  status: string;
  token_expires_at: string | null;
}): MetaConnection {
  return {
    id: row.id,
    kind: row.kind === "instagram" ? "instagram" : "facebook",
    pageId: row.page_id,
    pageName: row.page_name,
    pageToken: row.page_access_token,
    igUserId: row.ig_user_id,
    igUsername: row.ig_username,
    scopes: row.scopes ?? [],
    status: row.status,
    expiresAt: row.token_expires_at,
  };
}

/** كل روابط ميتا المباشرة لمساحة العمل. */
export async function listMetaConnections(
  admin: Admin,
  workspaceId: string,
  kind?: "facebook" | "instagram",
): Promise<MetaConnection[]> {
  let query = admin
    .from("meta_connections")
    .select(
      "id, kind, page_id, page_name, page_access_token, ig_user_id, ig_username, scopes, status, token_expires_at",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toConnection);
}

/** الربط المستخدم للنشر على منصة ميتا (أول ربط صالح، أو صفحة محدّدة). */
export async function metaTarget(
  admin: Admin,
  workspaceId: string,
  kind: "facebook" | "instagram",
  pageId?: string,
): Promise<MetaConnection | null> {
  await refreshMetaTokensIfExpiring(admin, workspaceId);
  const all = await listMetaConnections(admin, workspaceId, kind);
  const usable = all.filter((c) => (kind === "instagram" ? Boolean(c.igUserId) : true));
  if (pageId) return usable.find((c) => c.pageId === pageId) ?? null;
  return usable.find((c) => c.status === "connected") ?? usable[0] ?? null;
}

/** عتبة التجديد الاستباقي: نجدّد قبل انتهاء التوكن بعشرة أيام. */
export const META_REFRESH_WINDOW_MS = 10 * 24 * 60 * 60 * 1000;

export function metaTokenNeedsRefresh(expiresAt: string | null, now = Date.now()): boolean {
  if (!expiresAt) return false;
  const expiry = Date.parse(expiresAt);
  if (Number.isNaN(expiry)) return false;
  return expiry - now <= META_REFRESH_WINDOW_MS;
}

/**
 * تجديد استباقي لتوكن ميتا الطويل قبل انتهائه، بدل اكتشاف الانتهاء بخطأ 190 أثناء النشر.
 * لا يرمي أخطاء: الفشل يُسجَّل فقط ويترك التوكن الحالي كما هو.
 */
export async function refreshMetaTokensIfExpiring(
  admin: Admin,
  workspaceId: string,
): Promise<boolean> {
  try {
    const { data, error } = await admin
      .from("meta_connections")
      .select("user_access_token, token_expires_at")
      .eq("workspace_id", workspaceId)
      .eq("status", "connected")
      .limit(1);
    if (error || !data?.length) return false;
    const row = data[0] as { user_access_token: string | null; token_expires_at: string | null };
    if (!row.user_access_token || !metaTokenNeedsRefresh(row.token_expires_at)) return false;

    const config = await metaConfig();
    if (!config) return false;

    const fresh = await longLivedToken(config, row.user_access_token);
    const pages = await fetchPages(fresh.token);
    if (!pages.length) return false;
    const scopes = await grantedScopes(fresh.token).catch(() => [] as string[]);
    await saveConnections(admin, workspaceId, {
      userToken: fresh.token,
      expiresAt: fresh.expiresAt,
      scopes,
      pages,
    });
    return true;
  } catch (refreshError) {
    console.error("[meta] proactive token refresh failed", refreshError);
    return false;
  }
}

/** هل يوجد مسار ميتا مباشر جاهز لهذه المنصة؟ (يقرر التوجيه الهجين) */
export async function hasMetaDirect(
  admin: Admin,
  workspaceId: string,
  provider: string,
): Promise<boolean> {
  if (provider !== "facebook" && provider !== "instagram") return false;
  if (!(await metaConfig())) return false;
  return Boolean(await metaTarget(admin, workspaceId, provider));
}

/* -------------------------------- النشر -------------------------------- */

export type MetaMedia = { url: string; kind: "image" | "video" };

export type MetaPublishInput = {
  text: string;
  imageUrl?: string | undefined;
  videoUrl?: string | undefined;
  /** وسائط متعددة (ألبوم فيسبوك / كاروسيل إنستجرام). */
  media?: MetaMedia[] | undefined;
  pageId?: string | undefined;
};

/** يوحّد الوسائط: القائمة المتعددة أولاً ثم الحقول المفردة القديمة. */
export function normalizeMedia(input: MetaPublishInput): MetaMedia[] {
  const list = [...(input.media ?? [])];
  if (!list.length) {
    if (input.imageUrl) list.push({ url: input.imageUrl, kind: "image" });
    if (input.videoUrl) list.push({ url: input.videoUrl, kind: "video" });
  }
  const seen = new Set<string>();
  return list.filter((m) => m.url && !seen.has(m.url) && seen.add(m.url)).slice(0, 10);
}

export type MetaPublishResult = {
  provider: "facebook" | "instagram";
  postId: string;
  pageId: string;
  pageName: string | null;
  permalink: string | null;
  raw: unknown;
};

/** نشر على صفحة فيسبوك: نص / صورة أو ألبوم صور (‎/photos‎) / فيديو (‎/videos‎). */
export async function publishFacebook(
  conn: MetaConnection,
  input: MetaPublishInput,
): Promise<MetaPublishResult> {
  const media = normalizeMedia(input);
  const images = media.filter((m) => m.kind === "image").map((m) => m.url);
  const videos = media.filter((m) => m.kind === "video").map((m) => m.url);

  // ألبوم: نرفع كل صورة غير منشورة ثم ننشر منشوراً واحداً يضمّها كلها.
  if (images.length > 1) {
    const ids: string[] = [];
    for (const url of images) {
      const photo = await graph<{ id?: string }>(`${GRAPH}/${conn.pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          url,
          published: "false",
          access_token: conn.pageToken,
        }).toString(),
      });
      if (photo.id) ids.push(photo.id);
    }
    if (!ids.length) throw new Error("تعذّر رفع صور المنشور إلى فيسبوك.");
    const feedParams = new URLSearchParams({
      message: input.text,
      access_token: conn.pageToken,
    });
    ids.forEach((id, i) =>
      feedParams.set(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })),
    );
    const album = await graph<{ id?: string; post_id?: string }>(`${GRAPH}/${conn.pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: feedParams.toString(),
    });
    const albumId = album.post_id ?? album.id ?? "";
    if (!albumId) throw new Error("ميتا لم تُعِد معرّف المنشور — أعد المحاولة.");
    return {
      provider: "facebook",
      postId: albumId,
      pageId: conn.pageId,
      pageName: conn.pageName,
      permalink: `https://www.facebook.com/${albumId}`,
      raw: album,
    };
  }

  let endpoint = `${GRAPH}/${conn.pageId}/feed`;
  const params = new URLSearchParams({ access_token: conn.pageToken });
  if (videos[0]) {
    endpoint = `${GRAPH}/${conn.pageId}/videos`;
    params.set("file_url", videos[0]);
    params.set("description", input.text);
  } else if (images[0]) {
    endpoint = `${GRAPH}/${conn.pageId}/photos`;
    params.set("url", images[0]);
    params.set("caption", input.text);
    params.set("published", "true");
  } else {
    params.set("message", input.text);
  }

  const res = await graph<{ id?: string; post_id?: string }>(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const postId = res.post_id ?? res.id ?? "";
  if (!postId) throw new Error("ميتا لم تُعِد معرّف المنشور — أعد المحاولة.");
  return {
    provider: "facebook",
    postId,
    pageId: conn.pageId,
    pageName: conn.pageName,
    permalink: `https://www.facebook.com/${postId}`,
    raw: res,
  };
}

/** ينتظر جاهزية حاوية إنستجرام (الفيديو والكاروسيل يحتاجان معالجة). */
async function waitForContainer(conn: MetaConnection, containerId: string): Promise<void> {
  for (let i = 0; i < 18; i += 1) {
    await new Promise((r) => setTimeout(r, 5_000));
    const st = await graph<{ status_code?: string }>(
      `${GRAPH}/${containerId}?fields=status_code&access_token=${encodeURIComponent(conn.pageToken)}`,
    );
    if (st.status_code === "FINISHED") return;
    if (st.status_code === "ERROR")
      throw new Error(
        "إنستجرام رفض الوسائط — استخدم MP4 عمودياً (9:16) أقل من ٩٠ ثانية أو صوراً بصيغة JPG.",
      );
  }
}

/** نشر على إنستجرام: حاوية (أو كاروسيل) ثم media_publish مع انتظار معالجة الفيديو. */

export async function publishInstagram(
  conn: MetaConnection,
  input: MetaPublishInput,
): Promise<MetaPublishResult> {
  if (!conn.igUserId) throw new Error("لا يوجد حساب إنستجرام احترافي مرتبط بهذه الصفحة.");
  const media = normalizeMedia(input);
  if (!media.length) throw new Error("إنستجرام يتطلب صورة أو فيديو مع المنشور.");

  /** ينشئ حاوية عنصر واحد وينتظر جاهزيته إن كان فيديو. */
  const makeContainer = async (item: MetaMedia, extra: Record<string, string> = {}) => {
    const body = new URLSearchParams({ access_token: conn.pageToken, ...extra });
    if (item.kind === "video") body.set("video_url", item.url);
    else body.set("image_url", item.url);
    const created = await graph<{ id?: string }>(`${GRAPH}/${conn.igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!created.id) throw new Error("تعذّر تجهيز وسائط إنستجرام.");
    if (item.kind === "video") await waitForContainer(conn, created.id);
    return created.id;
  };

  let containerId: string;
  if (media.length > 1) {
    const children: string[] = [];
    for (const item of media)
      children.push(await makeContainer(item, { is_carousel_item: "true" }));
    const carousel = await graph<{ id?: string }>(`${GRAPH}/${conn.igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        media_type: "CAROUSEL",
        children: children.join(","),
        caption: input.text,
        access_token: conn.pageToken,
      }).toString(),
    });
    if (!carousel.id) throw new Error("تعذّر تجهيز الكاروسيل على إنستجرام.");
    containerId = carousel.id;
  } else {
    const only = media[0]!;
    containerId = await makeContainer(only, {
      caption: input.text,
      ...(only.kind === "video" ? { media_type: "REELS" } : {}),
    });
  }
  const container = { id: containerId };

  // الكاروسيل نفسه يحتاج لحظات ليجهز بعد تجهيز أبنائه.
  if (media.length > 1) await waitForContainer(conn, container.id);

  const published = await graph<{ id?: string }>(`${GRAPH}/${conn.igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: container.id,
      access_token: conn.pageToken,
    }).toString(),
  });
  if (!published.id) throw new Error("إنستجرام لم يُعِد معرّف المنشور.");

  let permalink: string | null = null;
  try {
    const meta = await graph<{ permalink?: string }>(
      `${GRAPH}/${published.id}?fields=permalink&access_token=${encodeURIComponent(conn.pageToken)}`,
    );
    permalink = meta.permalink ?? null;
  } catch {
    /* الرابط اختياري */
  }

  return {
    provider: "instagram",
    postId: published.id,
    pageId: conn.pageId,
    pageName: conn.igUsername ?? conn.pageName,
    permalink,
    raw: published,
  };
}

/** المدخل الموحّد للنشر المباشر على ميتا. */
export async function metaPublish(
  admin: Admin,
  workspaceId: string,
  provider: "facebook" | "instagram",
  input: MetaPublishInput,
): Promise<MetaPublishResult> {
  const conn = await metaTarget(admin, workspaceId, provider, input.pageId);
  if (!conn)
    throw new Error(
      provider === "facebook"
        ? "لا توجد صفحة فيسبوك مربوطة مباشرةً — اربط ميتا من صفحة التكاملات."
        : "لا يوجد حساب إنستجرام احترافي مربوط — اربط ميتا واختر صفحة مرتبطة بحساب إنستجرام.",
    );
  try {
    const result =
      provider === "facebook"
        ? await publishFacebook(conn, input)
        : await publishInstagram(conn, input);
    await admin
      .from("meta_connections")
      .update({ status: "connected", last_error: null })
      .eq("id", conn.id);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل غير معروف";
    await admin.from("meta_connections").update({ last_error: message }).eq("id", conn.id);
    throw error;
  }
}

/** تشخيص جاهزية النشر: الأذونات الناقصة وحالة كل صفحة. */
export async function metaDiagnose(
  admin: Admin,
  workspaceId: string,
): Promise<{
  configured: boolean;
  connections: {
    kind: "facebook" | "instagram";
    pageId: string;
    name: string | null;
    igUserId: string | null;
    canPublish: boolean;
    missing: string[];
    expiresAt: string | null;
    lastError?: string | null;
  }[];
}> {
  const configured = Boolean(await metaConfig());
  const rows = await listMetaConnections(admin, workspaceId);
  const connections = rows.map((c) => {
    const needed =
      c.kind === "facebook"
        ? ["pages_manage_posts", "pages_read_engagement"]
        : ["instagram_basic", "instagram_content_publish", "pages_read_engagement"];
    const missing = needed.filter((s) => !c.scopes.includes(s));
    return {
      kind: c.kind,
      pageId: c.pageId,
      name: c.kind === "instagram" ? (c.igUsername ?? c.pageName) : c.pageName,
      igUserId: c.igUserId,
      canPublish: missing.length === 0 && (c.kind === "facebook" || Boolean(c.igUserId)),
      missing,
      expiresAt: c.expiresAt,
    };
  });
  return { configured, connections };
}
