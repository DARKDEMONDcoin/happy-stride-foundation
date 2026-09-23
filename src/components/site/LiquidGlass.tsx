import { useRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function LiquidGlass({
  className,
  onPointerMove,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={cn("liquid-glass", className)}
      onPointerMove={(event) => {
        const node = ref.current;
        if (node) {
          const rect = node.getBoundingClientRect();
          node.style.setProperty("--glass-x", `${event.clientX - rect.left}px`);
          node.style.setProperty("--glass-y", `${event.clientY - rect.top}px`);
        }
        onPointerMove?.(event);
      }}
      {...props}
    />
  );
}
