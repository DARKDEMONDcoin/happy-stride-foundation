import { useCallback, useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Expand, ImageOff, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PostMedia = { url: string; kind: "image" | "video"; label?: string };

type Props = {
  media: PostMedia[];
  onRemove?: (url: string) => void;
  onError?: (url: string) => void;
};

export function PostMediaGallery({ media, onRemove, onError }: Props) {
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState(false);
  const touchX = useRef<number | null>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const current = media[Math.min(index, Math.max(0, media.length - 1))];

  useEffect(() => {
    if (index >= media.length) setIndex(Math.max(0, media.length - 1));
  }, [index, media.length]);

  const move = useCallback(
    (direction: number) => {
      if (media.length < 2) return;
      setIndex((value) => (value + direction + media.length) % media.length);
    },
    [media.length],
  );

  useEffect(() => {
    if (!viewer) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewer(false);
      if (event.key === "ArrowLeft") move(1);
      if (event.key === "ArrowRight") move(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [viewer, move]);

  const swipeStart = (x: number) => {
    touchX.current = x;
  };
  const swipeEnd = (x: number) => {
    if (touchX.current === null) return;
    const delta = x - touchX.current;
    if (Math.abs(delta) > 45) move(delta > 0 ? -1 : 1);
    touchX.current = null;
  };

  if (!current) {
    return (
      <div className="post-media-empty">
        <ImageOff className="size-7" />
        <span>أضف صورة أو فيديو ليظهر هنا</span>
      </div>
    );
  }

  const stage = (fullscreen = false) => (
    <div
      className={cn("post-media-stage", fullscreen && "is-fullscreen")}
      onTouchStart={(event) => swipeStart(event.touches[0]?.clientX ?? 0)}
      onTouchEnd={(event) => swipeEnd(event.changedTouches[0]?.clientX ?? 0)}
    >
      {current.kind === "image" ? (
        <img
          src={current.url}
          alt={current.label || `صورة المنشور ${index + 1}`}
          loading={fullscreen ? "eager" : "lazy"}
          onError={() => onError?.(current.url)}
        />
      ) : (
        <video src={current.url} controls playsInline preload="metadata" />
      )}
      {!fullscreen ? (
        <>
          <Button
            ref={expandRef}
            type="button"
            variant="secondary"
            size="icon-sm"
            className="post-media-expand"
            onClick={() => setViewer(true)}
            aria-label="عرض الوسيطة بكامل الشاشة"
            title="عرض كامل"
          >
            <Expand />
          </Button>
          {onRemove ? (
            <Button
              type="button"
              variant="destructive"
              size="icon-sm"
              className="post-media-delete"
              onClick={() => onRemove(current.url)}
              aria-label="حذف الوسيطة"
              title="حذف"
            >
              <Trash2 />
            </Button>
          ) : null}
        </>
      ) : null}
      {media.length > 1 ? (
        <>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="post-media-next"
            onClick={() => move(1)}
            aria-label="الوسيطة التالية"
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="post-media-prev"
            onClick={() => move(-1)}
            aria-label="الوسيطة السابقة"
          >
            <ChevronRight />
          </Button>
        </>
      ) : null}
      <span className="post-media-count">
        {index + 1} / {media.length}
      </span>
    </div>
  );

  return (
    <>
      <div className="post-media-gallery">
        {stage()}
        {media.length > 1 ? (
          <div className="post-media-strip" role="group" aria-label="وسائط المنشور">
            {media.map((item, itemIndex) => (
              <div key={item.url} className="post-media-thumb-wrap">
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={item.label || `عرض الوسيطة ${itemIndex + 1}`}
                  aria-pressed={itemIndex === index}
                  className={cn(
                    "post-media-thumb h-auto shrink-0 p-0",
                    itemIndex === index && "is-active",
                  )}
                  onClick={() => setIndex(itemIndex)}
                >
                  {item.kind === "image" ? (
                    <img src={item.url} alt="" loading="lazy" />
                  ) : (
                    <video src={item.url} muted preload="metadata" />
                  )}
                </Button>
                {onRemove ? (
                  <Button
                    type="button"
                    variant="destructive"
                    className="post-media-thumb-remove"
                    onClick={() => onRemove(item.url)}
                    aria-label={`حذف الوسيطة ${itemIndex + 1}`}
                    title="حذف"
                  >
                    <X className="size-3" strokeWidth={3} />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <DialogPrimitive.Root open={viewer} onOpenChange={setViewer}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content
            className="post-media-lightbox"
            aria-describedby={undefined}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              expandRef.current?.focus();
            }}
          >
            <DialogPrimitive.Title className="sr-only">معاينة الوسائط كاملة</DialogPrimitive.Title>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="post-media-close"
              onClick={() => setViewer(false)}
              aria-label="إغلاق المعاينة"
            >
              <X />
            </Button>
            {stage(true)}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
