/**
 * طبقة الصمود الشبكي — الضمانة بأن الوصول للمعلومة لا يسقط أبداً.
 *
 * ثلاث حمايات متتابعة لكل نداء خارجي:
 *  1) إعادة محاولة بتراجع أُسّي مع عناوين متصفح متناوبة (يتجاوز الحظر العابر 202/403/429).
 *  2) مرايا قراءة عامة ومجانية (r.jina.ai / allorigins / corsproxy / codetabs) إن رفض المصدر
 *     الاتصال المباشر — كلها بلا مفاتيح.
 *  3) قاطع دائرة لكل مضيف: المضيف الذي يسقط مراراً يُستبعد مؤقتاً بدل إهدار الميزانية،
 *     وذاكرة مؤقتة تخدم نسخة «قديمة لكن حقيقية» بدل الفشل الكامل.
 */

const AGENTS = [
  "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
];
let agentTick = 0;
const nextAgent = () => AGENTS[agentTick++ % AGENTS.length]!;

/* ————— قاطع الدائرة لكل مضيف ————— */

type Breaker = { fails: number; until: number };
const breakers = new Map<string, Breaker>();
const OPEN_MS = 10 * 60 * 1000;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** هل المضيف مسموح الآن (لم يسقط مراراً قريباً)؟ */
export function hostHealthy(url: string): boolean {
  const b = breakers.get(hostOf(url));
  return !b || Date.now() > b.until;
}

function noteFail(url: string) {
  const host = hostOf(url);
  const b = breakers.get(host) ?? { fails: 0, until: 0 };
  b.fails += 1;
  // ثلاث سقطات متتالية ⇒ استراحة تصاعدية بحد أقصى 10 دقائق.
  if (b.fails >= 3) b.until = Date.now() + Math.min(OPEN_MS, b.fails * 60_000);
  breakers.set(host, b);
}

function noteOk(url: string) {
  breakers.delete(hostOf(url));
}

/* ————— مرايا القراءة العامة ————— */

const MIRRORS: ((u: string) => string)[] = [
  (u) => `https://r.jina.ai/${u}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
];

/* ————— ذاكرة مؤقتة تخدم النسخة القديمة عند السقوط ————— */

type Entry = { at: number; body: string };
const cache = new Map<string, Entry>();
const FRESH_MS = 3 * 60 * 1000;
const STALE_MS = 24 * 60 * 60 * 1000;

/**
 * مدة «الطزاجة» حسب تقلّب نوع البيانات لا حسب رقم واحد للجميع:
 * الأسعار والأخبار تتغيّر كل دقائق، والطقس كل ربع ساعة، والأعياد والموسوعات كل يوم.
 * هذا يمنع تقديم رقم قديم على أنه الآن، ويخفّف الضغط على المصادر المحدودة.
 */
function freshnessTtl(url: string): number {
  const u = url.toLowerCase();
  if (/coingecko|coinbase|binance|kraken|finance/.test(u)) return 60 * 1000; // أسعار لحظية
  if (/news|rss|gdelt|lobste|mastodon|reddit|algolia/.test(u)) return 3 * 60 * 1000; // أخبار
  if (/open-meteo|wttr|earthquake/.test(u)) return 10 * 60 * 1000; // طقس/زلازل
  if (/frankfurter|er-api|exchangerate|currency-api/.test(u)) return 30 * 60 * 1000; // صرف يومي
  if (/aladhan|nager|wikipedia|wikidata|dbpedia|restcountries/.test(u)) return 6 * 60 * 60 * 1000;
  return FRESH_MS;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type FetchOptions = {
  ms?: number;
  headers?: Record<string, string>;
  /** عدد المحاولات المباشرة قبل اللجوء للمرايا. */
  attempts?: number;
  /** تعطيل المرايا لمصادر JSON الحسّاسة (نادراً). */
  mirrors?: boolean;
  /** استخدام الذاكرة المؤقتة (افتراضياً نعم). */
  cacheable?: boolean;
  /** تجاوز مدة الطزاجة الافتراضية المشتقة من نوع البيانات. */
  freshMs?: number;
};

/**
 * جلب نص بضمانات: ذاكرة طازجة → محاولات مباشرة → مرايا عامة → ذاكرة قديمة.
 * يرمي فقط إن سقط كل شيء ولا توجد نسخة محفوظة.
 */
export async function resilientText(url: string, opts: FetchOptions = {}): Promise<string> {
  const ms = opts.ms ?? 8_000;
  const attempts = opts.attempts ?? 2;
  const useCache = opts.cacheable !== false;
  const hit = cache.get(url);
  if (useCache && hit && Date.now() - hit.at < (opts.freshMs ?? freshnessTtl(url))) return hit.body;

  const tryOnce = async (target: string, timeout: number) => {
    const res = await fetch(target, {
      headers: {
        "User-Agent": nextAgent(),
        "Accept-Language": "ar,en;q=0.8",
        Accept: "*/*",
        ...opts.headers,
      },
      signal: AbortSignal.timeout(timeout),
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const body = await res.text();
    if (!body.trim()) throw new Error("empty");
    return body;
  };

  // «ms» هو الميزانية الكلية للنداء كله (محاولات + مرايا) حتى لا تتجاوز
  // سلسلة البدائل السقف الزمني الذي يعتمد عليه المتصل.
  const deadline = Date.now() + ms;
  const remaining = () => deadline - Date.now();

  if (hostHealthy(url)) {
    for (let i = 0; i < attempts && remaining() > 900; i++) {
      try {
        const body = await tryOnce(url, remaining());
        noteOk(url);
        if (useCache) cache.set(url, { at: Date.now(), body });
        return body;
      } catch {
        noteFail(url);
        if (i + 1 < attempts) await sleep(200);
      }
    }
  }

  if (opts.mirrors !== false) {
    for (const build of MIRRORS) {
      if (remaining() < 1_200) break;
      const mirror = build(url);
      if (!hostHealthy(mirror)) continue;
      try {
        const body = await tryOnce(mirror, remaining());
        noteOk(mirror);
        if (useCache) cache.set(url, { at: Date.now(), body });
        return body;
      } catch {
        noteFail(mirror);
      }
    }
  }

  if (useCache && hit && Date.now() - hit.at < STALE_MS) return hit.body;
  throw new Error(`unreachable: ${hostOf(url)}`);
}

/** نفس الضمانات لكن بمخرج JSON. */
export async function resilientJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const body = await resilientText(url, {
    ...opts,
    headers: { Accept: "application/json", ...opts.headers },
  });
  try {
    return JSON.parse(body) as T;
  } catch {
    // بعض المرايا تغلّف JSON داخل نص — نلتقط أول كائن/مصفوفة صالحة.
    const m = body.match(/[[{][\s\S]*[\]}]/);
    if (!m) throw new Error("bad json");
    return JSON.parse(m[0]) as T;
  }
}

/**
 * يشغّل بدائل بالترتيب ويعيد أول نتيجة غير فارغة — جوهر مبدأ «لكل مصدر بديل».
 */
export async function firstNonEmpty<T>(
  tasks: (() => Promise<T>)[],
  isEmpty: (v: T) => boolean,
  fallback: T,
): Promise<T> {
  for (const task of tasks) {
    try {
      const value = await task();
      if (!isEmpty(value)) return value;
    } catch {
      /* البديل التالي */
    }
  }
  return fallback;
}

/** يشغّل كل البدائل بالتوازي ويعيد أول ما ينجح فعلاً (الأسرع الصالح). */
export async function raceUseful<T>(
  tasks: (() => Promise<T>)[],
  isEmpty: (v: T) => boolean,
  fallback: T,
): Promise<T> {
  if (!tasks.length) return fallback;
  try {
    return await Promise.any(
      tasks.map(async (t) => {
        const v = await t();
        if (isEmpty(v)) throw new Error("empty");
        return v;
      }),
    );
  } catch {
    return fallback;
  }
}

/** سقف زمني صارم لأي عمل: لا شيء يوقف الرد على المستخدم. */
export async function withBudget<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([work, guard]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
