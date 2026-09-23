import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function AmbientBackground({
  quiet = false,
  className,
}: {
  quiet?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        node.style.setProperty("--smoke-scroll", `${Math.min(window.scrollY * 0.08, 90)}px`);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn("ambient-field", quiet && "ambient-field-quiet", className)}
    >
      <span className="ambient-cloud ambient-cloud-a" />
      <span className="ambient-cloud ambient-cloud-b" />
      <span className="ambient-cloud ambient-cloud-c" />
      <span className="ambient-grain" />
    </div>
  );
}
