import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ImagePlus,
  Loader2,
  Link2,
  X,
  Wand2,
  Check,
  Globe,
  RefreshCw,
  Upload,
  Camera,
  Paperclip,
  FileText,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { generateMedia } from "@/lib/media.functions";
import { listSiteAssets, syncSiteAssets, type StoredAsset } from "@/lib/brand-assets.functions";
import { ReelStudio } from "@/components/app/ReelStudio";
import { cn } from "@/lib/utils";

export type Attachment = {
  url: string;
  type: "image" | "video" | "file";
  alt?: string;
  mime?: string;
  size?: number;
};

/** حتى ١٠ عناصر مع بعض في نفس الرسالة. حدود الحجم تحمي الرفع من الفشل الصامت. */
const MAX_ATTACHMENTS = 10;
const MAX_BYTES = 50 * 1024 * 1024;
/** الملفات (مستندات/جداول/نصوص) تُقرأ بالكامل على الخادم، فنُحدّها بـ٢٥ ميجابايت. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const humanSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`
    : `${Math.max(1, Math.round(bytes / 1024))} ك.ب`;
export type ImageMode = "auto" | "off" | "manual";
export type Aspect = "square" | "portrait" | "landscape" | "story";

const ASPECTS: { id: Aspect; label: string }[] = [
  { id: "square", label: "مربّع 1:1" },
  { id: "portrait", label: "طولي 4:5" },
  { id: "story", label: "ستوري 9:16" },
  { id: "landscape", label: "عريض 16:9" },
];

const MODES: { id: ImageMode; label: string; hint: string }[] = [
  { id: "auto", label: "صورة تلقائية", hint: "الموظف يختار الصورة المناسبة للمنشور" },
  { id: "manual", label: "وصفي أنا", hint: "تُولَّد الصورة من وصفك حرفياً" },
  { id: "off", label: "بدون صورة", hint: "نص فقط" },
];

/**
 * استوديو الوسائط: حرية كاملة للمستخدم — يولّد صوراً من وصفه هو (بأي عدد ونسبة)،
 * أو يرفق روابط صور وفيديوهات، أو يوقف الصور تماماً.
 */
export function MediaStudio({
  workspaceId,
  attachments,
  onAttachmentsChange,
  imageMode,
  onImageModeChange,
  imagePrompt,
  onImagePromptChange,
  aspect,
  onAspectChange,
  disabled,
  defaultOpen = false,
  hideTrigger = false,
}: {
  workspaceId: string | undefined;
  attachments: Attachment[];
  onAttachmentsChange: (next: Attachment[]) => void;
  imageMode: ImageMode;
  onImageModeChange: (mode: ImageMode) => void;
  imagePrompt: string;
  onImagePromptChange: (value: string) => void;
  aspect: Aspect;
  onAspectChange: (value: Aspect) => void;
  disabled?: boolean;
  defaultOpen?: boolean;
  hideTrigger?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(2);
  const [literal, setLiteral] = useState(true);
  const [results, setResults] = useState<string[]>([]);
  const [linkValue, setLinkValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const generate = useServerFn(generateMedia);

  const run = useMutation({
    mutationFn: () =>
      generate({
        data: {
          workspaceId: workspaceId!,
          prompt: prompt.trim(),
          count,
          aspect,
          mode: literal ? "literal" : "enhanced",
        },
      }),
    onSuccess: (res) => {
      setResults((prev) => [...(res?.urls ?? []), ...prev].slice(0, 12));
      setError(res?.urls?.length ? null : "تعذّر توليد الصور الآن، جرّب مرة أخرى.");
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "تعذّر توليد الصور"),
  });

  // صور موقع المستخدم الحقيقية — يختار منها مباشرة بدل الصور المولّدة.
  const listAssets = useServerFn(listSiteAssets);
  const syncAssets = useServerFn(syncSiteAssets);
  const assetsQuery = useQuery({
    queryKey: ["site-assets", workspaceId],
    enabled: Boolean(workspaceId) && open,
    queryFn: () => listAssets({ data: { workspaceId: workspaceId!, limit: 40 } }),
  });
  const siteAssets: StoredAsset[] = assetsQuery.data?.assets ?? [];
  const sync = useMutation({
    mutationFn: () => syncAssets({ data: { workspaceId: workspaceId! } }),
    onSuccess: (res) => {
      void assetsQuery.refetch();
      if (!res?.ok) setError("أضف رابط موقعك في الإعدادات أولاً حتى نسحب صوره.");
      else if (!res.count) setError("لم نجد صوراً مناسبة في موقعك.");
      else setError(null);
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "تعذّر سحب صور الموقع"),
  });

  const attach = (url: string, type: "image" | "video") => {
    if (attachments.some((a) => a.url === url) || attachments.length >= MAX_ATTACHMENTS) return;
    onAttachmentsChange([...attachments, { url, type }]);
  };

  /** رفع صور وفيديوهات وملفات من جهاز المستخدم أو كاميرته، حتى ١٠ عناصر. */
  const uploadFiles = async (files: File[]) => {
    if (!workspaceId) return setError("اختر مساحة العمل أولاً.");
    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) return setError(`الحد الأقصى ${MAX_ATTACHMENTS} ملفات مع بعض.`);
    const picked = files.slice(0, room);
    if (files.length > room) setError(`أرفقنا ${room} ملفات فقط — الحد الأقصى ${MAX_ATTACHMENTS}.`);
    else setError(null);

    setUploading(picked.length);
    const added: Attachment[] = [];
    for (const file of picked) {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      const kind: Attachment["type"] = isVideo ? "video" : isImage ? "image" : "file";
      const limit = kind === "file" ? MAX_FILE_BYTES : MAX_BYTES;
      if (file.size > limit) {
        setError(
          `«${file.name}» ${humanSize(file.size)} — الحد الأقصى ${humanSize(limit)} ${
            kind === "file" ? "للملف" : "للصورة/الفيديو"
          }.`,
        );
        continue;
      }
      if (file.size === 0) {
        setError(`«${file.name}» ملف فارغ.`);
        continue;
      }
      try {
        const ext =
          file.name
            .split(".")
            .pop()
            ?.toLowerCase()
            .replace(/[^a-z0-9]/g, "") || (isVideo ? "mp4" : isImage ? "jpg" : "bin");
        const key = `${workspaceId}/uploads/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("nour-media").upload(key, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (upErr) throw upErr;
        const { data } = await supabase.storage
          .from("nour-media")
          .createSignedUrl(key, 60 * 60 * 24 * 365 * 5);
        if (!data?.signedUrl) throw new Error("no-url");
        added.push({
          url: data.signedUrl,
          type: kind,
          alt: file.name,
          mime: file.type || "application/octet-stream",
          size: file.size,
        });
      } catch {
        setError(`تعذّر رفع «${file.name}». أعد المحاولة.`);
      } finally {
        setUploading((n) => Math.max(0, n - 1));
      }
    }
    setUploading(0);
    if (added.length) {
      const existing = new Set(attachments.map((a) => a.url));
      onAttachmentsChange(
        [...attachments, ...added.filter((a) => !existing.has(a.url))].slice(0, MAX_ATTACHMENTS),
      );
    }
  };

  const addLink = () => {
    const url = linkValue.trim();
    if (!/^https?:\/\//i.test(url)) {
      setError("أدخل رابطاً يبدأ بـ http.");
      return;
    }
    const isVideo =
      /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url) || /youtube|youtu\.be|vimeo|tiktok/i.test(url);
    attach(url, isVideo ? "video" : "image");
    setLinkValue("");
    setError(null);
  };

  return (
    <div className={open ? "w-full" : "min-w-0"}>
      {!hideTrigger ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-2xl border border-border px-3 py-2 text-xs font-bold transition-colors hover:bg-secondary disabled:opacity-50",
              open && "border-primary/50 bg-primary/10",
            )}
          >
            <ImagePlus className="size-4" /> وسائط
            {!open && imageMode !== "auto" ? (
              <span className="text-[0.65rem] font-semibold text-muted-foreground">
                {imageMode === "off" ? "بدون صورة" : "وصفي أنا"}
              </span>
            ) : null}
            {attachments.length ? (
              <span className="rounded-full bg-foreground px-1.5 text-[0.65rem] text-background">
                {attachments.length}
              </span>
            ) : null}
          </button>
          <div
            className={cn(
              "items-center gap-1 rounded-2xl border border-border p-0.5",
              open ? "flex" : "hidden",
            )}
          >
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                title={m.hint}
                disabled={disabled}
                onClick={() => {
                  onImageModeChange(m.id);
                  if (m.id === "manual") setOpen(true);
                }}
                className={cn(
                  "inline-flex min-h-8 items-center rounded-xl px-2.5 py-1.5 text-[0.7rem] font-bold transition-colors",
                  imageMode === m.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-secondary",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {attachments.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <span
              key={a.url}
              className="group relative overflow-hidden rounded-xl border border-border bg-secondary"
            >
              {a.type === "image" ? (
                <img src={a.url} alt="مرفق" className="size-16 object-cover" loading="lazy" />
              ) : a.type === "video" ? (
                <span className="grid size-16 place-items-center text-[0.65rem] font-bold">
                  فيديو
                </span>
              ) : (
                <span
                  className="grid size-16 place-items-center gap-0.5 px-1 text-center text-[0.6rem] font-bold leading-tight"
                  title={`${a.alt ?? "ملف"}${a.size ? ` · ${humanSize(a.size)}` : ""}`}
                >
                  <FileText className="mx-auto size-4" />
                  <span className="line-clamp-2 break-all">{a.alt ?? "ملف"}</span>
                </span>
              )}
              <button
                type="button"
                aria-label="إزالة المرفق"
                onClick={() => onAttachmentsChange(attachments.filter((x) => x.url !== a.url))}
                className="absolute inset-x-0 bottom-0 grid min-h-6 place-items-center bg-foreground/80 text-background opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
              >
                <X className="mx-auto size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className="mt-3 space-y-3 rounded-2xl border border-border bg-secondary/40 p-3">
          <div className="rounded-xl border border-border bg-background/60 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Upload className="size-4 text-muted-foreground" />
              <span className="text-[0.7rem] font-bold">من جهازك أو المعرض</span>
              <span className="text-[0.65rem] text-muted-foreground">
                {attachments.length}/{MAX_ATTACHMENTS}
              </span>
              <div className="ms-auto flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={
                    disabled ||
                    !workspaceId ||
                    uploading > 0 ||
                    attachments.length >= MAX_ATTACHMENTS
                  }
                  onClick={() => fileInput.current?.click()}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-foreground px-3 py-1.5 text-[0.68rem] font-bold text-background disabled:opacity-40"
                >
                  {uploading > 0 ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <ImagePlus className="size-3" />
                  )}
                  {uploading > 0 ? `جاري الرفع… ${uploading}` : "صور وفيديوهات"}
                </button>
                <button
                  type="button"
                  disabled={
                    disabled ||
                    !workspaceId ||
                    uploading > 0 ||
                    attachments.length >= MAX_ATTACHMENTS
                  }
                  onClick={() => docInput.current?.click()}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[0.68rem] font-bold hover:bg-secondary disabled:opacity-40"
                >
                  <Paperclip className="size-3" /> ملفات
                </button>
                <button
                  type="button"
                  disabled={
                    disabled ||
                    !workspaceId ||
                    uploading > 0 ||
                    attachments.length >= MAX_ATTACHMENTS
                  }
                  onClick={() => cameraInput.current?.click()}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[0.68rem] font-bold hover:bg-secondary disabled:opacity-40"
                >
                  <Camera className="size-3" /> كاميرا
                </button>
              </div>
            </div>
            <p className="mt-1.5 text-[0.68rem] text-muted-foreground">
              حتى ١٠ عناصر مع بعض: صور وفيديوهات حتى {humanSize(MAX_BYTES)} لكل ملف، ومستندات وملفات
              (PDF · نصوص · CSV · JSON · أكواد) حتى {humanSize(MAX_FILE_BYTES)} — والموظف يقرأ
              محتواها فعلياً وينفّذ عليها ما تطلبه.
            </p>
            <input
              ref={fileInput}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                if (files.length) void uploadFiles(files);
              }}
            />
            <input
              ref={docInput}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                if (files.length) void uploadFiles(files);
              }}
            />
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                if (files.length) void uploadFiles(files);
              }}
            />
          </div>

          {imageMode === "manual" ? (
            <label className="block">
              <span className="text-[0.7rem] font-bold text-muted-foreground">
                وصف الصورة التي تريدها مع رد الموظف (تُولَّد من وصفك حرفياً)
              </span>
              <input
                value={imagePrompt}
                onChange={(e) => onImagePromptChange(e.target.value)}
                dir="auto"
                placeholder="مثال: كوب قهوة مثلّجة على طاولة رخام بيضاء وإضاءة صباحية"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="text-[0.7rem] font-bold text-muted-foreground">
              ولّد صوراً الآن من وصفك وأرفق ما يعجبك
            </span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              dir="auto"
              placeholder="اكتب وصف الصورة بالعربية أو الإنجليزية…"
              className="mt-1 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-border p-0.5">
              {ASPECTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onAspectChange(a.id)}
                  aria-pressed={aspect === a.id}
                  className={cn(
                    "inline-flex min-h-9 items-center rounded-lg px-2.5 py-1 text-[0.68rem] font-bold transition-colors",
                    aspect === a.id
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-border p-0.5">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  aria-pressed={count === n}
                  aria-label={`عدد الصور ${n}`}
                  className={cn(
                    "size-9 rounded-lg text-[0.68rem] font-bold transition-colors",
                    count === n
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLiteral((v) => !v)}
              aria-pressed={literal}
              className={cn(
                "inline-flex min-h-9 items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[0.68rem] font-bold transition-colors",
                literal ? "border-primary/50 bg-primary/10" : "border-border text-muted-foreground",
              )}
              title="مطابقة حرفية لوصفك بدل إعادة صياغته"
            >
              {literal ? <Check className="size-3" /> : <Wand2 className="size-3" />}
              {literal ? "مطابق لوصفي" : "حسّن وصفي"}
            </button>
            <button
              type="button"
              disabled={!workspaceId || prompt.trim().length < 3 || run.isPending}
              onClick={() => {
                setError(null);
                run.mutate();
              }}
              aria-disabled={!workspaceId || prompt.trim().length < 3 || run.isPending}
              className="ms-auto inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-foreground px-3.5 py-2 text-xs font-bold text-background disabled:opacity-40"
            >
              {run.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ImagePlus className="size-3.5" />
              )}
              ولّد الصور
            </button>
          </div>

          {results.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {results.map((url) => {
                const added = attachments.some((a) => a.url === url);
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => attach(url, "image")}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border transition-all",
                      added ? "border-jade" : "border-border hover:-translate-y-0.5",
                    )}
                  >
                    <img
                      src={url}
                      alt="صورة مولّدة"
                      className="aspect-square w-full object-cover"
                      loading="lazy"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-foreground/80 py-1 text-[0.65rem] font-bold text-background">
                      {added ? "مُرفقة ✓" : "أرفقها"}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-background/60 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Globe className="size-4 text-muted-foreground" />
              <span className="text-[0.7rem] font-bold">صور من موقعك</span>
              <button
                type="button"
                disabled={!workspaceId || sync.isPending}
                onClick={() => {
                  setError(null);
                  sync.mutate();
                }}
                aria-disabled={!workspaceId || sync.isPending}
                className="ms-auto inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[0.68rem] font-bold transition-colors hover:bg-secondary disabled:opacity-40"
              >
                {sync.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                {siteAssets.length ? "تحديث" : "اسحب صور موقعي"}
              </button>
            </div>
            {siteAssets.length ? (
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {siteAssets.map((a) => {
                  const added = attachments.some((x) => x.url === a.url);
                  return (
                    <button
                      key={a.url}
                      type="button"
                      title={a.alt ?? "صورة من موقعك"}
                      onClick={() => attach(a.url, "image")}
                      className={cn(
                        "group relative overflow-hidden rounded-lg border transition-all",
                        added ? "border-jade" : "border-border hover:-translate-y-0.5",
                      )}
                    >
                      <img
                        src={a.url}
                        alt={a.alt ?? "صورة من موقعك"}
                        className="aspect-square w-full object-cover"
                        loading="lazy"
                      />
                      {added ? (
                        <span className="absolute inset-x-0 bottom-0 bg-foreground/80 py-0.5 text-[0.6rem] font-bold text-background">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-1.5 text-[0.68rem] text-muted-foreground">
                نجلب صور منتجاتك ومقالاتك من موقعك لتستخدمها مباشرة في المنشورات.
              </p>
            )}
          </div>

          <ReelStudio
            workspaceId={workspaceId}
            images={[
              ...results,
              ...siteAssets.map((a) => a.url),
              ...attachments.filter((a) => a.type === "image").map((a) => a.url),
            ]}
            aspect={aspect}
            attached={attachments.map((a) => a.url)}
            onAttach={(url) => attach(url, "video")}
          />

          <div className="flex items-center gap-2">
            <Link2 className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLink();
                }
              }}
              dir="ltr"
              placeholder="أو الصق رابط صورة أو فيديو…"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={addLink}
              className="inline-flex min-h-10 shrink-0 items-center rounded-xl border border-border px-3 py-2 text-xs font-bold transition-colors hover:bg-secondary"
            >
              إضافة
            </button>
          </div>

          {error ? <p className="text-xs font-semibold text-coral">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
