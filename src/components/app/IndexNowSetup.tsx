import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, X } from "lucide-react";

import { indexNowStatus, setupIndexNow } from "@/lib/indexnow.functions";

/** تجهيز IndexNow: إشعار فوري ومجاني لمحركات البحث بأي مقال جديد. */
export function IndexNowSetup({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const statusFn = useServerFn(indexNowStatus);
  const setupFn = useServerFn(setupIndexNow);
  const [siteUrl, setSiteUrl] = useState("");

  const status = useQuery({
    queryKey: ["indexnow", workspaceId],
    queryFn: () => statusFn({ data: { workspaceId } }),
  });

  const setup = useMutation({
    mutationFn: () => setupFn({ data: { workspaceId, siteUrl } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["indexnow", workspaceId] });
      void qc.invalidateQueries({ queryKey: ["integrations", workspaceId] });
    },
  });

  const ready = status.data?.ready ? status.data : setup.data ? { ...setup.data } : null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-5 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-black">تجهيز IndexNow</h2>
            <p className="mt-1 text-sm text-ink-soft">
              خدمة مجانية من بينج وياندكس: بمجرد نشر نور مقالاً، تُبلّغ محركات البحث فوراً بدل
              انتظار الزحف.
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

        {status.isLoading ? (
          <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> جارٍ التحقق…
          </p>
        ) : ready ? (
          <div className="mt-5 space-y-3 text-sm">
            <p className="flex items-center gap-2 font-bold text-jade-deep">
              <Check className="size-4" /> جاهز للنطاق {ready.host}
            </p>
            <p className="text-ink-soft">
              خطوة أخيرة لمرة واحدة: ارفع على موقعك ملفاً نصياً بالمسار التالي يحتوي المفتاح فقط.
            </p>
            <code dir="ltr" className="block overflow-x-auto rounded-2xl bg-secondary p-3 text-xs">
              {ready.keyLocation}
            </code>
            <p className="text-ink-soft">محتوى الملف:</p>
            <code dir="ltr" className="block overflow-x-auto rounded-2xl bg-secondary p-3 text-xs">
              {ready.key}
            </code>
            <button
              onClick={onClose}
              className="w-full rounded-full bg-foreground px-4 py-2.5 text-sm font-bold text-background"
            >
              تم
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setup.mutate();
            }}
            className="mt-5 space-y-3"
          >
            <label className="block text-sm font-bold">
              رابط موقعك
              <input
                dir="ltr"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://example.com"
                required
                className="mt-1.5 w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm"
              />
            </label>
            {setup.error ? (
              <p className="rounded-2xl bg-coral/12 px-4 py-3 text-sm font-semibold text-coral">
                {setup.error instanceof Error ? setup.error.message : "تعذّر التجهيز"}
              </p>
            ) : null}
            <button
              disabled={setup.isPending}
              className="w-full rounded-full bg-foreground px-4 py-2.5 text-sm font-bold text-background disabled:opacity-60"
            >
              {setup.isPending ? "جارٍ التجهيز…" : "جهّز IndexNow"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
