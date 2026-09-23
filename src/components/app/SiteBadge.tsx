import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, ArrowUpLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import defaultWorkspace from "@/assets/default-workspace.jpg";

const KEY = "sahl:site-badge-hidden";

function hostOf(url: string) {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return (
      url
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0] ?? url
    );
  }
}

/** أيقونة الموقع الذي اختاره المستخدم لعقل العلامة + اسمه. */
export function SiteFavicon({ website, className }: { website: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const host = hostOf(website);
  if (failed) {
    return (
      <img
        src={defaultWorkspace}
        alt="صورة مساحة العمل الافتراضية"
        loading="lazy"
        width={1024}
        height={1024}
        className={cn("rounded-md object-cover", className)}
      />
    );
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?sz=64&domain=${host}`}
      alt={`أيقونة ${host}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("rounded-md object-contain", className)}
    />
  );
}

/** شريط صغير في المحادثات: يظهر موقع العلامة المختار حتى يلغيه المستخدم. */
export function SiteBadgeBar({ website }: { website?: string | null }) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(typeof window !== "undefined" && window.localStorage.getItem(KEY) === "1");
  }, []);

  if (!website || hidden) return null;
  const host = hostOf(website);

  return (
    <div className="glass-chip flex items-center gap-2.5 rounded-2xl border border-border bg-card/70 px-3 py-2 text-sm">
      <SiteFavicon website={website} className="size-6 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold" dir="ltr">
          {host}
        </span>
        <span className="block text-[0.7rem] text-muted-foreground">
          فريقك يقرأ هذا الموقع من عقل العلامة
        </span>
      </span>
      <Link
        to="/app/brain"
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[0.7rem] font-bold transition-colors hover:bg-secondary"
      >
        اختبر عقل العلامة <ArrowUpLeft className="size-3 text-primary" />
      </Link>
      <button
        type="button"
        aria-label="إلغاء"
        title="إلغاء"
        onClick={() => {
          window.localStorage.setItem(KEY, "1");
          setHidden(true);
        }}
        className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
