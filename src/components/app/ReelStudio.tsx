import { useMemo, useState } from "react";
import { Film, Loader2, Download, Check } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { renderReel, type ReelAspect } from "@/lib/reel-render";
import { cn } from "@/lib/utils";

type Props = {
  workspaceId: string | undefined;
  /** كل الصور المتاحة للمستخدم (مولّدة، من موقعه، أو مرفقة). */
  images: string[];
  aspect: "square" | "portrait" | "landscape" | "story";
  onAttach: (url: string) => void;
  attached: string[];
};

const DURATIONS = [2, 3, 4];

/**
 * استوديو الريلز: يحوّل صور المستخدم إلى فيديو حقيقي داخل المتصفح
 * (حركة + نص + انتقالات) بلا أي تكلفة ولا مفتاح خدمة.
 */
export function ReelStudio({ workspaceId, images, aspect, onAttach, attached }: Props) {
  const [picked, setPicked] = useState<string[]>([]);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [seconds, setSeconds] = useState(3);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; blob: Blob; mime: string } | null>(null);
  const [uploaded, setUploaded] = useState<string | null>(null);

  const reelAspect: ReelAspect =
    aspect === "landscape" ? "landscape" : aspect === "square" ? "square" : "story";

  const gallery = useMemo(() => [...new Set(images)].slice(0, 24), [images]);

  const toggle = (url: string) =>
    setPicked((p) => (p.includes(url) ? p.filter((u) => u !== url) : [...p, url].slice(0, 8)));

  const build = async () => {
    setError(null);
    setBusy(true);
    setProgress(0);
    setUploaded(null);
    try {
      const { blob, mime } = await renderReel({
        scenes: picked.map((url) => ({ url, caption: captions[url] ?? "" })),
        aspect: reelAspect,
        secondsPerScene: seconds,
        onProgress: setProgress,
      });
      setPreview({ url: URL.createObjectURL(blob), blob, mime });
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر بناء الفيديو.");
    } finally {
      setBusy(false);
    }
  };

  const attachVideo = async () => {
    // لا صمت: المستخدم يجب أن يعرف لماذا لم يحدث شيء.
    if (!preview) {
      setError("ابنِ الفيديو أولاً ثم أرفقه بالمنشور.");
      return;
    }
    if (!workspaceId) {
      setError("مساحة العمل لم تُحمّل بعد — أعد تحميل الصفحة ثم حاول مرة أخرى.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const ext = preview.mime.includes("mp4") ? "mp4" : "webm";
      const path = `${workspaceId}/reels/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("nour-media")
        .upload(path, preview.blob, { contentType: preview.mime, upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { data } = await supabase.storage
        .from("nour-media")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (!data?.signedUrl) throw new Error("تعذّر إنشاء رابط الفيديو.");
      onAttach(data.signedUrl);
      setUploaded(data.signedUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر رفع الفيديو.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-background/60 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Film className="size-4 text-muted-foreground" />
        <span className="text-[0.7rem] font-bold">ريلز من صورك (مجاني بالكامل)</span>
        <div className="ms-auto flex items-center gap-1 rounded-xl border border-border p-0.5">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSeconds(d)}
              className={cn(
                "rounded-lg px-2 py-1 text-[0.66rem] font-bold transition-colors",
                seconds === d
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-secondary",
              )}
            >
              {d} ث/مشهد
            </button>
          ))}
        </div>
      </div>

      {gallery.length ? (
        <>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {gallery.map((url) => {
              const order = picked.indexOf(url);
              return (
                <button
                  key={url}
                  type="button"
                  onClick={() => toggle(url)}
                  className={cn(
                    "relative overflow-hidden rounded-lg border transition-all",
                    order >= 0 ? "border-jade" : "border-border hover:-translate-y-0.5",
                  )}
                >
                  <img
                    src={url}
                    alt="مشهد"
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                  {order >= 0 ? (
                    <span className="absolute end-1 top-1 grid size-5 place-items-center rounded-full bg-foreground text-[0.6rem] font-bold text-background">
                      {order + 1}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {picked.length ? (
            <div className="mt-2 space-y-1.5">
              {picked.map((url, i) => (
                <div key={url} className="flex items-center gap-2">
                  <span className="text-[0.65rem] font-bold text-muted-foreground">{i + 1}</span>
                  <input
                    value={captions[url] ?? ""}
                    onChange={(e) => setCaptions((c) => ({ ...c, [url]: e.target.value }))}
                    dir="auto"
                    placeholder="نص على الشاشة لهذا المشهد (اختياري)"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </div>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => void build()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3.5 py-2 text-xs font-bold text-background disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Film className="size-3.5" />
                )}
                {busy ? `جارٍ البناء ${Math.round(progress * 100)}%` : "ابنِ الفيديو"}
              </button>
            </div>
          ) : (
            <p className="mt-1.5 text-[0.68rem] text-muted-foreground">
              اختر صورتين أو أكثر بالترتيب، واكتب نصاً لكل مشهد إن أردت.
            </p>
          )}
        </>
      ) : (
        <p className="mt-1.5 text-[0.68rem] text-muted-foreground">
          ولّد صوراً أو اسحب صور موقعك أولاً، ثم حوّلها إلى ريلز هنا.
        </p>
      )}

      {preview ? (
        <div className="mt-3 space-y-2">
          <video
            src={preview.url}
            controls
            playsInline
            className="max-h-72 w-full rounded-xl border border-border bg-black object-contain"
          />
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={preview.url}
              download={`reel.${preview.mime.includes("mp4") ? "mp4" : "webm"}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-secondary"
            >
              <Download className="size-3.5" /> نزّل الفيديو
            </a>
            <button
              type="button"
              disabled={busy || !workspaceId || Boolean(uploaded && attached.includes(uploaded))}
              onClick={() => void attachVideo()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3 py-2 text-xs font-bold text-background disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              {uploaded ? "مُرفق ✓" : "أرفقه بالمنشور"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs font-semibold text-coral">{error}</p> : null}
    </div>
  );
}
