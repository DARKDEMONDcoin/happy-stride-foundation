import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, X } from "lucide-react";

import { connectGhost } from "@/lib/publishing.functions";

export function GhostConnect({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const connectFn = useServerFn(connectGhost);
  const [apiUrl, setApiUrl] = useState("");
  const [adminKey, setAdminKey] = useState("");

  const save = useMutation({
    mutationFn: () => connectFn({ data: { workspaceId, apiUrl, adminKey } }),
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
            <h2 className="font-display text-xl font-black">ربط مدونة Ghost</h2>
            <p className="mt-1 text-sm text-ink-soft">
              من لوحة Ghost: Settings ← Integrations ← Add custom integration، ثم انسخ رابط الموقع
              ومفتاح Admin API key كاملاً بالشكل <code>id:secret</code>.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-xl p-1 hover:bg-secondary"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <label className="block text-sm font-bold">رابط الموقع</label>
            <input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              dir="ltr"
              placeholder="https://blog.example.com"
              className="mt-1.5 w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-bold">Admin API key</label>
            <input
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              dir="ltr"
              type="password"
              placeholder="6a1b…:9f3c…"
              className="mt-1.5 w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        {save.error ? (
          <p className="mt-3 text-sm font-semibold text-coral">
            {save.error instanceof Error ? save.error.message : "تعذّر الربط"}
          </p>
        ) : null}

        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || apiUrl.length < 6 || adminKey.length < 20}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-3 text-sm font-bold text-background disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          اختبر واربط
        </button>

        <p className="mt-3 text-xs text-muted-foreground">
          نحفظ المفتاح على الخادم فقط ولا يظهر في المتصفح، ويمكنك فصله بضغطة واحدة.
        </p>
      </div>
    </div>
  );
}
