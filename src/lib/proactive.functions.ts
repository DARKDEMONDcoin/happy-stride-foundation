/**
 * دوال الخادم للمجدول الاستباقي: قراءة المبادرات وتحديثها وقبولها ورفضها.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const base = { workspaceId: z.string().uuid() };

export const listProposals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object(base).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("proposals")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("status", { ascending: true })
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const refreshProposalsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object(base).parse(input))
  .handler(async ({ data, context }) => {
    const { refreshProposals } = await import("./proactive.server");
    return refreshProposals(context.supabase, data.workspaceId);
  });

export const acceptProposalNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ...base, proposalId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { acceptProposal } = await import("./proactive.server");
    return acceptProposal(context.supabase, {
      workspaceId: data.workspaceId,
      proposalId: data.proposalId,
    });
  });

export const dismissProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ...base, proposalId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("proposals")
      .update({ status: "dismissed" })
      .eq("id", data.proposalId)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
