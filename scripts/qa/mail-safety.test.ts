import { expect, test } from "bun:test";
import { mailHeader, mimeHeader, mimeBody, rfc822 } from "../../src/lib/direct-actions.server";

test("Arabic subject retains MIME padding", () => {
  expect(mimeHeader("ب")).toBe("=?UTF-8?B?2Kg=?=");
});

test("mail headers reject injected recipients and control characters", () => {
  for (const value of ["a@example.com\r\nBcc: b@example.com", "x\ny", "x\0y"]) {
    expect(() => mailHeader(value)).toThrow();
    expect(() => mimeHeader(value)).toThrow();
    expect(() => rfc822(value, "test", "body")).toThrow();
  }
});

test("long Arabic subjects round trip using bounded encoded words", () => {
  const subject = "عرض السعر النهائي 😊 ".repeat(30);
  const words = mimeHeader(subject).split("\r\n ");
  expect(words.every((word) => word.length <= 75)).toBe(true);
  const decoded = words
    .map((word) => Buffer.from(word.slice(10, -2), "base64").toString("utf8"))
    .join("");
  expect(decoded).toBe(subject);
});

test("MIME bodies wrap at 76 characters and round trip", () => {
  const body = "مرحباً بكم\n".repeat(100);
  const encoded = mimeBody(body);
  expect(encoded.split("\r\n").every((line) => line.length <= 76)).toBe(true);
  expect(Buffer.from(encoded, "base64").toString("utf8")).toBe(body);
});
