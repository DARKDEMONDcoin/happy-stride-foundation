import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BusinessProfile } from "@/lib/business-profile.server";
import type { SeoAudit } from "@/lib/seo-audit.server";

export type DiscoveryOpportunity = {
  keyword: string;
  intent: "معلوماتية" | "شرائية" | "محلية" | "مقارنة";
  demandScore: number;
  difficultyScore: number | null;
  topDomains: string[];
  /** هل يظهر موقعنا حالياً في أول ١٠ نتائج لهذه العبارة. */
  weRank: number | null;
};

export type DiscoveryCompetitor = {
  domain: string;
  contentCount: number;
  topics: string[];
};

export type DiscoveryPresence = {
  /** المنصات التي وجدنا لها حساباً منشوراً للعلامة. */
  found: { platform: string; url: string }[];
  /** منصات مهمة للنشاط لم نجد لها أثراً. */
  missing: string[];
};

export type DiscoveryAction = {
  priority: "عالية" | "متوسطة" | "منخفضة";
  title: string;
  why: string;
  employeeId: string;
  prompt: string;
};

export type DiscoveryReport = {
  url: string;
  generatedAt: string;
  profile: BusinessProfile;
  audit: SeoAudit | null;
  opportunities: DiscoveryOpportunity[];
  competitors: DiscoveryCompetitor[];
  presence: DiscoveryPresence;
  actions: DiscoveryAction[];
  /** 0-100: جاهزية العلامة رقمياً (موقع + محتوى + حضور + بيانات). */
  readiness: number;
  /** الهدف الذي صرّح به المستخدم في الحوار. */
  goal?: string | null;
};

const SOCIAL_HOSTS: Record<string, string> = {
  "instagram.com": "instagram",
  "facebook.com": "facebook",
  "tiktok.com": "tiktok",
  "x.com": "x",
  "twitter.com": "x",
  "linkedin.com": "linkedin",
  "youtube.com": "youtube",
  "snapchat.com": "snapchat",
  "pinterest.com": "pinterest",
};

const CORE_PLATFORMS = ["instagram", "tiktok", "facebook", "x", "linkedin", "youtube"];

/**
 * كشف شامل للعلامة والموقع من رابط واحد:
 * ملف النشاط + فحص سيو للصفحة الرئيسية + فرص كلمات مفتاحية بأرقام حقيقية
 * + جرد محتوى المنافسين + الحضور على المنصات + خطة عمل مرتّبة بالأولوية.
 */
export const discoverBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        url: z.string().trim().min(4).max(300),
        /** هدف المستخدم من الحوار (مبيعات / زيارات / وعي / حجوزات). */
        goal: z.string().trim().max(60).optional(),
        /** منافسون ذكرهم المستخدم بنفسه — أدق من استنتاجهم من الموقع. */
        competitors: z.array(z.string().trim().max(120)).max(3).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<DiscoveryReport> => {
    const { profileWebsite } = await import("./business-profile.server");
    const { auditPage } = await import("./seo-audit.server");
    const { keywordExpansion, keywordMetrics, competitorInventory, serpSearch, withBudget } =
      await import("./seo-research.server");

    const profile = await profileWebsite(data.url);
    const host = (() => {
      try {
        return new URL(
          /^https?:\/\//.test(data.url) ? data.url : `https://${data.url}`,
        ).host.replace(/^www\./, "");
      } catch {
        return "";
      }
    })();

    const seed =
      [profile.products[0], profile.industry, profile.locations[0]]
        .filter(Boolean)
        .join(" ")
        .trim()
        .slice(0, 60) || profile.name;

    /** أسماء المنافسين قد تأتي كنص لا كنطاق — نحوّلها لنطاق نظيف ونتجاهل ما لا يصلح. */
    const rivalDomains = [
      ...new Set(
        [...(data.competitors ?? []), ...profile.competitors]
          .map((c) => {
            const raw =
              c
                .trim()
                .replace(/^https?:\/\//i, "")
                .replace(/^www\./, "")
                .split(/[\s/?#]/)[0] ?? "";
            return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(raw) ? raw.toLowerCase() : "";
          })
          .filter(Boolean),
      ),
    ].slice(0, 3);

    const [audit, expansion, rivals] = await Promise.all([
      withBudget(auditPage(data.url), 25_000, null as SeoAudit | null).catch(() => null),
      withBudget(keywordExpansion(seed), 25_000, null).catch(() => null),
      Promise.all(
        rivalDomains.map((c) => withBudget(competitorInventory(c), 15_000, null).catch(() => null)),
      ),
    ]);

    // فرص الكلمات: نأخذ عيّنة موزّعة على النوايا ونقيسها فعلياً.
    const picks: { keyword: string; intent: DiscoveryOpportunity["intent"] }[] = [];
    const take = (list: string[] | undefined, intent: DiscoveryOpportunity["intent"], n: number) =>
      (list ?? []).slice(0, n).forEach((k) => picks.push({ keyword: k, intent }));
    take(expansion?.transactional, "شرائية", 3);
    take(expansion?.local, "محلية", 2);
    take(expansion?.commercial, "مقارنة", 2);
    take(expansion?.informational, "معلوماتية", 3);
    // احتياط: إن لم تُصنَّف أي نية، نقيس الاقتراحات الخام أو بذرة النشاط نفسها.
    if (!picks.length) {
      const fallback = (expansion?.suggestions ?? []).slice(0, 5);
      (fallback.length ? fallback : [seed, profile.industry].filter(Boolean)).forEach((k) =>
        picks.push({ keyword: k, intent: "معلوماتية" }),
      );
    }

    const opportunities: DiscoveryOpportunity[] = (
      await Promise.all(
        picks.slice(0, 8).map(async (p) => {
          const metric = await withBudget(keywordMetrics(p.keyword), 12_000, null).catch(
            () => null,
          );
          if (!metric) return null;
          const weRank =
            host && metric.topDomains.findIndex((d) => d.includes(host)) >= 0
              ? metric.topDomains.findIndex((d) => d.includes(host)) + 1
              : null;
          return {
            keyword: p.keyword,
            intent: p.intent,
            demandScore: metric.demandScore,
            difficultyScore: metric.difficultyScore,
            topDomains: metric.topDomains.slice(0, 4),
            weRank,
          } satisfies DiscoveryOpportunity;
        }),
      )
    )
      .filter((o): o is DiscoveryOpportunity => Boolean(o))
      .sort(
        (a, b) =>
          b.demandScore - (b.difficultyScore ?? 50) - (a.demandScore - (a.difficultyScore ?? 50)),
      );

    const competitors: DiscoveryCompetitor[] = rivals
      .filter((r): r is NonNullable<typeof r> => Boolean(r?.domain))
      .map((r) => ({ domain: r.domain, contentCount: r.urlCount, topics: r.topics.slice(0, 6) }))
      .filter((c) => c.contentCount > 0 || c.topics.length > 0);

    // الحضور على المنصات: روابط الموقع أولاً ثم بحث حيّ عن اسم العلامة.
    const foundMap = new Map<string, string>();
    for (const link of profile.socials) {
      const hostname = (() => {
        try {
          return new URL(link).host.replace(/^www\./, "");
        } catch {
          return "";
        }
      })();
      const platform = Object.entries(SOCIAL_HOSTS).find(([h]) => hostname.endsWith(h))?.[1];
      if (platform && !foundMap.has(platform)) foundMap.set(platform, link);
    }
    if (foundMap.size < 3) {
      const serp = await withBudget(
        serpSearch(`${profile.name} instagram OR tiktok OR facebook OR linkedin`),
        10_000,
        [],
      ).catch(() => []);
      for (const r of serp) {
        const hostname = (() => {
          try {
            return new URL(r.url).host.replace(/^www\./, "");
          } catch {
            return "";
          }
        })();
        const platform = Object.entries(SOCIAL_HOSTS).find(([h]) => hostname.endsWith(h))?.[1];
        if (platform && !foundMap.has(platform)) foundMap.set(platform, r.url);
      }
    }
    const presence: DiscoveryPresence = {
      found: [...foundMap].map(([platform, url]) => ({ platform, url })),
      missing: CORE_PLATFORMS.filter((p) => !foundMap.has(p)),
    };

    // خطة العمل: مشتقة من الفجوات الفعلية، لا من قائمة عامة.
    const actions: DiscoveryAction[] = [];
    const failing = (audit?.checks ?? []).filter((c) => c.status === "fail");
    if (failing.length) {
      actions.push({
        priority: "عالية",
        title: `أصلح ${failing.length} مشكلة سيو في صفحتك الرئيسية`,
        why: failing
          .slice(0, 3)
          .map((c) => c.label)
          .join("، "),
        employeeId: "nour",
        prompt: `أصلح مشاكل السيو التالية في ${audit?.finalUrl ?? data.url} واكتب لي النصوص الجاهزة للنسخ: ${failing
          .map((c) => `${c.label} — ${c.detail}`)
          .join(" | ")}`,
      });
    }
    const bestKw = opportunities[0];
    if (bestKw) {
      actions.push({
        priority: "عالية",
        title: `اكتب محتوى يستهدف «${bestKw.keyword}»`,
        why: `طلب ${bestKw.demandScore}/100 وصعوبة ${bestKw.difficultyScore ?? "غير محددة"} — ${
          bestKw.weRank ? `ترتيبك الحالي ${bestKw.weRank}` : "لا تظهر في النتائج الأولى"
        }.`,
        employeeId: "nour",
        prompt: `اكتب مقالاً كاملاً محسّناً لمحرك البحث يستهدف «${bestKw.keyword}» لنشاط ${profile.name} (${profile.industry}) مع عناوين فرعية وأسئلة شائعة.`,
      });
    }
    if (presence.missing.length) {
      actions.push({
        priority: presence.found.length ? "متوسطة" : "عالية",
        title: `افتح حضورك على ${presence.missing.slice(0, 3).join("، ")}`,
        why: "لم نجد أثراً لعلامتك على هذه المنصات، وجمهورك موجود عليها.",
        employeeId: "sonny",
        prompt: `ضع لي خطة إطلاق حسابات ${presence.missing.slice(0, 3).join("، ")} لنشاط ${profile.name}: نبذة الحساب، أول ٧ منشورات، والهاشتاقات.`,
      });
    }
    if (competitors.length) {
      const top = competitors[0]!;
      actions.push({
        priority: "متوسطة",
        title: `سدّ فجوة المحتوى أمام ${top.domain}`,
        why: `لديه ${top.contentCount} صفحة منشورة حول: ${top.topics.slice(0, 4).join("، ")}.`,
        employeeId: "nour",
        prompt: `قارن محتوى ${host || profile.name} بمحتوى ${top.domain} واقترح ١٠ مواضيع نكسب بها، مرتّبة بالأولوية.`,
      });
    }
    if ((audit?.speed?.performance ?? 100) < 70) {
      actions.push({
        priority: "متوسطة",
        title: "سرعة موقعك تُضعف ترتيبك ومبيعاتك",
        why: `أداء الجوال ${audit?.speed?.performance}/100 · LCP ${audit?.speed?.lcp ?? "—"}.`,
        employeeId: "nour",
        prompt: `اشرح لي بخطوات عملية كيف أسرّع ${audit?.finalUrl ?? data.url} مع ترتيب الخطوات حسب الأثر.`,
      });
    }

    // جاهزية رقمية مركّبة.
    const readiness = Math.round(
      0.4 * (audit?.score ?? 40) +
        0.25 * Math.min(100, presence.found.length * 20) +
        0.2 * Math.min(100, (opportunities.filter((o) => o.weRank).length / 3) * 100) +
        0.15 * (profile.confidence === "high" ? 100 : profile.confidence === "medium" ? 60 : 30),
    );

    const report: DiscoveryReport = {
      url: audit?.finalUrl ?? data.url,
      generatedAt: new Date().toISOString(),
      goal: data.goal ?? null,
      profile,
      audit,
      opportunities,
      competitors,
      presence,
      actions,
      readiness,
    };

    // نحفظ الخلاصة في عقل العلامة ليستفيد منها كل الموظفين لاحقاً.
    await context.supabase.from("brain_items").insert({
      workspace_id: data.workspaceId,
      kind: "note",
      title: `كشف شامل: ${profile.name}`,
      meta: report.url,
      body: [
        profile.summary,
        `الجاهزية الرقمية: ${readiness}/100`,
        opportunities.length ? `فرص كلمات: ${opportunities.map((o) => o.keyword).join("، ")}` : "",
        presence.found.length ? `حضور: ${presence.found.map((p) => p.platform).join("، ")}` : "",
        presence.missing.length ? `منصات ناقصة: ${presence.missing.join("، ")}` : "",
        actions.length ? `أولويات: ${actions.map((a) => a.title).join(" | ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      used_by: ["nour", "sonny", "eva"],
    });

    return report;
  });
