/**
 * جلب صور حقيقية من الإنترنت (لا توليد) — مصادر مجانية مفتوحة بلا مفتاح:
 * Openverse (صور مرخّصة بحرية)، Wikimedia Commons، صور أخبار Google (og:image).
 * تُستدعى كلها بالتوازي وبسقف زمني قصير، وكل صورة تُتحقق أنها صورة فعلاً.
 */
import { latinQuery } from "./query-translate";

export type WebImage = { url: string; title: string; source: string; page: string };

const UA = "SahlBot/1.0 (+https://happy-stride-foundation.lovable.app)";

/** «هات صورة من النت / صورة حقيقية / ابحث عن صورة» — جلب لا توليد. */
const WEB_IMAGE_RE =
  /(صور[ةه]?|صور)\s*(حقيقي[ةه]|فعلي[ةه]|أصلي[ةه]|اصلي[ةه])|(من|على|علي|ع)\s*(ال)?(نت|انترنت|إنترنت|جوجل|google|web|الويب)|(ابحث|دور|دوّر|شوف|لاقي|لاقيلي|جيب|جيبلي)\s*(لي\s*)?(عن\s*|على\s*)?(صور[ةه]?|صور)|real\s*(photo|image)|from\s*the\s*(web|internet)/iu;

export function wantsWebImage(message: string): boolean {
  return WEB_IMAGE_RE.test(message ?? "");
}

/** ينظّف الطلب إلى موضوع الصورة فقط. */
export function imageQuery(message: string): string {
  return (message ?? "")
    .replace(/[؟?!.,،]/g, " ")
    .replace(/(^|\s)يا\s+\S+/gu, " ")
    .replace(
      /(?<=^|\s)(?:هات(لي)?|جيب(لي)?|ابحث|دوّ?ر|عايز|عاوز|أريد|اريد|ابغى|لي|عن|على|علي|من|ال(نت|انترنت|إنترنت)|إنترنت|انترنت|النت|جوجل|google|صور[ةه]?|صور|حقيقي[ةه]|فعلي[ةه]|خاص[ةه]|بـ?اللي|انا|كاتب[هة]?|please|image|photo|of)(?=\s|$)/giu,
      " ",
    )
    .replace(/[؟?!.,،]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

async function getJson<T>(url: string, ms: number): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(ms),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function openverse(q: string, ms: number): Promise<WebImage[]> {
  const json = await getJson<{
    results?: { url?: string; title?: string; foreign_landing_url?: string; source?: string }[];
  }>(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=8&mature=false`, ms);
  return (json?.results ?? [])
    .filter((r) => r.url && /^https:/.test(r.url))
    .map((r) => ({
      url: r.url!,
      title: (r.title ?? q).slice(0, 120),
      source: `Openverse${r.source ? ` / ${r.source}` : ""}`,
      page: r.foreign_landing_url ?? r.url!,
    }));
}

async function commons(q: string, ms: number): Promise<WebImage[]> {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search" +
    `&gsrnamespace=6&gsrlimit=8&gsrsearch=${encodeURIComponent(q)}` +
    "&prop=imageinfo&iiprop=url|mime&iiurlwidth=1280";
  const json = await getJson<{
    query?: {
      pages?: Record<
        string,
        { title?: string; imageinfo?: { thumburl?: string; url?: string; mime?: string; descriptionurl?: string }[] }
      >;
    };
  }>(url, ms);
  return Object.values(json?.query?.pages ?? {})
    .map((p) => ({ p, info: p.imageinfo?.[0] }))
    .filter(({ info }) => info && /image\/(jpeg|png|webp)/.test(info.mime ?? ""))
    .map(({ p, info }) => ({
      url: info!.thumburl ?? info!.url!,
      title: (p.title ?? q).replace(/^File:|\.\w+$/g, "").slice(0, 120),
      source: "Wikimedia Commons",
      page: info!.descriptionurl ?? info!.url!,
    }));
}

async function newsImages(q: string, ms: number): Promise<WebImage[]> {
  try {
    const { findEventImage } = await import("./command-image.server");
    const hit = await Promise.race([
      findEventImage(q),
      new Promise<null>((r) => setTimeout(() => r(null), ms)),
    ]);
    return hit ? [{ url: hit.url, title: hit.title, source: hit.source, page: hit.url }] : [];
  } catch {
    return [];
  }
}

async function isImage(url: string, ms = 5000): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": UA, Range: "bytes=0-1024" },
      signal: AbortSignal.timeout(ms),
    });
    return (res.ok || res.status === 206) && (res.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return false;
  }
}

/** ضمائر الإحالة: الموضوع مذكور في رسالة سابقة لا في هذه. */
const REFERENCE_RE =
  /(^|\s)(له|لها|ليه|ليها|لهم|عنه|عنها|ده|دي|دا|هذا|هذه|هذي|الموضوع|المنتج|الخبر|it|this|that)(?=\s|$)/iu;

/** يجلب حتى `max` صور حقيقية متحقَّق منها عن الموضوع، خلال ~٩ ثوانٍ. */
export async function webImageSearch(
  message: string,
  max = 4,
  previousMessage = "",
): Promise<WebImage[]> {
  let topic = imageQuery(message);
  const stripped = topic.replace(REFERENCE_RE, " ").replace(/\s+/g, " ").trim();
  if (previousMessage && (stripped.length < 3 || (REFERENCE_RE.test(topic) && stripped.length < 12))) {
    topic = `${stripped} ${imageQuery(previousMessage) || previousMessage.slice(0, 80)}`.trim();
  }
  topic = topic || message.slice(0, 80);
  const latin = latinQuery(topic);
  const en = latin && latin !== topic ? latin : topic;
  const lists = await Promise.all([
    /فوز|مبارا|خبر|أخبار|اخبار|حدث|اليوم|أمس|امس|news/i.test(message)
      ? newsImages(topic, 8000)
      : Promise.resolve([]),
    openverse(en, 6000),
    commons(en, 6000),
    en !== topic ? commons(topic, 6000) : Promise.resolve([]),
  ]);
  // تناوب بين المصادر حتى لا تأتي كل الصور من مصدر واحد.
  const merged: WebImage[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < 8; i++)
    for (const l of lists) {
      const it = l[i];
      if (it && !seen.has(it.url)) {
        seen.add(it.url);
        merged.push(it);
      }
    }
  const checks = await Promise.all(merged.slice(0, max * 2).map((m) => isImage(m.url)));
  return merged.slice(0, max * 2).filter((_, i) => checks[i]).slice(0, max);
}
