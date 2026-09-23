import logo from "@/assets/sahl-logo.png";
import { cn } from "@/lib/utils";

export function LogoMark({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <img
      src={logo}
      alt="شعار سهل"
      width={size}
      height={size}
      className={cn("shrink-0 select-none object-contain", className)}
      draggable={false}
    />
  );
}

export default LogoMark;
