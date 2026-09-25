import { describe, expect, test } from "bun:test";
import {
  guessEmployee,
  isPublishRequest,
  markdownToTelegramHtml,
  parseTelegramText,
  splitForTelegram,
} from "../../src/lib/telegram-format";

describe("telegram team routing", () => {
  test("name prefix picks the employee and is stripped", () => {
    expect(parseTelegramText("يا نور ابحثي عن المنافسين")).toEqual({ kind: "message", employeeId: "nour", text: "ابحثي عن المنافسين" });
    expect(parseTelegramText("دانة، صممي لوجو")).toEqual({ kind: "message", employeeId: "dana", text: "صممي لوجو" });
    expect(parseTelegramText("سِراج اكتب بوست")).toMatchObject({ employeeId: "sonny", text: "اكتب بوست" });
  });
  test("a word that merely starts with a name is not a call", () => {
    expect(parseTelegramText("نورت الدنيا")).toMatchObject({ employeeId: null });
    expect(parseTelegramText("سامحني")).toMatchObject({ employeeId: null });
  });
  test("slash commands", () => {
    expect(parseTelegramText("/adam حلل الحملة")).toEqual({ kind: "message", employeeId: "adam", text: "حلل الحملة" });
    expect(parseTelegramText("/siraj@SahlBot")).toMatchObject({ employeeId: "sonny", text: "" });
    expect(parseTelegramText("/team")).toMatchObject({ kind: "command", command: "team" });
    expect(parseTelegramText("/new")).toMatchObject({ kind: "command", command: "new" });
  });
  test("topic guess and publish intent", () => {
    expect(guessEmployee("اكتب مقال سيو")).toBe("nour");
    expect(guessEmployee("صباح الخير")).toBe("sonny");
    expect(isPublishRequest("اكتب بوست عن العرض وانشره على انستا")).toBe(true);
    expect(isPublishRequest("إيه رأيك في العرض؟")).toBe(false);
  });
});

describe("telegram formatting", () => {
  test("markdown to safe html", () => {
    const html = markdownToTelegramHtml("## عنوان\n- **مهم** <x>\n[رابط](https://a.com)");
    expect(html).toBe('<b>عنوان</b>\n• <b>مهم</b> &lt;x&gt;\n<a href="https://a.com">رابط</a>');
  });
  test("long replies are split under the limit", () => {
    const long = Array.from({ length: 40 }, (_, i) => `فقرة ${i} ${"ن".repeat(200)}`).join("\n\n");
    const parts = splitForTelegram(long);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 3800)).toBe(true);
  });
});
