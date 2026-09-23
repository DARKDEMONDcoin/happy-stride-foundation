import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fingerprint, Globe, Loader2, Sparkles, Check, Quote, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { extractBrandVoice } from "@/lib/brand-voice.functions";
import type { BrandVoiceResult } from "@/lib/brand-voice.server";
import { cn } from "@/lib/utils";

const dialectAr: Record<string, string> = {
  egyptian: "مصرية",
  gulf: "خليجية",
  levantine: "شامية",
  maghrebi: "مغاربية",
  msa: "فصحى مبسّطة",
  mixed: "مزيج فصحى وعامية",
};

function Meter({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(10, Number(value) || 0));
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold">{label}</span>
        <span className="text-muted-foreground">{v}/10</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full"
          style={{ width: `${v * 10}%`, backgroundImage: "var(--gradient-aurora)" }}
        />
      </div>
    </div>
  );
}

export function BrandVoiceExtractor({
  workspaceId,
  compact = false,
}: {
  workspaceId?: string | undefined;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const run = useServerFn(extractBrandVoice);
  const [mode, setMode] = useState<"url" | "samples">("url");
  const [url, setUrl] = useState("");
  const [samples, setSamples] = useState("");
  const [result, setResult] = useState<BrandVoiceResult | null>(null);

  const extract = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("مساحة العمل غير جاهزة بعد.");
      return run({
        data: {
          workspaceId,
          url: mode === "url" ? url : undefined,
          samples: samples || undefined,
          save: true,
        },
      });
    },
    onSuccess: (res) => {
      setResult(res);
      void qc.invalidateQueries({ queryKey: ["brain", workspaceId] });
      toast.success("تم استخراج صوت العلامة وحفظه — كل الموظفين سيلتزمون به الآن.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الاستخراج"),
  });

  const p = result?.profile;
  const s = result?.stats;

  return (
    <section className={cn("rounded-3xl border border-border bg-card", compact ? "p-5" : "p-6")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-2xl text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-aurora)" }}
          >
            <Fingerprint className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-black">استخرج صوت علامتك تلقائيًا</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              نقرأ موقعك، نحلّل اللهجة والنبرة والمفردات، ونبني «دليل صوت العلامة» يلتزم به الفريق
              كله فورًا.
            </p>
          </div>
        </div>
      </div>

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          extract.mutate();
        }}
      >
        <div className="flex gap-1 rounded-full bg-secondary p-1 text-sm font-bold">
          {(["url", "samples"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 rounded-full px-3 py-1.5 transition-colors",
                mode === m ? "bg-card shadow-card" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "url" ? "من رابط موقعي" : "من نصوص ألصقها"}
            </button>
          ))}
        </div>

        {mode === "url" ? (
          <label className="flex items-center gap-2 rounded-2xl border border-border px-4 py-3 focus-within:border-jade">
            <Globe className="size-4 shrink-0 text-muted-foreground" />
            <input
              dir="ltr"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-brand.com"
              className="min-w-0 flex-1 bg-transparent text-left outline-none"
              required
            />
          </label>
        ) : null}

        <textarea
          value={samples}
          onChange={(e) => setSamples(e.target.value)}
          placeholder={
            mode === "url"
              ? "اختياري: الصق منشورات أو رسائل تمثّل أسلوبكم لتعزيز الدقة…"
              : "الصق ٣-١٠ منشورات أو رسائل أو فقرات من موقعك (٨٠ حرفًا على الأقل)…"
          }
          required={mode === "samples"}
          className="min-h-24 w-full resize-y rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:border-jade"
        />

        <button
          type="submit"
          disabled={extract.isPending || !workspaceId}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background disabled:opacity-60"
        >
          {extract.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> نقرأ موقعك ونحلّل الأسلوب…
            </>
          ) : (
            <>
              <Sparkles className="size-4" /> استخرج صوت العلامة
            </>
          )}
        </button>
      </form>

      {result && p && s ? (
        <div className="mt-6 space-y-5 border-t border-border/70 pt-5">
          <div className="flex items-start gap-3 rounded-2xl bg-secondary/60 p-4">
            <Volume2 className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-bold">{p.summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {(p.personality ?? []).join(" · ")} — اللهجة: {p.dialect || dialectAr[s.dialect]} —
                المخاطبة: {p.addressing || s.addressing}
                {result.sourceUrls.length ? ` — من ${result.sourceUrls.length} صفحات` : ""}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2.5 rounded-2xl border border-border p-4">
              <Meter label="رسمية" value={p.tone?.formality ?? 5} />
              <Meter label="حيوية" value={p.tone?.energy ?? 5} />
              <Meter label="دفء" value={p.tone?.warmth ?? 5} />
              <Meter label="فكاهة" value={p.tone?.humor ?? 3} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-sm">
              {[
                { l: "متوسط طول الجملة", v: `${s.avgSentenceLength} كلمة` },
                { l: "إيموجي / ١٠٠ كلمة", v: String(s.emojiPerHundredWords) },
                { l: "كلمات إنجليزية", v: `${Math.round(s.englishRatio * 100)}%` },
                { l: "حجم العينة", v: `${s.sampleWords.toLocaleString("ar-EG")} كلمة` },
              ].map((x) => (
                <div key={x.l} className="rounded-2xl border border-border p-3">
                  <p className="text-[11px] text-muted-foreground">{x.l}</p>
                  <p className="mt-0.5 font-display font-black">{x.v}</p>
                </div>
              ))}
            </div>
          </div>

          {p.signaturePhrases?.length ? (
            <div>
              <h3 className="text-sm font-black">عبارات مميزة</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {p.signaturePhrases.map((ph) => (
                  <li
                    key={ph}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs"
                  >
                    <Quote className="size-3 text-primary" /> {ph}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border p-4">
              <h3 className="text-sm font-black text-jade">مفردات نستخدمها</h3>
              <p className="mt-2 text-sm leading-relaxed">{(p.vocabulary?.use ?? []).join("، ")}</p>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <h3 className="text-sm font-black text-coral">مفردات نتجنبها</h3>
              <p className="mt-2 text-sm leading-relaxed">
                {(p.vocabulary?.avoid ?? []).join("، ")}
              </p>
            </div>
          </div>

          {p.samples?.length ? (
            <div>
              <h3 className="text-sm font-black">قبل / بعد بصوت علامتك</h3>
              <ul className="mt-2 space-y-2">
                {p.samples.slice(0, 3).map((x, i) => (
                  <li
                    key={i}
                    className="grid gap-2 rounded-2xl border border-border p-3 text-sm sm:grid-cols-2"
                  >
                    <p className="text-muted-foreground line-through decoration-coral/50">
                      {x.before}
                    </p>
                    <p className="font-semibold">{x.after}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {p.perChannel?.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {p.perChannel.map((c) => (
                <div key={c.channel} className="rounded-2xl bg-secondary/50 p-3 text-sm">
                  <span className="font-black">{c.channel}: </span>
                  <span className="text-ink-soft">{c.guidance}</span>
                </div>
              ))}
            </div>
          ) : null}

          <p className="flex items-center gap-2 rounded-2xl bg-jade/10 px-4 py-3 text-sm font-semibold text-jade">
            <Check className="size-4" /> حُفظ كـ «دليل صوت العلامة» في عقل العلامة — يُحقن تلقائيًا
            في نور وسِراج وكل الموظفين.
          </p>
        </div>
      ) : null}
    </section>
  );
}
