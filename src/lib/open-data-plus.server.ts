/**
 * مصادر مفتوحة إضافية — الطبقة التي تجعل البحث العميق عميقاً فعلاً.
 *
 * ما يميّز هذه المجموعة عن الأولى (open-data.server):
 * - **بحث ويكيميديا العربي**: أول مصدر يفهم سؤالنا بالعربية كما هو، بلا ترجمة.
 *   كل ما سبق كان يحتاج مقابلاً إنجليزياً وإلا صمت.
 * - **Europe PMC**: مليونا بحث محكّم مفتوح — سلوك المستهلك والصحة والتغذية،
 *   وهي أساس أي ادعاء عن مطاعم أو منتجات.
 * - **dev.to و Lobsters و npm**: نبض الممارسين اليومي في الأدوات والتقنية،
 *   وهو ما يفوت الدراسات المحكّمة لأنها أبطأ بسنتين.
 * - **Open Library**: الكتب المرجعية حين يكون السؤال عن أصل منهج لا عن خبر.
 * - **Datamuse**: توسعة الاستعلام بمرادفات حقيقية بدل تخميننا لها.
 *
 * كلها بلا مفتاح وبلا اشتراك وبلا حد تعاقدي، وكلها تمر عبر طبقة أمان البحث.
 */
import type { Finding } from "./open-data.server";
import { safeJson } from "./research-safety.server";

/** واجهات موثّقة للاستخدام البرمجي: هوية بوت معرّفة ومهلة قصيرة. */
const API = { agent: "bot", skipRobots: true, ms: 8_000 } as const;

const clean = (s: string, max = 240): string =>
  (s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/**
 * بحث ويكيبيديا العربية الحقيقي (واجهة ويكيميديا الحديثة).
 * يبحث في نص المقالات لا في العناوين فقط، فيصلح لأسئلة عربية بلا مقابل إنجليزي.
 */
export async function wikimediaArabic(query: string, limit = 4): Promise<Finding[]> {
  if (!query.trim()) return [];
  const data = await safeJson<{
    pages?: { key?: string; title?: string; excerpt?: string; description?: string }[];
  }>(
    `https://api.wikimedia.org/core/v1/wikipedia/ar/search/page?q=${encodeURIComponent(query)}&limit=${limit}`,
    API,
  );
  return (data?.pages ?? [])
    .filter((p) => p.title && p.key)
    .map((p) => ({
      title: p.title!,
      url: `https://ar.wikipedia.org/wiki/${encodeURIComponent(p.key!)}`,
      snippet: clean(p.excerpt ?? p.description ?? ""),
      source: "ويكيبيديا",
    }));
}

/** أبحاث محكّمة مفتوحة الوصول — سلوك المستهلك والتغذية والصحة والإدارة. */
export async function europePmc(query: string, limit = 4): Promise<Finding[]> {
  if (!query.trim()) return [];
  const data = await safeJson<{
    resultList?: {
      result?: {
        title?: string;
        doi?: string;
        id?: string;
        pubYear?: string;
        journalTitle?: string;
        citedByCount?: number;
        abstractText?: string;
      }[];
    };
  }>(
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(
      query,
    )}&format=json&pageSize=${limit}&sort=CITED%20desc`,
    API,
  );
  return (data?.resultList?.result ?? [])
    .filter((r) => r.title)
    .map((r) => ({
      title: clean(r.title!, 180),
      url: r.doi ? `https://doi.org/${r.doi}` : `https://europepmc.org/article/MED/${r.id ?? ""}`,
      snippet: clean(
        r.abstractText ??
          `${r.journalTitle ?? "بحث محكّم"}${r.citedByCount ? ` — استُشهد به ${r.citedByCount} مرة` : ""}`,
      ),
      source: "Europe PMC",
      ...(r.pubYear ? { year: Number(r.pubYear) } : {}),
    }));
}

/** ما يكتبه الممارسون اليوم: أسرع من الأبحاث وأصدق من المدوّنات التسويقية. */
export async function devtoPosts(tagOrQuery: string, limit = 4): Promise<Finding[]> {
  const q = tagOrQuery.trim().toLowerCase().replace(/\s+/g, "");
  if (!q) return [];
  const data = await safeJson<
    { title?: string; url?: string; description?: string; published_at?: string; positive_reactions_count?: number }[]
  >(`https://dev.to/api/articles?tag=${encodeURIComponent(q)}&per_page=${limit}&top=365`, API);
  return (data ?? [])
    .filter((a) => a.title && a.url)
    .map((a) => ({
      title: clean(a.title!, 160),
      url: a.url!,
      snippet: clean(
        `${a.description ?? ""}${a.positive_reactions_count ? ` — ${a.positive_reactions_count} تفاعل` : ""}`,
      ),
      source: "dev.to",
      ...(a.published_at ? { year: Number(a.published_at.slice(0, 4)) } : {}),
    }));
}

/** مجتمع هندسي مرتفع الإشارة — نقاش عملي عن الأدوات والأداء. */
export async function lobstersHot(query: string, limit = 3): Promise<Finding[]> {
  const terms = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  if (!terms.length) return [];
  const data = await safeJson<{ title?: string; url?: string; comments_url?: string; score?: number; tags?: string[] }[]>(
    "https://lobste.rs/hottest.json",
    API,
  );
  return (data ?? [])
    .filter((s) => s.title && terms.some((t) => `${s.title} ${(s.tags ?? []).join(" ")}`.toLowerCase().includes(t)))
    .slice(0, limit)
    .map((s) => ({
      title: clean(s.title!, 160),
      url: s.url || s.comments_url || "https://lobste.rs",
      snippet: `نقاش هندسي${s.score ? ` بتقييم ${s.score}` : ""}`,
      source: "Lobsters",
    }));
}

/** أدوات مفتوحة المصدر جاهزة للاستخدام — بديل مجاني لأي أداة مدفوعة يسأل عنها المستخدم. */
export async function npmPackages(query: string, limit = 4): Promise<Finding[]> {
  if (!query.trim()) return [];
  const data = await safeJson<{
    objects?: { package?: { name?: string; description?: string; links?: { npm?: string } }; score?: { final?: number } }[];
  }>(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${limit}`, API);
  return (data?.objects ?? [])
    .filter((o) => o.package?.name)
    .map((o) => ({
      title: `${o.package!.name} — مكتبة مفتوحة`,
      url: o.package!.links?.npm ?? `https://www.npmjs.com/package/${o.package!.name}`,
      snippet: clean(o.package!.description ?? ""),
      source: "npm",
    }));
}

/** كتب مرجعية: حين يكون السؤال عن منهج راسخ لا عن رقم هذا العام. */
export async function openLibraryBooks(query: string, limit = 3): Promise<Finding[]> {
  if (!query.trim()) return [];
  const data = await safeJson<{
    docs?: { title?: string; key?: string; first_publish_year?: number; author_name?: string[] }[];
  }>(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}&fields=title,key,first_publish_year,author_name`, API);
  return (data?.docs ?? [])
    .filter((d) => d.title && d.key)
    .map((d) => ({
      title: clean(d.title!, 160),
      url: `https://openlibrary.org${d.key}`,
      snippet: `كتاب${d.author_name?.[0] ? ` — ${d.author_name[0]}` : ""}`,
      source: "Open Library",
      ...(d.first_publish_year ? { year: d.first_publish_year } : {}),
    }));
}

/**
 * توسعة الاستعلام بمرادفات حقيقية يستخدمها الناس.
 * الفائدة: سؤال واحد يتحوّل إلى ثلاثة زوايا لغوية، فلا نفقد مصدراً
 * لأنه سمّى الشيء باسم آخر (pricing / rates / cost).
 */
export async function relatedTerms(englishQuery: string, limit = 6): Promise<string[]> {
  const q = englishQuery.trim();
  if (!q) return [];
  const data = await safeJson<{ word?: string; score?: number }[]>(
    `https://api.datamuse.com/words?ml=${encodeURIComponent(q)}&max=${limit * 2}`,
    API,
  );
  return (data ?? [])
    .map((w) => w.word ?? "")
    .filter((w) => w.length > 2)
    .slice(0, limit);
}

/**
 * جسر اللغة الحقيقي — ترجمة المصطلح العربي إلى مقابله الإنجليزي عبر ويكيبيديا.
 *
 * معجمنا اليدوي يغطي مصطلحات التسويق فقط، فسؤال مثل «أثر الألوان على قرار
 * الشراء» كان يصمت أمام كل المصادر العالمية لأنه بلا مقابل لاتيني. ويكيبيديا
 * تحل هذا مجاناً: نبحث المقال بالعربية، ثم نأخذ عنوان نسخته الإنجليزية —
 * وهي ترجمة بشرية موثّقة لا تخمين آلي.
 *
 * يعيد "" حين لا يجد مقابلاً: الصمت أصدق من مصطلح مخترع يجلب أدلة عن موضوع آخر.
 */
export async function bridgeToEnglish(arabic: string): Promise<string> {
  const q = (arabic ?? "").trim().slice(0, 80);
  if (!q || !/[\u0600-\u06FF]/.test(q)) return "";
  const norm = (s: string) =>
    s.replace(/[\u064B-\u0652\u0640]/g, "").replace(/[\u0623\u0625\u0622]/g, "\u0627").replace(/\s+/g, " ").trim();
  const haystack = norm(q);
  const words = haystack.split(" ").filter((w) => w.length > 2);

  /**
   * نجرّب العبارة كاملة ثم نقصّرها كلمةً كلمة. سبب التدرّج: فهرس ويكيبيديا
   * يعرف «سلوك المستهلك» ولا يعرف «سلوك المستهلك في المطاعم»، والمفهوم الأصلي
   * هو ما نريد ترجمته لا الجملة كما نطقها المستخدم.
   */
  const candidates = [...new Set([haystack, words.slice(0, 3).join(" "), words.slice(0, 2).join(" ")])]
    .filter((c) => c.length > 4)
    .slice(0, 3);

  for (const phrase of candidates) {
    const hit = await safeJson<{ pages?: { key?: string; title?: string }[] }>(
      `https://api.wikimedia.org/core/v1/wikipedia/ar/search/title?q=${encodeURIComponent(phrase)}&limit=3`,
      API,
    );
    /**
     * شرط القبول: عنوان المقال العربي مذكور داخل سؤالنا نفسه. بدونه يترجم
     * البحث مفهوماً مجاوراً لم يسأل عنه أحد («البصرة» لسؤال عن «هوية بصرية»)
     * فنجلب أدلة عن موضوع آخر — وهذا أسوأ من الصمت.
     */
    const title = (hit?.pages ?? [])
      .map((p) => p.title ?? p.key ?? "")
      .find((t) => t.length > 3 && haystack.includes(norm(t)));
    if (!title) continue;

    const links = await safeJson<{ title?: string; code?: string }[]>(
      `https://ar.wikipedia.org/w/rest.php/v1/page/${encodeURIComponent(title)}/links/language`,
      API,
    );
    const en = (links ?? []).find((l) => l.code === "en")?.title;
    if (en && /^[\w\s\-'&.]+$/.test(en)) return en.slice(0, 90);
  }
  return "";
}
