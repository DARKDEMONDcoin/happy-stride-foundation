import { describe, expect, test } from "bun:test";

import { isStaleReview, splitReview, STALE_REVIEW_DAYS } from "../../src/lib/task-freshness";

const DAY = 86_400_000;
const now = Date.parse("2026-09-20T00:00:00Z");

describe("صلاحية طابور الاعتماد", () => {
  test("المخرج الحديث يبقى في الطابور الحيّ", () => {
    expect(isStaleReview({ updated_at: new Date(now - 3 * DAY).toISOString() }, now)).toBe(false);
  });

  test("ما تجاوز المدة يصير أرشيفاً", () => {
    const old = new Date(now - (STALE_REVIEW_DAYS + 2) * DAY).toISOString();
    expect(isStaleReview({ updated_at: old }, now)).toBe(true);
  });

  test("بلا تاريخ لا يُؤرشَف", () => {
    expect(isStaleReview({}, now)).toBe(false);
  });

  test("القسمة تفصل الحيّ عن الأرشيف", () => {
    const { live, stale } = splitReview(
      [
        { id: "a", updated_at: new Date(now - DAY).toISOString() },
        { id: "b", updated_at: new Date(now - 90 * DAY).toISOString() },
        { id: "c", created_at: new Date(now - 60 * DAY).toISOString() },
      ],
      now,
    );
    expect(live.map((t) => t.id)).toEqual(["a"]);
    expect(stale.map((t) => t.id)).toEqual(["b", "c"]);
  });
});
