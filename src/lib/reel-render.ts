/**
 * صانع الريلز داخل المتصفح — مجاني ١٠٠٪ وبلا أي مفتاح أو خدمة خارجية.
 *
 * يأخذ صوراً (مولّدة مجاناً أو من موقع العميل) ويحوّلها إلى فيديو حقيقي:
 * حركة كين برنز (تقريب/إزاحة ناعمة) + انتقال تلاشٍ + نص عربي على الشاشة،
 * ثم يسجّله عبر MediaRecorder إلى ملف WebM جاهز للتنزيل أو الإرفاق بالمنشور.
 *
 * لماذا داخل المتصفح؟ خوادم Workers لا تشغّل ffmpeg، وكل واجهات الفيديو
 * بالذكاء الاصطناعي إمّا مدفوعة أو تتطلب مفتاحاً. هذا المسار بلا تكلفة ولا حدود.
 */

export type ReelAspect = "story" | "square" | "landscape";

export type ReelScene = {
  /** رابط صورة (يجب أن يسمح بالقراءة عبر CORS). */
  url: string;
  /** نص قصير يظهر على الشاشة — اتركه فارغاً لمشهد بلا نص. */
  caption?: string;
};

export type ReelOptions = {
  scenes: ReelScene[];
  aspect?: ReelAspect;
  /** مدة كل مشهد بالثواني. */
  secondsPerScene?: number;
  /** لون النص والشريط السفلي. */
  accent?: string;
  onProgress?: (ratio: number) => void;
};

const SIZES: Record<ReelAspect, { w: number; h: number }> = {
  story: { w: 720, h: 1280 },
  square: { w: 1080, h: 1080 },
  landscape: { w: 1280, h: 720 },
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`تعذّر تحميل الصورة: ${url}`));
    img.src = url;
  });
}

/** يلفّ النص العربي على أسطر تناسب عرض الشاشة. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function pickMime(): string {
  const candidates = [
    "video/mp4;codecs=avc1",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "video/webm";
}

/** يبني الفيديو ويعيد ملفاً جاهزاً (WebM أو MP4 حسب دعم المتصفح). */
export async function renderReel({
  scenes,
  aspect = "story",
  secondsPerScene = 3,
  accent = "#ffffff",
  onProgress,
}: ReelOptions): Promise<{ blob: Blob; mime: string; seconds: number }> {
  if (!scenes.length) throw new Error("أضف صورة واحدة على الأقل.");
  if (typeof MediaRecorder === "undefined") throw new Error("متصفحك لا يدعم تسجيل الفيديو.");

  const { w, h } = SIZES[aspect];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذّر تجهيز لوحة الرسم.");

  const images = await Promise.all(scenes.map((s) => loadImage(s.url)));

  const mime = pickMime();
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const total = scenes.length * secondsPerScene * 1000;
  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
  });
  recorder.start(200);

  const start = performance.now();
  await new Promise<void>((resolve) => {
    const draw = () => {
      const elapsed = performance.now() - start;
      if (elapsed >= total) {
        resolve();
        return;
      }
      onProgress?.(elapsed / total);

      const idx = Math.min(scenes.length - 1, Math.floor(elapsed / (secondsPerScene * 1000)));
      const local = (elapsed % (secondsPerScene * 1000)) / (secondsPerScene * 1000);

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);

      const paint = (img: HTMLImageElement, t: number, alpha: number) => {
        // كين برنز: تقريب بطيء من ١.٠٤ إلى ١.١٦ مع إزاحة رأسية خفيفة.
        const zoom = 1.04 + t * 0.12;
        const ratio = Math.max(w / img.width, h / img.height) * zoom;
        const dw = img.width * ratio;
        const dh = img.height * ratio;
        const dx = (w - dw) / 2;
        const dy = (h - dh) / 2 - (dh - h) * 0.06 * (t - 0.5);
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.globalAlpha = 1;
      };

      paint(images[idx]!, local, 1);
      // تلاشٍ متقاطع في آخر ٢٥٪ من المشهد.
      if (local > 0.75 && idx < images.length - 1) {
        paint(images[idx + 1]!, 0, (local - 0.75) / 0.25);
      }

      // تدرّج سفلي يجعل النص مقروءاً على أي صورة.
      const grad = ctx.createLinearGradient(0, h * 0.5, 0, h);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.72)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, h * 0.5, w, h * 0.5);

      const caption = scenes[idx]?.caption?.trim();
      if (caption) {
        const size = Math.round(w * (aspect === "landscape" ? 0.052 : 0.062));
        ctx.font = `700 ${size}px "Tajawal", "Cairo", system-ui, sans-serif`;
        ctx.direction = "rtl";
        ctx.textAlign = "center";
        ctx.fillStyle = accent;
        ctx.shadowColor = "rgba(0,0,0,0.65)";
        ctx.shadowBlur = 14;
        const lines = wrap(ctx, caption, w * 0.84);
        const lh = size * 1.35;
        // دخول ناعم للنص من الأسفل.
        const rise = Math.max(0, 1 - local / 0.18) * size * 0.7;
        let y = h * 0.86 - (lines.length - 1) * lh + rise;
        for (const line of lines) {
          ctx.fillText(line, w / 2, y);
          y += lh;
        }
        ctx.shadowBlur = 0;
      }

      // شريط تقدّم رفيع أسفل الشاشة.
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(0, h - 6, w, 6);
      ctx.fillStyle = accent;
      ctx.fillRect(0, h - 6, w * (elapsed / total), 6);

      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  });

  recorder.stop();
  stream.getTracks().forEach((t) => t.stop());
  onProgress?.(1);
  const blob = await done;
  return { blob, mime, seconds: scenes.length * secondsPerScene };
}
