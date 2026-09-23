import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, X } from "lucide-react";

import { listSearchConsoleSites, selectSearchConsoleSite } from "@/lib/gsc.functions";

export function SearchConsoleSites({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listSearchConsoleSites);
  const selectFn = useServerFn(selectSearchConsoleSite);
  const [picked, setPicked] = useState<string | null>(null);

  const sites = useQuery({
    queryKey: ["gsc-sites", workspaceId],
    queryFn: () => listFn({ data: { workspaceId } }),
  });

  const save = useMutation({
    mutationFn: (siteUrl: string) => selectFn({ data: { workspaceId, siteUrl } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["integrations", workspaceId] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-5 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-black">اختر موقع Search Console</h2>
            <p className="mt-1 text-sm text-ink-soft">
              نور ستقرأ بيانات هذا الموقع فقط (كلمات البحث، الصفحات، النقرات) لتحسين المحتوى.
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

        <div className="mt-5 space-y-2">
          {sites.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> جارٍ جلب المواقع…
            </p>
          ) : sites.error ? (
            <p className="rounded-2xl bg-coral/12 px-4 py-3 text-sm font-semibold text-coral">
              {sites.error instanceof Error ? sites.error.message : "تعذّر جلب المواقع"}
            </p>
          ) : !sites.data?.sites.length ? (
            <p className="text-sm text-muted-foreground">
              لا توجد مواقع متحقَّقة في هذا الحساب — تحقّق من ملكية موقعك في Search Console أولاً.
            </p>
          ) : (
            sites.data.sites.map((s) => (
              <button
                key={s}
                dir="ltr"
                onClick={() => setPicked(s)}
                className={`block w-full rounded-2xl border px-4 py-3 text-start text-sm font-semibold ${
                  (picked ?? sites.data.selected) === s
                    ? "border-jade bg-jade/8 text-jade-deep"
                    : "border-border hover:bg-secondary"
                }`}
              >
                {s}
              </button>
            ))
          )}
        </div>

        {save.error ? (
          <p className="mt-4 rounded-2xl bg-coral/12 px-4 py-3 text-sm font-semibold text-coral">
            {save.error instanceof Error ? save.error.message : "تعذّر الحفظ"}
          </p>
        ) : null}

        <button
          onClick={() => {
            const value = picked ?? sites.data?.selected;
            if (value) save.mutate(value);
          }}
          disabled={!(picked ?? sites.data?.selected) || save.isPending}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-bold text-background disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          حفظ الاختيار
        </button>
      </div>
    </div>
  );
}
