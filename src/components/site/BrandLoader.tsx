import { LogoMark } from "@/components/site/LogoMark";
import { cn } from "@/lib/utils";

/** علامة التحميل الرسمية: شعار سهل داخل حلقة ضوئية دوّارة. */
export function BrandLoader({
  label = "جارٍ التحميل…",
  size = "md",
  className,
}: {
  label?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const px = size === "sm" ? 28 : size === "lg" ? 64 : 44;
  return (
    <div
      className={cn("brand-loader", `brand-loader-${size}`, className)}
      role="status"
      aria-live="polite"
    >
      <span className="brand-loader-ring">
        <span className="brand-loader-arc" aria-hidden />
        <span className="brand-loader-mark">
          <LogoMark size={px} className="size-full" />
        </span>
      </span>
      {label ? <span className="brand-loader-label">{label}</span> : null}
    </div>
  );
}

/** شاشة تحميل كاملة تُستخدم أثناء انتقال الصفحات. */
export function BrandLoaderScreen({ label }: { label?: string }) {
  return (
    <div className="brand-loader-screen">
      <BrandLoader size="lg" label={label ?? "لحظة… نجهّز لك الصفحة"} />
    </div>
  );
}
