/**
 * إدارة كل مفاتيح التطبيق داخل قاعدة بيانات Supabase (جدول app_secrets).
 * أي مفتاح — قديم أو جديد — يُضاف من الإعدادات ويُقرأ فوراً من الكود بدون تعديل برمجي.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{1,127}$/;

/** المفاتيح التي يستفيد منها التطبيق مباشرة، تُعرض كمقترحات في الإعدادات. */
export const KNOWN_SECRETS = [
  { name: "GEMINI_API_KEY", label: "Gemini (كتابة وتحليل ذكي)" },
  { name: "OPENROUTER_API_KEY", label: "OpenRouter (بديل احتياطي للذكاء)" },
  { name: "GOOGLE_OAUTH_CLIENT_ID", label: "Google OAuth — المعرّف" },
  { name: "GOOGLE_OAUTH_CLIENT_SECRET", label: "Google OAuth — السر" },
  { name: "PIPEDREAM_CLIENT_ID", label: "Pipedream — المعرّف" },
  { name: "PIPEDREAM_CLIENT_SECRET", label: "Pipedream — السر" },
  { name: "PIPEDREAM_PROJECT_ID", label: "Pipedream — المشروع" },
  { name: "PIPEDREAM_ENVIRONMENT", label: "Pipedream — البيئة" },
  { name: "PIPEDREAM_WEBHOOK_SECRET", label: "Pipedream — سر الويبهوك" },
  {
    name: "PIPEDREAM_OAUTH_APP_FACEBOOK",
    label: "تطبيق ميتا الخاص بكم (OAuth Client ID في Pipedream) — لازم لنشر فيسبوك",
  },
  {
    name: "PIPEDREAM_OAUTH_APP_INSTAGRAM",
    label: "تطبيق ميتا الخاص بكم — لازم لنشر إنستجرام",
  },
] as const;

function mask(value: string): string {
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export const listSecrets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_secrets")
      .select("name, value, updated_at")
      .order("name");

    const rows = (data ?? []) as { name: string; value: string; updated_at: string }[];
    const stored = rows.map((r) => ({
      name: r.name,
      preview: mask((r.value ?? "").trim()),
      updatedAt: r.updated_at,
    }));
    const storedNames = new Set(stored.map((s) => s.name));

    return {
      stored,
      missing: KNOWN_SECRETS.filter((k) => !storedNames.has(k.name)).map((k) => ({ ...k })),
    };
  });

/** يحفظ/يحدّث مفتاحاً أو أكثر. يقبل لصق عدة أسطر بصيغة NAME=value. */
export const upsertSecrets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { entries?: { name: string; value: string }[]; bulk?: string }) => input)
  .handler(async ({ data }) => {
    const pairs = new Map<string, string>();

    for (const entry of data.entries ?? []) {
      const name = (entry.name ?? "").trim();
      const value = (entry.value ?? "").trim();
      if (name && value) pairs.set(name, value);
    }

    for (const raw of (data.bulk ?? "").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const at = line.search(/[=:]/);
      if (at <= 0) continue;
      const name = line.slice(0, at).trim();
      const value = line
        .slice(at + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (name && value) pairs.set(name, value);
    }

    const invalid = [...pairs.keys()].filter((n) => !NAME_RE.test(n));
    if (invalid.length) throw new Error(`أسماء غير صالحة: ${invalid.join("، ")}`);
    if (pairs.size === 0) return { saved: 0, names: [] as string[] };

    const now = new Date().toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("app_secrets").upsert(
      [...pairs].map(([name, value]) => ({ name, value, updated_at: now })),
      { onConflict: "name" },
    );
    if (error) throw new Error("تعذّر الحفظ في قاعدة البيانات.");

    const { resetSecretsCache } = await import("./secrets.server");
    resetSecretsCache();
    return { saved: pairs.size, names: [...pairs.keys()] };
  });

export const deleteSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string }) => ({ name: (input.name ?? "").trim() }))
  .handler(async ({ data }) => {
    if (!NAME_RE.test(data.name)) throw new Error("اسم غير صالح.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("app_secrets").delete().eq("name", data.name);
    const { resetSecretsCache } = await import("./secrets.server");
    resetSecretsCache();
    return { deleted: data.name };
  });

/** اختبار عملي: هل الذكاء الاصطناعي يردّ بالمفاتيح المحفوظة الآن؟ */
export const testAiProviders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { resetSecretsCache } = await import("./secrets.server");
    resetSecretsCache();
    const { providerKeys } = await import("./provider-keys.server");
    const keys = await providerKeys();
    if (!keys.gemini && !keys.openrouter) {
      return { ok: false, message: "لا يوجد مفتاح ذكاء اصطناعي محفوظ بعد." };
    }
    try {
      const { freeChat } = await import("./nour-research.server");
      const reply = await freeChat("", [{ role: "user", content: "قل: تم" }], {
        maxTokens: 16,
        race: false,
      });
      return { ok: true, message: `المزوّد يعمل ✅ — الرد: ${reply.slice(0, 60)}` };
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    }
  });
