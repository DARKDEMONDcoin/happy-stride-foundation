import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Loader2 } from "lucide-react";

import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { isPipedreamProvider } from "@/data/pipedream-apps";
import { startPipedreamConnect } from "@/lib/pipedream.functions";

/** منصات تُربط بنموذج داخلي على صفحة التكاملات (مفتاح/رابط بدل OAuth الوسيط). */
const DIALOG_PROVIDERS = new Set([
  "wordpress",
  "indexnow",
  "shopify",
  "webflow",
  "ghost",
  "telegram",
]);

type Props = {
  workspaceId: string | undefined;
  provider: string;
  /** نص الزر — الافتراضي «اربط <المنصة>». */
  label?: string;
  className?: string;
  size?: "sm" | "md";
  /** يكمل النشر فور العودة من الربط عندما كان هذا هو الأمر الصريح للمستخدم. */
  publishAfterConnect?: boolean;
};

/**
 * زر ربط مباشر: يفتح ربط نفس المنصة التي طلبها المستخدم فوراً (نافذة OAuth أو نموذج
 * المنصة) بدل رميه في صفحة التكاملات ليبحث عنها بنفسه. وبعد نجاح الربط يعود
 * إلى الصفحة التي كان فيها.
 */
export function ConnectNow({
  workspaceId,
  provider,
  label,
  className,
  size = "md",
  publishAfterConnect = false,
}: Props) {
  const navigate = useNavigate();
  const startConnect = useServerFn(startPipedreamConnect);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setError(null);
    if (DIALOG_PROVIDERS.has(provider) || !isPipedreamProvider(provider) || !workspaceId) {
      void navigate({ to: "/app/integrations", search: { connect: provider } as never });
      return;
    }
    setBusy(true);
    try {
      if (publishAfterConnect) {
        sessionStorage.setItem(
          `publish-after-connect:${workspaceId}`,
          JSON.stringify({ provider, createdAt: Date.now() }),
        );
      }
      const back = `${window.location.pathname}${window.location.search}`;
      const { url } = await startConnect({
        data: { workspaceId, provider, origin: window.location.origin, returnTo: back },
      });
      window.location.href = url;
    } catch (e) {
      if (publishAfterConnect) sessionStorage.removeItem(`publish-after-connect:${workspaceId}`);
      setError(e instanceof Error ? e.message : "تعذّر بدء الربط");
      setBusy(false);
    }
  };

  const pad = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className={
          className ??
          `inline-flex items-center gap-1.5 rounded-full bg-foreground font-bold text-background transition-transform hover:-translate-y-0.5 disabled:opacity-60 ${pad}`
        }
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <AppIcon name={provider} className="size-3.5" />
        )}
        {label ?? `اربط ${appLabel(provider)}`}
        {!busy ? <Link2 className="size-3.5 opacity-70" /> : null}
      </button>
      {error ? <span className="text-[11px] font-bold text-coral">{error}</span> : null}
    </span>
  );
}
