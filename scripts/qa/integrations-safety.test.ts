/** اختبارات متانة التكاملات: منع العناوين الداخلية، منع التكرار، تجديد التوكن، إعادة المحاولة. */
import { expect, test } from "bun:test";

import { isPrivateHostname, normalizeSiteUrl } from "../../src/lib/integrations.functions";
import { fingerprint, recordIntegrationEvent } from "../../src/lib/integration-events.server";
import { isTransientMetaFailure, metaTokenNeedsRefresh } from "../../src/lib/meta.server";

test("العناوين الداخلية مرفوضة والعامة مقبولة", () => {
  for (const host of [
    "localhost",
    "127.0.0.1",
    "10.0.0.5",
    "192.168.1.10",
    "172.16.3.4",
    "169.254.169.254",
    "::1",
  ]) {
    expect(isPrivateHostname(host)).toBe(true);
  }
  expect(isPrivateHostname("example.com")).toBe(false);
  expect(isPrivateHostname("172.32.1.1")).toBe(false);
});

test("ربط ووردبريس يرفض http والعناوين الداخلية والمنافذ المخصصة", () => {
  expect(() => normalizeSiteUrl("http://example.com")).toThrow();
  expect(() => normalizeSiteUrl("https://169.254.169.254")).toThrow();
  expect(() => normalizeSiteUrl("https://example.com:8080")).toThrow();
  expect(() => normalizeSiteUrl("https://user:pass@example.com")).toThrow();
  expect(normalizeSiteUrl("example.com/blog/")).toBe("https://example.com/blog");
});

test("بصمة الحدث ثابتة للطلب نفسه ومختلفة عند اختلاف أي جزء", () => {
  const a = fingerprint(["pipedream", "CONNECTED", "acc_1"]);
  expect(fingerprint(["pipedream", "CONNECTED", "acc_1"])).toBe(a);
  expect(fingerprint(["pipedream", "CONNECTED", "acc_2"])).not.toBe(a);
});

test("الحدث المكرر لا يُنفَّذ مرتين", async () => {
  const seen = new Set<string>();
  const admin = {
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        const key = `${row["workspace_id"]}|${row["provider"]}|${row["event_key"]}`;
        if (seen.has(key)) return { error: { code: "23505" } };
        seen.add(key);
        return { error: null };
      },
    }),
  };
  const event = {
    workspaceId: "ws",
    provider: "facebook",
    eventKey: "evt_1",
    action: "publish",
  };
  expect(await recordIntegrationEvent(admin, event)).toBe(true);
  expect(await recordIntegrationEvent(admin, event)).toBe(false);
});

test("تجديد توكن ميتا يبدأ قبل الانتهاء بعشرة أيام", () => {
  const now = Date.now();
  const inDays = (d: number) => new Date(now + d * 86_400_000).toISOString();
  expect(metaTokenNeedsRefresh(inDays(40), now)).toBe(false);
  expect(metaTokenNeedsRefresh(inDays(5), now)).toBe(true);
  expect(metaTokenNeedsRefresh(null, now)).toBe(false);
});

test("أخطاء الازدحام والأعطال تُعاد المحاولة، وأخطاء الأذونات لا", () => {
  expect(isTransientMetaFailure(429)).toBe(true);
  expect(isTransientMetaFailure(503)).toBe(true);
  expect(isTransientMetaFailure(400, 4)).toBe(true);
  expect(isTransientMetaFailure(400, 190)).toBe(false);
  expect(isTransientMetaFailure(403, 200)).toBe(false);
});
