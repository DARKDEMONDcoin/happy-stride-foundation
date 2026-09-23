/**
 * حد استخدام على الخادم للنقاط العامة (التسجيل وجلسة التجربة).
 * العدّاد يُحفظ في قاعدة البيانات حتى يعمل مع كل نسخ الخادم، ولا يعتمد على الذاكرة.
 */

/** يستخرج عنوان الطالب من ترويسات الوسيط، ويرجع "unknown" إن لم يوجد. */
export function requestIdentifier(request: Request | undefined): string {
  if (!request) return "unknown";
  const forwarded = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
  return (
    forwarded ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * يزيد العدّاد ويعيد true إذا تجاوز الطالب الحد المسموح داخل النافذة.
 * أي خطأ في القاعدة لا يمنع العملية (نفشل بأمان نحو السماح).
 */
export async function isRateLimited(
  bucket: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("bump_rate_limit", {
      _bucket: bucket,
      _identifier: identifier || "unknown",
      _window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[rate-limit] rpc failed:", error.message);
      return false;
    }
    return typeof data === "number" && data > limit;
  } catch (e) {
    console.error("[rate-limit] failed:", e instanceof Error ? e.message : e);
    return false;
  }
}
