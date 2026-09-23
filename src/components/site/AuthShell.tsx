import { LogoMark } from "@/components/site/LogoMark";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, ShieldCheck, Clock4, Languages } from "lucide-react";

const proofs = [
  { icon: Languages, t: "عربية أصيلة بكل اللهجات" },
  { icon: ShieldCheck, t: "موافقتك قبل أي إجراء حسّاس" },
  { icon: Clock4, t: "أول منشور خلال ١١ دقيقة" },
];

export function AuthShell({
  title,
  lead,
  children,
  footer,
}: {
  title: string;
  lead: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1fr_1.05fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <div className="sahl-smoke sahl-smoke-auth" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ backgroundImage: "var(--gradient-ink)" }}
        />
        <div
          aria-hidden
          className="absolute -top-1/3 -left-1/4 h-[130%] w-[90%] opacity-24 blur-3xl"
          style={{
            backgroundImage: "var(--gradient-aurora)",
            backgroundSize: "200% 200%",
            animation: "aurora-pan 18s ease-in-out infinite",
            borderRadius: "48% 52% 40% 60%",
          }}
        />
        <div aria-hidden className="grid-lines absolute inset-0 opacity-30" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link to="/" className="flex items-center gap-2.5 text-white">
            <LogoMark className="size-11" size={44} />
            <span className="font-display text-xl font-extrabold">سهل</span>
          </Link>

          <div>
            <h2 className="max-w-md font-display text-4xl leading-tight font-black text-white">
              فريق كامل يبدأ العمل الليلة، بلا توظيف ولا انتظار.
            </h2>
            <ul className="mt-8 space-y-4">
              {proofs.map((p) => (
                <li key={p.t} className="flex items-center gap-3 text-white/90">
                  <span className="grid size-9 place-items-center rounded-xl bg-white/15 backdrop-blur">
                    <p.icon className="size-4.5" strokeWidth={2.2} />
                  </span>
                  {p.t}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-white/70">
            «وفّرت ساعتين يومياً من أول أسبوع» — نُهى العُمري، أتيليه نُهى
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-14">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-7 flex items-center gap-2 lg:hidden">
            <LogoMark className="size-9" size={36} />
            <span className="font-display text-lg font-extrabold">سهل</span>
          </Link>

          <h1 className="font-display text-3xl font-black">{title}</h1>
          <p className="mt-2 text-ink-soft">{lead}</p>

          <div className="mt-8">{children}</div>

          <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
        </div>
      </div>
    </div>
  );
}

export const authInput =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 outline-none transition-colors focus:border-primary";
