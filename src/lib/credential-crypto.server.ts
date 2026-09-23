/**
 * تشفير بيانات الربط المخزّنة (كلمات مرور التطبيقات ومفاتيح المنصات) قبل كتابتها في القاعدة.
 * AES-GCM بمفتاح من CREDENTIALS_ENC_KEY (أو app_secrets). متوافق مع الصفوف القديمة غير المشفّرة.
 */
const PREFIX = "enc.v1.";

function b64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function unb64(text: string): Uint8Array<ArrayBuffer> {
  const raw = atob(text);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function keyMaterial(): Promise<CryptoKey | null> {
  let secret = process.env["CREDENTIALS_ENC_KEY"] ?? "";
  if (!secret) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("app_secrets")
        .select("value")
        .eq("name", "CREDENTIALS_ENC_KEY")
        .maybeSingle();
      secret = data?.value ?? "";
    } catch {
      secret = "";
    }
  }
  if (!secret) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** يشفّر كائن الإعدادات إلى صيغة تخزين. يعيد الكائن كما هو إن لم يوجد مفتاح. */
export async function sealConfig(config: Record<string, unknown>): Promise<Record<string, string>> {
  const key = await keyMaterial();
  // فشل مغلق: بلا مفتاح لا نكتب توكنات بنص صريح في القاعدة إطلاقاً.
  if (!key) {
    console.error("[credentials] CREDENTIALS_ENC_KEY غير مضبوط — أُلغي حفظ بيانات الربط.");
    throw new Error(
      "تعذّر حفظ بيانات الربط: مفتاح التشفير غير مضبوط على الخادم (CREDENTIALS_ENC_KEY). أضفه ثم أعد المحاولة.",
    );
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(config));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  return { __enc: `${PREFIX}${b64(iv)}.${b64(cipher)}` };
}

/**
 * يفكّ التشفير؛ الصفوف القديمة (بلا __enc) تُعاد كما هي.
 * إن غاب المفتاح أو تغيّر (صفّ مشفّر بمفتاح قديم) نعيد null بدل رفع خطأ،
 * حتى تظهر الواجهة «غير مربوط» ويعيد المالك الربط بدل شاشة بيضاء.
 */
export async function openConfig<T>(stored: unknown): Promise<T | null> {
  if (!stored || typeof stored !== "object") return null;
  const blob = (stored as { __enc?: unknown }).__enc;
  if (typeof blob !== "string") return stored as T;
  if (!blob.startsWith(PREFIX)) return null;
  const key = await keyMaterial();
  if (!key) {
    console.error("[credentials] CREDENTIALS_ENC_KEY غير متاح — تعذّر فكّ بيانات الربط.");
    return null;
  }
  const [ivPart, cipherPart] = blob.slice(PREFIX.length).split(".");
  if (!ivPart || !cipherPart) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(ivPart) },
      key,
      unb64(cipherPart),
    );
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    console.error("[credentials] فشل فكّ التشفير — بيانات الربط محفوظة بمفتاح مختلف.");
    return null;
  }
}


/** هل الصف مخزّن مشفّراً؟ (يُستخدم للترحيل التدريجي) */
export function isSealed(stored: unknown): boolean {
  return Boolean(
    stored &&
      typeof stored === "object" &&
      typeof (stored as { __enc?: unknown }).__enc === "string",
  );
}
