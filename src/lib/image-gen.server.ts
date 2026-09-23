/**
 * توليد الصور لنور — مجاني وبلا حدود يومية وبلا مفتاح API.
 *
 * المزوّد الأساسي: Pollinations.ai (نموذج FLUX) — يرجع صورة مباشرة عبر رابط دائم،
 * بلا تسجيل ولا مفتاح ولا حصة يومية. نحفظ الرابط كما هو داخل المقال (CDN مجاني)،
 * أو نرفع البايتات إلى Supabase Storage عند الحاجة لملكية كاملة للأصل.
 *
 * الاحتياطي: Gemini image (المفتاح موجود أصلاً) عند فشل المزوّد الأساسي.
 */

const POLLINATIONS = "https://image.pollinations.ai/prompt";

export type ImageOptions = {
  width?: number;
  height?: number;
  /** ثابت يجعل نفس الوصف يعطي نفس الصورة (مفيد لإعادة التوليد المتوقّعة). */
  seed?: number;
  timeoutMs?: number;
};

/** كلمات جودة تُضاف مرة واحدة فقط عندما لا يذكرها الوصف — ترفع حِدّة الصورة وواقعيتها. */
function withQuality(prompt: string): string {
  const p = prompt.trim();
  if (/\b(8k|4k|photorealistic|high detail|ultra detailed|cinematic)\b/i.test(p)) return p;
  return `${p} Photorealistic, ultra detailed, sharp focus, natural lighting, professional commercial photography, 8k.`;
}

/** رابط صورة جاهز للاستخدام مباشرة داخل Markdown/HTML — لا يحتاج انتظار توليد. */
export function imageUrl(prompt: string, opts: ImageOptions = {}): string {
  const { width = 1216, height = 640, seed } = opts;
  const q = new URLSearchParams({
    width: String(width),
    height: String(height),
    model: "flux",
    nologo: "true",
    // لا تُنشر الصورة في الخلاصة العامة للمزوّد — خصوصية محتوى العميل.
    nofeed: "true",
    // لا «تحسين» تلقائي للوصف: كان يبدّل الموضوع ويعطي صوراً لا علاقة لها بالطلب.
    enhance: "false",
    ...(seed !== undefined ? { seed: String(seed) } : {}),
  });
  return `${POLLINATIONS}/${encodeURIComponent(withQuality(prompt).slice(0, 900))}?${q}`;
}

export type ImageBriefInput = {
  /** طلب المستخدم الأصلي (بالعربية غالباً). */
  request: string;
  /** عنوان المخرج/المنشور. */
  title?: string | null | undefined;
  /** أول أسطر نص المنشور — يحمل المنتج/العرض/المكان الفعلي. */
  body?: string | null | undefined;
  brand?: { name?: string; industry?: string; country?: string | null } | undefined;
  /** وصف كتبه النموذج مسبقاً (قد يكون عاماً) — يُستخدم كإلهام لا كمرجع. */
  draft?: string | null | undefined;
  /** نسبة الأبعاد المستهدفة. */
  aspect?: "square" | "portrait" | "landscape";
};

/**
 * «مخرج صور»: يحوّل الطلب الفعلي إلى وصف تصويري يُظهر الموضوع نفسه (المنتج، المكان،
 * العرض) لا صورة عامة — عبر نداء قصير سريع، مع احتياط حتمي إن تعذّر النداء.
 */
export async function imageBrief(input: ImageBriefInput): Promise<string> {
  const subject = [input.title, input.request].filter(Boolean).join(" — ").slice(0, 300);
  const fallback = [
    `Photorealistic commercial photograph that clearly shows: ${subject}.`,
    input.brand?.industry ? `Business: ${input.brand.industry}.` : "",
    input.brand?.country
      ? `Setting: ${input.brand.country}, Middle East.`
      : "Setting: Middle East / Arab world.",
    "Hero subject centered and unmistakable, natural light, high detail, premium look, 8k.",
  ]
    .filter(Boolean)
    .join(" ");
  try {
    const { freeChat } = await import("./nour-research.server");
    const raw = await freeChat(
      "",
      [
        {
          role: "system",
          content:
            "You are an art director for social media. Write ONE English image-generation prompt (max 70 words) that depicts EXACTLY the concrete subject of the post: the specific product/dish/service/place/offer named by the user. Rules: 1) Name the subject explicitly in the first sentence. 2) Describe scene, props, lighting, angle, mood matching the Arab/Middle-Eastern market. 3) Never invent a different subject. 4) No text, letters, logos, watermarks. Output the prompt only.",
        },
        {
          role: "user",
          content: [
            `User request (Arabic): ${input.request.slice(0, 600)}`,
            input.title ? `Post title: ${input.title}` : "",
            input.body ? `Post text (excerpt): ${input.body.slice(0, 500)}` : "",
            input.brand?.name ? `Brand: ${input.brand.name} (${input.brand.industry ?? ""})` : "",
            input.brand?.country ? `Country: ${input.brand.country}` : "",
            input.draft
              ? `Draft idea from writer (may be generic, fix it): ${input.draft.slice(0, 300)}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      { timeoutMs: 12_000, maxTokens: 160, budgetMs: 15_000, race: true },
    );
    const clean = raw
      .replace(/^```[a-z]*\n?|```$/gim, "")
      .replace(/^(prompt|image prompt)\s*[:：]\s*/i, "")
      .replace(/[\u0600-\u06FF]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (clean.length < 40) return fallback + NO_TEXT;
    return clean.slice(0, 850) + NO_TEXT;
  } catch {
    return fallback + NO_TEXT;
  }
}

/**
 * «وصف المستخدم حرفياً»: يترجم وصف المستخدم العربي إلى إنجليزية تصويرية دون
 * إضافة أي عنصر لم يذكره — هذا ما يجعل الصورة مطابقة لما كتبه بالضبط.
 */
export async function literalBrief(userPrompt: string): Promise<string> {
  const trimmed = userPrompt.replace(/\s+/g, " ").trim().slice(0, 700);
  // وصف إنجليزي بالفعل: يُستخدم كما هو بلا أي تدخل.
  if (!/[\u0600-\u06FF]/.test(trimmed)) return trimmed.slice(0, 850) + NO_TEXT;
  try {
    const { freeChat } = await import("./nour-research.server");
    const raw = await freeChat(
      "",
      [
        {
          role: "system",
          content:
            "Translate the user's Arabic image description into ONE faithful English image-generation prompt. Rules: keep EVERY element the user mentioned (subject, colors, place, style, mood, composition); add NOTHING new except neutral photographic quality words (lighting, sharpness, resolution). Never change the subject. Output the prompt only.",
        },
        { role: "user", content: trimmed },
      ],
      { timeoutMs: 12_000, maxTokens: 180, budgetMs: 14_000, race: true },
    );
    const clean = raw
      .replace(/^```[a-z]*\n?|```$/gim, "")
      .replace(/^(prompt|image prompt)\s*[:：]\s*/i, "")
      .replace(/[\u0600-\u06FF]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (clean.length < 20) return `${trimmed}. Photorealistic, high detail, 8k.` + NO_TEXT;
    return clean.slice(0, 850) + NO_TEXT;
  } catch {
    return `${trimmed}. Photorealistic, high detail, 8k.` + NO_TEXT;
  }
}

/** أبعاد الصورة حسب النسبة المطلوبة من المستخدم. */
export function aspectSize(aspect: "square" | "portrait" | "landscape" | "story") {
  if (aspect === "square") return { width: 1024, height: 1024 };
  if (aspect === "portrait") return { width: 896, height: 1152 };
  if (aspect === "story") return { width: 768, height: 1344 };
  return { width: 1216, height: 640 };
}

/** يولّد الصورة فعلياً ويعيد بايتاتها (للرفع إلى التخزين أو النشر إلى ووردبريس). */
export async function generateImageBytes(
  prompt: string,
  opts: ImageOptions = {},
): Promise<{ bytes: Uint8Array; contentType: string; url: string } | null> {
  const { limitImage } = await import("./limiter.server");
  // المزوّد المجاني يرفض تحت الضغط المتوازي — ننظّم التزامن ثم نعيد المحاولة
  // بتأخير متصاعد قبل السقوط إلى Gemini، فلا يخرج المنشور بلا صورة.
  return limitImage(async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const url = imageUrl(prompt, opts.seed !== undefined ? opts : { ...opts, seed: attempt });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 90_000);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`pollinations ${res.status}`);
        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.byteLength < 2000) throw new Error("صورة فارغة");
        return { bytes: buf, contentType: res.headers.get("content-type") ?? "image/jpeg", url };
      } catch (error) {
        console.error(`[nour] pollinations attempt ${attempt + 1} failed:`, error);
        // بعد محاولتين فاشلتين نجرّب Gemini فوراً بدل انتظار كل المحاولات.
        if (attempt === 1) {
          const early = await geminiImage(withQuality(prompt), opts);
          if (early) return early;
        }
        if (attempt < 3)
          await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt + Math.random() * 900));
      } finally {
        clearTimeout(timer);
      }
    }
    return (
      (await geminiImage(withQuality(prompt), opts)) ??
      (await gatewayImage(withQuality(prompt), opts))
    );
  });
}

/**
 * احتياطي ثانٍ: توليد الصورة عبر بوابة Lovable AI حين يسقط المزوّد المجاني
 * ويكون مفتاح Gemini غائباً — كي لا يخرج المنشور بلا صورة إطلاقاً.
 */
async function gatewayImage(
  prompt: string,
  opts: ImageOptions = {},
): Promise<{ bytes: Uint8Array; contentType: string; url: string } | null> {
  try {
    const { providerKeys } = await import("./provider-keys.server");
    const { lovable } = await providerKeys();
    if (!lovable) return null;
    const w = opts.width ?? 1216;
    const h = opts.height ?? 640;
    const size = w === h ? "1024x1024" : w > h ? "1536x1024" : "1024x1536";
    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovable}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-pro-image-preview", prompt, n: 1, size }),
    });
    if (!res.ok) {
      console.error("[image] gateway image failed:", res.status);
      return null;
    }
    const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
    const first = json.data?.[0];
    if (first?.b64_json) {
      const bin = atob(first.b64_json);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return {
        bytes,
        contentType: "image/png",
        url: `data:image/png;base64,${first.b64_json}`,
      };
    }
    if (first?.url) {
      const img = await fetch(first.url);
      if (!img.ok) return null;
      const bytes = new Uint8Array(await img.arrayBuffer());
      if (bytes.byteLength < 2000) return null;
      return {
        bytes,
        contentType: img.headers.get("content-type") ?? "image/png",
        url: first.url,
      };
    }
    return null;
  } catch (error) {
    console.error("[image] gateway image failed:", error);
    return null;
  }
}

/** احتياطي: توليد الصورة عبر Gemini image بمفتاح Google AI Studio المخزَّن في Supabase. */
async function geminiImage(
  prompt: string,
  opts: ImageOptions = {},
): Promise<{ bytes: Uint8Array; contentType: string; url: string } | null> {
  try {
    const { providerKeys } = await import("./provider-keys.server");
    const { gemini } = await providerKeys();
    if (!gemini) return null;
    // Gemini لا يأخذ أبعاداً رقمية، فنمرّر النسبة نصّياً حتى لا تخرج الصورة بقصّ خاطئ.
    const w = opts.width ?? 1216;
    const h = opts.height ?? 640;
    const ratio =
      w === h
        ? "1:1 square"
        : w > h
          ? "16:9 landscape"
          : h / w > 1.6
            ? "9:16 vertical story"
            : "4:5 portrait";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${gemini}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${prompt} Aspect ratio: ${ratio}.` }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      },
    );

    if (!res.ok) return null;
    const json = (await res.json()) as {
      candidates?: {
        content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] };
      }[];
    };
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    const b64 = part?.inlineData?.data;
    if (!b64) return null;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return {
      bytes,
      contentType: part?.inlineData?.mimeType ?? "image/png",
      url: `data:${part?.inlineData?.mimeType ?? "image/png"};base64,${b64}`,
    };
  } catch (error) {
    console.error("[nour] gemini image failed:", error);
    return null;
  }
}

/**
 * وصف بصري احترافي للصورة الرئيسية من عنوان المقال — بلا نص داخل الصورة
 * (النماذج ترسم حروفاً عربية مشوّهة، فنمنع الكتابة صراحةً).
 */
export function heroPrompt(topic: string, industry?: string): string {
  return [
    `Editorial hero photograph for an article about: ${topic}.`,
    industry ? `Brand industry: ${industry}.` : "",
    "Modern, clean, high-end commercial photography, soft natural light, shallow depth of field,",
    "Middle Eastern / Gulf context where relevant, realistic, 16:9, no text, no letters, no watermark, no logo.",
  ]
    .filter(Boolean)
    .join(" ");
}

const NO_TEXT = " No text, no letters, no typography, no watermark, no logo.";

/**
 * يستخرج الوصف البصري الذي كتبه الموظف داخل مخرجه (كتلة كود إنجليزية، أو سطر
 * بعد «وصف الصورة»/«Image prompt»/«برومبت») ليُولَّد منه فعلياً بدل وصف عام.
 */
export function extractImagePrompt(markdown: string): string | null {
  const candidates: string[] = [];
  // 1) كتل كود تحتوي نصاً إنجليزياً طويلاً
  for (const m of markdown.matchAll(/```[a-z]*\n([\s\S]*?)```/gi)) {
    const body = (m[1] ?? "").trim();
    if (
      body.length > 40 &&
      /[a-z]{4,}/i.test(body) &&
      !/[\u0600-\u06FF]{3,}/.test(body.slice(0, 80))
    )
      candidates.push(body);
  }
  // 2) سطر بعد عنوان/تسمية الوصف
  const label =
    /(?:image\s*prompt|prompt|وصف الصورة|برومبت الصورة|برومبت|الوصف البصري)\s*[:：\-–]?\s*\**\s*\n?\s*([^\n]{40,900})/gi;
  for (const m of markdown.matchAll(label)) {
    const line = (m[1] ?? "").replace(/^[*_`"“]+|[*_`"”]+$/g, "").trim();
    if (/[a-z]{4,}/i.test(line)) candidates.push(line);
  }
  // 3) اقتباس إنجليزي طويل بين علامتي تنصيص
  for (const m of markdown.matchAll(/["“]([A-Za-z][^"”\n]{60,700})["”]/g))
    candidates.push((m[1] ?? "").trim());

  const best = candidates
    .map((c) => c.replace(/\s+/g, " ").trim())
    .filter((c) => c.length >= 40)
    .sort((a, b) => b.length - a.length)[0];
  if (!best) return null;
  const clean = best
    .replace(/[\u0600-\u06FF]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
  return clean.length >= 30 ? clean + NO_TEXT : null;
}

/**
 * يحذف كتلة الوصف البصري من المخرج بعد استخدامها في توليد الصورة،
 * فلا يرى المالك برومبتاً إنجليزياً داخل نص عربي.
 */
export function stripImagePrompt(markdown: string): string {
  return markdown
    .replace(
      /^[ \t]*[*_#> \t]*(?:image[ \t]*prompt|prompt|وصف الصورة|برومبت الصورة|برومبت|الوصف البصري)[ \t]*[:：\-–]?[ \t*]*([^\n]*)(?:\n[ \t]*```[^\n]*\n([\s\S]*?)```|\n([A-Za-z][^\n]{40,900}))?/gim,
      (match, inline: string, block: string | undefined, next: string | undefined) =>
        /[a-z]{4,}/i.test([inline, block, next].filter(Boolean).join(" ")) ? "" : match,
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * صورة رئيسية «مملوكة»: نولّدها ثم نرفعها إلى مخزن Supabase (nour-media) باسم مساحة العمل،
 * فتصبح أصلاً دائماً يخصّ العميل لا رابطاً خارجياً. عند أي فشل نرجع لرابط المزوّد المجاني.
 */
/**
 * يتحقق أن الرابط يعرض صورة فعلاً قبل إرجاعه — رابط مزوّد خارجي قد لا يُحمَّل
 * في متصفح المستخدم فتظهر صورة مكسورة ثم تُحذف من المنشور.
 */
async function usableImageUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return false;
      const type = res.headers.get("content-type") ?? "";
      return type.startsWith("image/");
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

/**
 * يعيد رابط صورة صالحاً للعرض والنشر، أو نصاً فارغاً إن تعذّر توليدها —
 * لا نُرجع رابطاً غير مُتحقَّق منه حتى لا يظهر للمستخدم مربع صورة مكسور.
 */
export async function ownedHeroImage(
  client: {
    storage: {
      from: (b: string) => {
        upload: (p: string, f: Blob, o?: Record<string, unknown>) => Promise<{ error: unknown }>;
        createSignedUrl: (p: string, s: number) => Promise<{ data: { signedUrl: string } | null }>;
      };
    };
  },
  workspaceId: string,
  prompt: string,
  opts: ImageOptions = {},
): Promise<string> {
  try {
    const image = await generateImageBytes(prompt, opts);
    if (!image) {
      const fallback = imageUrl(prompt, opts);
      return (await usableImageUrl(fallback)) ? fallback : "";
    }

    const ext = image.contentType.includes("png") ? "png" : "jpg";
    const path = `${workspaceId}/hero/${crypto.randomUUID()}.${ext}`;
    const bucket = client.storage.from("nour-media");
    const { error } = await bucket.upload(
      path,
      new Blob([image.bytes as BlobPart], { type: image.contentType }),
      {
        contentType: image.contentType,
        upsert: false,
      },
    );
    // فشل الرفع لا يضيّع صورة وُلّدت فعلاً: نعيد رابط المصدر الذي تحقّقنا من تحميله.
    if (error) {
      console.error("[nour] hero image upload failed:", error);
      return image.url;
    }
    // رابط موقّع طويل الأمد (5 سنوات) صالح للنشر داخل المقال
    const { data } = await bucket.createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    return data?.signedUrl ?? image.url;
  } catch (error) {
    console.error("[nour] owned hero image failed:", error);
    return "";
  }
}
