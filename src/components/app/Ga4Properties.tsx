import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, X } from "lucide-react";

import { listGa4Properties, selectGa4Property } from "@/lib/ga4.functions";
import { startPipedreamConnect } from "@/lib/pipedream.functions";

export function Ga4Properties({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listGa4Properties);
  const selectFn = useServerFn(selectGa4Property);
  const startGoogle = useServerFn(startPipedreamConnect);
  const [picked, setPicked] = useState<string | null>(null);

  const props = useQuery({
    queryKey: ["ga4-properties", workspaceId],
    queryFn: () => listFn({ data: { workspaceId } }),
    retry: false,
  });

  const save = useMutation({
    mutationFn: (propertyId: string) => selectFn({ data: { workspaceId, propertyId } }),
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
            <h2 className="font-display text-xl font-black">اختر خاصية Google Analytics 4</h2>
            <p className="mt-1 text-sm text-ink-soft">
              نور تقرأ الجلسات والصفحات الأعلى من البحث العضوي لتُكمل حلقة القياس بعد النشر.
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
          {props.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> جارٍ جلب الخصائص…
            </p>
          ) : props.error ? (
            <div className="space-y-3">
              <p className="rounded-2xl bg-coral/12 px-4 py-3 text-sm font-semibold text-coral">
                {props.error instanceof Error ? props.error.message : "تعذّر جلب خصائص Analytics"}
              </p>
              <button
                onClick={async () => {
                  const { url } = await startGoogle({
                    data: { workspaceId, provider: "analytics", origin: window.location.origin },
                  });
                  window.location.href = url;
                }}
                className="w-full rounded-full border border-border px-5 py-2.5 text-sm font-bold hover:bg-secondary"
              >
                ربط حساب Google (يشمل صلاحية Analytics)
              </button>
            </div>
          ) : !props.data?.properties.length ? (
            <p className="text-sm text-muted-foreground">
              لا توجد خصائص GA4 في هذا الحساب — أنشئ خاصية في Google Analytics ثم أعد المحاولة.
            </p>
          ) : (
            props.data.properties.map((p) => (
              <button
                key={p.id}
                onClick={() => setPicked(p.id)}
                className={`block w-full rounded-2xl border px-4 py-3 text-start text-sm font-semibold ${
                  picked === p.id
                    ? "border-jade bg-jade/8 text-jade-deep"
                    : "border-border hover:bg-secondary"
                }`}
              >
                {p.name}
                <span dir="ltr" className="block text-xs font-normal text-muted-foreground">
                  {p.id}
                </span>
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
          onClick={() => picked && save.mutate(picked)}
          disabled={!picked || save.isPending}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-bold text-background disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          حفظ الاختيار
        </button>
      </div>
    </div>
  );
}
