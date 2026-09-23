import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * IndexNow: إشعار فوري ومجاني تماماً لبينج/ياندكس (وشركائهما) بأن رابطاً جديداً أو محدّثاً جاهز للزحف.
 * لا يحتاج حساباً ولا مفتاح API مدفوعاً — فقط ملف مفتاح على موقع العميل.
 */
type IndexNowConfig = { key: string; keyLocation: string; host: string };

async function assertOwner(
  supabase: {
    rpc: (
      fn: "owns_workspace",
      args: { _workspace_id: string },
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  },
  workspaceId: string,
) {
  const { data, error } = await supabase.rpc("owns_workspace", { _workspace_id: workspaceId });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Forbidden: لا تملك هذه مساحة العمل.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type AdminClient = Awaited<ReturnType<typeof assertOwner>>;

/** توليد مفتاح IndexNow صالح (أحرف/أرقام، 32 حرفاً). */
function generateKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** تجهيز IndexNow لمساحة العمل: يولّد المفتاح ويحدد مسار ملف التحقق. */
export const setupIndexNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workspaceId: z.string().uuid(), siteUrl: z.string().min(4).max(300) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const raw = data.siteUrl.trim().replace(/\/+$/, "");
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== "https:") throw new Error("الموقع يجب أن يكون https.");

    const key = generateKey();
    const config: IndexNowConfig = {
      key,
      keyLocation: `${url.origin}/${key}.txt`,
      host: url.host,
    };

    const { error } = await admin.from("integration_credentials").upsert(
      {
        workspace_id: data.workspaceId,
        provider: "indexnow",
        config: config as unknown as Record<string, string>,
      },
      { onConflict: "workspace_id,provider" },
    );
    if (error) throw new Error(error.message);

    await admin
      .from("integrations")
      .update({ status: "connected", account: url.host })
      .eq("workspace_id", data.workspaceId)
      .eq("provider", "indexnow");

    return { ok: true as const, ...config };
  });

async function loadConfig(admin: AdminClient, workspaceId: string): Promise<IndexNowConfig | null> {
  const { data } = await admin
    .from("integration_credentials")
    .select("config")
    .eq("workspace_id", workspaceId)
    .eq("provider", "indexnow")
    .maybeSingle();
  const config = data?.config as IndexNowConfig | undefined;
  return config?.key && config.host ? config : null;
}

/** إرسال روابط إلى IndexNow (بينج + ياندكس) — مجاني وفوري. */
export async function submitIndexNowFor(
  admin: AdminClient,
  workspaceId: string,
  urls: string[],
): Promise<{ submitted: number; endpoints: { endpoint: string; status: number }[] } | null> {
  const config = await loadConfig(admin, workspaceId);
  if (!config) return null;
  const clean = Array.from(new Set(urls.filter((u) => /^https?:\/\//.test(u)))).filter((u) => {
    try {
      return new URL(u).host === config.host;
    } catch {
      return false;
    }
  });
  if (!clean.length) return { submitted: 0, endpoints: [] };

  const body = JSON.stringify({
    host: config.host,
    key: config.key,
    keyLocation: config.keyLocation,
    urlList: clean.slice(0, 100),
  });

  const endpoints = ["https://api.indexnow.org/indexnow", "https://yandex.com/indexnow"];
  const results = await Promise.all(
    endpoints.map(async (endpoint) => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body,
          signal: AbortSignal.timeout(12_000),
        });
        return { endpoint, status: res.status };
      } catch {
        return { endpoint, status: 0 };
      }
    }),
  );

  return { submitted: clean.length, endpoints: results };
}

/** إرسال روابط يدوياً من الواجهة. */
export const submitIndexNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        urls: z.array(z.string().url()).min(1).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const result = await submitIndexNowFor(admin, data.workspaceId, data.urls);
    if (!result) throw new Error("IndexNow غير مهيأ — جهّزه أولاً من صفحة التكاملات.");
    if (!result.submitted) throw new Error("الروابط لا تنتمي إلى النطاق المهيأ في IndexNow.");
    const accepted = result.endpoints.some((e) => e.status >= 200 && e.status < 300);
    return { ok: accepted, ...result };
  });

/** حالة IndexNow الحالية للعرض في الواجهة. */
export const indexNowStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context.supabase, data.workspaceId);
    const config = await loadConfig(admin, data.workspaceId);
    return config ? { ready: true as const, ...config } : { ready: false as const };
  });
