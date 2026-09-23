import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import { scorePost } from "@/lib/post-quality";

type Props = {
  text: string;
  providers: string[];
  hasMedia: boolean;
  bannedWords?: string[];
  tone?: string | undefined;
  industry?: string | undefined;
  /** لا نظهر اقتراحات تحسين أسلوبية إلا بعد أن يغيّر المستخدم النص بنفسه. */
  edited?: boolean;
  /** عند تمريرها تظهر أداة إعادة الكتابة التلقائية. */
  onApply?: (text: string) => void;
};

/**
 * فحص ما قبل النشر: لا درجات ولا كلام إنشائي — مشاكل حقيقية فقط
 * (تجاوز حد المنصة، كلمة ممنوعة، غياب دعوة للفعل…) وزر يعيد الكتابة فعلياً.
 * حين لا توجد مشكلة تظهر سطر واحد فقط ولا تشغل مساحة.
 */
export function PostQuality({
  text,
  providers,
  hasMedia,
  bannedWords = [],
  tone,
  industry,
  edited = false,
}: Props) {
  void tone;
  void industry;

  const reports = useMemo(() => {
    const list = providers.length ? providers : ["facebook"];
    return list
      .map((provider) => scorePost({ text, provider, hasMedia, bannedWords }))
      .sort((a, b) => a.score - b.score);
  }, [text, providers, hasMedia, bannedWords]);

  const weakest = reports[0];

  /** المشاكل الفعلية فقط، بلا تكرار بين المنصات. */
  const issues = useMemo(() => {
    const seen = new Set<string>();
    const out: { key: string; severity: "fail" | "warn"; label: string; hint: string }[] = [];
    for (const report of reports) {
      for (const check of report.checks) {
        if (check.severity === "pass") continue;
        // هذه قواعد محلية حتمية وليست رأياً من نموذج. الحواجز تظهر دائماً؛
        // أما التحسينات فلا تظهر إلا بعدما يعدّل المستخدم النص.
        const deterministic = new Set([
          "artifacts",
          "banned",
          "limit",
          "media",
          "hashtags",
          "hashtag-placement",
          "repeat",
          "readable",
        ]);
        if (check.severity !== "fail" && (!edited || !deterministic.has(check.id))) continue;
        const key = `${check.id}:${check.hint}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          key,
          severity: check.severity === "fail" ? "fail" : "warn",
          label: report.providerLabel,
          hint: check.hint,
        });
      }
    }
    return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "fail" ? -1 : 1));
  }, [edited, reports]);

  if (!weakest || !text.trim()) return null;

  const failures = issues.filter((i) => i.severity === "fail").length;

  return (
    <div className="mt-3">
      {issues.length ? (
        <div className="rounded-xl border border-border bg-card/70 p-3">
          <div className="flex items-center gap-2 text-[11px] font-bold">
            {failures ? (
              <XCircle className="size-3.5 text-coral" />
            ) : (
              <AlertTriangle className="size-3.5 text-gold-deep" />
            )}
            <span>
              {failures
                ? `${failures} مشكلة تمنع نشراً ناجحاً`
                : `${issues.length} ملاحظة قد ترفع النتيجة`}
            </span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {issues.slice(0, 5).map((item) => (
              <li key={item.key} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                {item.severity === "fail" ? (
                  <XCircle className="mt-0.5 size-3.5 shrink-0 text-coral" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-gold-deep" />
                )}
                <span className="text-ink-soft">
                  {reports.length > 1 ? <span className="font-bold">{item.label} — </span> : null}
                  {item.hint}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-jade-deep" />
          المنشور مطابق لحدود المنصات المختارة — جاهز للنشر.
        </p>
      )}
    </div>
  );
}
