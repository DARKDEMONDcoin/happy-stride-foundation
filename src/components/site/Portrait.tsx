import { useState } from "react";
import { ChevronDown, MapPin, Sparkles } from "lucide-react";
import { useRegion } from "@/hooks/use-region";
import { COUNTRIES, COUNTRY_GROUPS, portraitOf } from "@/data/team-portraits";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type PortraitProps = {
  memberId: string;
  name: string;
  className?: string;
  eager?: boolean;
};

/** صورة الموظف — بزيّ بلد المستخدم، ونفسها في كل مكان بالموقع. */
export function Portrait({ memberId, name, className, eager }: PortraitProps) {
  const { region } = useRegion();
  return (
    <img
      key={`${memberId}-${region}`}
      src={portraitOf(memberId, region)}
      alt={`${name} — موظف رقمي في سهل`}
      width={768}
      height={768}
      loading={eager ? "eager" : "lazy"}
      className={cn("object-cover object-top", className)}
    />
  );
}

/**
 * مبدّل البلد — يُكتشف بلد الزائر تلقائياً ويستطيع تغييره في أي وقت.
 */
export function RegionPicker({ className }: { className?: string }) {
  const { country, countryInfo, setCountry, auto } = useRegion();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="اختر بلدك"
          className={cn(
            "group inline-flex items-center gap-2 rounded-full border border-border bg-card/80 py-1.5 pr-1.5 pl-4 text-sm font-bold shadow-card backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift",
            className,
          )}
        >
          <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
            <MapPin className="size-3.5" strokeWidth={2.6} />
          </span>
          <span className="flex flex-col items-start leading-none">
            <span>{countryInfo.name}</span>
            {auto && (
              <span className="mt-1 flex items-center gap-1 text-[0.62rem] font-semibold opacity-70">
                <Sparkles className="size-2.5" />
                اكتشفناه تلقائياً
              </span>
            )}
          </span>
          <ChevronDown
            className={cn(
              "size-4 opacity-60 transition-transform duration-300",
              open && "rotate-180",
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={10}
        className="w-[min(92vw,34rem)] rounded-3xl border-border bg-card p-5 shadow-lift"
      >
        <p className="font-display text-base font-extrabold">اختر بلدك</p>
        <p className="mt-1 text-xs text-muted-foreground">
          نعرض لك الأسعار والمحتوى بما يناسب بلدك:
        </p>
        <div className="mt-4 space-y-4">
          {COUNTRY_GROUPS.map((g) => (
            <div key={g}>
              <p className="mb-2 text-[0.7rem] font-bold tracking-wider text-primary">{g}</p>
              <div className="flex flex-wrap gap-1.5">
                {COUNTRIES.filter((c) => c.group === g).map((c) => {
                  const on = c.code === country;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setCountry(c.code);
                        setOpen(false);
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-semibold transition-all duration-200",
                        on
                          ? "border-transparent bg-foreground text-background shadow-card"
                          : "border-border bg-background text-ink-soft hover:border-primary/50 hover:text-primary",
                      )}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
