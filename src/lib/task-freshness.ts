/**
 * صلاحية طابور الاعتماد.
 *
 * المخرجات التي تبقى «بانتظار موافقتك» شهراً كاملاً لم تعد قراراً معلّقاً: هي
 * أرشيف. إبقاؤها داخل العدّاد نفسه يخنق الشاشة ويجعل الموظفين يقرأون إشارات
 * قديمة على أنها الوضع الحالي. لذلك نفصل الطابور الحيّ عن الأرشيف في مكان واحد
 * تستخدمه الواجهة والإحاطة وذاكرة التشغيل معاً — بلا تغيير في قاعدة البيانات.
 */

/** بعد هذه المدة يُعتبر المخرج المنتظر أرشيفاً لا قراراً معلّقاً. */
export const STALE_REVIEW_DAYS = 30;

const DAY_MS = 86_400_000;

export function staleBefore(now: number = Date.now()): string {
  return new Date(now - STALE_REVIEW_DAYS * DAY_MS).toISOString();
}

export function isStaleReview(
  task: { created_at?: string | null; updated_at?: string | null },
  now: number = Date.now(),
): boolean {
  const stamp = task.updated_at ?? task.created_at;
  if (!stamp) return false;
  const time = Date.parse(stamp);
  if (Number.isNaN(time)) return false;
  return now - time > STALE_REVIEW_DAYS * DAY_MS;
}

/** يقسّم المخرجات المنتظرة إلى طابور حيّ وأرشيف قديم. */
export function splitReview<T extends { created_at?: string | null; updated_at?: string | null }>(
  tasks: T[],
  now: number = Date.now(),
): { live: T[]; stale: T[] } {
  const live: T[] = [];
  const stale: T[] = [];
  for (const task of tasks) (isStaleReview(task, now) ? stale : live).push(task);
  return { live, stale };
}
