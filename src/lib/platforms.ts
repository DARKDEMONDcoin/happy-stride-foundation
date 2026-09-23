/**
 * فهم المنصة التي يقصدها المستخدم من كلامه (عربي/إنجليزي/عامية) — ملف محايد
 * يعمل على المتصفح والخادم حتى يتفق الشات ولوحة النشر على نفس التفسير.
 */

/** معرّفات المنصات التي يدعمها سِراج للنشر المباشر. */
export const PUBLISHABLE = [
  "instagram",
  "facebook",
  "linkedin",
  "x",
  "pinterest",
  "youtube",
  "telegram",
] as const;
export type Publishable = (typeof PUBLISHABLE)[number];

const ALIASES: Record<string, RegExp> = {
  linkedin: /لينكد\s*ان|لينكدإن|لينكدين|لينكد|linked\s*in/i,
  instagram: /انستا|إنستا|انستجرام|إنستجرام|انستقرام|إنستقرام|instagram|insta\b|\big\b/i,
  facebook: /فيس\s*بوك|فيسبوك|(?:^|\s|و|ال|لل|ع|على|علي)فيس(?:\s|$|[،,.و])|facebook|\bfb\b/i,
  x: /تويتر|إكس\b|اكس\b|twitter|\bx\.com|(?:^|\s)(?:على|علي|ع)\s*x(?:\s|$|[،,.])/i,
  pinterest: /بنترست|بينترست|pinterest/i,
  youtube: /يوتيوب|يوتوب|youtube|شورتس|shorts/i,
  telegram: /تيليجرام|تيليغرام|تليجرام|تليغرام|تلجرام|telegram|\btg\b/i,
  tiktok: /تيك\s*توك|تيكتوك|tiktok/i,
  snapchat: /سناب|snapchat/i,
  threads: /ثريدز|threads/i,
  wordpress: /ووردبريس|وردبريس|wordpress/i,
  ghost: /\bghost\b|جوست/i,
  shopify: /شوبيفاي|shopify/i,
  webflow: /ويبفلو|webflow/i,
  "google-business": /خرائط جوجل|جوجل بزنس|google business|نشاطي التجاري/i,
};

/** كل المنصات المذكورة صراحةً في النص، بترتيب ظهورها. */
export function detectProviders(text: string): string[] {
  const hits: { p: string; i: number }[] = [];
  for (const [p, re] of Object.entries(ALIASES)) {
    const m = re.exec(text);
    if (m) hits.push({ p, i: m.index });
  }
  return hits.sort((a, b) => a.i - b.i).map((h) => h.p);
}

/** المنصات المطلوبة للنشر تحديداً (القابلة للنشر منها فقط). */
export function requestedPublishTargets(text: string): Publishable[] {
  return detectProviders(text).filter((p): p is Publishable =>
    (PUBLISHABLE as readonly string[]).includes(p),
  );
}

/** يحوّل اسم قناة كتبه النموذج (بأي لغة) إلى معرّف منصة، أو null إن لم يُفهم. */
export function normalizeChannel(channel: string | null | undefined): string | null {
  if (!channel) return null;
  const c = channel.trim().toLowerCase();
  if (c in ALIASES) return c;
  const found = detectProviders(c);
  return found[0] ?? null;
}

/** أسماء عربية لعرضها في الرسائل. */
export const PROVIDER_LABEL: Record<string, string> = {
  linkedin: "لينكدإن",
  instagram: "إنستجرام",
  facebook: "فيسبوك",
  x: "إكس (تويتر)",
  pinterest: "بنترست",
  youtube: "يوتيوب",
  telegram: "تيليجرام",
  tiktok: "تيك توك",
  snapchat: "سناب شات",
  threads: "ثريدز",
  wordpress: "ووردبريس",
  ghost: "Ghost",
  shopify: "شوبيفاي",
  webflow: "ويبفلو",
  "google-business": "نشاطي التجاري على جوجل",
};

export function providerLabel(p: string): string {
  return PROVIDER_LABEL[p] ?? p;
}
