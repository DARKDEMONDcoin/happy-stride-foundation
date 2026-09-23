/**
 * مخزن «آخر معلومة معروفة» — الضمانة النهائية ضد انقطاع الوعي.
 *
 * كل مرة تنجح فيها المصادر الحيّة نحفظ لقطة دائمة في قاعدة البيانات.
 * وإذا سقطت كل المصادر لاحقاً (حجب، انقطاع شبكة، حدود معدل)، يقرأ الموظف
 * آخر لقطة معروفة ويقدّمها صراحةً مع عمرها بدل الصمت أو الاختلاق.
 *
 * التخزين في Supabase لا في الذاكرة: العامل (worker) بلا حالة، والذاكرة تضيع
 * عند كل إعادة تشغيل، أما اللقطة فتبقى.
 */

export type SnapshotPayload = { text: string };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** يحفظ لقطة (kind + key) ويستبدل الأقدم. لا يرمي أبداً: الحفظ لا يعطّل الرد. */
export async function saveSnapshot(kind: string, key: string, text: string): Promise<void> {
  if (!text.trim()) return;
  try {
    const db = await admin();
    const res = await db
      .from("live_snapshots")
      .upsert(
        { kind, key, payload: { text } as SnapshotPayload, captured_at: new Date().toISOString() },
        { onConflict: "kind,key" },
      );
    if (res.error) console.error("[snapshot] save failed:", res.error.message);
  } catch (e) {
    console.error("[snapshot] save error:", String(e));
  }
}

export type Snapshot = { text: string; capturedAt: number; ageMs: number };

/** يقرأ آخر لقطة لمفتاح معيّن (أو لأي مفتاح ضمن النوع نفسه إن لم يوجد). */
export async function readSnapshot(
  kind: string,
  key: string,
  maxAgeMs = 48 * 60 * 60 * 1000,
): Promise<Snapshot | null> {
  try {
    const db = await admin();
    const exact = await db
      .from("live_snapshots")
      .select("payload, captured_at")
      .eq("kind", kind)
      .eq("key", key)
      .maybeSingle();
    let row = exact.data as { payload: SnapshotPayload; captured_at: string } | null;
    if (!row) {
      const any = await db
        .from("live_snapshots")
        .select("payload, captured_at")
        .eq("kind", kind)
        .order("captured_at", { ascending: false })
        .limit(1);
      row = (any.data?.[0] as { payload: SnapshotPayload; captured_at: string } | undefined) ?? null;
    }
    if (!row) return null;
    const capturedAt = Date.parse(row.captured_at);
    const ageMs = Date.now() - capturedAt;
    if (!Number.isFinite(capturedAt) || ageMs > maxAgeMs) return null;
    const text = row.payload?.text ?? "";
    if (!text.trim()) return null;
    return { text, capturedAt, ageMs };
  } catch {
    return null;
  }
}

/** مفتاح اللقطة: يفصل الأخبار عن الأسعار عن الطقس عن المدينة، فلا تختلط. */
export function snapshotKey(
  intent: Record<string, boolean>,
  opts: { country?: string | null; city?: string | null } = {},
): string {
  const place = (opts.city || opts.country || "global").toString().toLowerCase();
  if (intent["fx"]) return `fx:${place}`;
  if (intent["crypto"]) return "crypto:global";
  if (intent["weather"]) return `weather:${place}`;
  if (intent["prayer"]) return `prayer:${place}`;
  if (intent["sports"]) return "sports:global";
  if (intent["tech"]) return "news:tech";
  if (intent["news"]) return `news:${place}`;
  return `general:${place}`;
}
