import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, X } from "lucide-react";

import { connectWebflow, listWebflowCollections } from "@/lib/publishing.functions";

export function WebflowConnect({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listWebflowCollections);
  const connectFn = useServerFn(connectWebflow);
  const [accessToken, setAccessToken] = useState("");
  const [siteId, setSiteId] = useState("");
  const [collectionId, setCollectionId] = useState("");

  const collections = useMutation({
    mutationFn: () => listFn({ data: { workspaceId, accessToken, siteId } }),
    onSuccess: (res) => {
      if (res.collections[0]) setCollectionId(res.collections[0].id);
    },
  });

  const save = useMutation({
    mutationFn: () => connectFn({ data: { workspaceId, accessToken, siteId, collectionId } }),
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
            <h2 className="font-display text-xl font-black">ربط موقع Webflow</h2>
            <p className="mt-1 text-sm text-ink-soft">
              من إعدادات الموقع في Webflow: Apps &amp; integrations ← API access ← أنشئ رمز موقع
              بصلاحية CMS، وانسخ معرّف الموقع (Site ID) من نفس الصفحة.
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

        <div className="mt-5 space-y-3">
          <input
            dir="ltr"
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Webflow site API token"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
          />
          <input
            dir="ltr"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            placeholder="Site ID"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
          />
          <button
            onClick={() => collections.mutate()}
            disabled={!accessToken || !siteId || collections.isPending}
            className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-bold hover:bg-secondary disabled:opacity-60"
          >
            {collections.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            جلب مجموعات CMS
          </button>

          {collections.data?.collections.length ? (
            <select
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
            >
              {collections.data.collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {collections.error || save.error ? (
          <p className="mt-4 rounded-2xl bg-coral/12 px-4 py-3 text-sm font-semibold text-coral">
            {(collections.error ?? save.error) instanceof Error
              ? ((collections.error ?? save.error) as Error).message
              : "تعذّر الربط"}
          </p>
        ) : null}

        <button
          onClick={() => save.mutate()}
          disabled={!collectionId || save.isPending}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-bold text-background disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          ربط الموقع
        </button>
      </div>
    </div>
  );
}
