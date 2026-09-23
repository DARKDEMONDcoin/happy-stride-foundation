import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Globe,
  Loader2,
  ScanSearch,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { auditSite } from "@/lib/seo-audit.functions";
import type { SeoAudit } from "@/lib/seo-audit.server";
import { cn } from "@/lib/utils";

const statusUi = {
  pass: { icon: CheckCircle2, cls: "text-jade", bg: "bg-jade/10", label: "ممتاز" },
  warn: {
    icon: AlertTriangle,
    cls: "text-amber-600",
    bg: "bg-amber-500/10",
    label: "يحتاج تحسينًا",
  },
  fail: { icon: XCircle, cls: "text-coral", bg: "bg-coral/10", label: "مشكلة" },
} as const;

function Ring({ value, label }: { value: number | null; label: string }) {
  const v = value ?? 0;
  const color = v >= 90 ? "var(--color-jade)" : v >= 50 ? "#d97706" : "var(--color-coral)";
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="grid size-16 place-items-center rounded-full"
        style={{ background: `conic-gradient(${color} ${v * 3.6}deg, var(--color-secondary) 0)` }}
      >
        <div className="grid size-12 place-items-center rounded-full bg-card font-display text-lg font-black">
          {value == null ? "—" : value}
        </div>
      </div>
      <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
    </div>
  );
}

export function SeoAuditCard({ defaultUrl = "" }: { defaultUrl?: string }) {
  const run = useServerFn(auditSite);
  const [url, setUrl] = useState(defaultUrl);
  const [result, setResult] = useState<SeoAudit | null>(null);

  const audit = useMutation({
    mutationFn: () => run({ data: { url, withSpeed: true } }),
    onSuccess: setResult,
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الفحص"),
  });

  const fails = result?.checks.filter((c) => c.status === "fail") ?? [];
  const warns = result?.checks.filter((c) => c.status === "warn") ?? [];
  const passes = result?.checks.filter((c) => c.status === "pass") ?? [];
  const ordered = [...fails, ...warns, ...passes];

  const nourPrompt = result
    ? `افحصت صفحتي ${result.finalUrl} ووجدت هذه المشاكل:\n${[...fails, ...warns]
        .map((c) => `- ${c.label}: ${c.detail}`)
        .join(
          "\n",
        )}\nاكتب لي خطة إصلاح مرتبة بالأولوية مع النصوص الجاهزة (العنوان، الوصف، H1، schema).`
    : "";

  return (
    <section className="rounded-3xl border border-border bg-card p-6 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-2xl text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-aurora)" }}
          >
            <ScanSearch className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-black">فحص سيو فوري لأي صفحة — مجانًا</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              لا يحتاج ربط Search Console: ١٦ فحصًا للعنوان والوصف والعناوين والصور وSchema
              والعربية/RTL + سرعة Lighthouse.
            </p>
          </div>
        </div>
      </div>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          audit.mutate();
        }}
      >
        <label className="flex flex-1 items-center gap-2 rounded-2xl border border-border px-4 py-3 focus-within:border-jade">
          <Globe className="size-4 shrink-0 text-muted-foreground" />
          <input
            dir="ltr"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/page"
            className="min-w-0 flex-1 bg-transparent text-left outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={audit.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-foreground px-5 py-3 text-sm font-bold text-background disabled:opacity-60"
        >
          {audit.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> نفحص الصفحة والسرعة…
            </>
          ) : (
            <>
              <Gauge className="size-4" /> افحص الآن
            </>
          )}
        </button>
      </form>
      {audit.isPending ? (
        <p className="mt-2 text-xs text-muted-foreground">
          قياس السرعة عبر Lighthouse قد يستغرق حتى ٣٠ ثانية.
        </p>
      ) : null}

      {result ? (
        <div className="mt-6 space-y-5 border-t border-border/70 pt-5">
          <div className="flex flex-wrap items-center justify-around gap-4 rounded-2xl bg-secondary/50 p-4">
            <Ring value={result.score} label="سيو الصفحة" />
            <Ring value={result.speed?.performance ?? null} label="الأداء (جوال)" />
            <Ring value={result.speed?.seo ?? null} label="سيو Lighthouse" />
            <Ring value={result.speed?.accessibility ?? null} label="إمكانية الوصول" />
            <div className="text-xs text-muted-foreground">
              {result.speed ? (
                <>
                  <p>
                    LCP: <b className="text-foreground">{result.speed.lcp ?? "—"}</b>
                  </p>
                  <p>
                    CLS: <b className="text-foreground">{result.speed.cls ?? "—"}</b>
                  </p>
                  <p>
                    INP: <b className="text-foreground">{result.speed.inp ?? "—"}</b>
                  </p>
                </>
              ) : (
                <p className="max-w-[12rem]">
                  قياس السرعة المجاني من جوجل مشغول الآن — تحليل الصفحة أعلاه كامل، وأعد المحاولة
                  لاحقًا للسرعة.
                </p>
              )}
            </div>
          </div>

          <p className="text-sm">
            <span className="font-black text-coral">{fails.length} مشكلة</span> ·{" "}
            <span className="font-black text-amber-600">{warns.length} تحسين</span> ·{" "}
            <span className="font-black text-jade">{passes.length} ممتاز</span>
            <span className="text-muted-foreground">
              {" "}
              — {result.page.wordCount.toLocaleString("ar-EG")} كلمة · {result.page.images} صورة ·{" "}
              {result.page.internalLinks} رابط داخلي
            </span>
          </p>

          <ul className="grid gap-2 md:grid-cols-2">
            {ordered.map((c) => {
              const ui = statusUi[c.status];
              return (
                <li
                  key={c.id}
                  className={cn(
                    "rounded-2xl border border-border p-3.5 text-sm",
                    c.status !== "pass" && ui.bg,
                  )}
                >
                  <div className="flex items-center gap-2">
                    <ui.icon className={cn("size-4 shrink-0", ui.cls)} />
                    <span className="font-bold">{c.label}</span>
                    <span className={cn("ms-auto text-[11px] font-bold", ui.cls)}>{ui.label}</span>
                  </div>
                  <p className="mt-1 break-words text-muted-foreground">{c.detail}</p>
                  {c.fix && c.status !== "pass" ? (
                    <p className="mt-1 text-xs font-semibold text-ink-soft">↳ {c.fix}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {fails.length + warns.length > 0 ? (
            <Link
              to="/app/chat/$id"
              params={{ id: "nour" }}
              search={{ prompt: nourPrompt }}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-primary-foreground"
              style={{ backgroundImage: "var(--gradient-aurora)" }}
            >
              اطلب من نور إصلاح هذه النقاط بنصوص جاهزة ←
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
