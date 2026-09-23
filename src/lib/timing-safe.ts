/**
 * مقارنة أسرار ثابتة الزمن.
 * المقارنة النصية المباشرة (`===`) تخرج عند أول حرف مختلف، فيتسرّب منها زمنٌ
 * يسمح نظرياً باستنتاج السر حرفاً حرفاً. هذا المصدر الوحيد لمقارنة الأسرار
 * في مسارات الكرون والويبهوك معاً حتى لا يعود الفرق بينها.
 */
export function secretsMatch(provided: string, expected?: string | null): boolean {
  if (!expected) return false;
  if (!provided) return false;
  let diff = provided.length ^ expected.length;
  const len = Math.max(provided.length, expected.length);
  for (let i = 0; i < len; i += 1) {
    diff |= (provided.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  return diff === 0;
}
