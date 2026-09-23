import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { ambientPulse, timezoneForCountry } from "./live-context.server";
import { localParts, zonedTimeToUtc } from "./timezone";
import { craft, personas } from "./nour-run.server";
import { memoryBlock } from "./memory.server";
import { adaptForProvider } from "./post-format";
import { sharedSystemBlocks, governanceBlocks } from "./team-knowledge";

/**
 * تقويم المحتوى الكامل لسِراج:
 *  1) planCalendar: خطة أسبوع/شهر — أفكار مرتبطة بنشاطك وأعمدة المحتوى وما نجح سابقاً، موزّعة على أفضل الأوقات.
 *  2) generateCalendarPost: تحويل فكرة واحدة إلى منشور نهائي + صورة على هوية العلامة (يعمل واحداً واحداً مع شريط تقدّم).
 *  3) learnFromPerformance: قراءة أداء المنشورات الحقيقية (إعجابات/تعليقات) واستخلاص «ما ينجح» وحفظه في عقل العلامة.
 *  4) dailyIdeas: 3 أفكار منشورات يومية للإحاطة الصباحية.
 */

type Admin = SupabaseClient<Database>;

export type PostMeta = {
  title?: string;
  angle?: string;
  pillar?: string;
  hook?: string;
  imageIdea?: string;
  goal?: string;
  batch?: string;
  generatedAt?: string;
  error?: string;
};

export type PostMetrics = {
  likes?: number;
  comments?: number;
  views?: number;
  score?: number;
  fetchedAt?: string;
};

const BEST_HOURS: Record<string, number[]> = {
  instagram: [11, 14, 20],
  facebook: [10, 13, 21],
  linkedin: [8, 10, 12],
  x: [9, 12, 18],
  pinterest: [14, 20, 22],
  tiktok: [12, 19, 22],
  youtube: [16, 19, 21],
  "google-business": [9, 12, 17],
};

const PILLARS = [
  "تعليمي",
  "خلف الكواليس",
  "إثبات اجتماعي",
  "عرض/دعوة",
  "ترفيهي/تفاعلي",
  "قصة العلامة",
];

export function extractJson<T>(raw: string): T | null {
  const s = raw.indexOf("{");
  const a = raw.indexOf("[");
  const start = s === -1 ? a : a === -1 ? s : Math.min(s, a);
  if (start === -1) return null;
  const endChar = raw[start] === "[" ? "]" : "}";
  const end = raw.lastIndexOf(endChar);
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/**
 * وضع JSON في بعض المزوّدين يفرض كائناً جذرياً، فيعيد النموذج
 * {"items":[...]} أو عنصراً واحداً بدل المصفوفة. نطبّع كل الأشكال إلى مصفوفة.
 */
export function extractJsonList<T extends object>(raw: string, requiredKey: keyof T): T[] {
  const parsed = extractJson<unknown>(raw);
  const isItem = (x: unknown): x is T =>
    Boolean(x) && typeof x === "object" && requiredKey in (x as object);
  if (Array.isArray(parsed)) return parsed.filter(isItem);
  if (parsed && typeof parsed === "object") {
    if (isItem(parsed)) return [parsed];
    for (const v of Object.values(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        const items = v.filter(isItem);
        if (items.length) return items;
      }
    }
  }
  // احتياط أخير: عدة كائنات JSON متتالية بلا مصفوفة (NDJSON).
  const out: T[] = [];
  for (const m of raw.matchAll(/\{[^{}]*\}/g)) {
    try {
      const o = JSON.parse(m[0]) as unknown;
      if (isItem(o)) out.push(o);
    } catch {
      /* تجاهل */
    }
  }
  return out;
}

async function workspaceContext(admin: Admin, workspaceId: string) {
  const [{ data: ws }, { data: brain }, { data: linked }, { data: recent }] = await Promise.all([
    admin.from("workspaces").select("*").eq("id", workspaceId).maybeSingle(),
    admin.from("brain_items").select("title, body, kind").eq("workspace_id", workspaceId),
    admin
      .from("pipedream_accounts")
      .select("provider")
      .eq("workspace_id", workspaceId)
      .eq("status", "connected"),
    admin
      .from("social_posts")
      .select("body, provider, status, meta, metrics")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  if (!ws) throw new Error("مساحة العمل غير موجودة.");
  const w = ws as typeof ws & {
    website?: string | null;
    country?: string | null;
    profile?: unknown;
  };
  const learning = (brain ?? []).find((b) => b.kind === "learning");
  return {
    ws: w,
    brain: (brain ?? []).filter((b) => b.kind !== "learning"),
    learning: learning?.body ?? null,
    connected: (linked ?? []).map((l) => l.provider),
    recent: (recent ?? []) as unknown as {
      body: string;
      provider: string;
      status: string;
      meta: PostMeta;
      metrics: PostMetrics | null;
    }[],
  };
}

function systemFor(
  ctx: Awaited<ReturnType<typeof workspaceContext>>,
  dialect: string,
  query: string,
): string {
  const p = personas["sonny"]!;
  return [
    `أنت ${p.name} — ${p.role}`,
    ...governanceBlocks("sonny"),
    `## معايير الحرفة\n${craft["sonny"] ?? ""}`,
    ...sharedSystemBlocks({
      employeeId: "sonny",
      connected: ctx.connected,
      profile: ctx.ws.profile,
      website: ctx.ws.website,
      country: ctx.ws.country,
      dialect,
    }),
    `## العلامة\nالاسم: ${ctx.ws.name} · المجال: ${ctx.ws.industry} · النبرة: ${ctx.ws.tone} · اللهجة المطلوبة: ${dialect}` +
      (ctx.ws.banned_words?.length ? `\nكلمات ممنوعة: ${ctx.ws.banned_words.join("، ")}` : ""),
    ctx.brain.length ? `## عقل العلامة\n${memoryBlock(ctx.brain as never, query, 8)}` : "",
    ctx.learning ? `## ما تعلّمته من أداء منشوراتنا السابقة (طبّقه)\n${ctx.learning}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const COUNTRY_DIALECT: Record<string, string> = {
  EG: "مصرية",
  SA: "خليجية",
  AE: "خليجية",
  KW: "خليجية",
  QA: "خليجية",
  BH: "خليجية",
  OM: "خليجية",
  JO: "شامية",
  LB: "شامية",
  SY: "شامية",
  PS: "شامية",
  IQ: "عراقية",
  YE: "يمنية",
  MA: "مغربية",
  DZ: "جزائرية",
  TN: "تونسية",
  LY: "ليبية",
  SD: "سودانية",
  MR: "موريتانية",
  مصر: "مصرية",
  السعودية: "خليجية",
  الإمارات: "خليجية",
  الكويت: "خليجية",
  قطر: "خليجية",
  البحرين: "خليجية",
  عمان: "خليجية",
  الأردن: "شامية",
  لبنان: "شامية",
  سوريا: "شامية",
  فلسطين: "شامية",
  العراق: "عراقية",
  اليمن: "يمنية",
  المغرب: "مغربية",
  الجزائر: "جزائرية",
  تونس: "تونسية",
  ليبيا: "ليبية",
  السودان: "سودانية",
};

/**
 * لهجة الكتابة الفعلية لمساحة العمل: اختيار المالك عند التسجيل ← لهجة موقعه المكتشفة ← دولته ← مصرية (سوق «سهل» الأول).
 * لا نفترض الخليجية أبداً كقيمة صامتة.
 */
export async function resolveDialect(
  admin: Admin,
  workspaceId: string,
  explicit?: string | null,
): Promise<string> {
  if (explicit && explicit.trim()) return explicit.trim();
  const { data: ws } = await admin
    .from("workspaces")
    .select("owner_id, country, profile")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!ws) return "مصرية";
  const { data: prof } = await admin
    .from("profiles")
    .select("dialect")
    .eq("id", ws.owner_id)
    .maybeSingle();
  if (prof?.dialect?.trim()) return prof.dialect.trim();
  const p = (ws as { profile?: { dialect?: string } | null }).profile;
  if (p && typeof p === "object" && typeof p.dialect === "string" && p.dialect.trim())
    return p.dialect.trim();
  const c = (ws as { country?: string | null }).country?.trim();
  if (c && COUNTRY_DIALECT[c.toUpperCase()]) return COUNTRY_DIALECT[c.toUpperCase()]!;
  if (c && COUNTRY_DIALECT[c]) return COUNTRY_DIALECT[c]!;
  return "مصرية";
}

/* ---------------- 1) الخطة ---------------- */

export type PlanInput = {
  workspaceId: string;
  days: number; // 7 أو 14 أو 30
  perDay: number; // 1..3
  providers: string[];
  topic?: string | undefined;
  dialect?: string | undefined;
  timezone: string;
  startAt?: string | undefined;
};

function slotDates(input: PlanInput): { at: Date; provider: string }[] {
  const out: { at: Date; provider: string }[] = [];
  const start = input.startAt ? new Date(input.startAt) : new Date();
  const primary = input.providers[0] ?? "instagram";
  const hours = BEST_HOURS[primary] ?? [11, 14, 20];
  // يوم البداية بالتوقيت المحلي للعلامة، والإزاحة تُحسب لكل موعد على حدة
  // حتى لا تنزاح المواعيد ساعة كاملة عند تغيّر التوقيت الصيفي داخل الخطة.
  const first = localParts(input.timezone, start);
  for (let d = 0; d < input.days; d += 1) {
    for (let i = 0; i < input.perDay; i += 1) {
      const hour = hours[i % hours.length]!;
      const at = zonedTimeToUtc(input.timezone, first.y, first.m, first.d + 1 + d, hour, 0);
      out.push({
        at,
        provider: input.providers[(d * input.perDay + i) % input.providers.length] ?? primary,
      });
    }
  }
  return out;
}


/**
 * المنطقة الزمنية المعتمدة للعلامة: ما اختاره المالك في الطيار الآلي أولاً،
 * ثم استنتاجها من الدولة — حتى لا تختلف ساعة التقويم عن ساعة الجدولة.
 */
export async function brandTimeZone(
  admin: Admin,
  workspaceId: string,
  country?: string | null,
): Promise<string> {
  const { data } = await admin
    .from("social_autopilot")
    .select("timezone")
    .eq("workspace_id", workspaceId)
    .limit(1)
    .maybeSingle();
  return data?.timezone?.trim() || timezoneForCountry(country);
}

export async function planCalendar(
  admin: Admin,
  input: PlanInput,
): Promise<{ created: number; batch: string }> {
  const ctx = await workspaceContext(admin, input.workspaceId);
  const timeZone = await brandTimeZone(admin, input.workspaceId, ctx.ws.country);
  const slots = slotDates({ ...input, timezone: timeZone }).slice(0, 45);
  const { freeChat } = await import("./nour-research.server");

  const recentTitles = ctx.recent
    .map((r) => r.meta?.title || r.body.slice(0, 60))
    .filter(Boolean)
    .slice(0, 15);

  const dialect = await resolveDialect(admin, input.workspaceId, input.dialect);
  const pulse = await ambientPulse(
    { country: ctx.ws.country, timeZone, topics: [input.topic ?? ctx.ws.industry] },
    9_000,
  ).catch(() => "");
  const system = [systemFor(ctx, dialect, input.topic ?? ctx.ws.industry), pulse]
    .filter(Boolean)
    .join("\n\n");
  const user = [
    `خطّط ${slots.length} فكرة منشور لتقويم محتوى ${input.days} يوماً على: ${input.providers.join("، ")}.`,
    input.topic
      ? `المحور المطلوب من المالك: ${input.topic}`
      : "بلا محور محدد — استند إلى نشاط العلامة وجمهورها.",
    `وزّع الأفكار على أعمدة المحتوى: ${PILLARS.join("، ")} — بلا تكرار، وبتنويع الهدف (وصول/تفاعل/رسائل/مبيعات).`,
    recentTitles.length ? `تجنّب تكرار ما نُشر مؤخراً: ${recentTitles.join(" | ")}` : "",
    `أخرج JSON فقط بهذا الشكل بالضبط — كائن فيه مفتاح "items" يحوي مصفوفة بطول ${slots.length} (لا تُرجع عنصراً واحداً أبداً): {"items":[ ... ]} وكل عنصر بهذا الشكل:\n{"title":"عنوان قصير بالعربية","pillar":"أحد الأعمدة","angle":"زاوية المنشور بجملة","hook":"أول سطر يوقف التمرير (≤ 12 كلمة)","goal":"وصول|تفاعل|رسائل|مبيعات","imageIdea":"وصف بصري إنجليزي دقيق للصورة (مشهد، إضاءة، زاوية، بلا نص)"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await freeChat(
    "",
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    {
      json: true,
      timeoutMs: 60_000,
      maxTokens: 3500,
      timeZone,
    },
  );
  let ideas = extractJsonList<PostMeta>(raw, "title");
  if (ideas.length && ideas.length < slots.length) {
    // النموذج أعاد أقل من المطلوب: نكمل بجولة ثانية بدل أن نكرّر الفكرة نفسها على الأيام.
    try {
      const more = await freeChat(
        "",
        [
          { role: "system", content: system },
          { role: "user", content: user },
          { role: "assistant", content: JSON.stringify({ items: ideas }) },
          {
            role: "user",
            content: `ممتاز. أكمل ${slots.length - ideas.length} فكرة إضافية مختلفة تماماً عن السابقة بنفس الشكل {"items":[...]}.`,
          },
        ],
        { json: true, timeoutMs: 60_000, maxTokens: 3500, timeZone },
      );
      ideas = [...ideas, ...extractJsonList<PostMeta>(more, "title")];
    } catch (e) {
      console.warn("[calendar] second planning round failed:", e);
    }
  }
  if (!ideas.length) {
    console.error("[calendar] plan parse failed; raw:", raw.slice(0, 400));
    throw new Error("لم أستطع تكوين خطة الآن — حاول مرة أخرى.");
  }

  const batch = `plan-${Date.now().toString(36)}`;
  const rows = slots.map((s, i) => {
    const idea = ideas[i % ideas.length]!;
    const meta: PostMeta = {
      title: String(idea.title ?? "").slice(0, 120),
      pillar: String(idea.pillar ?? PILLARS[i % PILLARS.length]).slice(0, 40),
      angle: String(idea.angle ?? "").slice(0, 300),
      hook: String(idea.hook ?? "").slice(0, 160),
      goal: String(idea.goal ?? "تفاعل").slice(0, 20),
      imageIdea: String(idea.imageIdea ?? "").slice(0, 500),
      batch,
    };
    return {
      workspace_id: input.workspaceId,
      employee_id: "sonny",
      provider: s.provider,
      body: `${meta.hook || meta.title}\n\n(فكرة بانتظار الكتابة — ${meta.pillar})`,
      scheduled_at: s.at.toISOString(),
      status: "idea",
      meta,
    };
  });
  const { error } = await admin.from("social_posts").insert(rows as never);
  if (error) throw new Error(error.message);
  return { created: rows.length, batch };
}

/* ---------------- 2) توليد منشور واحد ---------------- */

export async function generateCalendarPost(
  admin: Admin,
  workspaceId: string,
  postId: string,
  opts: { withImage: boolean; dialect?: string | undefined },
): Promise<{ id: string; body: string; imageUrl: string | null }> {
  const { data: post } = await admin
    .from("social_posts")
    .select("*")
    .eq("id", postId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!post) throw new Error("المنشور غير موجود.");
  const meta = ((post as { meta?: PostMeta }).meta ?? {}) as PostMeta;
  const ctx = await workspaceContext(admin, workspaceId);
  const { freeChat } = await import("./nour-research.server");

  const dialect = await resolveDialect(admin, workspaceId, opts.dialect);
  const timeZone = timezoneForCountry(ctx.ws.country);
  const system = systemFor(ctx, dialect, meta.title ?? post.body);
  const user = [
    `اكتب المنشور النهائي لمنصة ${post.provider}.`,
    `العنوان/الفكرة: ${meta.title ?? ""}`,
    meta.angle ? `الزاوية: ${meta.angle}` : "",
    meta.hook ? `ابدأ بهذا الهوك (أو أقوى منه): ${meta.hook}` : "",
    meta.pillar ? `عمود المحتوى: ${meta.pillar}` : "",
    meta.goal ? `الهدف: ${meta.goal}` : "",
    "القواعد: فكرة واحدة، جمل قصيرة، دعوة فعل واحدة، هاشتاقات بطبقات (5-10) في آخر سطر، بلا مقدمات وبلا شرح. لا أرقام مختلقة ولا وعود.",
    post.provider === "x"
      ? "الحد 270 حرفاً شاملاً الهاشتاقات."
      : post.provider === "linkedin"
        ? "نبرة مهنية دافئة، 900-1300 حرف، أسطر قصيرة."
        : "1200-1800 حرف كحد أقصى.",
    `أخرج JSON فقط: {"caption":"نص المنشور الكامل بالعربية","image_prompt":"English visual prompt, one paragraph, on-brand, no text in image"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await freeChat(
    "",
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    {
      json: true,
      timeoutMs: 60_000,
      maxTokens: 1400,
      timeZone,
    },
  );
  const out = extractJson<{ caption?: string; image_prompt?: string }>(raw);
  const caption = (out?.caption ?? "").trim();
  if (!caption) throw new Error("لم يخرج نص منشور صالح.");
  let body = adaptForProvider(post.provider, caption);
  // نفس حاجز الجودة الحتمي المستخدم في المحادثة: هوك، طول المنصة، دعوة فعل، هاشتاقات، كلمات ممنوعة.
  try {
    const { autofixPosts } = await import("./post-autofix.server");
    const [fixed] = await autofixPosts(
      "",
      [
        {
          title: meta.title ?? "منشور",
          channel: post.provider,
          body,
          image_prompt: out?.image_prompt ?? "",
        },
      ],
      {
        bannedWords: (ctx.ws as { banned_words?: string[] | null }).banned_words ?? [],
        dialect,
        hasMedia: opts.withImage,
      },
    );
    const improved = typeof fixed?.body === "string" ? fixed.body.trim() : "";
    if (improved.length > 20) body = adaptForProvider(post.provider, improved);
  } catch (e) {
    console.warn("[calendar] autofix skipped:", e instanceof Error ? e.message : e);
  }

  let imageUrl: string | null = post.image_url;
  if (opts.withImage && !imageUrl) {
    try {
      const { ownedHeroImage, imageBrief } = await import("./image-gen.server");
      // «مخرج صور»: الوصف يُبنى من عنوان المنشور ونصّه الفعلي، لا من فكرة عامة.
      const brief = await imageBrief({
        request: `${meta.title ?? ""} — ${meta.angle ?? ""}`.trim(),
        title: meta.title ?? null,
        body,
        brand: { name: ctx.ws.name, industry: ctx.ws.industry, country: ctx.ws.country ?? null },
        draft: out?.image_prompt || meta.imageIdea,
      });
      const prompt = `${brief} Square 1:1 composition, premium commercial photography.`;
      imageUrl =
        (await ownedHeroImage(
          admin as unknown as Parameters<typeof ownedHeroImage>[0],
          workspaceId,
          prompt,
        )) || null;
    } catch (e) {
      console.error("[calendar] image failed:", e);
    }
  }

  const { error } = await admin
    .from("social_posts")
    .update({
      body,
      image_url: imageUrl,
      status: "draft",
      meta: { ...meta, generatedAt: new Date().toISOString(), error: undefined },
    } as never)
    .eq("id", postId);
  if (error) throw new Error(error.message);
  return { id: postId, body, imageUrl };
}

/* ---------------- 3) التعلّم من الأداء ---------------- */

type MetaAccounts = {
  data?: { id: string; name?: string; instagram_business_account?: { id: string } }[];
};
type MetaPosts = {
  data?: {
    id: string;
    caption?: string;
    message?: string;
    timestamp?: string;
    created_time?: string;
    permalink?: string;
    like_count?: number;
    comments_count?: number;
  }[];
};

async function readMetaPerformance(
  admin: Admin,
  workspaceId: string,
  provider: "instagram" | "facebook",
) {
  const { pipedreamConfig, proxyRequest } = await import("./pipedream.server");
  const config = await pipedreamConfig();
  if (!config) return [];
  const { data: acc } = await admin
    .from("pipedream_accounts")
    .select("account_id")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .eq("status", "connected")
    .maybeSingle();
  if (!acc?.account_id) return [];
  const accounts = await proxyRequest<MetaAccounts>(config, {
    workspaceId,
    accountId: acc.account_id,
    url: "https://graph.facebook.com/v23.0/me/accounts?fields=id,name,instagram_business_account&limit=5",
  });
  const page = accounts.data?.[0];
  const target = provider === "instagram" ? page?.instagram_business_account?.id : page?.id;
  if (!target) return [];
  const url =
    provider === "instagram"
      ? `https://graph.facebook.com/v23.0/${target}/media?fields=id,caption,timestamp,permalink,like_count,comments_count&limit=25`
      : `https://graph.facebook.com/v23.0/${target}/posts?fields=id,message,created_time,permalink_url,likes.summary(true),comments.summary(true)&limit=25`;
  const posts = await proxyRequest<
    MetaPosts & {
      data?: {
        likes?: { summary?: { total_count?: number } };
        comments?: { summary?: { total_count?: number } };
      }[];
    }
  >(config, {
    workspaceId,
    accountId: acc.account_id,
    url,
  });
  return (posts.data ?? []).map((p) => {
    const x = p as typeof p & {
      likes?: { summary?: { total_count?: number } };
      comments?: { summary?: { total_count?: number } };
    };
    return {
      id: p.id,
      provider,
      text: (p.caption ?? p.message ?? "").slice(0, 400),
      at: p.timestamp ?? p.created_time ?? "",
      likes: p.like_count ?? x.likes?.summary?.total_count ?? 0,
      comments: p.comments_count ?? x.comments?.summary?.total_count ?? 0,
    };
  });
}

export async function learnFromPerformance(
  admin: Admin,
  workspaceId: string,
): Promise<{ analyzed: number; summary: string; source: "live" | "internal" | "none" }> {
  const live = (
    await Promise.all([
      readMetaPerformance(admin, workspaceId, "instagram").catch(() => []),
      readMetaPerformance(admin, workspaceId, "facebook").catch(() => []),
    ])
  ).flat();

  // نحدّث مقاييس منشوراتنا المنشورة التي نعرف مرجعها الخارجي
  if (live.length) {
    const { data: ours } = await admin
      .from("social_posts")
      .select("id, remote_ref")
      .eq("workspace_id", workspaceId)
      .eq("status", "published")
      .not("remote_ref", "is", null)
      .limit(100);
    for (const o of ours ?? []) {
      const hit = live.find(
        (l) => o.remote_ref && (l.id === o.remote_ref || o.remote_ref.includes(l.id)),
      );
      if (hit) {
        const metrics: PostMetrics = {
          likes: hit.likes,
          comments: hit.comments,
          score: hit.likes + hit.comments * 3,
          fetchedAt: new Date().toISOString(),
        };
        await admin
          .from("social_posts")
          .update({ metrics } as never)
          .eq("id", o.id);
      }
    }
  }

  let sample: { text: string; likes: number; comments: number; provider: string; at: string }[] =
    live.map((l) => ({
      text: l.text,
      likes: l.likes,
      comments: l.comments,
      provider: l.provider as string,
      at: l.at,
    }));
  let source: "live" | "internal" | "none" = live.length ? "live" : "none";
  if (!sample.length) {
    type Chain = {
      eq: (c: string, v: string) => Chain;
      not: (c: string, op: string, v: unknown) => Chain;
      limit: (n: number) => PromiseLike<{ data: unknown[] | null }>;
    };
    const { data: internal } = await (
      admin.from("social_posts") as unknown as { select: (s: string) => Chain }
    )
      .select("body, provider, published_at, metrics")
      .eq("workspace_id", workspaceId)
      .eq("status", "published")
      .not("metrics", "is", null)
      .limit(40);
    sample = (
      (internal ?? []) as unknown as {
        body: string;
        provider: string;
        published_at: string | null;
        metrics?: PostMetrics;
      }[]
    ).map((p) => {
      const m = (p as { metrics?: PostMetrics }).metrics ?? {};
      return {
        text: p.body.slice(0, 400),
        likes: m.likes ?? 0,
        comments: m.comments ?? 0,
        provider: p.provider,
        at: p.published_at ?? "",
      };
    });
    if (sample.length) source = "internal";
  }
  if (sample.length < 3) {
    return {
      analyzed: sample.length,
      source,
      summary:
        "لا توجد بيانات أداء كافية بعد — اربط إنستجرام أو فيسبوك وسنقرأ أداء آخر 25 منشوراً ونتعلّم منها تلقائياً.",
    };
  }

  const sorted = [...sample].sort((a, b) => b.likes + b.comments * 3 - (a.likes + a.comments * 3));
  const top = sorted.slice(0, 6);
  const bottom = sorted.slice(-4);
  const { freeChat } = await import("./nour-research.server");
  const raw = await freeChat(
    "",
    [
      {
        role: "system",
        content:
          "أنت محلل أداء سوشيال ميديا عربي. استخلص أنماطاً قابلة للتطبيق (هوك، طول، نبرة، نوع المحتوى، توقيت، دعوة الفعل) من الفرق بين الأفضل والأضعف. لا تختلق ما لا تدعمه البيانات.",
      },
      {
        role: "user",
        content: `الأفضل أداءً:\n${top.map((t) => `- [${t.provider} · ${t.at.slice(0, 10)} · ${t.likes}❤ ${t.comments}💬] ${t.text}`).join("\n")}\n\nالأضعف:\n${bottom
          .map((t) => `- [${t.provider} · ${t.likes}❤ ${t.comments}💬] ${t.text}`)
          .join(
            "\n",
          )}\n\nاكتب 6-9 قواعد عملية قصيرة بصيغة أوامر يطبّقها كاتب المحتوى في المنشورات القادمة، كل قاعدة في سطر يبدأ بـ«-». ثم سطر أخير يبدأ بـ«أفضل توقيت:» إن كان واضحاً من التواريخ.`,
      },
    ],
    { timeoutMs: 45_000, maxTokens: 700 },
  );
  const summary = raw.trim().slice(0, 2500);

  const title = "ما نجح في منشوراتك — تعلّم سِراج";
  const { data: existing } = await admin
    .from("brain_items")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("kind", "learning")
    .maybeSingle();
  const payload = {
    workspace_id: workspaceId,
    kind: "learning",
    title,
    meta: `تعلّم من الأداء · ${sample.length} منشوراً · ${new Date().toLocaleDateString("ar-EG")}`,
    body: summary,
    used_by: ["sonny", "dana", "adam"],
  };
  if (existing) await admin.from("brain_items").update(payload).eq("id", existing.id);
  else await admin.from("brain_items").insert(payload);

  return { analyzed: sample.length, summary, source };
}

/* ---------------- 4) أفكار اليوم ---------------- */

export async function dailyIdeas(
  admin: Admin,
  workspaceId: string,
  dialectHint?: string | null,
): Promise<{ title: string; hook: string; provider: string; prompt: string }[]> {
  const ctx = await workspaceContext(admin, workspaceId);
  const dialect = await resolveDialect(admin, workspaceId, dialectHint);
  const { freeChat } = await import("./nour-research.server");
  const timeZone = timezoneForCountry(ctx.ws.country);
  const { nowFacts } = await import("./time-awareness.server");
  const day = nowFacts(timeZone).long;
  const pulse = await ambientPulse(
    { country: ctx.ws.country, timeZone, topics: [ctx.ws.industry] },
    9_000,
  ).catch(() => "");
  const raw = await freeChat(
    "",
    [
      {
        role: "system",
        content: [systemFor(ctx, dialect, ctx.ws.industry), pulse].filter(Boolean).join("\n\n"),
      },
      {
        role: "user",
        content: `اليوم ${day}. اقترح 3 أفكار منشورات قابلة للنشر اليوم لهذه العلامة (مختلفة الأعمدة، مرتبطة بالموسم/اليوم إن أمكن). أخرج JSON فقط بهذا الشكل بالضبط (كائن فيه مصفوفة من 3 عناصر): {"ideas":[{"title":"…","hook":"أول سطر ≤ 12 كلمة","provider":"instagram|facebook|linkedin|x|tiktok"},{…},{…}]}`,
      },
    ],
    { json: true, timeoutMs: 40_000, maxTokens: 600, timeZone },
  );
  type Idea = { title: string; hook: string; provider: string };
  const ideas: Idea[] = extractJsonList<Idea>(raw, "title");
  if (!ideas.length) console.warn("[dailyIdeas] empty result; raw:", String(raw).slice(0, 300));
  return ideas
    .filter((i) => i && (i.title || i.hook))
    .slice(0, 3)
    .map((i) => ({
      title: String(i.title ?? "").slice(0, 100),
      hook: String(i.hook ?? "").slice(0, 160),
      provider: String(i.provider ?? "instagram"),
      prompt: `اكتب لي منشور ${i.provider ?? "إنستجرام"} عن: ${i.title} — ابدأ بهوك: «${i.hook}» مع صورة مناسبة.`,
    }));
}
