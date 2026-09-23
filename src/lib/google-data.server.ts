import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { pipedreamConfig, proxyRequest } from "./pipedream.server";

type Admin = SupabaseClient<Database>;
type GoogleProvider = "search-console" | "analytics";

async function accountIdFor(
  admin: Admin,
  workspaceId: string,
  provider: GoogleProvider,
): Promise<string> {
  const { data, error } = await admin
    .from("pipedream_accounts")
    .select("account_id")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .eq("status", "connected")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.account_id) {
    throw new Error(
      provider === "search-console"
        ? "اربط حساب Google Search Console من صفحة التكاملات أولاً."
        : "اربط حساب Google Analytics من صفحة التكاملات أولاً.",
    );
  }
  return data.account_id;
}

/** ينفذ طلبات Google عبر حساب OAuth المحفوظ في Pipedream، دون قراءة مفاتيح Google محلياً. */
export async function googleDataRequest<T>(
  workspaceId: string,
  provider: GoogleProvider,
  url: string,
  init?: { method?: "GET" | "POST"; body?: unknown },
): Promise<T> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const config = await pipedreamConfig();
  if (!config) throw new Error("وسيط التكاملات Pipedream غير مفعّل.");
  const accountId = await accountIdFor(supabaseAdmin, workspaceId, provider);
  return proxyRequest<T>(config, {
    workspaceId,
    accountId,
    url,
    method: init?.method ?? "GET",
    ...(init?.body === undefined ? {} : { body: init.body }),
    ...(init?.method === "POST" ? { headers: { "Content-Type": "application/json" } } : {}),
  });
}
