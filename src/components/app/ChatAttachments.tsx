import { useCallback, useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Download, FileText, Play, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type ChatAttachment = {
  url: string;
  type: "image" | "video" | "file";
  alt?: string | undefined;
  size?: number;
};

/** الصيغ التي يحفظ بها الخادم مرفقات المستخدم داخل نص رسالته. */
const ATTACHMENT_LINE =
  /^\s*(?:(!)\[([^\]]*)\]|(🎬|📎)\s*\[([^\]]*)\])\((https?:\/\/[^\s)]+)\)\s*$/u;

/** يفصل نص رسالة المستخدم عن مرفقاتها، لتُعرض الوسائط بشكلها الحقيقي بدل روابط خام. */
export function splitUserBody(body: string): { text: string; items: ChatAttachment[] } {
  const items: ChatAttachment[] = [];
  const kept: string[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(ATTACHMENT_LINE);
    if (!m) {
      kept.push(line);
      continue;
    }
    const url = m[5]!;
    if (m[1]) items.push({ url, type: "image", alt: m[2] || undefined });
    else items.push({ url, type: m[3] === "🎬" ? "video" : "file", alt: m[4] || undefined });
  }
  return { text: kept.join("\n").trim(), items };
}

const humanSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`
    : `${Math.max(1, Math.round(bytes / 1024))} ك.ب`;

const extOf = (a: ChatAttachment) =>
  (a.alt ?? a.url.split("?")[0] ?? "").split(".").pop()?.toUpperCase().slice(0, 5) ?? "";

/**
 * عرض مرفقات الرسالة: صور وفيديوهات بشكلها الحقيقي تُفتح بكامل الشاشة وتُكبَّر،
 * وملفات كبطاقات قابلة للفتح والتنزيل.
 */
export function ChatAttachments({
  items,
  onRemove,
  compact = false,
  className,
}: {
  items: ChatAttachment[];
  onRemove?: (url: string) => void;
  compact?: boolean;
  className?: string | undefined;
}) {
  const media = items.filter((a) => a.type !== "file");
  const files = items.filter((a) => a.type === "file");
  const [open, setOpen] = useState<number | null>(null);
  const [zoom, setZoom] = useState(false);

  const move = useCallback(
    (dir: number) => {
      setZoom(false);
      setOpen((i) => (i === null ? i : (i + dir + media.length) % media.length));
    },
    [media.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") move(1);
      if (e.key === "ArrowRight") move(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, move]);

  if (!items.length) return null;
  const current = open === null ? null : media[open];
  const single = media.length === 1 && !compact;

  return (
    <div className={cn("space-y-2", className)}>
      {media.length ? (
        <div
          className={cn(
            "grid gap-1.5",
            compact
              ? "grid-cols-[repeat(auto-fill,4rem)]"
              : single
                ? "grid-cols-1"
                : "grid-cols-2 sm:grid-cols-3",
          )}
        >
          {media.map((a, i) => (
            <div
              key={a.url}
              className={cn(
                "group relative overflow-hidden rounded-xl border border-border/60 bg-muted",
                compact ? "size-16" : single ? "max-w-sm" : "aspect-square",
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setZoom(false);
                  setOpen(i);
                }}
                aria-label={a.type === "video" ? "تشغيل الفيديو بحجم كامل" : "عرض الصورة بحجم كامل"}
                className="block size-full cursor-zoom-in"
              >
                {a.type === "image" ? (
                  <img
                    src={a.url}
                    alt={a.alt || "صورة مرفقة"}
                    loading="lazy"
                    className={cn(
                      "size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]",
                      single && "max-h-80 w-auto",
                    )}
                  />
                ) : (
                  <span className="relative block size-full">
                    <video
                      src={`${a.url}#t=0.1`}
                      muted
                      playsInline
                      preload="metadata"
                      className={cn("size-full object-cover", single && "max-h-80")}
                    />
                    <span className="absolute inset-0 grid place-items-center bg-foreground/20">
                      <span className="grid size-10 place-items-center rounded-full bg-background/90 text-foreground shadow-card">
                        <Play className="size-4 translate-x-px fill-current" />
                      </span>
                    </span>
                  </span>
                )}
              </button>
              {onRemove ? (
                <button
                  type="button"
                  aria-label="إزالة المرفق"
                  onClick={() => onRemove(a.url)}
                  className="absolute end-1 top-1 grid size-6 place-items-center rounded-full bg-foreground/80 text-background shadow-sm hover:bg-foreground"
                >
                  <X className="size-3.5" strokeWidth={3} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {files.length ? (
        <div className={cn("flex flex-wrap gap-1.5", compact && "gap-2")}>
          {files.map((a) => (
            <div
              key={a.url}
              className="relative flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-border/60 bg-background/90 py-2 pe-2 ps-2.5 text-foreground"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary">
                <FileText className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block max-w-[14rem] truncate text-xs font-bold" dir="auto">
                  {a.alt ?? "ملف مرفق"}
                </span>
                <span className="block text-[0.65rem] text-muted-foreground">
                  {[extOf(a), a.size ? humanSize(a.size) : ""].filter(Boolean).join(" · ")}
                </span>
              </span>
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                download={a.alt}
                aria-label={`فتح ${a.alt ?? "الملف"}`}
                className="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-secondary"
              >
                <Download className="size-4" />
              </a>
              {onRemove ? (
                <button
                  type="button"
                  aria-label="إزالة المرفق"
                  onClick={() => onRemove(a.url)}
                  className="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-secondary"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <DialogPrimitive.Root open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-foreground/90 backdrop-blur-sm" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-[81] flex items-center justify-center outline-none"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(null);
            }}
          >
            <DialogPrimitive.Title className="sr-only">معاينة المرفق</DialogPrimitive.Title>
            {current ? (
              <div
                className={cn(
                  "max-h-full max-w-full",
                  zoom ? "overflow-auto" : "grid place-items-center p-4 sm:p-10",
                )}
                style={zoom ? { width: "100vw", height: "100dvh" } : undefined}
              >
                {current.type === "image" ? (
                  <img
                    src={current.url}
                    alt={current.alt || "صورة مرفقة"}
                    onClick={() => setZoom((z) => !z)}
                    className={cn(
                      "select-none rounded-lg",
                      zoom
                        ? "max-w-none cursor-zoom-out"
                        : "max-h-[calc(100dvh-5rem)] max-w-[calc(100vw-2rem)] cursor-zoom-in object-contain",
                    )}
                  />
                ) : (
                  <video
                    key={current.url}
                    src={current.url}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-[calc(100dvh-5rem)] max-w-[calc(100vw-2rem)] rounded-lg"
                  />
                )}
              </div>
            ) : null}
            <div className="fixed end-3 top-3 flex gap-2">
              {current ? (
                <a
                  href={current.url}
                  target="_blank"
                  rel="noreferrer"
                  download
                  aria-label="تنزيل"
                  className="grid size-10 place-items-center rounded-full bg-background/90 text-foreground shadow-card"
                >
                  <Download className="size-4" />
                </a>
              ) : null}
              <DialogPrimitive.Close
                aria-label="إغلاق"
                className="grid size-10 place-items-center rounded-full bg-background/90 text-foreground shadow-card"
              >
                <X className="size-5" />
              </DialogPrimitive.Close>
            </div>
            {media.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="التالي"
                  onClick={() => move(1)}
                  className="fixed left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-background/90 text-foreground shadow-card"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label="السابق"
                  onClick={() => move(-1)}
                  className="fixed right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-background/90 text-foreground shadow-card"
                >
                  <ChevronRight className="size-5" />
                </button>
                <span className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-3 py-1 text-xs font-bold text-foreground">
                  {(open ?? 0) + 1} / {media.length}
                </span>
              </>
            ) : null}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
