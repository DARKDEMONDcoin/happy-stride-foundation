/**
 * سجل أحداث التكاملات: أثر دائم لكل ربط/إرسال خارجي + منع تكرار نفس الحدث.
 * يعتمد فهرساً فريداً على (مساحة العمل، المنصة، مفتاح الحدث) فالتكرار يفشل بصمت ويُعاد "مكرر".
 */
type Admin = {
  from: (table: "integration_events") => {
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: { code?: string } | null }>;
  };
};

export type IntegrationEvent = {
  workspaceId: string;
  provider: string;
  /** مفتاح ثابت يصف هذا الحدث بالضبط (معرّف حدث المزوّد، أو بصمة الطلب). */
  eventKey: string;
  action: string;
  status?: "ok" | "error" | "skipped";
  detail?: Record<string, unknown>;
};

/**
 * يسجّل الحدث. يعيد `false` إن كان الحدث مسجّلاً من قبل (تكرار) فيمتنع المستدعي عن التنفيذ.
 * الفشل غير المتعلق بالتكرار لا يمنع العمل — نسجّله في الكونسول فقط.
 */
export async function recordIntegrationEvent(
  admin: Admin,
  event: IntegrationEvent,
): Promise<boolean> {
  const { error } = await admin.from("integration_events").insert({
    workspace_id: event.workspaceId,
    provider: event.provider,
    event_key: event.eventKey.slice(0, 200),
    action: event.action,
    status: event.status ?? "ok",
    detail: event.detail ?? null,
  });
  if (!error) return true;
  if (error.code === "23505") return false; // مكرر: نفس الحدث سُجّل سابقاً
  console.error("[integration-events] insert failed", error);
  return true;
}

/** بصمة ثابتة لمحاولة إرسال، تُستخدم كمفتاح منع تكرار عندما لا يعطينا المزوّد معرّف حدث. */
export function fingerprint(parts: (string | number | null | undefined)[]): string {
  const raw = parts.filter((p) => p !== null && p !== undefined).join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return `${raw.slice(0, 80)}#${(hash >>> 0).toString(36)}`;
}
