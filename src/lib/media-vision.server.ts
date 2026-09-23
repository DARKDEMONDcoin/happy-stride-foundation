/**
 * قراءة وسائط المستخدم: نمرّر الصور المرفقة إلى نموذج بصري ونعيد وصفاً نصياً موجزاً
 * لكل صورة، فيستطيع الموظف «رؤية» ما أرفقه المستخدم والبناء عليه بدل تجاهله.
 * الفيديو لا يُحلَّل بصرياً — نذكره بالرابط والاسم فقط.
 */

const LOVABLE = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GEMINI = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

const VISION_LOVABLE = "google/gemini-2.5-flash";
const VISION_GEMINI = "gemini-3.5-flash-lite";

type Attachment = {
  url: string;
  type: "image" | "video" | "file";
  alt?: string | undefined;
  mime?: string | undefined;
  size?: number | undefined;
};

type Part =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

async function callVision(
  endpoint: string,
  apiKey: string,
  model: string,
  parts: Part[],
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content:
            "أنت محلّل بصري. صِف كل صورة مرفقة بدقة وباختصار بالعربية: ما تحتويه، الأشخاص/المنتجات، أي نص مكتوب داخلها حرفياً، الألوان والجو العام. أعد سطراً لكل صورة يبدأ بـ «صورة N:».",
        },
        { role: "user", content: parts },
      ],
    }),
    signal: AbortSignal.timeout(35_000),
  });
  if (!res.ok) throw new Error(`${model}: ${res.status}`);
  const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error(`${model}: رد فارغ`);
  return content.trim();
}

const MAX_INLINE_BYTES = 6 * 1024 * 1024;

/**
 * النماذج البصرية لا تستطيع جلب الروابط الموقّعة أو المحمية بـ robots،
 * فنجلب البايتات بأنفسنا ونمرّرها كـ data URL.
 */
async function inlineImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SahlMediaReader/1.0)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_INLINE_BYTES) return null;
    const base64 = Buffer.from(buf).toString("base64");
    return `data:${type};base64,${base64}`;
  } catch {
    return null;
  }
}

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const TEXTUAL_MIME =
  /^(text\/|application\/(json|xml|x-?yaml|yaml|csv|javascript|x-javascript|sql|x-sh|x-httpd-php|rtf))/i;
const TEXTUAL_EXT =
  /\.(txt|md|markdown|csv|tsv|json|xml|ya?ml|html?|css|js|mjs|cjs|ts|tsx|jsx|py|rb|go|rs|java|php|c|h|cpp|sql|log|srt|vtt|ini|conf|env|sh)$/i;

/** يقرأ ملفاً واحداً ويعيد نصاً يفهمه الموظف — نص مباشر أو استخراج من PDF. */
async function readOneFile(
  file: Attachment,
  index: number,
  keys: { lovable?: string | undefined; gemini?: string | undefined },
): Promise<string> {
  const name = file.alt || `ملف ${index + 1}`;
  try {
    const res = await fetch(file.url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return `ملف ${index + 1} (${name}): تعذّر تحميله (${res.status}).`;
    const mime = (res.headers.get("content-type") || file.mime || "").split(";")[0]!.trim();
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_FILE_BYTES)
      return `ملف ${index + 1} (${name}): أكبر من الحد المسموح بالقراءة (٢٥ م.ب).`;

    if (TEXTUAL_MIME.test(mime) || TEXTUAL_EXT.test(name)) {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(buf).slice(0, 14_000);
      return `ملف ${index + 1} (${name} · ${mime || "نص"}) — محتواه الحقيقي:\n${text}`;
    }

    const base64 = Buffer.from(buf).toString("base64");
    const isPdf = mime === "application/pdf" || /\.pdf$/i.test(name);
    if (isPdf || mime.startsWith("image/")) {
      const parts: Part[] = [
        {
          type: "text",
          text: `اقرأ هذا الملف «${name}» بالكامل واستخرج محتواه المهم: العناوين، الأرقام، الجداول، والنص الحرفي المهم — بالعربية وباختصار منظّم.`,
        },
        isPdf
          ? {
              type: "file" as const,
              file: { filename: name, file_data: `data:application/pdf;base64,${base64}` },
            }
          : { type: "image_url" as const, image_url: { url: `data:${mime};base64,${base64}` } },
      ];
      let read = "";
      if (keys.lovable)
        read = await callVision(LOVABLE, keys.lovable, VISION_LOVABLE, parts).catch(() => "");
      if (!read && keys.gemini)
        read = await callVision(GEMINI, keys.gemini, VISION_GEMINI, parts).catch(() => "");
      if (read) return `ملف ${index + 1} (${name}) — ما استخرجناه منه:\n${read}`;
      return `ملف ${index + 1} (${name}): تعذّرت قراءة محتواه الآن.`;
    }

    return `ملف ${index + 1} (${name} · ${mime || "صيغة غير معروفة"} · ${Math.round(buf.byteLength / 1024)} ك.ب): صيغة لا تُقرأ نصياً مباشرة — اطلب من المستخدم نسخ محتواه أو إرساله PDF/نص إن احتجت تفاصيله.`;
  } catch (error) {
    console.warn(
      "[media-vision] file read failed:",
      error instanceof Error ? error.message : error,
    );
    return `ملف ${index + 1} (${name}): تعذّرت قراءته.`;
  }
}

/** وصف نصي لوسائط المستخدم وملفاته (حتى ١٠ عناصر). */
export async function describeUserMedia(attachments: Attachment[]): Promise<string> {
  const images = attachments.filter((a) => a.type === "image").slice(0, 10);
  const videos = attachments.filter((a) => a.type === "video").slice(0, 10);
  const files = attachments.filter((a) => a.type === "file").slice(0, 6);
  const videoNote = videos.length
    ? videos.map((v, i) => `فيديو ${i + 1}: ${v.alt || v.url}`).join(" · ")
    : "";

  let filesNote = "";
  if (files.length) {
    try {
      const { providerKeys } = await import("./provider-keys.server");
      const keys = await providerKeys();
      const read = await Promise.all(files.map((f, i) => readOneFile(f, i, keys)));
      filesNote = read.filter(Boolean).join("\n\n");
    } catch (error) {
      console.warn("[media-vision] files failed:", error instanceof Error ? error.message : error);
    }
  }

  if (!images.length) return [filesNote, videoNote].filter(Boolean).join(" · ");

  const inlined = (await Promise.all(images.map((a) => inlineImage(a.url)))).filter(
    (u): u is string => Boolean(u),
  );
  if (!inlined.length) return [filesNote, videoNote].filter(Boolean).join(" · ");

  const parts: Part[] = [
    {
      type: "text",
      text: `صِف هذه ${inlined.length} صورة/صور المرفقة من المستخدم، سطر لكل صورة.`,
    },
    ...inlined.map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];

  try {
    const { providerKeys } = await import("./provider-keys.server");
    const keys = await providerKeys();
    let described = "";
    if (keys.lovable) {
      described = await callVision(LOVABLE, keys.lovable, VISION_LOVABLE, parts).catch(() => "");
    }
    if (!described && keys.gemini) {
      described = await callVision(GEMINI, keys.gemini, VISION_GEMINI, parts).catch(() => "");
    }
    return [described, filesNote, videoNote].filter(Boolean).join(" · ");
  } catch (error) {
    console.warn("[media-vision] failed:", error instanceof Error ? error.message : error);
    return [filesNote, videoNote].filter(Boolean).join(" · ");
  }
}
