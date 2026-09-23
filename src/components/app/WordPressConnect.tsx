import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck, X } from "lucide-react";

import { connectWordPress } from "@/lib/integrations.functions";
import { cn } from "@/lib/utils";

const field = "w-full rounded-2xl border border-border px-4 py-3 outline-none focus:border-jade";

export function WordPressConnect({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const connect = useServerFn(connectWordPress);
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () => connect({ data: { workspaceId, siteUrl, username, appPassword } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["integrations", workspaceId] });
      onClose();
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "تعذّر الربط"),
  });

  const ready = siteUrl.trim() && username.trim() && appPassword.trim().length >= 8;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-5 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-black">اربط موقع ووردبريس</h2>
            <p className="mt-1 text-sm text-ink-soft">
              نور ستحفظ المقالات كمسودة على مدونتك، والنشر النهائي بموافقتك.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="grid size-9 place-items-center rounded-xl hover:bg-secondary"
          >
            <X className="size-4.5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">رابط الموقع</span>
            <input
              dir="ltr"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              className={cn(field, "text-start")}
              placeholder="https://example.com"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">اسم المستخدم في ووردبريس</span>
            <input
              dir="ltr"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={cn(field, "text-start")}
              placeholder="admin"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold">
              كلمة مرور التطبيق (Application Password)
            </span>
            <input
              dir="ltr"
              type="password"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              className={cn(field, "text-start")}
              placeholder="xxxx xxxx xxxx xxxx"
            />
            <span className="mt-2 block text-xs text-muted-foreground">
              من لوحة ووردبريس: المستخدمون ← ملفك الشخصي ← Application Passwords ← أنشئ كلمة جديدة
              وانسخها هنا. ليست كلمة مرور حسابك، ويمكنك إلغاؤها في أي وقت.
            </span>
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl bg-coral/12 px-4 py-3 text-sm font-semibold text-coral">
            {error}
          </p>
        ) : null}

        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-secondary/60 p-4 text-xs leading-relaxed text-ink-soft">
          <ShieldCheck className="size-4 shrink-0 text-jade-deep" />
          بيانات الربط تُخزَّن على الخادم فقط ولا تُعاد إلى المتصفح أبداً.
        </p>

        <button
          onClick={() => {
            setError(null);
            submit.mutate();
          }}
          disabled={!ready || submit.isPending}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-bold text-background disabled:opacity-60"
        >
          {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          تحقّق واربط
        </button>
      </div>
    </div>
  );
}
