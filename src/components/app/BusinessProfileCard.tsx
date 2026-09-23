import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Sparkles,
  RefreshCw,
  MapPin,
  Users,
  Store,
  Swords,
  Link2,
  ArrowUpLeft,
} from "lucide-react";

import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { getMember } from "@/data/team";
import type { BusinessProfile } from "@/lib/business-profile.server";
import { profileMyWebsite } from "@/lib/business-profile.functions";
import { cn } from "@/lib/utils";
import { Portrait } from "@/components/site/Portrait";
import { SiteFavicon } from "@/components/app/SiteBadge";
import defaultWorkspace from "@/assets/default-workspace.jpg";

type Props = {
  workspaceId: string;
  website?: string | null | undefined;
  profile?: Partial<BusinessProfile> | null | undefined;
  /** يُستدعى بعد التحليل (الإعداد الأولي يملأ الحقول منه). */
  onProfiled?: (p: BusinessProfile, url: string) => void;
  compact?: boolean;
  className?: string;
};

const field =
  "w-full rounded-2xl border border-border bg-background px-4 py-3 outline-none focus:border-jade";

/** بطاقة «ملف العلامة»: رابط واحد → نفهم النشاط كاملاً ونقترح أول المهام والتكاملات. */
export function BusinessProfileCard({
  workspaceId,
  website,
  profile,
  onProfiled,
  compact,
  className,
}: Props) {
  const qc = useQueryClient();
  const run = useServerFn(profileMyWebsite);
  const [url, setUrl] = useState(website ?? "");
  const [result, setResult] = useState<BusinessProfile | null>(null);

  const mutation = useMutation({
    mutationFn: () => run({ data: { workspaceId, url, save: true } }),
    onSuccess: (r) => {
      setResult(r.profile);
      onProfiled?.(r.profile, url);
      void qc.invalidateQueries({ queryKey: ["workspace"] });
      void qc.invalidateQueries({ queryKey: ["brain", workspaceId] });
    },
  });

  const p = (result ?? profile) as Partial<BusinessProfile> | null;
  const has = Boolean(p?.summary || p?.products?.length);
  const savedSite = (website ?? "").trim() || (mutation.isSuccess ? url.trim() : "");

  return (
    <section className={cn("rounded-3xl border border-border bg-card p-4 sm:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-2xl bg-jade/12 text-jade-deep">
            {savedSite ? (
              <SiteFavicon website={savedSite} className="size-6" />
            ) : (
              <img
                src={defaultWorkspace}
                alt="صورة مساحة العمل الافتراضية"
                loading="lazy"
                width={1024}
                height={1024}
                className="size-full object-cover"
              />
            )}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base font-black sm:text-lg">ملف العلامة من موقعك</h2>
            {savedSite ? (
              <p className="mt-0.5 truncate text-xs font-bold text-jade-deep" dir="ltr">
                {savedSite.replace(/^https?:\/\//, "").replace(/^www\./, "")}
              </p>
            ) : null}
            <p className="mt-0.5 text-xs text-ink-soft sm:text-sm">
              ضع رابط موقعك فقط — نقرأ صفحاته ونفهم منتجاتك وجمهورك ومدنك ولهجتك ومنافسيك، ويعمل
              عليها الموظفون الستة تلقائياً.
            </p>
          </div>
        </div>
        {has && p?.confidence ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[0.7rem] font-bold",
              p.confidence === "high"
                ? "bg-jade/12 text-jade-deep"
                : p.confidence === "medium"
                  ? "bg-amber/15 text-amber"
                  : "bg-secondary text-muted-foreground",
            )}
          >
            {p.confidence === "high"
              ? "فهم عالٍ"
              : p.confidence === "medium"
                ? "فهم جيد — راجع التفاصيل"
                : "فهم محدود — أضف معلومات"}
          </span>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim().length > 3 && !mutation.isPending) mutation.mutate();
        }}
        className="mt-4 flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          dir="ltr"
          inputMode="url"
          placeholder="https://your-site.com"
          className={cn(field, "flex-1 text-start")}
        />
        <button
          type="submit"
          disabled={mutation.isPending || url.trim().length < 4}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-foreground px-5 py-3 text-sm font-bold text-background disabled:opacity-60"
        >
          {mutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : has ? (
            <RefreshCw className="size-4" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {mutation.isPending ? "نقرأ موقعك…" : has ? "أعد التحليل" : "افهم نشاطي"}
        </button>
      </form>
      {mutation.isPending ? (
        <p className="mt-2 text-xs text-muted-foreground">
          نقرأ حتى 6 صفحات (عنّا، الخدمات، الأسعار…) ونكتشف المنصة واللهجة والمنافسين — نحو 30
          ثانية.
        </p>
      ) : null}
      {mutation.error ? (
        <p className="mt-3 rounded-2xl bg-coral/12 px-4 py-3 text-sm font-semibold text-coral">
          {mutation.error instanceof Error ? mutation.error.message : "تعذّر تحليل الموقع"}
        </p>
      ) : null}

      {has && p ? (
        <div className="mt-5 space-y-4">
          <p className="rounded-2xl bg-secondary/60 p-4 text-sm leading-relaxed">
            <b>{p.name}</b> · {p.industry}
            {p.country ? ` · ${p.country}` : ""}
            {p.platform ? ` · موقع ${p.platform}` : ""}
            {p.dialect ? ` · لهجة ${p.dialect}` : ""}
            <br />
            {p.summary}
          </p>

          {!compact ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Fact icon={Store} label="المنتجات/الخدمات" items={p.products} />
              <Fact icon={Users} label="الجمهور" items={p.audience ? [p.audience] : []} />
              <Fact icon={MapPin} label="المدن/الفروع" items={p.locations} />
              <Fact icon={Swords} label="منافسون محتملون" items={p.competitors} ltr />
            </div>
          ) : null}

          {p.recommendedIntegrations?.length ? (
            <div>
              <p className="mb-2 text-xs font-bold text-muted-foreground">
                أكثر الحسابات فائدة لنشاطك (تُربط عند الحاجة فقط)
              </p>
              <div className="flex flex-wrap gap-2">
                {p.recommendedIntegrations.map((i) => (
                  <Link
                    key={i.provider}
                    to="/app/integrations"
                    title={i.why}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-bold hover:bg-secondary"
                  >
                    <AppIcon name={i.provider} className="size-4" /> {appLabel(i.provider)}
                    <Link2 className="size-3 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {!compact && p.firstTasks?.length ? (
            <div>
              <p className="mb-2 text-xs font-bold text-muted-foreground">
                أول مهمة مقترحة لكل موظف — اضغط لتبدأ فوراً
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {p.firstTasks.map((t) => {
                  const m = getMember(t.employeeId);
                  if (!m) return null;
                  return (
                    <Link
                      key={`${t.employeeId}-${t.title}`}
                      to="/app/chat/$id"
                      params={{ id: t.employeeId }}
                      search={{ prompt: t.prompt }}
                      className="group flex items-center gap-3 rounded-2xl border border-border p-3 text-start transition-colors hover:bg-secondary/60"
                    >
                      <span
                        className="size-9 shrink-0 overflow-hidden rounded-xl"
                        style={{ background: m.tintSoft }}
                      >
                        <Portrait memberId={m.id} name={m.name} className="size-full" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-muted-foreground">
                          {m.name}
                        </span>
                        <span className="block truncate text-sm font-bold">{t.title}</span>
                      </span>
                      <ArrowUpLeft className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Fact({
  icon: Icon,
  label,
  items,
  ltr,
}: {
  icon: typeof Store;
  label: string;
  items?: string[] | undefined;
  ltr?: boolean | undefined;
}) {
  if (!items?.length) return null;
  return (
    <div className="rounded-2xl border border-border/70 p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-1 text-sm" dir={ltr ? "ltr" : undefined}>
        {items.join("، ")}
      </p>
    </div>
  );
}
