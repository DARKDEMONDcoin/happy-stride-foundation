import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, X } from "lucide-react";

import { connectShopify } from "@/lib/publishing.functions";

export function ShopifyConnect({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const connect = useServerFn(connectShopify);
  const [shop, setShop] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const save = useMutation({
    mutationFn: () => connect({ data: { workspaceId, shop, accessToken } }),
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
            <h2 className="font-display text-xl font-black">ربط متجر Shopify</h2>
            <p className="mt-1 text-sm text-ink-soft">
              من لوحة المتجر: Settings ← Apps and sales channels ← Develop apps ← أنشئ تطبيقاً
              مخصصاً وامنحه صلاحية <span dir="ltr">write_content</span>، ثم انسخ رمز Admin API.
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
            value={shop}
            onChange={(e) => setShop(e.target.value)}
            placeholder="your-store.myshopify.com"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
          />
          <input
            dir="ltr"
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="shpat_..."
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
          />
        </div>

        {save.error ? (
          <p className="mt-4 rounded-2xl bg-coral/12 px-4 py-3 text-sm font-semibold text-coral">
            {save.error instanceof Error ? save.error.message : "تعذّر الربط"}
          </p>
        ) : null}

        <button
          onClick={() => save.mutate()}
          disabled={!shop || !accessToken || save.isPending}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-bold text-background disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          ربط المتجر
        </button>
      </div>
    </div>
  );
}
