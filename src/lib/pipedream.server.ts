/**
 * طبقة Pipedream Connect — الوسيط الموحّد لكل تكاملات الموظفين.
 *
 * المبدأ: لا تلمس منصتنا أي توكن OAuth لأي منصة خارجية إطلاقاً.
 * المستخدم يربط حسابه عبر Pipedream، ونحن نحتفظ بمعرّف الحساب (apn_...) فقط،
 * ثم ننفّذ الطلبات إما عبر «إجراء جاهز» (actions/run) أو عبر «الوكيل» (proxy).
 *
 * المفاتيح تُقرأ من جدول app_secrets في Supabase (Supabase هو الباك إند الوحيد)
 * مع سقوط اختياري على متغيرات البيئة.
 */

const API = "https://api.pipedream.com/v1";

export type PipedreamConfig = {
  clientId: string;
  clientSecret: string;
  projectId: string;
  environment: "development" | "production";
};

type Cache = { at: number; value: PipedreamConfig };
let configCache: Cache | null = null;
let tokenCache: { at: number; ttl: number; token: string } | null = null;

const CONFIG_TTL = 5 * 60 * 1000;

const SECRET_NAMES = [
  "PIPEDREAM_CLIENT_ID",
  "PIPEDREAM_CLIENT_SECRET",
  "PIPEDREAM_PROJECT_ID",
  "PIPEDREAM_ENVIRONMENT",
] as const;

/** يقرأ إعدادات Pipedream عبر الطبقة الموحّدة للأسرار (جدول app_secrets في Supabase). */
export async function pipedreamConfig(): Promise<PipedreamConfig | null> {
  if (configCache && Date.now() - configCache.at < CONFIG_TTL) return configCache.value;

  const { getSecrets } = await import("./secrets.server");
  const found: Record<string, string> = await getSecrets(SECRET_NAMES);

  const clientId = found["PIPEDREAM_CLIENT_ID"] ?? "";
  const clientSecret = found["PIPEDREAM_CLIENT_SECRET"] ?? "";
  const projectId = found["PIPEDREAM_PROJECT_ID"] ?? "";
  if (!clientId || !clientSecret || !projectId) return null;

  const value: PipedreamConfig = {
    clientId,
    clientSecret,
    projectId,
    environment:
      found["PIPEDREAM_ENVIRONMENT"]?.trim().toLowerCase() === "production"
        ? "production"
        : "development",
  };
  configCache = { at: Date.now(), value };
  return value;
}

/** رسالة موحّدة عندما لا تكون مفاتيح Pipedream مضبوطة بعد. */
export function missingConfigError(): Error {
  return new Error(
    "لم تُضبط مفاتيح Pipedream بعد. أضف PIPEDREAM_CLIENT_ID و PIPEDREAM_CLIENT_SECRET و PIPEDREAM_PROJECT_ID في جدول app_secrets.",
  );
}

/** توكن خادم قصير العمر عبر client_credentials مع تخزين مؤقت. */
async function accessToken(config: PipedreamConfig): Promise<string> {
  if (tokenCache && Date.now() - tokenCache.at < tokenCache.ttl) return tokenCache.token;

  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    // بلا مهلة كان نداء واحد متعثّر يعلّق تنفيذ المهمة كلها.
    signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`تعذّر الاتصال بـ Pipedream [${res.status}]: ${text.slice(0, 200)}`);
  const json = JSON.parse(text) as { access_token: string; expires_in?: number };
  const ttl = Math.max(60_000, ((json.expires_in ?? 3600) - 120) * 1000);
  tokenCache = { at: Date.now(), ttl, token: json.access_token };
  return json.access_token;
}

async function call<T>(config: PipedreamConfig, path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken(config);
  const res = await fetch(`${API}/connect/${config.projectId}${path}`, {
    signal: AbortSignal.timeout(30_000),
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "x-pd-environment": config.environment,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[pipedream] ${path} [${res.status}]: ${text.slice(0, 400)}`);
    // نُبقي رقم الحالة داخل الرسالة كي يصنّفها مصنّف الأعطال المؤقتة في proxyRequest
    // ضمن القابل لإعادة المحاولة — بدونه كان أشهر عطل مؤقت (الازدحام) لا يُعاد أبداً.
    if (res.status === 429) throw new Error("Pipedream مشغول مؤقتاً [429] — أعد المحاولة بعد قليل.");
    // حساب مفقود لدى الوسيط = ربط قديم أو ملغى — نوضّحه بلغة المستخدم.
    if (text.includes("Auth provision not found")) {
      throw new Error("الحساب لم يعد مربوطاً — أعد ربطه من صفحة التكاملات ثم أعد المحاولة.");
    }
    if (text.includes("not available on your current plan")) {
      throw new Error(
        "هذه المنصة تحتاج تنفيذ إجراء جاهز لدى الوسيط، وهو غير مفعّل في باقة الوسيط الحالية. " +
          "المنصات الأساسية (فيسبوك، إنستجرام، إكس، لينكدإن، بينترست) تنشر مباشرة دون هذا القيد.",
      );
    }
    // طلبات الوكيل تنقل خطأ المنصة نفسها، لا خطأ الوسيط — نترجمه لسبب وحل مفهومين.
    const friendly = explainPlatformError(text);
    if (friendly) throw new Error(friendly);
    // نسبة الخطأ لصاحبه: تنفيذ إجراء جاهز يُرجِع غالباً خطأ المنصة نفسها داخل جسم
    // الرد، فنسبته للوسيط كانت تضلّل المالك ويذهب يفحص الوسيط بدل حسابه.
    const platformFault =
      path.startsWith("/proxy/") ||
      /oauth|token|permission|scope|unauthorized|forbidden|invalid_grant|rate.?limit|duplicate|invalid[_\s-]?(param|request|media)/i.test(
        text,
      );
    const source = platformFault ? "المنصة رفضت الطلب" : "الوسيط رفض الطلب";
    throw new Error(`${source} [${res.status}]: ${text.slice(0, 200)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** يترجم أخطاء Graph API (ميتا) وأمثالها إلى سبب + حل بالعربية. */
export function explainPlatformError(raw: string): string | null {
  let code: number | undefined;
  let message = "";
  try {
    const j = JSON.parse(raw) as {
      error?: { code?: number; message?: string; error_subcode?: number };
    };
    code = j.error?.code;
    message = j.error?.message ?? "";
  } catch {
    message = raw;
  }
  if (
    /pages_manage_posts|pages_read_engagement/.test(message) ||
    code === 283 ||
    (code === 200 && /permission/i.test(message))
  ) {
    return (
      "فيسبوك رفض النشر لأن الربط لا يملك صلاحية النشر (pages_manage_posts / pages_read_engagement). " +
      "نافذة الربط الافتراضية لا تطلب هذه الصلاحيات أصلاً، لذا لا يكفي إعادة الربط وحدها. " +
      "الحل: أنشئ تطبيق ميتا خاصاً بكم بصلاحيات Advanced Access، أضِفه كـ OAuth Client في مشروع Pipedream، " +
      "ثم الصق معرّفه في الإعدادات ← المفاتيح باسم PIPEDREAM_OAUTH_APP_FACEBOOK وأعد ربط فيسبوك."
    );
  }
  if (code === 190) return "انتهت صلاحية ربط فيسبوك/إنستجرام — أعد ربط الحساب من صفحة التكاملات.";
  if (code === 10)
    return "التطبيق لا يملك الإذن لهذا الإجراء على هذه الصفحة — تأكد أنك مسؤول (Admin) عن الصفحة ثم أعد الربط.";
  if (code === 368)
    return "فيسبوك حظر النشر مؤقتاً على هذه الصفحة (سياسة المجتمع) — حاول لاحقاً أو راجع إشعارات الصفحة.";
  if (code === 9 || code === 4 || code === 17 || code === 32)
    return "تجاوزت حد الطلبات المسموح لدى المنصة — انتظر قليلاً ثم أعد المحاولة.";
  if (code === 100 && /image|media|url/i.test(message))
    return "المنصة رفضت الصورة — تأكد أن رابط الصورة عام ومباشر (JPG/PNG) وحجمها أقل من 8 ميجابايت.";
  if (code === 9004 || /instagram.*(media|container)/i.test(message))
    return "إنستجرام تعذّر تحميل الوسائط — استخدم صورة JPG عامة بنسبة بين 4:5 و1.91:1.";
  return null;
}

/** معرّف المستخدم لدى Pipedream = مساحة العمل (كل ربط يخص العلامة لا الشخص). */
export function externalUserId(workspaceId: string): string {
  return `ws_${workspaceId}`;
}

export type ConnectToken = {
  token: string;
  expires_at?: string;
  connect_link_url?: string;
};

/** ينشئ توكن ربط قصير العمر لصفحة الربط (Connect Link أو الـ SDK). */
export async function createConnectToken(
  config: PipedreamConfig,
  workspaceId: string,
  allowedOrigins: string[],
  redirects?: { success?: string; error?: string },
): Promise<ConnectToken> {
  return call<ConnectToken>(config, "/tokens", {
    method: "POST",
    body: JSON.stringify({
      external_user_id: externalUserId(workspaceId),
      allowed_origins: allowedOrigins,
      ...(redirects?.success ? { success_redirect_uri: redirects.success } : {}),
      ...(redirects?.error ? { error_redirect_uri: redirects.error } : {}),
    }),
  });
}

/**
 * بعض المنصات (فيسبوك/إنستجرام) تعرض «ملفات صلاحيات» متعددة عند الربط،
 * والافتراضي منها للقراءة فقط — فلا يمكن النشر. نختار تلقائياً أصغر ملف
 * يغطي الصلاحيات المطلوبة للنشر ونمرّره في رابط الربط.
 */
export async function pickScopeProfile(
  config: PipedreamConfig,
  appSlug: string,
  requiredScopes: string[],
): Promise<string | null> {
  if (!requiredScopes.length) return null;
  try {
    const token = await accessToken(config);
    const res = await fetch(`${API}/apps/${encodeURIComponent(appSlug)}`, {
      signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${token}`, "x-pd-environment": config.environment },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { scope_profiles?: { name?: string; scopes?: string[] }[] };
    };
    const profiles = json.data?.scope_profiles ?? [];
    const matching = profiles.filter(
      (p) => p.name && requiredScopes.every((s) => (p.scopes ?? []).includes(s)),
    );
    if (!matching.length) return null;
    matching.sort((a, b) => (a.scopes?.length ?? 0) - (b.scopes?.length ?? 0));
    return matching[0]!.name!;
  } catch (error) {
    console.error("[pipedream] scope profile lookup failed", error);
    return null;
  }
}

export type PdAccount = {
  id: string;
  name?: string | null;
  healthy?: boolean;
  /** الوسيط يضعها true فقط عندما يُلغى التفويض فعلاً لدى المنصة. */
  dead?: boolean;
  app?: { name_slug?: string; name?: string } | string;
};

/**
 * هل الحساب صالح للاستخدام؟
 * ملاحظة مهمة: حقل `healthy` لدى الوسيط يتأخر (يبقى false حتى أول فحص دوري)
 * حتى للحسابات التي تعمل تماماً — الاعتماد عليه كان يمنع النشر ويعيد المستخدم
 * إلى الربط بلا نهاية. المعيار الصحيح هو `dead`.
 */
export function accountUsable(account: { healthy?: boolean; dead?: boolean }): boolean {
  return account.dead !== true;
}

/** حسابات مساحة العمل المربوطة (بدون أي بيانات اعتماد). */
export async function listAccounts(
  config: PipedreamConfig,
  workspaceId: string,
  appSlug?: string,
): Promise<PdAccount[]> {
  const params = new URLSearchParams({ external_user_id: externalUserId(workspaceId) });
  if (appSlug) params.set("app", appSlug);
  const res = await call<{ data?: PdAccount[] }>(config, `/accounts?${params.toString()}`);
  return res.data ?? [];
}

/** فصل حساب من Pipedream نهائياً. */
export async function deleteAccount(config: PipedreamConfig, accountId: string): Promise<void> {
  await call(config, `/accounts/${accountId}`, { method: "DELETE" });
}

/** تنفيذ إجراء جاهز من مكتبة Pipedream (نشر منشور، إرسال بريد، إنشاء جهة اتصال…). */
export async function runAction(
  config: PipedreamConfig,
  params: {
    workspaceId: string;
    componentId: string;
    configuredProps: Record<string, unknown>;
  },
): Promise<{ ret?: unknown; exports?: unknown; os?: unknown }> {
  return call(config, "/actions/run", {
    method: "POST",
    body: JSON.stringify({
      id: params.componentId,
      external_user_id: externalUserId(params.workspaceId),
      configured_props: params.configuredProps,
    }),
  });
}

/** استدعاء أي واجهة خارجية عبر وكيل Pipedream — بلا أي توكن على خوادمنا. */
export async function proxyRequest<T = unknown>(
  config: PipedreamConfig,
  params: {
    workspaceId: string;
    accountId: string;
    url: string;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    /** جسم نصي جاهز (مثل form-urlencoded) بدلاً من JSON. */
    rawBody?: string;
    headers?: Record<string, string>;
  },
): Promise<T> {
  const encoded = base64Url(params.url);
  const search = new URLSearchParams({
    external_user_id: externalUserId(params.workspaceId),
    account_id: params.accountId,
  });
  const body =
    params.rawBody !== undefined
      ? params.rawBody
      : params.body === undefined
        ? undefined
        : JSON.stringify(params.body);
  const method = params.method ?? "GET";
  const init = {
    method,
    ...(body === undefined ? {} : { body }),
    headers: Object.fromEntries(
      Object.entries(params.headers ?? {}).map(([k, v]) => [`x-pd-proxy-${k}`, v]),
    ),
  };

  // إعادة محاولة متدرّجة عند الازدحام أو عطل مؤقت في المزوّد (429/5xx/انقطاع شبكة).
  // القراءات فقط تُعاد تلقائياً؛ الكتابة لا تُعاد كي لا يتكرر نشر أو إرسال.
  const retryable = method === "GET";
  const attempts = retryable ? 3 : 1;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await call<T>(config, `/proxy/${encoded}?${search.toString()}`, init);
    } catch (error) {
      lastError = error;
      const text = error instanceof Error ? error.message : String(error);
      const transient = /\b(429|500|502|503|504)\b|rate limit|timeout|ETIMEDOUT|ECONNRESET|fetch failed/i.test(text);
      if (!transient || attempt === attempts - 1) throw error;
      await new Promise((r) => setTimeout(r, 600 * 2 ** attempt + Math.floor(Math.random() * 250)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function base64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
