import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, RefreshCw, Loader2, Search, X } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { WordPressConnect } from "@/components/app/WordPressConnect";
import { SearchConsoleSites } from "@/components/app/SearchConsoleSites";
import { IndexNowSetup } from "@/components/app/IndexNowSetup";
import { Ga4Properties } from "@/components/app/Ga4Properties";
import { ShopifyConnect } from "@/components/app/ShopifyConnect";
import { WebflowConnect } from "@/components/app/WebflowConnect";
import { GhostConnect } from "@/components/app/GhostConnect";
import { MetaDirect } from "@/components/app/MetaDirect";
import { WhatsAppCommand } from "@/components/app/WhatsAppCommand";
import { TelegramCommand } from "@/components/app/TelegramCommand";
import { team } from "@/data/team";
import { Portrait } from "@/components/site/Portrait";
import { integrationStatusLabel } from "@/data/app";
import { isPipedreamProvider, pipedreamApp } from "@/data/pipedream-apps";
import { useIntegrations, useSetIntegrationStatus, useWorkspace } from "@/lib/data";
import { disconnectProvider } from "@/lib/integrations.functions";
import {
  disconnectPipedream,
  pipedreamStatus,
  startPipedreamConnect,
  syncPipedreamAccounts,
} from "@/lib/pipedream.functions";
import { GUEST_EMAIL } from "@/lib/guest.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { BrandLoader } from "@/components/site/BrandLoader";

export const Route = createFileRoute("/app/integrations")({
  head: () => ({
    meta: [
      { title: "التكاملات | سهل" },
      { name: "description", content: "اربط حسابات علامتك ليعمل فريقك مباشرة عليها." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntegrationsPage,
});

/** المنصات المربوطة ربطاً مباشراً من داخل المنصة (بدون وسيط). */
const realProviders = new Set(["wordpress", "indexnow", "shopify", "webflow", "ghost"]);

/** فيسبوك وإنستجرام لهما لوحة ربط مباشرة مستقلة لكل منهما. */
const isMeta = (provider: string) => provider === "facebook" || provider === "instagram";

const gscMessages: Record<string, string> = {
  denied: "أُلغيت موافقة Google — لم يتم الربط.",
  token_failed: "تعذّر إكمال الربط مع Google، جرّب مرة أخرى.",
  no_refresh_token: "لم يمنحنا Google صلاحية دائمة — أعد المحاولة واقبل الصلاحيات.",
  store_failed: "تعذّر حفظ بيانات الربط.",
  failed: "تعذّر إكمال الربط.",
};

function IntegrationsPage() {
  const qc = useQueryClient();
  const { data: workspace } = useWorkspace();
  const { data: integrations, isLoading } = useIntegrations(workspace?.id);
  const setStatus = useSetIntegrationStatus(workspace?.id);
  const disconnect = useServerFn(disconnectProvider);
  const startConnect = useServerFn(startPipedreamConnect);
  const syncAccounts = useServerFn(syncPipedreamAccounts);
  const disconnectPd = useServerFn(disconnectPipedream);
  const checkPipedream = useServerFn(pipedreamStatus);
  const [isGuest, setIsGuest] = useState(false);
  const [pdReady, setPdReady] = useState<boolean | null>(null);
  const [pdEnv, setPdEnv] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [wpOpen, setWpOpen] = useState(false);
  const [gscOpen, setGscOpen] = useState(false);
  const [indexNowOpen, setIndexNowOpen] = useState(false);
  const [ga4Open, setGa4Open] = useState(false);
  const [shopifyOpen, setShopifyOpen] = useState(false);
  const [webflowOpen, setWebflowOpen] = useState(false);
  const [ghostOpen, setGhostOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSync, setPendingSync] = useState(false);
  // العودة إلى الصفحة التي بدأ منها الربط، وفتح ربط منصة بعينها مباشرة.
  const [backTo, setBackTo] = useState<string | null>(null);
  const [autoConnect, setAutoConnect] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth
      .getUser()
      .then(({ data }) => setIsGuest(data.user?.email === GUEST_EMAIL))
      .catch(() => setIsGuest(false));
  }, []);

  useEffect(() => {
    void checkPipedream({ data: undefined })
      .then((r) => {
        setPdReady(r.ready);
        setPdEnv(r.environment ?? null);
      })
      .catch(() => setPdReady(false));
  }, [checkPipedream]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("gsc");
    const pd = params.get("pd");
    const want = params.get("connect");
    if (want) setAutoConnect(want);
    const back = params.get("back");
    if (back && back.startsWith("/")) setBackTo(back);
    if (!status && !pd && !want && !back) return;
    if (status === "connected") setGscOpen(true);
    else if (status) setError(gscMessages[status] ?? "تعذّر إكمال ربط Search Console.");
    if (pd === "failed") setError("لم يكتمل الربط عبر Pipedream — جرّب مرة أخرى.");
    if (pd === "connected") setPendingSync(true);
    window.history.replaceState({}, "", window.location.pathname);
    // نقرأ علامات العودة مرة واحدة فقط. لا نعتمد على جاهزية مساحة العمل هنا،
    // وإلا يُمسح `?pd=connected` قبل بدء المزامنة فيظهر الربط كأنه لم يحدث.
  }, []);

  /** تحذيرات صلاحيات بعد المزامنة (مثل فيسبوك بلا صلاحية نشر). */
  const [scopeWarnings, setScopeWarnings] = useState<{ provider: string; message: string }[]>([]);

  useEffect(() => {
    if (!pendingSync || !workspace) return;
    setPendingSync(false);
    void syncAccounts({ data: { workspaceId: workspace.id } })
      .then((r) => {
        setScopeWarnings(r.warnings ?? []);
        const done = Promise.all([
          qc.invalidateQueries({ queryKey: ["integrations", workspace.id] }),
          qc.invalidateQueries({ queryKey: ["pipedream-accounts", workspace.id] }),
        ]);
        if (backTo && !(r.warnings ?? []).length) {
          const to = backTo;
          setBackTo(null);
          setTimeout(() => window.location.assign(to), 400);
        }
        return done;
      })
      .catch(() => setError("تم الربط لكن تعذّرت المزامنة — اضغط «تحديث الحسابات»."));
  }, [pendingSync, workspace, qc, syncAccounts, backTo]);

  const all = integrations ?? [];
  // تطبيق واحد يظهر مرة واحدة فقط حتى لو استخدمه أكثر من موظف.
  const unique = all.filter((i, idx) => all.findIndex((x) => x.provider === i.provider) === idx);
  const connected = unique.filter((i) => i.status === "connected").length;
  const broken = unique.filter((i) => i.status === "error");
  const detailRow = unique.find((i) => i.provider === detail) ?? null;

  const refresh = async () => {
    if (!workspace) return;
    setBusy("sync");
    setError(null);
    try {
      const r = await syncAccounts({ data: { workspaceId: workspace.id } });
      setScopeWarnings(r.warnings ?? []);
      void qc.invalidateQueries({ queryKey: ["integrations", workspace.id] });
      void qc.invalidateQueries({ queryKey: ["pipedream-accounts", workspace.id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّرت مزامنة الحسابات");
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (id: string, status: string, provider: string) => {
    setError(null);
    if (isGuest) {
      setError(
        "أنت في وضع التجربة (بدون تسجيل) — مساحة التجربة مشتركة، فلا يمكن ربط حساباتك الحقيقية بها. سجّل دخولك بحسابك ثم اربط منصاتك.",
      );
      return;
    }
    // واتساب له مسار ربط مخصص لا يفتح موصل Pipedream القديم ذي الحقول اليدوية.
    if (provider === "whatsapp") {
      setDetail(provider);
      return;
    }
    if (realProviders.has(provider)) {
      if (status !== "connected") {
        if (provider === "wordpress") {
          setWpOpen(true);
          return;
        }
        if (provider === "indexnow") {
          setIndexNowOpen(true);
          return;
        }
        if (provider === "shopify") {
          setShopifyOpen(true);
          return;
        }
        if (provider === "webflow") {
          setWebflowOpen(true);
          return;
        }
        if (provider === "ghost") {
          setGhostOpen(true);
          return;
        }
        return;
      }
      setBusy(id);
      try {
        await disconnect({ data: { workspaceId: workspace!.id, provider } });
        void qc.invalidateQueries({ queryKey: ["integrations", workspace?.id] });
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذّر فصل الحساب");
      } finally {
        setBusy(null);
      }
      return;
    }

    if (isPipedreamProvider(provider) && workspace) {
      setBusy(id);
      try {
        if (status === "connected" && provider === "analytics") {
          setGa4Open(true);
        } else if (status === "connected" || status === "error") {
          await disconnectPd({ data: { workspaceId: workspace.id, provider } });
          void qc.invalidateQueries({ queryKey: ["integrations", workspace.id] });
        } else {
          const { url } = await startConnect({
            data: { workspaceId: workspace.id, provider, origin: window.location.origin },
          });
          window.location.href = url;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذّر بدء الربط عبر Pipedream");
      } finally {
        setBusy(null);
      }
      return;
    }

    setBusy(id);
    try {
      if (status === "connected") {
        await setStatus.mutateAsync({ id, status: "disconnected", account: null });
      } else {
        await setStatus.mutateAsync({
          id,
          status: "connected",
          account: `${workspace?.name ?? "حسابي"} · ${appLabel(provider)}`,
        });
      }
    } finally {
      setBusy(null);
    }
  };

  // جاء المستخدم من زر «اربط X» داخل المحادثة: نفتح ربط نفس المنصة فوراً.
  useEffect(() => {
    if (!autoConnect || !workspace || isLoading) return;
    const row = (integrations ?? []).find((i) => i.provider === autoConnect);
    setAutoConnect(null);
    if (!row || row.status === "connected") return;
    void toggle(row.id, row.status, row.provider);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, workspace, isLoading, integrations]);

  return (
    <AppShell
      title="التكاملات"
      lead={`${connected} حساباً مرتبطاً · حساب واحد لكل منصة داخل مساحة العمل`}
    >
      {wpOpen && workspace ? (
        <WordPressConnect workspaceId={workspace.id} onClose={() => setWpOpen(false)} />
      ) : null}

      {gscOpen && workspace ? (
        <SearchConsoleSites workspaceId={workspace.id} onClose={() => setGscOpen(false)} />
      ) : null}

      {indexNowOpen && workspace ? (
        <IndexNowSetup workspaceId={workspace.id} onClose={() => setIndexNowOpen(false)} />
      ) : null}

      {ga4Open && workspace ? (
        <Ga4Properties workspaceId={workspace.id} onClose={() => setGa4Open(false)} />
      ) : null}

      {shopifyOpen && workspace ? (
        <ShopifyConnect workspaceId={workspace.id} onClose={() => setShopifyOpen(false)} />
      ) : null}

      {webflowOpen && workspace ? (
        <WebflowConnect workspaceId={workspace.id} onClose={() => setWebflowOpen(false)} />
      ) : null}

      {ghostOpen && workspace ? (
        <GhostConnect workspaceId={workspace.id} onClose={() => setGhostOpen(false)} />
      ) : null}

      {error ? (
        <p className="mb-6 rounded-2xl bg-coral/12 px-4 py-3 text-sm font-semibold text-coral">
          {error}
        </p>
      ) : null}

      {scopeWarnings.map((w) => (
        <div
          key={w.provider}
          className="mb-6 flex items-start gap-3 rounded-2xl border border-amber/40 bg-amber/10 p-4 text-sm"
        >
          <AppIcon name={w.provider} className="mt-0.5 size-6 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-black">{appLabel(w.provider)} مربوط لكن بلا صلاحية نشر</p>
            <p className="mt-1 leading-relaxed text-ink-soft">{w.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setScopeWarnings((s) => s.filter((x) => x.provider !== w.provider))}
            className="text-xs text-muted-foreground hover:text-foreground"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>
      ))}

      {isGuest ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-amber/40 bg-amber/10 p-4">
          <ShieldCheck className="size-5 shrink-0 text-coral" />
          <p className="flex-1 text-sm font-semibold">
            أنت تتصفح في وضع التجربة بدون تسجيل، ومساحة التجربة مشتركة بين الزوار — سجّل دخولك
            بحسابك أولاً ليُحفظ الربط في مساحتك أنت.
          </p>
          <a
            href="/auth"
            className="shrink-0 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-bold text-background"
          >
            سجّل الدخول
          </a>
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن تطبيق…"
            className="w-full rounded-full border border-border bg-card py-2 pr-9 pl-4 text-sm"
          />
        </div>
        <button
          onClick={() => void refresh()}
          disabled={busy === "sync" || !workspace}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border px-3.5 py-2 text-xs font-bold disabled:opacity-60"
        >
          <RefreshCw className={cn("size-4", busy === "sync" && "animate-spin")} /> تحديث
        </button>
      </div>

      {broken.length ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-coral/30 bg-coral/8 p-4">
          <RefreshCw className="size-5 shrink-0 text-coral" />
          <p className="flex-1 text-sm font-semibold">
            {broken.length} حسابات تحتاج إعادة ربط — المهام المرتبطة بها متوقفة مؤقتاً.
          </p>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BrandLoader size="sm" />
        </div>
      ) : (
        <div className="space-y-6">
          {team.map((m) => {
            const owned = unique
              .filter((i) => i.employee_id === m.id)
              .filter((i) => !query.trim() || appLabel(i.provider).includes(query.trim()));
            if (!owned.length) return null;
            return (
              <section key={m.id} className="rounded-3xl border border-border bg-card p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span
                    className="grid size-11 shrink-0 overflow-hidden rounded-2xl ring-2"
                    style={
                      {
                        background: m.tintSoft,
                        "--tw-ring-color": m.tintSoft,
                      } as React.CSSProperties
                    }
                  >
                    <Portrait memberId={m.id} name={m.name} className="size-full" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display font-black">{m.name}</h2>
                    <p className="truncate text-sm text-muted-foreground">{m.role}</p>
                  </div>
                  <span className="ms-auto shrink-0 text-xs font-bold text-muted-foreground">
                    {owned.filter((i) => i.status === "connected").length}/{owned.length}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {owned.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => setDetail(i.provider)}
                      className="flex items-center gap-3 rounded-2xl border border-border/70 p-4 text-right transition-colors hover:border-foreground/30 hover:bg-secondary/40"
                    >
                      <AppIcon name={i.provider} className="size-6 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">
                          {appLabel(i.provider)}
                        </span>
                        <span
                          className={cn(
                            "block truncate text-xs",
                            i.status === "connected"
                              ? "text-jade-deep"
                              : i.status === "error"
                                ? "text-coral"
                                : "text-muted-foreground",
                          )}
                        >
                          {i.status === "connected"
                            ? (i.account ?? integrationStatusLabel.connected)
                            : i.status === "error"
                              ? "يحتاج إعادة ربط"
                              : "غير مربوط"}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          i.status === "connected"
                            ? "bg-jade-deep"
                            : i.status === "error"
                              ? "bg-coral"
                              : "bg-border",
                        )}
                      />
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {detailRow ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-6"
          onClick={() => setDetail(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-border bg-card p-6 sm:rounded-3xl"
          >
            <div className="flex items-start gap-3">
              <AppIcon name={detailRow.provider} className="size-8 shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-black">{appLabel(detailRow.provider)}</h3>
                <p className="text-sm text-muted-foreground">
                  {detailRow.provider === "whatsapp"
                    ? "اربط رقم واتساب للأعمال من هنا دون إدخال معرّف الحساب أو توكن يدوي."
                    : isMeta(detailRow.provider)
                      ? "ربط مباشر عبر تطبيق ميتا الخاص بنا — أذونات نشر كاملة."
                      : realProviders.has(detailRow.provider)
                        ? "ربط مباشر بالمنصة عبر OAuth الرسمي."
                        : "ربط آمن عبر وسيط التكاملات — لا نحتفظ بكلمات مرورك."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="إغلاق"
                className="shrink-0 rounded-full border border-border p-1.5 text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {pipedreamApp(detailRow.provider)?.note &&
            !isMeta(detailRow.provider) &&
            detailRow.provider !== "whatsapp" ? (
              <p className="mt-4 rounded-2xl bg-secondary/60 px-4 py-3 text-sm leading-relaxed text-ink-soft">
                {pipedreamApp(detailRow.provider)!.note}
              </p>
            ) : null}

            {!isMeta(detailRow.provider) &&
            detailRow.provider !== "whatsapp" &&
            detailRow.provider !== "telegram" &&
            isPipedreamProvider(detailRow.provider) &&
            pdReady === false ? (
              <p className="mt-4 rounded-2xl bg-amber/10 px-4 py-3 text-sm font-semibold">
                وسيط التكاملات غير مفعّل بعد — أضف مفاتيحه لتفعيل هذا الربط.
              </p>
            ) : null}
            {!isMeta(detailRow.provider) &&
            detailRow.provider !== "whatsapp" &&
            detailRow.provider !== "telegram" &&
            isPipedreamProvider(detailRow.provider) &&
            pdEnv === "development" ? (
              <p className="mt-4 rounded-2xl bg-amber/10 px-4 py-3 text-sm font-semibold">
                الوسيط يعمل بوضع التجريب حالياً — حوّله إلى الوضع الإنتاجي ليربط عملاؤك حساباتهم.
              </p>
            ) : null}

            {detailRow.provider === "whatsapp" && workspace ? (
              <div className="mt-5">
                <WhatsAppCommand workspaceId={workspace.id} />
              </div>
            ) : detailRow.provider === "telegram" && workspace ? (
              <div className="mt-5">
                <TelegramCommand workspaceId={workspace.id} />
              </div>
            ) : isMeta(detailRow.provider) ? (
              <div className="mt-4">
                <MetaDirect
                  workspaceId={workspace?.id}
                  only={detailRow.provider === "facebook" ? "facebook" : "instagram"}
                  bare
                />
              </div>
            ) : (
              <button
                onClick={() => void toggle(detailRow.id, detailRow.status, detailRow.provider)}
                disabled={busy === detailRow.id}
                className={cn(
                  "mt-5 inline-flex rounded-full px-4 py-2 text-xs font-bold transition-colors disabled:opacity-60",
                  detailRow.status === "connected" && "border border-border",
                  detailRow.status === "error" && "bg-coral text-background",
                  detailRow.status === "disconnected" && "bg-foreground text-background",
                )}
              >
                {busy === detailRow.id
                  ? "…"
                  : detailRow.status === "connected"
                    ? "فصل الحساب"
                    : detailRow.status === "error"
                      ? "أعد الربط"
                      : "اربط الآن"}
              </button>
            )}
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex items-start gap-3 rounded-3xl border border-border bg-secondary/50 p-6">
        <ShieldCheck className="size-5 shrink-0 text-jade-deep" />
        <p className="text-sm leading-relaxed text-ink-soft">
          الربط يتم عبر OAuth الرسمي لكل منصة — لا نطلب كلمات مرورك أبداً، ويمكنك فصل أي حساب بضغطة
          واحدة.
        </p>
      </div>
    </AppShell>
  );
}
