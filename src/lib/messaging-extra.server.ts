/**
 * واتساب للأعمال، وجوجل درايف — عبر وكيل Pipedream (بلا أي توكن لدينا).
 */
import { proxyRequest, type PipedreamConfig } from "./pipedream.server";

type WaPhones = { data?: { id: string; display_phone_number?: string }[] };

/** يعثر على رقم الإرسال المرتبط بحساب واتساب للأعمال. */
export async function whatsappPhoneId(
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
): Promise<string | null> {
  try {
    const businesses = await proxyRequest<{ data?: { id: string }[] }>(config, {
      workspaceId,
      accountId,
      url: "https://graph.facebook.com/v23.0/me/businesses?limit=5",
    });
    const businessId = businesses.data?.[0]?.id;
    if (!businessId) return null;
    const wabas = await proxyRequest<{ data?: { id: string }[] }>(config, {
      workspaceId,
      accountId,
      url: `https://graph.facebook.com/v23.0/${businessId}/owned_whatsapp_business_accounts?limit=5`,
    });
    const waba = wabas.data?.[0]?.id;
    if (!waba) return null;
    const phones = await proxyRequest<WaPhones>(config, {
      workspaceId,
      accountId,
      url: `https://graph.facebook.com/v23.0/${waba}/phone_numbers?limit=5`,
    });
    return phones.data?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** إرسال رسالة واتساب نصية إلى عميل (داخل نافذة ٢٤ ساعة). */
export async function sendWhatsappText(
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
  params: { to: string; text: string; phoneNumberId?: string },
): Promise<unknown> {
  const phoneId =
    params.phoneNumberId?.trim() || (await whatsappPhoneId(config, workspaceId, accountId));
  if (!phoneId) throw new Error("تعذّر تحديد رقم واتساب للأعمال — أدخل معرّف الرقم يدوياً.");

  return proxyRequest(config, {
    workspaceId,
    accountId,
    method: "POST",
    url: `https://graph.facebook.com/v23.0/${phoneId}/messages`,
    body: {
      messaging_product: "whatsapp",
      to: params.to,
      type: "text",
      text: { body: params.text },
    },
  });
}

type DriveFiles = {
  files?: {
    id: string;
    name?: string;
    mimeType?: string;
    modifiedTime?: string;
    webViewLink?: string;
  }[];
};

/** أحدث ملفات درايف — سياق لدانة وبقية الفريق. */
export async function readDrive(
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
): Promise<string> {
  const url =
    "https://www.googleapis.com/drive/v3/files?" +
    new URLSearchParams({
      pageSize: "15",
      orderBy: "modifiedTime desc",
      fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
      q: "trashed = false",
    }).toString();

  const res = await proxyRequest<DriveFiles>(config, { workspaceId, accountId, url });
  const files = res.files ?? [];
  if (!files.length) return "لا ملفات حديثة في درايف.";
  return files
    .map(
      (f) =>
        `- ${f.modifiedTime?.slice(0, 10) ?? "?"} | ${f.name ?? "بلا اسم"} | ${f.mimeType ?? ""}`,
    )
    .join("\n");
}

/** إنشاء مجلد في درايف لتنظيم أصول الحملة. */
export async function createDriveFolder(
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
  params: { name: string; parentId?: string },
): Promise<{ id: string }> {
  const res = await proxyRequest<{ id?: string }>(config, {
    workspaceId,
    accountId,
    method: "POST",
    url: "https://www.googleapis.com/drive/v3/files",
    body: {
      name: params.name,
      mimeType: "application/vnd.google-apps.folder",
      ...(params.parentId ? { parents: [params.parentId] } : {}),
    },
  });
  if (!res.id) throw new Error("تعذّر إنشاء المجلد في درايف.");
  return { id: res.id };
}
