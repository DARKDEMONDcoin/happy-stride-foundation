/**
 * قناة واتساب للأعمال — الإرسال عبر وكيل Pipedream (لا نحتفظ بأي توكن)،
 * مع دعم رجعي لتوكن مباشر إن كان محفوظاً من ربط قديم.
 * بيانات القناة تُحفظ في integration_credentials تحت المزوّد "whatsapp".
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

const GRAPH = "https://graph.facebook.com/v23.0";

export type WhatsappCreds = {
  /** مساحة العمل صاحبة القناة (لازمة لنداءات الوسيط). */
  workspaceId: string;
  /** معرّف رقم الإرسال في واتساب للأعمال (Phone Number ID). */
  phoneNumberId: string;
  /** معرّف الحساب المربوط لدى Pipedream (apn_...) — الوضع المفضّل. */
  accountId?: string;
  /** توكن ميتا الدائم — فقط للربط اليدوي القديم. */
  token?: string;
  /** رقم العرض — للعرض فقط في الواجهة. */
  displayNumber?: string;
  /** الكلمة السرية التي تُدخل في إعداد الويبهوك داخل لوحة ميتا. */
  verifyToken?: string;
  /** حساب واتساب للأعمال المكتشَف تلقائياً بعد تفويض فيسبوك. */
  wabaId?: string;
  /** كل أرقام الإرسال المتاحة — لاختيار الرقم بلا إدخال يدوي. */
  phones?: { id: string; displayNumber: string; name?: string; wabaId: string }[];
};

type StoredConfig = Partial<Omit<WhatsappCreds, "workspaceId">>;

function toCreds(workspaceId: string, config: StoredConfig | undefined): WhatsappCreds | null {
  if (!config?.phoneNumberId) return null;
  if (!config.accountId && !config.token) return null;
  return {
    workspaceId,
    phoneNumberId: config.phoneNumberId,
    ...(config.accountId ? { accountId: config.accountId } : {}),
    ...(config.token ? { token: config.token } : {}),
    ...(config.displayNumber ? { displayNumber: config.displayNumber } : {}),
    ...(config.verifyToken ? { verifyToken: config.verifyToken } : {}),
  };
}

/** يتحقق من كلمة التحقق المرسلة من ميتا عند تفعيل الويبهوك. */
export async function verifyTokenMatches(admin: Admin, token: string): Promise<boolean> {
  if (!token) return false;
  const { getSecrets } = await import("./secrets.server");
  const secrets = await getSecrets(["WHATSAPP_VERIFY_TOKEN"] as const);
  // مقارنة ثابتة الزمن مثل بقية أسرار المشروع — المقارنة العادية تسرّب طول التطابق.
  const { secretsMatch } = await import("./timing-safe");
  if (secretsMatch(token, secrets.WHATSAPP_VERIFY_TOKEN?.trim())) return true;
  const { data } = await admin
    .from("integration_credentials")
    .select("config")
    .eq("provider", "whatsapp");
  const { openConfig } = await import("./credential-crypto.server");
  for (const row of data ?? []) {
    const config = await openConfig<StoredConfig>(row.config);
    if (secretsMatch(token, config?.verifyToken)) return true;
  }
  return false;
}

/**
 * يحفظ قناة واتساب مباشرةً بعد تفويض فيسبوك — بلا أي إدخال يدوي:
 * توكن طويل المدى + رقم الإرسال المكتشَف تلقائياً.
 */
export async function saveWhatsappFromMeta(
  admin: Admin,
  workspaceId: string,
  params: {
    token: string;
    phones: { id: string; displayNumber: string; name?: string; wabaId: string }[];
  },
): Promise<{ displayNumber: string; count: number }> {
  const chosen = params.phones[0];
  if (!chosen) throw new Error("لم نجد رقم واتساب للأعمال في الحساب المصرّح به.");
  const { data: existing } = await admin
    .from("integration_credentials")
    .select("config")
    .eq("workspace_id", workspaceId)
    .eq("provider", "whatsapp")
    .maybeSingle();
  const { openConfig, sealConfig } = await import("./credential-crypto.server");
  const previous = ((await openConfig<StoredConfig>(existing?.config)) ?? {}) as StoredConfig;

  // الرقم المعروض والحساب يجب أن يطابقا الرقم الذي سيُرسل منه فعلاً، لا أول رقم
  // في القائمة: مع أكثر من رقم كان المالك يرى رقماً غير الذي يرسل الموظف منه.
  const keptId =
    previous.phoneNumberId && params.phones.some((p) => p.id === previous.phoneNumberId)
      ? previous.phoneNumberId
      : chosen.id;
  const active = params.phones.find((p) => p.id === keptId) ?? chosen;

  const { error } = await admin.from("integration_credentials").upsert(
    {
      workspace_id: workspaceId,
      provider: "whatsapp",
      config: await sealConfig({
        phoneNumberId: keptId,
        token: params.token,
        wabaId: active.wabaId,
        displayNumber: active.displayNumber,
        phones: params.phones,
        verifyToken: previous.verifyToken ?? crypto.randomUUID().replace(/-/g, ""),
      }),
    },
    { onConflict: "workspace_id,provider" },
  );
  if (error) throw new Error(error.message);

  await admin
    .from("integrations")
    .update({ status: "connected", account: active.displayNumber || active.name || "واتساب" })
    .eq("workspace_id", workspaceId)
    .eq("provider", "whatsapp");

  return { displayNumber: active.displayNumber, count: params.phones.length };
}

/** يقرأ بيانات واتساب لمساحة عمل بعينها. */
export async function whatsappCreds(
  admin: Admin,
  workspaceId: string,
): Promise<WhatsappCreds | null> {
  const { data } = await admin
    .from("integration_credentials")
    .select("config")
    .eq("workspace_id", workspaceId)
    .eq("provider", "whatsapp")
    .maybeSingle();
  const { openConfig } = await import("./credential-crypto.server");
  return toCreds(workspaceId, (await openConfig<StoredConfig>(data?.config)) ?? undefined);
}

/** يعثر على مساحة العمل صاحبة رقم الإرسال الذي وصلت إليه الرسالة. */
export async function workspaceByPhoneNumberId(
  admin: Admin,
  phoneNumberId: string,
): Promise<{ workspaceId: string; creds: WhatsappCreds } | null> {
  const { data } = await admin
    .from("integration_credentials")
    .select("workspace_id, config")
    .eq("provider", "whatsapp");
  const { openConfig } = await import("./credential-crypto.server");
  for (const row of data ?? []) {
    const config = await openConfig<StoredConfig>(row.config);
    if (config?.phoneNumberId !== phoneNumberId) continue;
    const creds = toCreds(row.workspace_id, config);
    if (creds) return { workspaceId: row.workspace_id, creds };
  }
  return null;
}

/** نداء Graph API: عبر وكيل Pipedream إن كان الربط عبره، وإلا بالتوكن المباشر. */
async function graph<T>(
  creds: WhatsappCreds,
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown },
): Promise<T> {
  if (creds.accountId) {
    const { pipedreamConfig, proxyRequest, missingConfigError } =
      await import("./pipedream.server");
    const config = await pipedreamConfig();
    if (!config) throw missingConfigError();
    return proxyRequest<T>(config, {
      workspaceId: creds.workspaceId,
      accountId: creds.accountId,
      url: `${GRAPH}${path}`,
      method: init?.method ?? "GET",
      ...(init?.body === undefined ? {} : { body: init.body }),
    });
  }

  if (!creds.token) throw new Error("قناة واتساب غير مربوطة.");
  // إعادة محاولة على الفشل العابر (429 أو عطل مؤقت) بنفس سياسة ميتا —
  // كان خطأ ازدحام واحد يُسقط الرسالة نهائياً بلا محاولة ثانية.
  const { isTransientMetaFailure } = await import("./meta.server");
  const delays = [400, 1200, 3000];
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(`${GRAPH}${path}`, {
        method: init?.method ?? "GET",
        // بلا مهلة كان الطلب يعلّق حتى تموت الدالة كلها إن تأخّر Graph.
        signal: AbortSignal.timeout(20_000),
        headers: {
          Authorization: `Bearer ${creds.token}`,
          "Content-Type": "application/json",
        },
        ...(init?.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      });
    } catch (networkError) {
      lastError =
        networkError instanceof Error ? networkError : new Error("تعذّر الاتصال بخوادم واتساب.");
      const delay = delays[attempt];
      if (delay === undefined) break;
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    const text = await res.text();
    if (res.ok) return (text ? JSON.parse(text) : {}) as T;
    let code: number | undefined;
    try {
      code = (JSON.parse(text) as { error?: { code?: number } }).error?.code;
    } catch {
      code = undefined;
    }
    lastError = new Error(`WhatsApp API failed [${res.status}]: ${text.slice(0, 400)}`);
    const delay = delays[attempt];
    if (delay === undefined || !isTransientMetaFailure(res.status, code)) break;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw lastError ?? new Error("تعذّر إتمام الطلب مع واتساب.");
}

/** يرسل رسالة نصية عبر واتساب (داخل نافذة ٢٤ ساعة من رسالة العميل). */
export async function sendWhatsapp(creds: WhatsappCreds, to: string, text: string): Promise<void> {
  await graph(creds, `/${creds.phoneNumberId}/messages`, {
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { preview_url: false, body: text.slice(0, 4000) },
    },
  });
}

/** أرقام الإرسال المتاحة داخل حساب واتساب للأعمال المربوط عبر Pipedream. */
export async function listPipedreamPhones(
  workspaceId: string,
  accountId: string,
): Promise<{ id: string; displayNumber: string; name?: string }[]> {
  const { pipedreamConfig, proxyRequest, missingConfigError } = await import("./pipedream.server");
  const config = await pipedreamConfig();
  if (!config) throw missingConfigError();

  type Phones = {
    data?: { id: string; display_phone_number?: string; verified_name?: string }[];
  };
  // معرّف حساب الأعمال محفوظ لدى الوسيط نفسه — نستدعيه بماكرو بدل تخزينه عندنا.
  let res: Phones;
  try {
    res = await proxyRequest<Phones>(config, {
      workspaceId,
      accountId,
      url: `${GRAPH}/{{custom_fields.business_account_id}}/phone_numbers?limit=25`,
    });
  } catch (error) {
    // إن لم يُستبدل الماكرو (ربط قديم بلا معرّف حساب أعمال) يرجع خطأ غامض عن مسار
    // فيه أقواس — نحوّله لرسالة تقول للمالك ماذا يفعل بالضبط.
    const message = error instanceof Error ? error.message : String(error);
    if (/custom_fields|business_account_id|\{\{/.test(message)) {
      throw new Error(
        "ربط واتساب لا يحمل معرّف حساب الأعمال (Business Account ID). أعد ربط واتساب من صفحة التكاملات واختر حساب الأعمال أثناء الربط.",
      );
    }
    throw error;
  }

  return (res.data ?? []).map((p) => ({
    id: p.id,
    displayNumber: p.display_phone_number ?? "",
    ...(p.verified_name ? { name: p.verified_name } : {}),
  }));
}

/** يتحقق من صلاحية رقم الإرسال ويعيد بياناته. */
export async function verifyWhatsappCreds(
  creds: Omit<WhatsappCreds, "displayNumber" | "verifyToken">,
): Promise<{ displayNumber: string; verifiedName?: string }> {
  const body = await graph<{ display_phone_number?: string; verified_name?: string }>(
    creds,
    `/${creds.phoneNumberId}?fields=display_phone_number,verified_name`,
  );
  return {
    displayNumber: body.display_phone_number ?? "",
    ...(body.verified_name ? { verifiedName: body.verified_name } : {}),
  };
}
