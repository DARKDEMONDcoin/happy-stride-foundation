import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Link2, Unplug, AlertTriangle, PlayCircle } from "lucide-react";

import { AppIcon } from "@/components/site/AppIcon";
import {
  disconnectMeta,
  metaStatus,
  publishMetaDirect,
  runMetaSelfTest,
  startMetaConnect,
} from "@/lib/meta.functions";
import { cn } from "@/lib/utils";

type Diagnostic = {
  kind: "facebook" | "instagram";
  pageId: string;
  name: string | null;
  igUserId: string | null;
  canPublish: boolean;
  missing: string[];
  expiresAt: string | null;
};

type TestResult = {
  provider: "facebook" | "instagram";
  ok: boolean;
  postId?: string;
  permalink?: string | null;
  error?: string;
  missing?: string[];
};

/**
 * لوحة ميتا المباشرة: ربط الصفحات وحسابات إنستجرام بتطبيقنا الخاص،
 * معاينة شكل المنشور قبل إرساله، ونشر/اختبار حي يعرض معرّف المنشور أو سبب الفشل.
 */
export function MetaDirect({
  workspaceId,
  only,
  bare = false,
}: {
  workspaceId: string | undefined;
  /** عرض منصة واحدة فقط (فيسبوك أو إنستجرام) داخل لوحة تفاصيل التطبيق. */
  only?: "facebook" | "instagram";
  /** بدون إطار القسم وعنوانه — للاستخدام داخل لوحة جانبية. */
  bare?: boolean;
}) {
  const status = useServerFn(metaStatus);
  const connect = useServerFn(startMetaConnect);
  const disconnect = useServerFn(disconnectMeta);
  const publish = useServerFn(publishMetaDirect);
  const selfTest = useServerFn(runMetaSelfTest);

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [connections, setConnections] = useState<Diagnostic[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [authUrl, setAuthUrl] = useState<string | null>(null);

  const [text, setText] = useState("مرحباً من سِراج — منشور تجريبي عبر النشر المباشر على ميتا.");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [target, setTarget] = useState<"facebook" | "instagram">(only ?? "facebook");

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await status({ data: { workspaceId } });
      setConfigured(res.configured);
      setConnections(res.connections as Diagnostic[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر قراءة حالة ميتا.");
    }
  }, [status, workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const meta = params.get("meta");
    if (!meta) return;
    if (meta === "failed")
      setError(`لم يكتمل ربط ميتا (${params.get("reason") ?? "سبب غير معروف"}).`);
    window.history.replaceState({}, "", window.location.pathname);
    void refresh();
  }, [refresh]);

  const startConnect = async () => {
    if (!workspaceId) return;
    setBusy("connect");
    setError(null);
    try {
      const res = await connect({
        data: { workspaceId, origin: window.location.origin, returnTo: "/app/integrations" },
      });
      // فيسبوك يرفض الفتح داخل الإطار (معاينة لوفابل) — لذلك نفتح نافذة جديدة دائماً.
      const win = window.open(res.url, "_blank", "noopener,noreferrer");
      if (!win) {
        setAuthUrl(res.url);
        setError("المتصفح منع فتح النافذة — استخدم الرابط بالأسفل لإتمام الربط.");
      } else {
        setAuthUrl(res.url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر بدء ربط ميتا.");
    } finally {
      setBusy(null);
    }
  };

  const runTest = async () => {
    if (!workspaceId) return;
    setBusy("test");
    setError(null);
    setResults([]);
    try {
      const providers = Array.from(new Set(connections.map((c) => c.kind)));
      if (!providers.length) throw new Error("لا يوجد ربط ميتا بعد.");
      const res = await selfTest({ data: { workspaceId, providers } });
      setResults(res.results as TestResult[]);
      setConnections(res.diagnostics.connections as Diagnostic[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الاختبار التلقائي.");
    } finally {
      setBusy(null);
    }
  };

  const publishNow = async () => {
    if (!workspaceId) return;
    setBusy("publish");
    setError(null);
    setResults([]);
    try {
      const res = await publish({
        data: {
          workspaceId,
          provider: target,
          text,
          ...(imageUrl ? { imageUrl } : {}),
          ...(videoUrl ? { videoUrl } : {}),
        },
      });
      setResults([
        { provider: target, ok: true, postId: res.postId, permalink: res.permalink ?? null },
      ]);
    } catch (e) {
      setResults([
        { provider: target, ok: false, error: e instanceof Error ? e.message : "فشل النشر." },
      ]);
    } finally {
      setBusy(null);
    }
  };

  const removeAll = async () => {
    if (!workspaceId) return;
    setBusy("disconnect");
    try {
      await disconnect({ data: { workspaceId } });
      setConnections([]);
      setResults([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الفصل.");
    } finally {
      setBusy(null);
    }
  };

  const facebookPages = connections.filter((c) => c.kind === "facebook");
  const igAccounts = connections.filter((c) => c.kind === "instagram");
  const shown = only ? connections.filter((c) => c.kind === only) : connections;

  return (
    <section className={bare ? "" : "mb-6 rounded-3xl border border-border bg-card p-6"}>
      <header className="flex flex-wrap items-center gap-3">
        {bare ? null : (
          <>
            <AppIcon name="facebook" className="size-7" />
            <AppIcon name="instagram" className="size-7" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black">النشر المباشر على ميتا</h2>
              <p className="text-sm text-ink-soft">
                ربط صفحات فيسبوك وحسابات إنستجرام بتطبيق ميتا الخاص بنا — أذونات نشر كاملة وتوكنات
                طويلة المدى محفوظة على الخادم فقط.
              </p>
            </div>
          </>
        )}
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void startConnect()}
            disabled={!workspaceId || busy === "connect"}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background disabled:opacity-60"
          >
            {busy === "connect" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Link2 className="size-4" />
            )}
            {connections.length ? "إعادة الربط" : "اربط ميتا"}
          </button>
          {connections.length ? (
            <button
              type="button"
              onClick={() => void removeAll()}
              disabled={busy === "disconnect"}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-bold disabled:opacity-60"
            >
              <Unplug className="size-4" /> فصل
            </button>
          ) : null}
        </div>
      </header>

      {configured === false ? (
        <p className="mt-4 rounded-2xl bg-amber/10 px-4 py-3 text-sm font-semibold">
          مفاتيح تطبيق ميتا غير مضبوطة — أضف META_APP_ID و META_APP_SECRET من الإعدادات ← المفاتيح.
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-2xl bg-coral/12 px-4 py-3 text-sm font-semibold text-coral">
          {error}
        </p>
      ) : null}

      {authUrl ? (
        <div className="mt-4 rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-sm">
          <p className="font-semibold">
            فيسبوك لا يفتح داخل نافذة المعاينة — أكمل الربط في تبويب خارجي ثم عد واضغط «تحديث».
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={authUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background"
            >
              افتح صفحة الموافقة
            </a>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex rounded-full border border-border px-4 py-2 text-xs font-bold"
            >
              تحديث الحالة
            </button>
          </div>
        </div>
      ) : null}

      {shown.length ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {shown.map((c) => (
            <li
              key={`${c.kind}-${c.pageId}`}
              className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/40 p-3"
            >
              <AppIcon name={c.kind} className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{c.name ?? c.pageId}</p>
                <p className="text-xs text-ink-soft">
                  {c.kind === "facebook" ? "صفحة فيسبوك" : "حساب إنستجرام احترافي"} ·{" "}
                  {c.canPublish
                    ? "جاهز للنشر"
                    : `ينقصه: ${c.missing.join("، ") || "حساب إنستجرام"}`}
                </p>
              </div>
              {c.canPublish ? (
                <CheckCircle2 className="size-4 shrink-0 text-jade-deep" />
              ) : (
                <AlertTriangle className="size-4 shrink-0 text-coral" />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          لا يوجد ربط مباشر بعد — اضغط «اربط ميتا» ووافق على كل الأذونات واختر صفحاتك.
        </p>
      )}

      {shown.length ? (
        <div className={cn("mt-6 grid gap-6", bare ? "" : "lg:grid-cols-2")}>
          <div className="space-y-3">
            <div className={cn("flex gap-2", only ? "hidden" : "")}>
              {(["facebook", "instagram"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTarget(p)}
                  disabled={p === "instagram" && !igAccounts.length}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-xs font-bold transition",
                    target === p
                      ? "bg-foreground text-background"
                      : "border border-border text-ink-soft",
                    p === "instagram" && !igAccounts.length ? "opacity-40" : "",
                  )}
                >
                  {p === "facebook" ? "فيسبوك" : "إنستجرام"}
                </button>
              ))}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className="w-full rounded-2xl border border-border bg-background p-3 text-sm"
              placeholder="نص المنشور…"
            />
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full rounded-2xl border border-border bg-background p-3 text-sm"
              placeholder="رابط صورة عام (اختياري — إلزامي لإنستجرام)"
            />
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full rounded-2xl border border-border bg-background p-3 text-sm"
              placeholder="رابط فيديو MP4 عام (اختياري)"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void publishNow()}
                disabled={busy !== null || !text.trim()}
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background disabled:opacity-60"
              >
                {busy === "publish" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <PlayCircle className="size-4" />
                )}
                انشر الآن
              </button>
              <button
                type="button"
                onClick={() => void runTest()}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-bold disabled:opacity-60"
              >
                {busy === "test" ? <Loader2 className="size-4 animate-spin" /> : null}
                اختبار تلقائي شامل
              </button>
            </div>
          </div>

          {/* معاينة شكل المنشور */}
          <div className="rounded-2xl border border-border bg-secondary/30 p-4">
            <p className="mb-3 text-xs font-bold text-ink-soft">
              معاينة {target === "facebook" ? "فيسبوك" : "إنستجرام"}
            </p>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-2 p-3">
                <div className="grid size-8 place-items-center rounded-full bg-foreground text-[10px] font-black text-background">
                  {(target === "facebook" ? facebookPages[0]?.name : igAccounts[0]?.name)?.slice(
                    0,
                    2,
                  ) ?? "SR"}
                </div>
                <div>
                  <p className="text-xs font-bold">
                    {(target === "facebook" ? facebookPages[0]?.name : igAccounts[0]?.name) ??
                      "صفحتك"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">الآن</p>
                </div>
              </div>
              {target === "facebook" ? (
                <p className="whitespace-pre-wrap px-3 pb-3 text-sm leading-relaxed">{text}</p>
              ) : null}
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  className="aspect-square w-full bg-black object-cover"
                />
              ) : imageUrl ? (
                <img
                  src={imageUrl}
                  alt="معاينة المنشور"
                  className={cn(
                    "w-full object-cover",
                    target === "instagram" ? "aspect-square" : "aspect-video",
                  )}
                />
              ) : target === "instagram" ? (
                <div className="grid aspect-square w-full place-items-center bg-muted text-xs text-muted-foreground">
                  إنستجرام يتطلب صورة أو فيديو
                </div>
              ) : null}
              {target === "instagram" ? (
                <p className="whitespace-pre-wrap px-3 py-3 text-sm leading-relaxed">{text}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {results.length ? (
        <ul className="mt-4 space-y-2">
          {results.map((r) => (
            <li
              key={`${r.provider}-${r.postId ?? r.error}`}
              className={cn(
                "rounded-2xl px-4 py-3 text-sm",
                r.ok ? "bg-jade-deep/10" : "bg-coral/12 text-coral",
              )}
            >
              <span className="font-bold">
                {r.provider === "facebook" ? "فيسبوك" : "إنستجرام"}:{" "}
              </span>
              {r.ok ? (
                <>
                  نجح النشر · معرّف المنشور {r.postId}
                  {r.permalink ? (
                    <a
                      href={r.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="mr-2 underline underline-offset-4"
                    >
                      افتح المنشور
                    </a>
                  ) : null}
                </>
              ) : (
                r.error
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
