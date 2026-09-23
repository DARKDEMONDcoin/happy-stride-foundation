import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Loader2 } from "lucide-react";

import { AppIcon } from "@/components/site/AppIcon";
import { SearchConsoleSites } from "@/components/app/SearchConsoleSites";
import { Ga4Properties } from "@/components/app/Ga4Properties";
import { startSearchConsoleOAuth } from "@/lib/gsc.functions";
import { startPipedreamConnect } from "@/lib/pipedream.functions";
import { cn } from "@/lib/utils";

type Kind = "search-console" | "analytics";

/**
 * زر ربط جوجل المباشر: يفتح موافقة Google فوراً من قسم التحليلات نفسه،
 * بدل إرسال المستخدم إلى صفحة التكاملات ليبحث عن الخدمة بنفسه.
 * وإن كان الحساب مربوطاً وينقص اختيار الموقع/الخاصية فتُفتح نافذة الاختيار.
 */
export function GoogleConnectButton({
  workspaceId,
  kind,
  label,
  needsPick = false,
  size = "md",
  className,
}: {
  workspaceId: string | undefined;
  kind: Kind;
  label?: string;
  /** الحساب مربوط لكن لم يُختر الموقع/الخاصية بعد. */
  needsPick?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const startGsc = useServerFn(startSearchConsoleOAuth);
  const startConnect = useServerFn(startPipedreamConnect);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    if (!workspaceId) return;
    setError(null);
    if (needsPick) {
      setPicker(true);
      return;
    }
    setBusy(true);
    try {
      const url =
        kind === "search-console"
          ? (await startGsc({ data: { workspaceId } })).url
          : (
              await startConnect({
                data: {
                  workspaceId,
                  provider: "analytics",
                  origin: window.location.origin,
                  returnTo: `${window.location.pathname}${window.location.search}`,
                },
              })
            ).url;
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر بدء الربط مع جوجل");
      setBusy(false);
    }
  };

  const pad = size === "sm" ? "px-3 py-1.5 text-xs" : "px-3.5 py-2 text-sm";
  const fallback = kind === "search-console" ? "اربط Search Console" : "اربط Google Analytics";

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={() => void go()}
        disabled={busy || !workspaceId}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl bg-foreground font-bold text-background transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0",
          pad,
          className,
        )}
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <AppIcon
            name={kind === "search-console" ? "search-console" : "analytics"}
            className="size-3.5"
          />
        )}
        {needsPick
          ? kind === "search-console"
            ? "اختر موقعك"
            : "اختر الخاصية"
          : (label ?? fallback)}
        {!busy ? <Link2 className="size-3.5 opacity-70" /> : null}
      </button>
      {error ? <span className="text-[11px] font-bold text-coral">{error}</span> : null}
      {picker && workspaceId ? (
        kind === "search-console" ? (
          <SearchConsoleSites workspaceId={workspaceId} onClose={() => setPicker(false)} />
        ) : (
          <Ga4Properties workspaceId={workspaceId} onClose={() => setPicker(false)} />
        )
      ) : null}
    </span>
  );
}
