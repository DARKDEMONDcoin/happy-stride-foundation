import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { LogoMark } from "@/components/site/LogoMark";
import { supabase } from "@/integrations/supabase/client";
import { signIn } from "@/lib/auth";
import { GUEST_EMAIL } from "@/lib/guest.functions";
import { createAccount } from "@/lib/signup.functions";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  mode: z.enum(["signup", "signin"]).default("signup").optional(),
  plan: z.enum(["start", "growth"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  ssr: false,
  head: () => ({
    meta: [
      { title: "أنشئ حسابك في سهل | فريق موظفين ذكاء اصطناعي بالعربية" },
      {
        name: "description",
        content:
          "سجّل حساباً مجانياً في سهل خلال دقيقة، أو سجّل الدخول إلى مساحة عملك — فريق موظفين بالذكاء الاصطناعي يعمل بالعربية.",
      },
      { property: "og:title", content: "أنشئ حسابك في سهل" },
      {
        property: "og:description",
        content: "حساب مجاني بدون بطاقة — ستة موظفين بالذكاء الاصطناعي يعملون بالعربية.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const arabCountries = [
  { code: "SA", flag: "🇸🇦", name: "السعودية" },
  { code: "AE", flag: "🇦🇪", name: "الإمارات" },
  { code: "EG", flag: "🇪🇬", name: "مصر" },
  { code: "KW", flag: "🇰🇼", name: "الكويت" },
  { code: "QA", flag: "🇶🇦", name: "قطر" },
  { code: "BH", flag: "🇧🇭", name: "البحرين" },
  { code: "OM", flag: "🇴🇲", name: "عُمان" },
  { code: "JO", flag: "🇯🇴", name: "الأردن" },
  { code: "LB", flag: "🇱🇧", name: "لبنان" },
  { code: "SY", flag: "🇸🇾", name: "سوريا" },
  { code: "IQ", flag: "🇮🇶", name: "العراق" },
  { code: "PS", flag: "🇵🇸", name: "فلسطين" },
  { code: "YE", flag: "🇾🇪", name: "اليمن" },
  { code: "SD", flag: "🇸🇩", name: "السودان" },
  { code: "LY", flag: "🇱🇾", name: "ليبيا" },
  { code: "TN", flag: "🇹🇳", name: "تونس" },
  { code: "DZ", flag: "🇩🇿", name: "الجزائر" },
  { code: "MA", flag: "🇲🇦", name: "المغرب" },
  { code: "MR", flag: "🇲🇷", name: "موريتانيا" },
  { code: "SO", flag: "🇸🇴", name: "الصومال" },
  { code: "DJ", flag: "🇩🇯", name: "جيبوتي" },
  { code: "KM", flag: "🇰🇲", name: "جزر القمر" },
] as const;

type Errors = Record<string, string>;

function arabicError(message: string) {
  const m = message.toLowerCase();
  if (
    m.includes("already registered") ||
    m.includes("already been registered") ||
    m.includes("user already")
  )
    return "هذا البريد مسجّل بالفعل — جرّب تسجيل الدخول أو استعادة كلمة المرور.";
  if (m.includes("invalid login credentials")) return "البريد أو كلمة المرور غير صحيحة.";
  if (m.includes("email not confirmed"))
    return "لم يتم تأكيد البريد بعد — افتح رسالة التأكيد في بريدك.";
  if (m.includes("password should be at least"))
    return "كلمة المرور قصيرة جداً — ٨ أحرف على الأقل.";
  if (m.includes("provider is not enabled") || m.includes("unsupported provider"))
    return "الدخول عبر Google غير مفعّل حالياً — استخدم البريد وكلمة المرور.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "محاولات كثيرة في وقت قصير — انتظر دقيقة ثم أعد المحاولة.";
  if (m.includes("invalid email") || m.includes("email address"))
    return "صيغة البريد الإلكتروني غير صحيحة.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "تعذّر الاتصال بالخدمة — تحقّق من الإنترنت وأعد المحاولة.";
  return message || "حدث خطأ غير متوقع — أعد المحاولة.";
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" className="sauth-google-icon" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.63Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.73a5.4 5.4 0 0 1 0-3.46V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.33C4.68 5.15 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function CornerGlow() {
  return (
    <div className="sauth-glow" aria-hidden="true">
      <span className="sauth-glow-blob is-one" />
      <span className="sauth-glow-blob is-two" />
      <span className="sauth-glow-blob is-three" />
      <span className="sauth-glow-blob is-four" />
    </div>
  );
}

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const createAccountFn = useServerFn(createAccount);
  const [mode, setMode] = useState<"signup" | "signin">(search.mode ?? "signup");

  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState<string>("SA");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [updates, setUpdates] = useState(true);
  const [showPw, setShowPw] = useState(false);

  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    setMode(search.mode ?? "signup");
  }, [search.mode]);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const user = data.user;
      if (!user || user.is_anonymous || !user.email) return;
      if (user.email === GUEST_EMAIL) {
        void supabase.auth.signOut();
        return;
      }
      void navigate({ to: "/app", replace: true });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  const isSignup = mode === "signup";

  function switchMode(next: "signup" | "signin") {
    setMode(next);
    setErrors({});
    setFormError("");
    setResetSent(false);
    void navigate({ to: "/auth", search: { mode: next }, replace: true });
  }

  function validate(): boolean {
    const e: Errors = {};
    const mail = email.trim();
    if (!mail) e["email"] = "أدخل بريدك الإلكتروني.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) e["email"] = "صيغة البريد غير صحيحة.";
    if (!password) e["password"] = "أدخل كلمة المرور.";
    else if (isSignup && password.length < 8) e["password"] = "٨ أحرف على الأقل.";
    if (isSignup && fullName.trim().length < 3)
      e["fullName"] = "اكتب اسمك الكامل (٣ أحرف على الأقل).";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError("");
    setResetSent(false);
    if (!validate()) return;
    setBusy(true);
    try {
      if (isSignup) {
        const res = await createAccountFn({
          data: {
            email: email.trim(),
            password,
            fullName: fullName.trim(),
            company: fullName.trim(),
            dialect: "فصحى",
          },
        });
        if (!res.ok) {
          setFormError(
            res.reason === "duplicate"
              ? "هذا البريد مسجّل بالفعل — سجّل الدخول أو استعد كلمة المرور."
              : res.reason === "password"
                ? "كلمة المرور غير مقبولة — اجعلها ٨ أحرف على الأقل وأقوى."
                : res.reason === "rate_limited"
                  ? "محاولات كثيرة من هذا الجهاز — انتظر بضع دقائق ثم أعد المحاولة."
                  : "تعذّر إنشاء الحساب الآن — أعد المحاولة بعد لحظات.",
          );
          return;
        }
        await signIn(email.trim(), password);
        await navigate({ to: "/onboarding", replace: true });
        return;
      }
      await signIn(email.trim(), password);
      await navigate({ to: "/app", replace: true });
    } catch (error) {
      setFormError(arabicError(error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setFormError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/app` },
      });
      if (error) throw error;
    } catch (error) {
      setFormError(arabicError(error instanceof Error ? error.message : String(error)));
    }
  }

  async function onForgot() {
    setFormError("");
    const mail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) {
      setErrors({ email: "أدخل بريدك أولاً لنرسل رابط الاستعادة." });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(mail, {
        redirectTo: `${window.location.origin}/auth?mode=signin`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (error) {
      setFormError(arabicError(error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="sauth-page" dir="rtl">
      <CornerGlow />

      <header className="sauth-topbar">
        <Link to="/" className="sauth-logo" aria-label="سهل — الصفحة الرئيسية">
          <LogoMark className="size-7" size={28} />
        </Link>
      </header>

      <div className="sauth-center">
        <div className="sauth-card">
          <div className="sauth-card-body">
            <h1 className="sauth-title">{isSignup ? "أنشئ حساب سهل" : "سجّل الدخول إلى سهل"}</h1>

            <button type="button" className="sauth-google" onClick={onGoogle}>
              <span>{isSignup ? "التسجيل عبر Google" : "المتابعة عبر Google"}</span>
              <GoogleIcon />
            </button>

            <div className="sauth-divider">
              <span>{isSignup ? "أو سجّل عبر" : "أو ادخل عبر"}</span>
            </div>

            <form onSubmit={onSubmit} noValidate className="sauth-form">
              <div className="sauth-field">
                <label htmlFor="email">البريد الإلكتروني</label>
                <input
                  id="email"
                  type="email"
                  dir="ltr"
                  value={email}
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={Boolean(errors["email"])}
                  className={cn("sauth-input", errors["email"] && "is-invalid")}
                />
                {errors["email"] ? <p className="sauth-error">{errors["email"]}</p> : null}
              </div>

              {isSignup ? (
                <div className="sauth-field">
                  <label htmlFor="fullName">الاسم الكامل</label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    autoComplete="name"
                    onChange={(e) => setFullName(e.target.value)}
                    aria-invalid={Boolean(errors["fullName"])}
                    className={cn("sauth-input", errors["fullName"] && "is-invalid")}
                  />
                  {errors["fullName"] ? <p className="sauth-error">{errors["fullName"]}</p> : null}
                </div>
              ) : null}

              <div className="sauth-field">
                <label htmlFor="password">كلمة المرور</label>
                <div className="sauth-pw">
                  <input
                    id="password"
                    type={showPw ? "text" : "password"}
                    dir="ltr"
                    value={password}
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={Boolean(errors["password"])}
                    className={cn("sauth-input", errors["password"] && "is-invalid")}
                  />
                  <button
                    type="button"
                    className="sauth-pw-toggle"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  >
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors["password"] ? <p className="sauth-error">{errors["password"]}</p> : null}
                {!isSignup ? (
                  <button type="button" className="sauth-forgot" onClick={onForgot}>
                    نسيت كلمة المرور؟
                  </button>
                ) : null}
              </div>

              {isSignup ? (
                <div className="sauth-field">
                  <label htmlFor="country">الدولة</label>
                  <select
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="sauth-input sauth-select"
                  >
                    {arabCountries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {isSignup ? (
                <label className="sauth-check">
                  <input
                    type="checkbox"
                    checked={updates}
                    onChange={(e) => setUpdates(e.target.checked)}
                  />
                  <span>
                    أوافق على تلقي تحديثات وعروض من سهل. يمكنك إلغاء الاشتراك في أي وقت.{" "}
                    <Link to="/privacy" className="sauth-link">
                      سياسة الخصوصية
                    </Link>
                  </span>
                </label>
              ) : null}

              {formError ? (
                <p role="alert" className="sauth-form-error">
                  {formError}
                </p>
              ) : null}
              {resetSent ? (
                <p role="status" className="sauth-note">
                  أرسلنا رابط استعادة كلمة المرور إلى بريدك.
                </p>
              ) : null}

              <button type="submit" className="sauth-submit" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {busy ? "لحظة..." : isSignup ? "إنشاء الحساب" : "تسجيل الدخول"}
              </button>
            </form>
          </div>

          <div className="sauth-card-foot">
            {isSignup ? "لديك حساب بالفعل؟" : "ليس لديك حساب؟"}{" "}
            <button
              type="button"
              className="sauth-link"
              onClick={() => switchMode(isSignup ? "signin" : "signup")}
            >
              {isSignup ? "سجّل الدخول" : "أنشئ حسابًا"}
            </button>
          </div>
        </div>

        <footer className="sauth-footer">
          <span>© سهل</span>
          <span className="sauth-footer-links">
            <Link to="/privacy">الخصوصية</Link>
            <Link to="/terms">الشروط</Link>
          </span>
        </footer>
      </div>
    </main>
  );
}
