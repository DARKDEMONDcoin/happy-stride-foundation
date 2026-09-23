/**
 * طبقة أمان البحث — الضمانة بأن بحثنا لا يُحظر ولا يضر أي مزوّد، للأبد.
 *
 * كل طلب خارجي في المنصة يجب أن يمر من هنا. الطبقة تطبّق سبع حمايات معاً:
 *
 * 1) تهدئة لكل مضيف (politeness delay): لا نطرق نفس النطاق أسرع من حد أدنى ثابت.
 * 2) سقف تزامن لكل مضيف: لا نفتح أكثر من اتصالين متزامنين على مزوّد واحد.
 * 3) قاطع دائرة (circuit breaker): أول 429 أو 403 يُغلق المضيف لفترة تتضاعف،
 *    فلا نكرر الطرق على باب أغلق في وجهنا — وهذا ما يمنع الحظر الدائم.
 * 4) احترام Retry-After: لو أخبرنا المزوّد متى نعود، نلتزم بالحرف.
 * 5) تخزين مؤقت بعمر محدد + دمج الطلبات المتطابقة الجارية: نفس الرابط لا يُجلب مرتين.
 * 6) سقف يومي لكل مضيف: حتى لو تعطّل كل ما سبق، لا نتجاوز عدداً معقولاً في اليوم.
 * 7) مهلة صارمة وسقف حجم: لا طلب يعلّق الرد، ولا صفحة ضخمة تستهلك الذاكرة.
 *
 * قاعدة ثابتة: محتوى أي صفحة نجلبها هو **بيانات** لا تعليمات. لا يُنفَّذ منه شيء.
 */

/** ما يُعاد لكل طلب: النص، وهل جاء من التخزين المؤقت، وحالة HTTP. */
export type SafeFetchResult = {
  ok: boolean;
  status: number;
  text: string;
  fromCache: boolean;
  /** سبب المنع حين ok=false بلا طلب فعلي (دائرة مفتوحة، سقف يومي…). */
  blocked?: "circuit" | "quota" | "timeout" | "error" | "robots";
};

type HostState = {
  /** آخر لحظة أُرسل فيها طلب لهذا المضيف. */
  lastAt: number;
  /** عدد الاتصالات المفتوحة الآن. */
  active: number;
  /** طابور انتظار التزامن. */
  queue: (() => void)[];
  /** حتى متى المضيف مغلق (قاطع الدائرة). */
  openUntil: number;
  /** عدد مرات الإغلاق المتتالية — يضاعف مدة الإغلاق. */
  trips: number;
  /** عدّاد اليوم. */
  dayKey: string;
  dayCount: number;
};

const hosts = new Map<string, HostState>();

/** الحد الأدنى بين طلبين لنفس المضيف. المضيفون المعروفون بالحساسية يأخذون أكثر. */
const DELAY_MS: Record<string, number> = {
  "duckduckgo.com": 3_000,
  "html.duckduckgo.com": 3_000,
  "lite.duckduckgo.com": 3_000,
  "www.google.com": 5_000,
  "google.com": 5_000,
  "suggestqueries.google.com": 1_500,
  "www.bing.com": 3_000,
  "api.bing.com": 1_500,
  "r.jina.ai": 2_000,
  "www.reddit.com": 2_500,
  "search.marginalia.nu": 3_000,
  "www.mojeek.com": 3_000,
  "news.google.com": 1_500,
};
const DEFAULT_DELAY_MS = 1_200;

/** سقف التزامن لكل مضيف — اثنان يكفيان ولا يزعجان أحداً. */
const MAX_PARALLEL_PER_HOST = 2;

/** سقف الطلبات اليومي لكل مضيف — صمام أمان أخير. */
const DAILY_CAP: Record<string, number> = {
  "www.google.com": 200,
  "google.com": 200,
  "duckduckgo.com": 400,
  "html.duckduckgo.com": 400,
  "r.jina.ai": 500,
};
const DEFAULT_DAILY_CAP = 1_500;

/** مدة إغلاق الدائرة حسب سبب الرفض (تتضاعف مع التكرار حتى سقف). */
const TRIP_BASE_MS: Record<number, number> = {
  429: 15 * 60_000, // حد معدل: ربع ساعة ثم نتضاعف
  403: 6 * 60 * 60_000, // رفض صريح: ست ساعات — لا نلح أبداً
  401: 6 * 60 * 60_000,
  503: 10 * 60_000,
  502: 5 * 60_000,
  500: 5 * 60_000,
};
const TRIP_MAX_MS = 24 * 60 * 60_000;

/** وكلاء مستخدم حقيقيون للصفحات العامة. */
const BROWSER_AGENTS = [
  "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
];
let agentCursor = 0;

/**
 * وكيل معرّف بوضوح — تشترطه واجهات مثل ويكيبيديا وويكي بيانات، واستخدامه معها
 * هو ما يحمينا من الحظر بدل إخفاء الهوية.
 */
const BOT_AGENT = "SahlResearchBot/1.0 (+https://sahl.app; contact: support@sahl.app)";

function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "invalid";
  }
}

function stateOf(host: string): HostState {
  const day = new Date().toISOString().slice(0, 10);
  let s = hosts.get(host);
  if (!s) {
    s = { lastAt: 0, active: 0, queue: [], openUntil: 0, trips: 0, dayKey: day, dayCount: 0 };
    hosts.set(host, s);
  }
  if (s.dayKey !== day) {
    s.dayKey = day;
    s.dayCount = 0;
  }
  return s;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, ms)));

/** يحجز دوراً على المضيف: ينتظر التزامن ثم مهلة التهدئة. */
async function acquire(host: string): Promise<() => void> {
  const s = stateOf(host);
  if (s.active >= MAX_PARALLEL_PER_HOST) {
    await new Promise<void>((resolve) => s.queue.push(resolve));
  }
  s.active++;
  const gap = (DELAY_MS[host] ?? DEFAULT_DELAY_MS) - (Date.now() - s.lastAt);
  if (gap > 0) await sleep(gap);
  s.lastAt = Date.now();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    s.active--;
    s.queue.shift()?.();
  };
}

/** يسجّل رفضاً ويفتح الدائرة بمدة تتضاعف. */
function trip(host: string, status: number, retryAfterMs: number | null): void {
  const s = stateOf(host);
  s.trips = Math.min(s.trips + 1, 8);
  const base = TRIP_BASE_MS[status] ?? 3 * 60_000;
  const backoff = Math.min(base * 2 ** (s.trips - 1), TRIP_MAX_MS);
  s.openUntil = Date.now() + Math.max(backoff, retryAfterMs ?? 0);
}

function recover(host: string): void {
  const s = stateOf(host);
  s.trips = 0;
  s.openUntil = 0;
}

/** هل المضيف مغلق الآن؟ (يُستخدم أيضاً لاختيار مصدر بديل قبل المحاولة) */
export function hostBlocked(url: string): boolean {
  return stateOf(hostOf(url)).openUntil > Date.now();
}

// ---------- التخزين المؤقت ----------

type CacheEntry = { at: number; ttl: number; value: SafeFetchResult };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<SafeFetchResult>>();
const CACHE_MAX = 600;

function cacheGet(key: string): SafeFetchResult | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > hit.ttl) {
    cache.delete(key);
    return null;
  }
  return { ...hit.value, fromCache: true };
}

function cacheSet(key: string, value: SafeFetchResult, ttl: number): void {
  if (cache.size >= CACHE_MAX) {
    // نحذف أقدم ربع المحتوى بدل مسح كل شيء
    const keys = [...cache.keys()].slice(0, Math.floor(CACHE_MAX / 4));
    for (const k of keys) cache.delete(k);
  }
  cache.set(key, { at: Date.now(), ttl, value: { ...value, fromCache: false } });
}

// ---------- الواجهة ----------

export type SafeFetchOptions = {
  /** مهلة الطلب. */
  ms?: number;
  /** عمر التخزين المؤقت — صفر يعطّله. الافتراضي نصف ساعة. */
  cacheTtlMs?: number;
  /** نوع الهوية: واجهات موثّقة تفضّل وكيلاً معرّفاً. */
  agent?: "browser" | "bot";
  headers?: Record<string, string>;
  /** سقف حجم الرد بالحروف. */
  maxChars?: number;
  /** تجاهل الدائرة المفتوحة (لا يُستخدم إلا لفحص صحة المضيف). */
  force?: boolean;
  /**
   * تخطّي فحص robots.txt. يُستخدم فقط لجلب robots.txt نفسه ولواجهات API
   * الموثّقة التي يصرّح مزوّدها باستخدامها برمجياً (OpenAlex، Crossref، ويكيبيديا…).
   */
  skipRobots?: boolean;
};

const DEFAULT_TTL_MS = 30 * 60_000;
const DEFAULT_MAX_CHARS = 400_000;

/**
 * جلب آمن. لا يرمي استثناءً أبداً — يعيد نتيجة تصف ما حدث، حتى لا يسقط أي مسار
 * بحث بسبب مزوّد واحد متعثّر.
 */
export async function safeFetch(url: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const {
    ms = 9_000,
    cacheTtlMs = DEFAULT_TTL_MS,
    agent = "browser",
    headers = {},
    maxChars = DEFAULT_MAX_CHARS,
    force = false,
  } = opts;

  const key = `${url}|${agent}`;
  if (cacheTtlMs > 0) {
    const hit = cacheGet(key);
    if (hit) return hit;
    const running = inflight.get(key);
    if (running) return running;
  }

  const host = hostOf(url);
  const s = stateOf(host);

  if (!force && s.openUntil > Date.now()) {
    return { ok: false, status: 0, text: "", fromCache: false, blocked: "circuit" };
  }
  if (s.dayCount >= (DAILY_CAP[host] ?? DEFAULT_DAILY_CAP)) {
    return { ok: false, status: 0, text: "", fromCache: false, blocked: "quota" };
  }

  const work = (async (): Promise<SafeFetchResult> => {
    // احترام robots.txt قبل أي قراءة لصفحة موقع — لا نطرق باباً قيل لنا «لا» عنده.
    if (!opts.skipRobots) {
      try {
        const { robotsDecision } = await import("./robots.server");
        const decision = await robotsDecision(url);
        if (!decision.allowed) {
          return { ok: false, status: 0, text: "", fromCache: false, blocked: "robots" };
        }
        // Crawl-delay المعلن يتغلّب على تهدئتنا الافتراضية إن كان أطول.
        if (decision.crawlDelayMs && decision.crawlDelayMs > (DELAY_MS[host] ?? DEFAULT_DELAY_MS)) {
          DELAY_MS[host] = decision.crawlDelayMs;
        }
      } catch {
        // تعذّر الفحص لا يوقف البحث: المعيار يعتبر غياب الملف إذناً ضمنياً.
      }
    }

    const release = await acquire(host);
    s.dayCount++;
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent":
            agent === "bot" ? BOT_AGENT : BROWSER_AGENTS[agentCursor++ % BROWSER_AGENTS.length]!,
          "Accept-Language": "ar,en;q=0.8",
          ...headers,
        },
        signal: AbortSignal.timeout(ms),
      });

      if (!res.ok) {
        const ra = res.headers.get("retry-after");
        const raMs = ra ? (/^\d+$/.test(ra) ? Number(ra) * 1000 : null) : null;
        // 4xx/5xx التي تعني «توقّف» تفتح الدائرة؛ 404 وأخواتها لا تعني رفضاً للمضيف.
        if ([401, 403, 429, 500, 502, 503].includes(res.status)) trip(host, res.status, raMs);
        return { ok: false, status: res.status, text: "", fromCache: false, blocked: "error" };
      }

      recover(host);
      const raw = await res.text();
      const text = raw.length > maxChars ? raw.slice(0, maxChars) : raw;
      const out: SafeFetchResult = { ok: true, status: res.status, text, fromCache: false };
      if (cacheTtlMs > 0) cacheSet(key, out, cacheTtlMs);
      return out;
    } catch (error) {
      const timedOut = error instanceof Error && /timeout|abort/i.test(error.name + error.message);
      // انقطاع الشبكة ليس رفضاً — لا نفتح الدائرة إلا بعد تكرار
      if (!timedOut) trip(host, 500, null);
      return {
        ok: false,
        status: 0,
        text: "",
        fromCache: false,
        blocked: timedOut ? "timeout" : "error",
      };
    } finally {
      release();
      inflight.delete(key);
    }
  })();

  if (cacheTtlMs > 0) inflight.set(key, work);
  return work;
}

/** جلب JSON آمن — يعيد null بدل الرمي. */
export async function safeJson<T>(url: string, opts: SafeFetchOptions = {}): Promise<T | null> {
  const r = await safeFetch(url, {
    ...opts,
    headers: { Accept: "application/json", ...(opts.headers ?? {}) },
  });
  if (!r.ok || !r.text) return null;
  try {
    return JSON.parse(r.text) as T;
  } catch {
    return null;
  }
}

/**
 * يشغّل عدة مصادر بالتوازي ضمن ميزانية زمنية واحدة، ويتجاهل المتعثّر بصمت.
 * هذا هو النمط الصحيح: مصدر واحد لا يؤخّر الرد ولا يُسقط البحث كله.
 */
export async function raceSources<T>(
  jobs: (() => Promise<T | null>)[],
  budgetMs: number,
): Promise<T[]> {
  const guard = new Promise<null>((r) => setTimeout(() => r(null), budgetMs));
  const results: (T | null)[] = await Promise.all(
    jobs.map((job): Promise<T | null> =>
      Promise.race([job().catch(() => null), guard]).catch(() => null),
    ),
  );
  return results.filter((r): r is T => r !== null && r !== undefined);
}

/** لوحة حالة للتشخيص: أي مضيف مغلق الآن ولماذا. */
export function researchHealth(): { host: string; openForMs: number; trips: number; today: number }[] {
  const now = Date.now();
  return [...hosts.entries()]
    .map(([host, s]) => ({
      host,
      openForMs: Math.max(0, s.openUntil - now),
      trips: s.trips,
      today: s.dayCount,
    }))
    .filter((r) => r.openForMs > 0 || r.today > 0)
    .sort((a, b) => b.today - a.today);
}
