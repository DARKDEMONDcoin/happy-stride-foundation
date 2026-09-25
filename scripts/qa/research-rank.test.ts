import { describe, expect, test } from "bun:test";
import { inferYear, rankFindings } from "../../src/lib/research-rank";

const f = (title: string, url: string, source = "بحث ويب", snippet = "") =>
  ({ title, url, source, snippet, kind: "evidence" }) as any;

describe("research ranking", () => {
  test("inferYear picks newest plausible year", () => {
    expect(inferYear("تحديث 2021 ثم 2024", 2026)).toBe(2024);
    expect(inferYear("نموذج 2099", 2026)).toBeUndefined();
    expect(inferYear("بدون سنة")).toBeUndefined();
  });

  test("fresh questions push dated pages down", () => {
    const rows = rankFindings(
      [
        f("سعر الذهب اليوم 26 أبريل 2024 في مصر", "https://a.com/1"),
        f("سعر الذهب اليوم في مصر لحظة بلحظة", "https://b.com/2"),
      ],
      { topic: "سعر الذهب اليوم في مصر", fresh: true },
    );
    expect(rows[0].url).toBe("https://b.com/2");
  });

  test("off-topic wikipedia pages are not evidence", () => {
    const rows = rankFindings(
      [
        f("تصميم مواقع الويب", "https://ar.wikipedia.org/wiki/x"),
        f("اتجاهات تصميم الشعارات 2026", "https://c.com/3"),
      ],
      { topic: "اتجاهات تصميم الشعارات" },
    );
    expect(rows.some((r) => r.url.includes("wikipedia"))).toBe(false);
  });
});

import { looksLikeGibberish } from "../../src/lib/search-intent";
test("gibberish never spends paid searches", () => {
  expect(looksLikeGibberish("asdkjh qwe")).toBe(true);
  expect(looksLikeGibberish("سعر الذهب")).toBe(false);
  expect(looksLikeGibberish("strength training")).toBe(false);
  expect(looksLikeGibberish("logo design trends 2026")).toBe(false);
  expect(looksLikeGibberish("quantum computing")).toBe(false);
});

import { countMatches, topicTokens, staleMonth } from "../../src/lib/research-rank";
test("Arabic definite article and prefixes match", () => {
  const tk = topicTokens("أخبار الاقتصاد المصري اليوم");
  expect(tk).not.toContain("اليوم");
  expect(countMatches("خفض توقعات نمو الاقتصاد المصري", tk)).toBe(2);
  expect(countMatches("تقرير عن والاقتصاد", ["الاقتصاد"])).toBe(1);
  expect(countMatches("المتحف المصري الكبير", ["مصر"])).toBe(0);
});
test("stale month detection", () => {
  const sept = new Date(2026, 8, 25);
  expect(staleMonth("سعر الدولار اليوم الأحد 21 أبريل", sept)).toBe(true);
  expect(staleMonth("سعر الدولار اليوم 24 سبتمبر", sept)).toBe(false);
});
