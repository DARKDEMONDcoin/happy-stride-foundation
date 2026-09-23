/**
 * احترام robots.txt — الحماية التي تمنع الحظر من أصله.
 *
 * طبقة أمان البحث تمنع الإلحاح بعد الرفض، وهذه الطبقة تمنع الطَرق على باب
 * صاحبه قال «لا» مسبقاً. قبل أي قراءة لصفحة موقع نقرأ robots.txt الخاص به،
 * نحترم Disallow ونحترم Crawl-delay إن وُجد. هذا ما يجعل زحفنا مقبولاً
 * عالمياً ولا يعرّضنا لحظر أبدي من أي مزوّد.
 *
 * ملاحظات:
 * - واجهات API الموثّقة (OpenAlex، Crossref…) لا تمر من هنا: استخدامها مصرّح به صراحةً.
 * - عند تعذّر قراءة robots.txt نسمح بالقراءة (كما يفعل معيار REP): غياب الملف إذن ضمني.
 * - القرار يُخزَّن 12 ساعة لكل نطاق فلا نثقل أحداً بطلب robots.txt المتكرر.
 */

type RobotsRules = {
  /** مسارات ممنوعة للوكيل المطابق. */
  disallow: string[];
  /** مسارات مسموحة صراحةً (تتغلّب على Disallow الأطول منها منطقياً). */
  allow: string[];
  /** مهلة الزحف المعلنة بالمللي ثانية، إن وُجدت. */
  crawlDelayMs: number | null;
};

type Entry = { at: number; rules: RobotsRules };

const TTL_MS = 12 * 60 * 60_000;
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<RobotsRules>>();

/** وكيلنا المعرَّف — نطابق عليه أولاً ثم على المجموعة العامة «*». */
const SELF_TOKEN = "sahlresearchbot";

const EMPTY: RobotsRules = { disallow: [], allow: [], crawlDelayMs: null };

/** يحلّل نص robots.txt ويستخرج المجموعة التي تخصّنا (أو المجموعة العامة). */
export function parseRobots(text: string): RobotsRules {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());

  // نجمع القواعد لكل وكيل. مجموعة واحدة قد تسبقها عدة أسطر User-agent.
  const groups: { agents: string[]; rules: RobotsRules }[] = [];
  let current: { agents: string[]; rules: RobotsRules } | null = null;
  let expectingAgents = false;

  for (const line of lines) {
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const field = m[1]!.toLowerCase();
    const value = (m[2] ?? "").trim();

    if (field === "user-agent") {
      if (!current || !expectingAgents) {
        current = { agents: [], rules: { disallow: [], allow: [], crawlDelayMs: null } };
        groups.push(current);
        expectingAgents = true;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }

    if (!current) continue;
    expectingAgents = false;

    if (field === "disallow" && value) current.rules.disallow.push(value);
    else if (field === "allow" && value) current.rules.allow.push(value);
    else if (field === "crawl-delay") {
      const n = Number(value.replace(",", "."));
      if (Number.isFinite(n) && n > 0) current.rules.crawlDelayMs = Math.min(n * 1000, 30_000);
    }
  }

  const mine = groups.find((g) => g.agents.some((a) => a.includes(SELF_TOKEN)));
  const star = groups.find((g) => g.agents.includes("*"));
  return mine?.rules ?? star?.rules ?? EMPTY;
}

/** مطابقة مسار بقواعد robots (تدعم * و$ كما في المعيار الموسّع). */
function matches(path: string, pattern: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const rx = new RegExp(
    "^" +
      body
        .split("*")
        .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*") +
      (anchored ? "$" : ""),
  );
  return rx.test(path);
}

async function rulesFor(origin: string): Promise<RobotsRules> {
  const hit = cache.get(origin);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rules;
  const running = inflight.get(origin);
  if (running) return running;

  const work = (async (): Promise<RobotsRules> => {
    try {
      // استيراد ديناميكي: طبقة الأمان تستدعي هذه الوحدة، فنتفادى دائرة استيراد.
      const { safeFetch } = await import("./research-safety.server");
      const res = await safeFetch(`${origin}/robots.txt`, {
        ms: 6_000,
        agent: "bot",
        cacheTtlMs: TTL_MS,
        maxChars: 120_000,
        skipRobots: true,
      });
      // لا ملف أو تعذّر الوصول ⇒ إذن ضمني بالقراءة (سلوك المعيار).
      const rules = res.ok && res.text ? parseRobots(res.text) : EMPTY;
      cache.set(origin, { at: Date.now(), rules });
      return rules;
    } catch {
      cache.set(origin, { at: Date.now(), rules: EMPTY });
      return EMPTY;
    } finally {
      inflight.delete(origin);
    }
  })();

  inflight.set(origin, work);
  return work;
}

export type RobotsDecision = { allowed: boolean; crawlDelayMs: number | null };

/**
 * هل يسمح لنا موقع هذا الرابط بقراءته؟ ومتى ينبغي أن نتمهّل بينه وبين التالي؟
 * لا يرمي استثناءً أبداً؛ عند أي شك يسمح بالقراءة كما ينص المعيار.
 */
export async function robotsDecision(url: string): Promise<RobotsDecision> {
  let origin: string;
  let path: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return { allowed: false, crawlDelayMs: null };
    origin = u.origin;
    path = u.pathname + u.search;
  } catch {
    return { allowed: false, crawlDelayMs: null };
  }

  const rules = await rulesFor(origin);
  const deny = rules.disallow.filter((p) => matches(path, p));
  if (!deny.length) return { allowed: true, crawlDelayMs: rules.crawlDelayMs };

  // Allow أطول من أطول Disallow مطابق ⇒ استثناء صريح مسموح.
  const longestDeny = Math.max(...deny.map((p) => p.length));
  const longestAllow = rules.allow
    .filter((p) => matches(path, p))
    .reduce((max, p) => Math.max(max, p.length), 0);

  return { allowed: longestAllow >= longestDeny, crawlDelayMs: rules.crawlDelayMs };
}
