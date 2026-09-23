import { LogoMark } from "@/components/site/LogoMark";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Portrait } from "@/components/site/Portrait";
import { Bell, Menu, X, User, LogOut } from "lucide-react";

import { team } from "@/data/team";
import { COUNTRIES } from "@/data/team-portraits";
import { useRegion } from "@/hooks/use-region";
import { supabase } from "@/integrations/supabase/client";
import { GUEST_EMAIL } from "@/lib/guest.functions";

import { useProfile, useWorkspace } from "@/lib/data";
import { UserAvatar } from "@/components/app/UserAvatar";
import { SiteFavicon } from "@/components/app/SiteBadge";
import { cn } from "@/lib/utils";
import defaultWorkspace from "@/assets/default-workspace.jpg";

function WorkspaceCard() {
  const { data: workspace } = useWorkspace();
  const website = (workspace as { website?: string | null } | undefined)?.website?.trim();
  return (
    <div className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-start">
      {website ? (
        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-background p-1.5 shadow-sm">
          <SiteFavicon website={website} className="size-full" />
        </span>
      ) : (
        <img
          src={defaultWorkspace}
          alt="صورة مساحة العمل الافتراضية"
          loading="lazy"
          width={1024}
          height={1024}
          className="size-10 shrink-0 rounded-xl border border-border object-cover shadow-sm"
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{workspace?.name ?? "مساحة عملك"}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {workspace?.industry ?? "—"}
        </span>
      </span>
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <Link
        to="/"
        className="flex h-11 items-center gap-2 border-b border-border px-1 pb-3 font-display text-xl font-black"
      >
        <LogoMark className="size-8 sm:size-10" size={40} />
        سهل<span className="text-jade">.</span>
      </Link>

      <WorkspaceCard />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 px-2">
          <p className="text-[0.68rem] font-bold text-muted-foreground">الموظفون</p>
        </div>
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {team.map((m) => (
            <Link
              key={m.id}
              to="/app/chat/$id"
              params={{ id: m.id }}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-sm transition-all hover:bg-secondary/70",
                pathname === `/app/chat/${m.id}` && "border-primary/20 bg-primary/10 shadow-sm",
              )}
            >
              <span className="relative block size-10 shrink-0 overflow-hidden rounded-lg shadow-sm">
                <Portrait memberId={m.id} name={m.name} className="size-full" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{m.name}</span>
                <span className="block truncate text-[0.7rem] text-muted-foreground">{m.role}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
      <Link to="/pricing" onClick={onNavigate} className="app-sidebar-pricing">
        <span>
          <small>الخطط والسعة</small>
          <b>عرض الأسعار</b>
        </span>
        <i aria-hidden="true">←</i>
      </Link>
    </div>
  );
}

/** شريط يوضّح أن الجلسة الحالية تجريبية ويقود لإنشاء حساب حقيقي. */
function GuestBar() {
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (alive) setIsGuest(data.user?.email === GUEST_EMAIL);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!isGuest) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-amber/15 px-5 py-3">
      <p className="text-sm font-bold">أنت في وضع التجربة — العمل هنا مشترك ولن يُحفظ باسمك.</p>
      <Link
        to="/auth"
        search={{ mode: "signup" }}
        className="rounded-full bg-foreground px-4 py-1.5 text-xs font-bold text-background"
      >
        أنشئ حسابك المجاني
      </Link>
    </div>
  );
}

/** قائمة المستخدم: اسمه وبريده، والملف الشخصي، وزي الفريق، وتسجيل الخروج. */
function UserMenu({ name }: { name: string | null }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const { country, countryInfo, setCountry } = useRegion();

  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (alive) setEmail(data.user?.email ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="حسابك"
        aria-expanded={open}
        className="size-10 overflow-hidden rounded-xl border border-border/60 shadow-card transition-transform hover:-translate-y-0.5"
      >
        <UserAvatar />
      </button>
      {open ? (
        <>
          <button
            aria-label="إغلاق"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute end-0 z-50 mt-2 w-[min(88vw,17rem)] rounded-2xl border border-border bg-card p-2 shadow-lift">
            <div className="flex items-center gap-3 px-3 py-2">
              <span className="size-10 shrink-0 overflow-hidden rounded-xl border border-border/60">
                <UserAvatar />
              </span>
              <span className="min-w-0">
                <p className="truncate text-sm font-bold">{name ?? "حسابك"}</p>
                {email ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
              </span>
            </div>
            <Link
              to="/app/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold hover:bg-secondary"
            >
              <User className="size-4" /> الملف الشخصي والإعدادات
            </Link>

            <div className="mt-1 rounded-xl bg-secondary/50 p-3">
              <p className="text-xs font-bold">زيّ الفريق</p>
              <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                اختياري — اعرض الموظفين بلبس أي دولة عربية.
              </p>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                aria-label="زي الفريق حسب الدولة"
                className="mt-2 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm font-semibold"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[0.68rem] text-muted-foreground">
                الحالي: {countryInfo.name}
              </p>
            </div>

            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
              className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm font-bold text-coral hover:bg-coral/10"
            >
              <LogOut className="size-4" /> تسجيل الخروج
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function AppShell({
  title,
  lead,
  actions,
  children,
  padded = true,
  compactTitle = false,
}: {
  title: string;
  lead?: string;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  /** يخفي العنوان على الهاتف ليتّسع الشريط للأزرار دون تداخل. */
  compactTitle?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: profile } = useProfile();
  const embedded = useRouterState({
    select: (state) =>
      (state.location.search as Record<string, unknown>)["embedded"] === "1" ||
      (state.location.search as Record<string, unknown>)["embedded"] === true,
  });

  return (
    <div
      className={cn(
        "app-shell sahl-app-theme flex min-h-screen bg-background",
        embedded && "is-embedded",
        compactTitle && "is-chat-shell",
      )}
    >
      <div className="sahl-smoke sahl-smoke-app" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <aside
        className={cn(
          "sticky top-0 hidden h-screen w-64 shrink-0 self-start overflow-hidden border-e border-border bg-card md:block",
          embedded && "md:hidden",
        )}
      >
        <SidebarBody />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="إغلاق"
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 start-0 w-[min(19rem,86vw)] overflow-y-auto bg-card shadow-2xl">
            <SidebarBody onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "app-topbar sticky top-0 z-30 px-2 pt-2 sm:px-4 sm:pt-3",
            embedded && "hidden",
          )}
        >
          <div className="app-topbar-inner flex min-h-14 items-center gap-2 px-2 py-1.5 sm:gap-2.5 sm:px-3">
            <button
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-border md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="القائمة"
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <div className={cn("min-w-0 flex-1", compactTitle && "hidden sm:block")}>
              <h1 className="truncate font-display text-base font-black sm:text-lg">{title}</h1>
              {lead ? (
                <p className="truncate text-xs text-muted-foreground sm:text-sm">{lead}</p>
              ) : null}
            </div>
            <div
              className={cn(
                "app-topbar-controls flex min-w-0 shrink items-center gap-1 sm:gap-2",
                compactTitle && "flex-1 overflow-hidden sm:flex-initial sm:overflow-visible",
              )}
            >
              {actions}
              <Link
                to="/app/approvals"
                className="relative hidden size-10 shrink-0 place-items-center rounded-xl border border-border transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid"
                aria-label="التنبيهات"
              >
                <Bell className="size-4.5" />
              </Link>
              <UserMenu name={profile?.full_name ?? null} />
            </div>
          </div>
        </header>
        {embedded ? null : <GuestBar />}
        <main className={padded ? "mx-auto w-full max-w-[100rem] px-3.5 py-5 sm:px-5 sm:py-7" : ""}>
          {children}
        </main>
      </div>
    </div>
  );
}
