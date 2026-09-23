import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, RefreshCw, Trash2 } from "lucide-react";

import { BrandLoader } from "@/components/site/BrandLoader";
import {
  connectWhatsappFromExistingMeta,
  createLinkCode,
  removeCommandLink,
  selectWhatsappPhone,
  startWhatsappConnect,
  whatsappStatus,
} from "@/lib/command-channels.functions";

const field =
  "w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-jade";

/** إعداد التحكّم بسِراج عبر واتساب: ربط بضغطة واحدة ثم أرقام مسموح لها بإصدار الأوامر. */
export function WhatsAppCommand({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const status = useServerFn(whatsappStatus);
  const connect = useServerFn(startWhatsappConnect);
  const connectExisting = useServerFn(connectWhatsappFromExistingMeta);
  const selectPhone = useServerFn(selectWhatsappPhone);
  const code = useServerFn(createLinkCode);
  const remove = useServerFn(removeCommandLink);

  const [error, setError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);
  const connectWindow = useRef<Window | null>(null);
  const connectStarting = useRef(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["whatsapp-channel", workspaceId],
    queryFn: () => status({ data: { workspaceId } }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["whatsapp-channel", workspaceId] });

  useEffect(() => {
    const receiveResult = (event: MessageEvent) => {
      if (event.source !== connectWindow.current || event.origin !== window.location.origin) return;
      const result = event.data as {
        type?: string;
        ok?: boolean;
        number?: string;
        reason?: string;
      };
      if (result.type !== "siraj-whatsapp-connect") return;
      connectWindow.current = null;
      if (result.ok) {
        setError(null);
        void invalidate();
      } else {
        setError(result.reason || "تعذّر إكمال ربط واتساب.");
      }
    };
    window.addEventListener("message", receiveResult);
    return () => window.removeEventListener("message", receiveResult);
  }, [workspaceId]);

  const connectMutation = useMutation({
    mutationFn: async () => {
      const existing = await connectExisting({ data: { workspaceId } });
      if (existing.connected) return { connected: true as const, url: "" };
      const fresh = await connect({
        data: { workspaceId, returnOrigin: window.location.origin },
      });
      return { connected: false as const, url: fresh.url };
    },
    onSuccess: (r) => {
      connectStarting.current = false;
      const popup = connectWindow.current;
      if (r.connected) {
        popup?.close();
        connectWindow.current = null;
        setError(null);
        void invalidate();
        return;
      }
      if (popup && !popup.closed) {
        popup.location.replace(r.url);
        popup.focus();
        return;
      }
      setError("اسمح بالنوافذ المنبثقة ثم اضغط «اربط واتساب» مرة أخرى.");
    },
    onError: (e: Error) => {
      connectStarting.current = false;
      connectWindow.current?.close();
      connectWindow.current = null;
      setError(e.message);
    },
  });

  const beginConnect = () => {
    if (connectStarting.current || connectMutation.isPending) return;
    connectStarting.current = true;
    setError(null);
    const popup = window.open(
      "about:blank",
      "siraj-whatsapp-connect",
      "popup=yes,width=560,height=760,resizable=yes,scrollbars=yes",
    );
    if (!popup) {
      // نكمل أولاً بمحاولة استخدام تفويض ميتا الموجود؛ قد لا نحتاج النافذة أصلاً.
      connectWindow.current = null;
      connectMutation.mutate();
      return;
    }
    connectWindow.current = popup;
    popup.document.title = "ربط واتساب";
    popup.document.body.dir = "rtl";
    popup.document.body.textContent = "جارٍ فتح تسجيل الدخول إلى فيسبوك…";
    connectMutation.mutate();
  };

  const phoneMutation = useMutation({
    mutationFn: (phoneNumberId: string) => selectPhone({ data: { workspaceId, phoneNumberId } }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const codeMutation = useMutation({
    mutationFn: (label: string) =>
      code({ data: { workspaceId, label: label || null, role: "owner" } }),
    onSuccess: (r) => {
      setNewCode(r.code);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <BrandLoader size="sm" />
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <MessageCircle className="size-5 text-jade" /> التحكّم عبر واتساب
        </h2>
        <p className="text-sm text-muted-foreground">
          ابعت لسِراج على واتساب: «اكتب بوست عن عرض خصم ٥٠٪ لليوم» — يرد بمسودة، وترد «انشر» فيتنشر
          على منصاتك المربوطة.
        </p>
      </header>

      {error ? (
        <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}

      <section className="space-y-3 rounded-3xl border border-border p-4">
        <h3 className="text-sm font-black">اربط واتساب</h3>
        {data?.connected ? (
          <p className="text-sm font-semibold text-jade-deep">
            مربوط{data.displayNumber ? ` · ${data.displayNumber}` : ""}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            ضغطة واحدة بحسابك على فيسبوك — نتعرّف على رقم واتساب للأعمال تلقائياً، بلا أي أكواد أو
            معرّفات تكتبها.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={connectMutation.isPending}
            onClick={beginConnect}
            className="rounded-2xl bg-foreground px-5 py-3 text-sm font-bold text-background disabled:opacity-60"
          >
            {connectMutation.isPending
              ? "جارٍ الفتح…"
              : data?.connected
                ? "إعادة الربط"
                : "اربط واتساب"}
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center gap-2 rounded-2xl border border-border px-5 py-3 text-sm font-bold hover:bg-secondary"
          >
            <RefreshCw className={`size-4 ${isRefetching ? "animate-spin" : ""}`} /> تحديث الحالة
          </button>
        </div>
      </section>

      {(data?.phones?.length ?? 0) > 1 ? (
        <section className="space-y-3 rounded-3xl border border-border p-4">
          <h3 className="text-sm font-black">رقم الإرسال</h3>
          <div className="grid gap-2">
            {data!.phones.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => phoneMutation.mutate(p.id)}
                className={`rounded-2xl border px-4 py-3 text-right text-sm ${
                  p.id === data!.phoneNumberId
                    ? "border-jade bg-jade/10 font-bold"
                    : "border-border hover:bg-secondary"
                }`}
              >
                <span dir="ltr">{p.displayNumber}</span>
                {p.name ? ` · ${p.name}` : ""}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3 rounded-3xl border border-border p-4">
        <h3 className="text-sm font-black">الأرقام المسموح لها بإصدار الأوامر</h3>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            codeMutation.mutate(String(f.get("label") ?? "").trim());
          }}
        >
          <input
            name="label"
            placeholder="اسم صاحب الرقم (اختياري)"
            className={`${field} sm:w-64`}
          />
          <button
            type="submit"
            disabled={codeMutation.isPending}
            className="rounded-2xl border border-border px-5 py-3 text-sm font-bold hover:bg-secondary disabled:opacity-60"
          >
            {codeMutation.isPending ? "…" : "أنشئ كود ربط"}
          </button>
        </form>
        {newCode ? (
          <p className="rounded-2xl bg-jade/12 px-4 py-3 text-sm font-semibold text-jade-deep">
            أرسل هذا الكود من واتساب إلى رقم أعمالك خلال ١٥ دقيقة:{" "}
            <span dir="ltr" className="font-mono">
              {newCode}
            </span>
          </p>
        ) : null}

        <ul className="space-y-2">
          {(data?.links ?? []).map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 text-sm"
            >
              <span className="min-w-0 truncate">
                <span dir="ltr">{l.external_id}</span>
                {l.label ? ` · ${l.label}` : ""}
              </span>
              <button
                type="button"
                aria-label="حذف الرقم"
                className="shrink-0 rounded-xl border border-border p-2 hover:bg-secondary"
                onClick={async () => {
                  await remove({ data: { workspaceId, id: l.id } });
                  invalidate();
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
          {!(data?.links ?? []).length ? (
            <li className="text-sm text-muted-foreground">لا أرقام مربوطة بعد.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
