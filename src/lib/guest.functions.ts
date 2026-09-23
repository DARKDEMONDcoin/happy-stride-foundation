import { createServerFn } from "@tanstack/react-start";

/** حساب التجربة المشترك — لا تسجيل ولا كلمات مرور من المستخدم. */
export const GUEST_EMAIL = "guest@sahl.app";

/**
 * يهيّئ حساب التجربة (يُنشئه مرة واحدة مع مساحة عمله عبر trigger)
 * ويعيد رمز دخول لمرة واحدة يستخدمه المتصفح فوراً.
 */
export const guestSession = createServerFn({ method: "POST" }).handler(async () => {
  // Never issue credentials for a shared identity: its RLS scope is shared too.
  throw new Error("تم إيقاف الدخول المشترك لحماية بياناتك. سجّل الدخول بحسابك الخاص.");
});
