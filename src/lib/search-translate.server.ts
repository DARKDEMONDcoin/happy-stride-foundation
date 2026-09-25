/**
 * مترجم كلمات البحث: يحوّل سؤال المستخدم العربي إلى أنسب لغة بحث للموضوع.
 *
 * لماذا؟ أغلب المعرفة العالمية (تصميم، تقنية، دراسات، معايير) مكتوبة بالإنجليزية،
 * فالبحث بالعربي فقط يعيد نتائج ضعيفة. لكن الموضوعات المحلية (أسعار مصر، أخبار
 * الأهلي، مطاعم الرياض) أقوى بالعربية — هنا نبقيها عربية.
 *
 * - نموذج واحد سريع (reasoning low) بمهلة انتظار قصيرة؛ ما يتأخر يُخزَّن للمرة القادمة.
 * - احتياطي فوري: معجمنا ثم ترجمة ويكيبيديا الموثّقة.
 * - ذاكرة ٢٤ ساعة: نفس الموضوع لا يُترجم مرتين.
 */
import { latinQuery } from "./query-translate";

export type SearchTranslation = {
  /** استعلام البحث بلغة الموضوع الأنسب ("" إن كان العربي هو الأنسب). */
  query: string;
  /** رمز اللغة: en غالباً، وقد تكون fr/de/ja… حين يكون الموضوع أصله بها. */
  lang: string;
  source: "ai" | "glossary" | "wikipedia" | "none";
};

const CACHE_TTL = 24 * 60 * 60_000;
const cache = new Map<string, { at: number; value: SearchTranslation }>();
const inflight = new Map<string, Promise<SearchTranslation | null>>();
const NONE: SearchTranslation = { query: "", lang: "ar", source: "none" };

const PROMPT = [
  "You convert an Arabic web-search request into the single best search query for finding high-quality results.",
  "Rules:",
  "- Usually output a concise English query (3-8 words) using the terms professionals actually search for.",
  "- If the topic is best covered in another language (e.g. French fashion house, Japanese anime), use that language.",
  "- If the topic is purely local to the Arab world (local prices, local news, local sports clubs, local shops, Arabic hashtags), output exactly: KEEP_ARABIC",
  "- Keep proper names correctly spelled. No quotes, no explanation.",
  "Output format: <lang-code>|<query>   e.g. en|logo design trends 2026   or   KEEP_ARABIC",
].join("\n");

async function aiTranslate(text: string, key: string): Promise<SearchTranslation | null> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      instructions: PROMPT,
      input: text,
      stream: true,
      store: false,
      reasoning: { effort: "low" },
    }),
  });
  if (!res.ok || !res.body) return null;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      try {
        const ev = JSON.parse(line.slice(5).trim()) as { type?: string; delta?: string };
        if (ev.type === "response.output_text.delta" && ev.delta) out += ev.delta;
      } catch {
        /* سطر غير مكتمل */
      }
    }
  }
  const line = out.trim().split("\n")[0]?.trim() ?? "";
  if (!line) return null;
  if (/KEEP_ARABIC/i.test(line)) return { query: "", lang: "ar", source: "ai" };
  const m = line.match(/^([a-z]{2})\s*\|\s*(.{2,120})$/i);
  const lang = (m?.[1] ?? "en").toLowerCase();
  const query = (m?.[2] ?? line).replace(/["«»]/g, "").trim().slice(0, 120);
  return query ? { query, lang, source: "ai" } : null;
}

/** يترجم استعلام البحث بسقف انتظار صارم؛ لا يرمي استثناءً أبداً. */
export async function translateSearch(text: string, waitMs = 3_500): Promise<SearchTranslation> {
  const q = (text ?? "").trim().slice(0, 160);
  if (q.length < 3 || !/[\u0600-\u06FF]/.test(q)) return NONE;
  const k = q.toLowerCase();
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.value;

  const apiKey = process.env["LOVABLE_API_KEY"];
  let job = inflight.get(k);
  if (!job && apiKey) {
    job = aiTranslate(q, apiKey)
      .catch(() => null)
      .then((v) => {
        if (v) cache.set(k, { at: Date.now(), value: v });
        inflight.delete(k);
        return v;
      });
    inflight.set(k, job);
  }
  const ai = job
    ? await Promise.race([job, new Promise<null>((r) => setTimeout(() => r(null), waitMs))])
    : null;
  if (ai) return ai;

  // احتياطي فوري بلا شبكة ثم ويكيبيديا.
  const g = latinQuery(q);
  if (g) return { query: g, lang: "en", source: "glossary" };
  const { bridgeToEnglish } = await import("./open-data-plus.server");
  const w = await bridgeToEnglish(q).catch(() => "");
  return w ? { query: w, lang: "en", source: "wikipedia" } : NONE;
}
