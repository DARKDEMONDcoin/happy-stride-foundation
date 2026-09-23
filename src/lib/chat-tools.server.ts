/**
 * «أدوات الشات»: عندما يطلب المستخدم في المحادثة شيئاً موجوداً في أقسام المنصة
 * (فحص سيو لصفحة، ترتيب كلمة على جوجل، تقويم محتوى، أفكار اليوم، التعلّم من الأداء)
 * ينفّذه الموظف فعلاً من الشات ويُدرج النتيجة الحقيقية في رده — لا وصفاً لما «يمكن» فعله.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export type ChatToolResult = {
  /** كتلة تُحقن في system prompt كأدلة حقيقية. */
  block: string;
  /** سطر يُلحق بالرد يوجّه المستخدم إلى القسم. */
  footer: string;
  /** اسم الأداة (للسجل). */
  tool: string;
};

const URL_RE =
  /https?:\/\/[^\s)»"']+|(?:^|\s)((?:[a-z0-9-]+\.)+(?:com|net|org|sa|ae|eg|kw|qa|om|bh|jo|ma|dz|tn|ly|iq|ye|sd|lb|ps|sy|ps|co|io|me|shop|store))(?:\/\S*)?/i;

function urlIn(text: string, fallback?: string | null): string | null {
  const m = URL_RE.exec(text);
  if (m) {
    const raw = (m[0] ?? m[1] ?? "").trim();
    return raw.startsWith("http") ? raw : `https://${raw}`;
  }
  return fallback ?? null;
}

function hostOf(u: string | null): string | null {
  if (!u) return null;
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** يستخرج الكلمة المفتاحية من صيغ مثل: ترتيب «كذا» / ترتيبي على كلمة كذا / rank for "x". */
function keywordIn(text: string): string | null {
  const quoted = /[«"“']([^»"”']{2,60})[»"”']/.exec(text);
  if (quoted?.[1]) return quoted[1].trim();
  const m =
    /(?:كلمة|كلمه|لكلمة|keyword|rank for)\s*[:：]?\s*(.{2,60}?)(?:\s+(?:في|على|علي|ب|بجوجل|on)\b|[؟?.!\n]|$)/i.exec(
      text,
    );
  return m?.[1]?.trim() ?? null;
}

function daysIn(text: string): number {
  if (/شهر|30\s*يوم|٣٠/.test(text)) return 30;
  if (/أسبوعين|اسبوعين|14\s*يوم|١٤/.test(text)) return 14;
  return 7;
}

/** كل النطاقات المذكورة في الرسالة (لفصل موقع المستخدم عن منافسيه). */
function domainsIn(text: string): string[] {
  const re = /(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/\S*)?/gi;
  const out: string[] = [];
  for (const m of text.matchAll(re)) {
    const d = (m[1] ?? "").toLowerCase().replace(/^www\./, "");
    if (d && !out.includes(d)) out.push(d);
  }
  return out;
}

const STOP =
  /^(عايز|عاوز|أريد|اريد|من|في|على|علي|إلى|الى|عن|مع|هذا|هذه|ذلك|اللي|الذي|التي|كل|كام|إيه|ايه|ازاي|إزاي|كيف|ليه|لماذا|هو|هي|أنا|انا|لي|لك|موقعي|موقع|خلال|يوم|شهر|سنة|جوجل|google|seo|سيو|خطة|واكتبلي|اكتبلي|هات|شوف|افحص|قارني|قارن|حدد|بحث|و|أو|او|ثم)$/i;

const COUNTRY_WORD: Record<string, string> = {
  EG: "مصر",
  SA: "السعودية",
  AE: "الإمارات",
  KW: "الكويت",
  QA: "قطر",
  OM: "عمان",
  BH: "البحرين",
  JO: "الأردن",
  MA: "المغرب",
  DZ: "الجزائر",
  TN: "تونس",
  IQ: "العراق",
};
function countryWord(code?: string | null): string {
  return code ? (COUNTRY_WORD[code.toUpperCase()] ?? "") : "";
}

/** بذرة بحث بشرية من نص الرسالة (لا اسم النطاق) — لأن اقتراحات جوجل لا تفهم النطاقات. */
function topicSeed(text: string): string | null {
  const cleaned = text
    .replace(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/gi, " ")
    .replace(/[«»"“”'(),.:؛;!؟?\-–—|]/g, " ");
  const words = cleaned
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP.test(w) && !/^\d+$/.test(w));
  if (words.length < 2) return null;
  return words.slice(0, 5).join(" ");
}

const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** إزاحة منطقة زمنية بالدقائق مقارنةً بـUTC الآن. */
function tzOffsetMinutes(timeZone: string): number {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(now);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const asUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );
    return Math.round((asUtc - now.getTime()) / 60_000);
  } catch {
    return 180;
  }
}

export async function runChatTools(
  admin: Admin,
  params: {
    workspaceId: string;
    employeeId: string;
    message: string;
    website?: string | null;
    country?: string | null;
    connected: string[];
    /** المنصات التي طلبها المستخدم صراحةً. */
    targets: string[];
    /** مجال النشاط واسم العلامة — أدق بذرة بحث من اسم النطاق. */
    industry?: string | null;
    brand?: string | null;
  },
): Promise<ChatToolResult[]> {
  const text = params.message;
  const out: ChatToolResult[] = [];
  const t0 = Date.now();
  const budget = 25_000;
  const left = () => budget - (Date.now() - t0);

  // ---------- نور (SEO) ----------
  if (params.employeeId === "nour") {
    const ownHost = hostOf(urlIn("", params.website));
    const rivalHosts = domainsIn(text)
      .filter((d) => d !== ownHost)
      .slice(0, 2);
    const explicitUrl = urlIn(text, null);
    const url =
      explicitUrl && hostOf(explicitUrl) === ownHost
        ? explicitUrl
        : (params.website ?? explicitUrl);
    // ترتيب ذكي للبذرة: كلمة صريحة من المستخدم ← نشاط العلامة وسوقها ← نص الرسالة ← النطاق.
    const marketWord = countryWord(params.country);
    const topic =
      keywordIn(text) ??
      (params.industry ? `${params.industry}${marketWord ? ` ${marketWord}` : ""}` : null) ??
      topicSeed(text) ??
      ownHost;

    /** طلب استراتيجي شامل: نشغّل كل الأدوات معاً بدل انتظار أن يطلبها المستخدم واحدة واحدة. */
    const bigAsk =
      /خطة|استراتيجية|أتصدر|اتصدر|تصدر|أهيمن|شامل|كل ?شي|من الصفر|٩٠|90 ?يوم|روتين|أزيد الزيارات|زيادة الزيارات/i.test(
        text,
      );

    const wantsAudit =
      bigAsk ||
      /فحص|افحص|تدقيق|audit|مشاكل (السيو|الصفحة)|سرعة الموقع|تحليل (الموقع|الصفحة|صفحة)/i.test(
        text,
      );
    const wantsRank = /ترتيب|رانك|rank|موقعي في جوجل|الصفحة الأولى|أي صفحة/i.test(text);
    const wantsKeywords =
      bigAsk ||
      /كلمات? مفتاحية|كلمات بحث|بحث كلمات|أفكار كلمات|keyword|الناس بتدور|الناس يبحثون|استعلامات/i.test(
        text,
      );
    const wantsBrief =
      /موجز محتوى|خطة مقال|أكتب مقال|اكتب مقال|اكتبلي|كيف أتفوق|هيكل مقال|outline|content brief|ماذا يحتوي المقال/i.test(
        text,
      );
    const wantsCompetitor =
      bigAsk ||
      rivalHosts.length > 0 ||
      /منافس|المنافسين|competitor|من يتفوق علي|قارن موقعي/i.test(text);
    const wantsGsc =
      bigAsk ||
      /سيرش كونسول|search console|أداء (الموقع|السيو|الصفحات)|نقرات|ظهور|impressions|أكثر (الكلمات|الصفحات)|بياناتي في جوجل|تآكل|تتآكل|تتنافس|cannibal/i.test(
        text,
      );

    const kw = keywordIn(text);
    const domain = hostOf(urlIn(text, params.website));
    const jobs: Promise<ChatToolResult | null>[] = [];

    if (wantsAudit && url) {
      jobs.push(
        (async () => {
          try {
            const { auditPage } = await import("./seo-audit.server");
            const a = await auditPage(url);
            const fails = a.checks.filter((c) => c.status !== "pass").slice(0, 10);
            return {
              tool: "seo-audit",
              block: [
                `### نتيجة فحص سيو حقيقي للصفحة ${a.finalUrl} (نُفّذ الآن)`,
                `الدرجة: ${a.score}/100 · زمن الاستجابة: ${a.fetchedMs}ms · العنوان: «${a.page.title || "—"}» (${a.page.title.length} حرف) · الوصف: ${a.page.description ? `${a.page.description.length} حرف` : "مفقود"} · H1: ${a.page.h1.length} · الكلمات: ${a.page.wordCount} · صور بلا alt: ${a.page.imagesMissingAlt}/${a.page.images} · اللغة: ${a.page.lang || "—"}`,
                ...fails.map(
                  (c) =>
                    `- [${c.status === "fail" ? "خطأ" : "تحذير"}] ${c.label}: ${c.detail}${c.fix ? ` → الحل: ${c.fix}` : ""}`,
                ),
                "اعرض هذه النتائج للمستخدم كما هي (أرقام حقيقية) مرتبة حسب الأثر، مع خطوات إصلاح عملية.",
              ].join("\n"),
              footer: "التقرير الكامل بالـ16 فحصاً في قسم «التقارير».",
            };
          } catch (e) {
            return {
              tool: "seo-audit",
              block: `تعذّر الوصول إلى ${url}: ${e instanceof Error ? e.message : "خطأ"} — أخبر المستخدم بصراحة أن الموقع لم يستجب، واطلب الرابط الصحيح، وأكمل باقي التحليل بما توفّر.`,
              footer: "",
            };
          }
        })(),
      );
    }

    if (wantsRank && kw && domain) {
      jobs.push(
        (async () => {
          try {
            const { checkRank } = await import("./rank-check.server");
            const r = await checkRank({
              workspaceId: params.workspaceId,
              keyword: kw,
              domain,
              market: (params.country ?? "EG").toUpperCase(),
              gscConnected: params.connected.includes("search-console"),
            });
            return {
              tool: "rank-check",
              block: [
                `### ترتيب حقيقي لكلمة «${kw}» للنطاق ${domain} (المصدر: ${r.source})`,
                r.position
                  ? `الموقع يظهر في المركز ${r.position}${r.url ? ` عبر ${r.url}` : ""}.`
                  : "الموقع لا يظهر في أول 100 نتيجة لهذه الكلمة.",
                r.clicks !== undefined
                  ? `نقرات: ${r.clicks} · ظهور: ${r.impressions ?? 0} (Search Console)`
                  : "",
                r.competitors.length
                  ? `من يتصدّر: ${r.competitors.map((c) => `#${c.position} ${c.host}`).join("، ")}`
                  : "",
                r.note ?? "",
                "لا تخترع أرقاماً أخرى؛ ابنِ التوصيات على هذه النتيجة فقط.",
              ]
                .filter(Boolean)
                .join("\n"),
              footer: "تابع هذه الكلمة أسبوعياً من قسم «الترتيب».",
            };
          } catch (e) {
            return {
              tool: "rank-check",
              block: `تعذّر فحص الترتيب: ${e instanceof Error ? e.message : "خطأ"}.`,
              footer: "",
            };
          }
        })(),
      );
    }

    if (wantsKeywords && topic) {
      jobs.push(
        (async () => {
          try {
            const { keywordExpansion, keywordMetrics, withBudget } =
              await import("./seo-research.server");
            const [exp, metric] = await Promise.all([
              withBudget(keywordExpansion(topic), 18_000, null as never),
              withBudget(keywordMetrics(topic), 18_000, null as never),
            ]);
            const groups = exp
              ? Object.entries(exp as unknown as Record<string, unknown>)
                  .filter(([, v]) => Array.isArray(v) && (v as unknown[]).length)
                  .slice(0, 6)
                  .map(([k, v]) => `- ${k}: ${(v as string[]).slice(0, 12).join("، ")}`)
              : [];
            const empty = !groups.length && (!metric || metric.demandScore === 0);
            return {
              tool: "keyword-research",
              block: empty
                ? `### بحث كلمات لـ«${topic}»: لم تُرجع محركات البحث اقتراحات كافية لهذه البذرة. اطلب من المستخدم جملة يبحث بها عميله فعلاً (خدمة + مدينة)، ولا تخترع أرقاماً.`
                : [
                    `### بحث كلمات حقيقي لـ«${topic}» (اقتراحات جوجل وبينج الحيّة — نُفّذ الآن)`,
                    metric
                      ? `مؤشر الطلب: ${metric.demandScore}/100 · عمق الاقتراحات: ${metric.suggestionDepth} · الصعوبة: ${metric.difficultyScore ?? "غير متاح"} · المتصدرون: ${metric.topDomains.slice(0, 6).join("، ") || "—"}`
                      : "",
                    ...groups,
                    "رتّب الكلمات حسب نية البحث (معلوماتية/تجارية/شرائية) واقترح صفحة مستهدفة لكل مجموعة. لا تخترع أحجام بحث.",
                  ]
                    .filter(Boolean)
                    .join("\n"),
              footer: "تابع أي كلمة أسبوعياً من قسم «الترتيب».",
            };
          } catch (e) {
            return {
              tool: "keyword-research",
              block: `تعذّر بحث الكلمات: ${e instanceof Error ? e.message : "خطأ"}.`,
              footer: "",
            };
          }
        })(),
      );
    }

    if (wantsBrief && (kw ?? topic)) {
      jobs.push(
        (async () => {
          try {
            const { contentBrief, withBudget } = await import("./seo-research.server");
            const b = await withBudget(
              contentBrief((kw ?? topic)!, params.website ?? undefined),
              22_000,
              null as never,
            );
            if (!b || !b.analyzed) return null;
            return {
              tool: "content-brief",
              block: [
                `### موجز محتوى حقيقي لـ«${b.query}» (حُلّل ${b.analyzed} من المتصدرين الآن)`,
                `متوسط الطول: ${b.medianWordCount} كلمة · الطول المستهدف: ${b.targetWordCount} كلمة · تغطية البيانات المنظمة: ${b.schemaCoverage}%`,
                b.headingIdeas.length
                  ? `عناوين فرعية متكررة: ${b.headingIdeas.slice(0, 12).join(" | ")}`
                  : "",
                b.commonTerms.length
                  ? `مصطلحات لازمة: ${b.commonTerms
                      .slice(0, 15)
                      .map((t) => t.term)
                      .join("، ")}`
                  : "",
                b.entityGaps.length
                  ? `فجوات لا يغطيها المنافسون: ${b.entityGaps.slice(0, 10).join("، ")}`
                  : "",
                b.competitors
                  .map((c) => `- ${c.title} (${c.words} كلمة · ${c.h2} عنوان) ${c.url}`)
                  .join("\n"),
                "ابنِ الهيكل على هذه الأرقام الحقيقية، ثم اكتب المقال كاملاً إن طلبه المستخدم.",
              ]
                .filter(Boolean)
                .join("\n"),
              footer: "",
            };
          } catch {
            return null;
          }
        })(),
      );
    }

    if (wantsCompetitor) {
      // نقارن موقع المستخدم بمنافسيه الذين ذكرهم بالاسم — لا نخلط بينهما.
      const targets = [...new Set([...(ownHost ? [ownHost] : []), ...rivalHosts])].slice(0, 3);
      for (const target of targets) {
        jobs.push(
          (async () => {
            try {
              const { competitorInventory, serpSearch, withBudget } =
                await import("./seo-research.server");
              const inv = await withBudget(competitorInventory(target), 18_000, null as never);
              const serp = kw ? await withBudget(serpSearch(kw), 12_000, []) : [];
              const mine = target === ownHost;
              return {
                tool: `inventory:${target}`,
                block: [
                  `### جرد حقيقي لـ${target} ${mine ? "(موقع المستخدم)" : "(منافس)"} — من robots.txt وخرائط الموقع`,
                  inv
                    ? `عدد الروابط المكتشفة: ${inv.urlCount} · خرائط: ${inv.sitemaps.slice(0, 3).join("، ") || "—"}`
                    : "لم نستطع قراءة خرائط الموقع.",
                  inv?.topics.length ? `أبرز المحاور: ${inv.topics.slice(0, 15).join("، ")}` : "",
                  inv?.samples.length
                    ? inv.samples
                        .slice(0, 10)
                        .map((s) => `- ${s.slug}`)
                        .join("\n")
                    : "",
                  serp.length
                    ? `المتصدرون للاستعلام: ${serp
                        .slice(0, 8)
                        .map((r) => `#${r.rank} ${r.url}`)
                        .join(" | ")}`
                    : "",
                  mine
                    ? "استخدم هذا كخط أساس لموقع المستخدم."
                    : "قارن هذا الجرد بجرد موقع المستخدم، واستخرج فجوات المحتوى الفعلية واقترح صفحات محددة نكسب بها.",
                ]
                  .filter(Boolean)
                  .join("\n"),
                footer: "",
              };
            } catch {
              return null;
            }
          })(),
        );
      }
    }

    if (wantsGsc) {
      jobs.push(
        (async () => {
          try {
            const { gscSnapshotDetailed } = await import("./gsc.functions");
            const g = await gscSnapshotDetailed(params.workspaceId, 28);
            return {
              tool: "gsc",
              block: g.snapshot
                ? [
                    `### أداء حقيقي من Search Console (${g.snapshot.site} · ${g.snapshot.range.start} → ${g.snapshot.range.end})`,
                    `أكثر الكلمات: ${g.snapshot.queries
                      .slice(0, 10)
                      .map(
                        (q) =>
                          `${q.key} (${q.clicks} نقرة · ${q.impressions} ظهور · مركز ${q.position.toFixed(1)})`,
                      )
                      .join(" | ")}`,
                    `أكثر الصفحات: ${g.snapshot.pages
                      .slice(0, 8)
                      .map((p) => `${p.key} (${p.clicks} نقرة)`)
                      .join(" | ")}`,
                    "ابنِ توصياتك على هذه الأرقام فقط.",
                  ].join("\n")
                : `Search Console: ${g.status.message} — أخبر المستخدم بصراحة، واعرض عليه ربطه الآن بضغطة من «الترتيب» أو «التقارير»، ثم أكمل الخطة بما هو متاح بدون بيانات جوجل.`,
              footer: g.snapshot ? "التفاصيل الكاملة في «التقارير»." : "",
            };
          } catch (e) {
            return {
              tool: "gsc",
              block: `تعذّر جلب بيانات Search Console: ${e instanceof Error ? e.message : "خطأ"}.`,
              footer: "",
            };
          }
        })(),
      );

      // فرص مخفية: حافة الصفحة الأولى، ضعف النقر، وتآكل الصفحات.
      jobs.push(
        (async () => {
          try {
            const { gscOpportunities } = await import("./gsc.functions");
            const o = await gscOpportunities(params.workspaceId, 28);
            if (!o.data) return null;
            const d = o.data;
            if (!d.strikingDistance.length && !d.lowCtr.length && !d.cannibalization.length)
              return null;
            return {
              tool: "gsc-opportunities",
              block: [
                `### فرص محسوبة من Search Console (${d.site})`,
                d.strikingDistance.length
                  ? `على حافة الصفحة الأولى (مركز 8-20 — أسرع مكسب): ${d.strikingDistance.map((r) => `${r.key} (مركز ${r.position.toFixed(1)} · ${r.impressions} ظهور)`).join(" | ")}`
                  : "",
                d.lowCtr.length
                  ? `ترتيب جيد ونقر ضعيف (المشكلة في العنوان/الوصف): ${d.lowCtr.map((r) => `${r.key} (مركز ${r.position.toFixed(1)} · CTR ${(r.ctr * 100).toFixed(1)}%)`).join(" | ")}`
                  : "",
                d.cannibalization.length
                  ? `تآكل داخلي — أكثر من صفحة على نفس الاستعلام: ${d.cannibalization.map((c) => `${c.key} → ${c.pages.map((p) => p.url).join(" ، ")}`).join(" | ")}`
                  : "",
                "حوّل كل بند إلى إجراء محدد: إعادة كتابة عنوان، تقوية صفحة، دمج صفحتين متآكلتين مع تحويل 301.",
              ]
                .filter(Boolean)
                .join("\n"),
              footer: "",
            };
          } catch {
            return null;
          }
        })(),
      );
    }

    // زيارات الموقع الحقيقية من Google Analytics 4 (مربوط باسم analytics).
    const wantsTraffic =
      bigAsk ||
      /زيارات|زوار|ترافيك|traffic|جمهور|مصادر (الزيارات|الترافيك)|جلسات|analytics|تحليلات/i.test(
        text,
      );
    if (wantsTraffic) {
      jobs.push(
        (async () => {
          try {
            const { ga4SnapshotDetailed } = await import("./ga4.functions");
            const g = await ga4SnapshotDetailed(params.workspaceId, 28);
            if (!g.snapshot) {
              if (!params.connected.includes("analytics")) return null;
              return {
                tool: "ga4",
                block: `Google Analytics: ${g.status.message} — أخبر المستخدم بذلك بجملة واحدة وأكمل التحليل بما هو متاح.`,
                footer: "",
              };
            }
            const s = g.snapshot;
            return {
              tool: "ga4",
              block: [
                `### زيارات حقيقية من Google Analytics 4 (${s.range.start} → ${s.range.end})`,
                `الجلسات: ${s.totals.sessions} · المستخدمون: ${s.totals.users} · الجلسات المتفاعلة: ${s.totals.engagedSessions}`,
                s.channels.length
                  ? `مصادر الزيارات: ${s.channels.map((c) => `${c.channel} (${c.sessions})`).join(" | ")}`
                  : "",
                s.organicLandingPages.length
                  ? `أفضل صفحات الدخول من البحث: ${s.organicLandingPages
                      .slice(0, 8)
                      .map((p) => `${p.page} (${p.sessions})`)
                      .join(" | ")}`
                  : "",
                "اربط هذه الأرقام بتوصياتك: أي قناة تنمو، وأي صفحة تستحق التقوية. لا تخترع أرقاماً أخرى.",
              ]
                .filter(Boolean)
                .join("\n"),
              footer: "لوحة الزيارات الكاملة في «التقارير».",
            };
          } catch {
            return null;
          }
        })(),
      );
    }

    // كل أدوات نور تعمل بالتوازي داخل سقف زمني واحد — لا تُلغى أداة لأن سابقتها تأخّرت.
    // السقف حدّ أقصى لا أرضية: نأخذ المتبقي من الميزانية، بحد أدنى 5ث وحد أقصى 25ث.
    const raceCapMs = Math.min(Math.max(left(), 5_000), 25_000);
    const settled = await Promise.race([
      Promise.all(jobs),
      new Promise<(ChatToolResult | null)[]>((resolve) => setTimeout(() => resolve([]), raceCapMs)),
    ]);

    for (const r of settled) if (r) out.push(r);
  }

  // ---------- سِراج (سوشيال) ----------
  if (params.employeeId === "sonny") {
    const wantsCalendar =
      /تقويم|خطة (محتوى|منشورات|أسبوع|شهر)|جدول (منشورات|محتوى)|كالندر|calendar|محتوى (أسبوع|شهر)/i.test(
        text,
      );
    if (wantsCalendar && left() > 15_000) {
      const providers = params.targets.length
        ? params.targets
        : params.connected.filter((p) =>
            ["instagram", "facebook", "linkedin", "x", "pinterest", "youtube"].includes(p),
          );
      const prov = providers.length ? providers : ["instagram"];
      try {
        const { planCalendar } = await import("./content-calendar.server");
        const { data: ws } = await admin
          .from("workspaces")
          .select("timezone")
          .eq("id", params.workspaceId)
          .maybeSingle();
        const days = daysIn(text);
        const r = await planCalendar(admin, {
          workspaceId: params.workspaceId,
          days,
          perDay: 1,
          providers: prov,
          topic: text.slice(0, 200),
          timezone: (ws as { timezone?: string } | null)?.timezone ?? "Africa/Cairo",
        });
        const { data: items } = await admin
          .from("social_posts")
          .select("scheduled_at, provider, meta")
          .eq("workspace_id", params.workspaceId)
          .contains("meta", { batch: r.batch })
          .order("scheduled_at", { ascending: true })
          .limit(45);
        out.push({
          tool: "calendar-plan",
          block: [
            `### أنشأتَ فعلاً تقويم محتوى لـ${days} يوماً (${r.created} فكرة) في قسم «التقويم» — هذه هي الأفكار:`,
            ...(items ?? []).map((p) => {
              const m = (p.meta ?? {}) as { title?: string; hook?: string; goal?: string };
              return `- ${new Date(p.scheduled_at).toLocaleDateString("ar-EG", { weekday: "short", day: "numeric", month: "short" })} · ${p.provider}: ${m.title ?? ""} — ${m.hook ?? ""} (${m.goal ?? ""})`;
            }),
            "اعرضها للمستخدم كجدول، وأخبره أن كل فكرة جاهزة لتوليد النص والصورة والاعتماد والنشر من قسم التقويم بضغطة.",
          ].join("\n"),
          footer: "افتح «التقويم» لتوليد النصوص والصور واعتمادها ونشرها.",
        });
      } catch (e) {
        out.push({
          tool: "calendar-plan",
          block: `تعذّر إنشاء التقويم: ${e instanceof Error ? e.message : "خطأ"}.`,
          footer: "",
        });
      }
    }

    const wantsIdeas =
      /أفكار (اليوم|النهاردة|منشورات)|فكرة (منشور|بوست)|اقترح (منشور|بوست|أفكار)|انشر إيه|أنشر ماذا/i.test(
        text,
      );
    if (wantsIdeas && !wantsCalendar && left() > 12_000) {
      try {
        const { dailyIdeas } = await import("./content-calendar.server");
        const ideas = await dailyIdeas(admin, params.workspaceId);
        if (ideas.length) {
          out.push({
            tool: "daily-ideas",
            block: [
              "### أفكار اليوم (مولّدة الآن من ملف العلامة وأداء منشوراتها):",
              ...ideas.map((i, n) => `${n + 1}. [${i.provider}] ${i.title} — ${i.hook}`),
              "قدّمها للمستخدم واعرض كتابة أيٍّ منها كاملاً فوراً.",
            ].join("\n"),
            footer: "",
          });
        }
      } catch {
        /* لا شيء */
      }
    }

    const wantsLearning =
      /(إيه|ماذا|ايه|ما) (اللي|الذي) (نجح|اشتغل)|أداء (المنشورات|البوستات)|تعلم من|أفضل منشور|insights|الأكثر تفاعلاً/i.test(
        text,
      );
    if (wantsLearning && left() > 10_000) {
      try {
        const { learnFromPerformance } = await import("./content-calendar.server");
        const r = await learnFromPerformance(admin, params.workspaceId);
        out.push({
          tool: "performance",
          block: [
            `### تحليل أداء حقيقي (${r.source === "live" ? "من إنستجرام/فيسبوك مباشرة" : r.source === "internal" ? "من سجل منشوراتنا" : "لا توجد بيانات كافية بعد"}) — ${r.analyzed} منشور:`,
            r.summary,
            r.source === "none"
              ? "أخبر المستخدم بصراحة أنه لا توجد بيانات أداء بعد، واقترح ربط إنستجرام/فيسبوك أو النشر لأسبوع أولاً."
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
          footer: "",
        });
      } catch {
        /* لا شيء */
      }
    }

    // أفضل وقت نشر محسوب من جمهور الحساب المربوط أو من سجل النشر.
    const wantsBestTime = /أفضل (وقت|توقيت|ميعاد)|امتى أنشر|إمتى أنشر|متى أنشر|best time/i.test(
      text,
    );
    if (wantsBestTime && left() > 10_000) {
      try {
        const { computeBestTimes } = await import("./best-time.server");
        const { data: ws } = await admin
          .from("workspaces")
          .select("timezone")
          .eq("id", params.workspaceId)
          .maybeSingle();
        const tz = (ws as { timezone?: string } | null)?.timezone ?? "Africa/Cairo";
        const offsetMin = tzOffsetMinutes(tz);
        const prov =
          params.targets[0] ??
          params.connected.find((p) => ["instagram", "facebook", "linkedin", "x"].includes(p)) ??
          "instagram";
        const r = await computeBestTimes(admin, params.workspaceId, prov, offsetMin);
        out.push({
          tool: "best-time",
          block: [
            `### أفضل مواعيد نشر حقيقية على ${prov} (المصدر: ${r.source === "audience" ? "ساعات تواجد متابعيك فعلياً" : r.source === "history" ? "سجل نشرك وتفاعله" : "قاعدة عامة — لا بيانات كافية بعد"} · ${r.samples} عينة)`,
            ...r.slots.map(
              (s) =>
                `- ${WEEKDAYS[s.weekday] ?? ""} الساعة ${String(s.hour).padStart(2, "0")}:00 بتوقيت ${tz}`,
            ),
            r.note ?? "",
            "اقترح جدولة المنشور القادم في أول موعد منها بضغطة من «التقويم».",
          ]
            .filter(Boolean)
            .join("\n"),
          footer: "يمكن جدولة المنشور على هذه المواعيد من «التقويم».",
        });
      } catch {
        /* لا شيء */
      }
    }
  }

  // ---------- حالة التكاملات (للموظفين معاً) ----------
  if (/تكامل|التكاملات|مربوط|الربط|اربط|حساباتي|أي منصات|integrations?/i.test(text)) {
    const { employeeDirectory } = await import("./team-knowledge");
    const { providerLabel } = await import("./platforms");
    const mine =
      employeeDirectory[params.employeeId as keyof typeof employeeDirectory]?.integrations.map(
        (i) => i.provider,
      ) ?? [];
    const on = mine.filter((p) => params.connected.includes(p));
    const off = mine.filter((p) => !params.connected.includes(p));
    const others = params.connected.filter((p) => !mine.includes(p));
    out.push({
      tool: "integrations-status",
      block: [
        "### حالة تكاملاتك الحقيقية الآن",
        on.length
          ? `مربوط ويعمل ضمن اختصاصك: ${on.map(providerLabel).join("، ")}`
          : "لا توجد منصة مربوطة بعد ضمن اختصاصك.",
        off.length ? `غير مربوط: ${off.map(providerLabel).join("، ")}` : "",
        others.length
          ? `مربوط في مساحة العمل لدى زملائك (يمكنك الإحالة إليه لا ادّعاء استخدامه): ${others.map(providerLabel).join("، ")}`
          : "",
        "اذكر المربوط فقط كقدرات جاهزة الآن، واعرض ربط الناقص بضغطة من «التكاملات» دون إلحاح.",
      ]
        .filter(Boolean)
        .join("\n"),
      footer: "إدارة الربط من صفحة «التكاملات».",
    });
  }

  return out;
}
