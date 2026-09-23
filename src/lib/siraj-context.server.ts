/**
 * سياق سِراج التشغيلي — ما ينقص أدوات السوشيال العالمية عند المنافسين:
 *  1) ذاكرة صوت العلامة الدائمة (تُحقن دائماً، لا تعتمد على ترتيب الاسترجاع).
 *  2) التعلّم من أداء منشوراتك الحقيقية (قواعد مستخلصة + أمثلة رابحة بأرقامها).
 *  3) وعي بالتقويم: ما هو مجدول قادماً حتى لا يكرّر أو يزاحم.
 *  4) أفضل وقت نشر من بياناتك أنت لا من جدول عام.
 * كل ذلك من بيانات مساحة العمل نفسها — بلا أي خدمة مدفوعة.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

type Metrics = { likes?: number; comments?: number; views?: number; score?: number };

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max).trim()}…` : text.trim();

const engagement = (m: Metrics | null | undefined) =>
  m?.score ?? (m?.likes ?? 0) + (m?.comments ?? 0) * 3 + Math.round((m?.views ?? 0) / 100);

const dayAr = (iso: string) =>
  new Date(iso).toLocaleDateString("ar-EG", {
    timeZone: "Asia/Riyadh",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

/** كتلة نصية جاهزة للحقن في تعليمات سِراج (فارغة إن لم تتوفر بيانات). */
export async function sirajContext(client: Client, workspaceId: string): Promise<string> {
  const nowIso = new Date().toISOString();
  const weekAhead = new Date(Date.now() + 7 * 86_400_000).toISOString();

  const [brainRes, publishedRes, scheduledRes] = await Promise.all([
    client
      .from("brain_items")
      .select("title, body, kind, meta")
      .eq("workspace_id", workspaceId)
      .in("kind", ["note", "learning"])
      .limit(60),
    client
      .from("social_posts")
      .select("body, provider, published_at, metrics")
      .eq("workspace_id", workspaceId)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(40),
    client
      .from("social_posts")
      .select("body, provider, scheduled_at")
      .eq("workspace_id", workspaceId)
      .eq("status", "scheduled")
      .gte("scheduled_at", nowIso)
      .lte("scheduled_at", weekAhead)
      .order("scheduled_at", { ascending: true })
      .limit(8),
  ]);

  const sections: string[] = [];

  /* ١) صوت العلامة — قاعدة إلزامية تُحقن حرفياً في كل مرة. */
  const brain = (brainRes.data ?? []) as { title: string; body: string; kind: string }[];
  const voice = brain.find((b) => b.title.includes("صوت العلامة"));
  if (voice?.body) {
    sections.push(`### صوت العلامة (قاعدة إلزامية — التزم بها حرفياً)\n${clip(voice.body, 1600)}`);
  }

  /* ٢) ما تعلّمه سِراج من أداء منشوراتك. */
  const learning = brain.find((b) => b.kind === "learning");
  if (learning?.body) {
    sections.push(
      `### قواعد مستخلصة من أداء حسابك الحقيقي (تُقدَّم على أي عُرف عام)\n${clip(learning.body, 1400)}`,
    );
  }

  /* ٣) أمثلة رابحة بأرقامها — تعلّم بالقدوة من حساب العميل نفسه. */
  type Row = {
    body: string;
    provider: string;
    published_at: string | null;
    metrics: Metrics | null;
  };
  const published = ((publishedRes.data ?? []) as unknown as Row[]).filter(
    (p) => engagement(p.metrics) > 0,
  );
  if (published.length >= 3) {
    const sorted = [...published].sort((a, b) => engagement(b.metrics) - engagement(a.metrics));
    const winners = sorted.slice(0, 3);
    // لا نعرض «الأضعف» إلا حين تكفي العيّنة، حتى لا يتكرر منشور موجود ضمن الأقوى.
    const loser = sorted.length >= 5 ? sorted[sorted.length - 1] : undefined;
    sections.push(
      [
        "### أقوى منشورات العميل فعلياً (حاكِ بنيتها وهوكها لا نصّها)",
        ...winners.map(
          (w) =>
            `- [${w.provider} · تفاعل ${engagement(w.metrics)}] ${clip(w.body.replace(/\s+/g, " "), 220)}`,
        ),
        loser ? `- الأضعف أداءً (تجنّب نمطه): ${clip(loser.body.replace(/\s+/g, " "), 160)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  } else if (published.length) {
    sections.push(
      "### الأداء\nلا توجد أرقام تفاعل كافية بعد. لا تدّعِ معرفة ما ينجح لهذا الحساب؛ اقترح اختباراً (A/B) وقس بعده.",
    );
  }

  /* ٤) وعي بالتقويم — منع التكرار والتزاحم. */
  const scheduled = (scheduledRes.data ?? []) as unknown as {
    body: string;
    provider: string;
    scheduled_at: string;
  }[];
  if (scheduled.length) {
    sections.push(
      [
        "### مجدول خلال ٧ أيام (لا تكرّر الفكرة ولا تزاحم الموعد)",
        ...scheduled.map(
          (s) =>
            `- ${dayAr(s.scheduled_at)} · ${s.provider}: ${clip(s.body.replace(/\s+/g, " "), 110)}`,
        ),
      ].join("\n"),
    );
  }

  if (!sections.length) return "";

  return [
    "## ذاكرة سِراج التشغيلية (بيانات هذا العميل — أعلى أولوية من أي قاعدة عامة)",
    ...sections,
    "قاعدة الاستخدام: طبّق صوت العلامة والقواعد المستخلصة دائماً. اذكر رقماً من الأداء فقط إن كان موجوداً أعلاه، ولا تخترع أرقاماً.",
  ].join("\n\n");
}
