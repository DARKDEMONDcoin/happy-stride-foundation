/**
 * استخراج المحتوى الأساسي للصفحة بمكتبات مفتوحة المصدر (MIT):
 * - `@mozilla/readability` (محرك «وضع القراءة» في فايرفوكس)
 * - `linkedom` (DOM خفيف يعمل داخل بيئة الخادم/Workers بلا متصفح)
 *
 * الفائدة لنور: قياس طول المحتوى الحقيقي بدل احتساب القوائم والفوتر،
 * وتحليل مصطلحات المنافسين من متن المقال نفسه.
 */
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export type ReadableArticle = {
  title: string;
  text: string;
  wordCount: number;
  excerpt: string;
  byline: string;
};

/** يحوّل HTML إلى نص يحترم حدود الفقرات والعناصر حتى لا تلتصق الكلمات ببعضها. */
export function blockAwareText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|section|article|tr|td|th|blockquote|figcaption)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function extractArticle(html: string, url: string): ReadableArticle | null {
  try {
    const { document } = parseHTML(html);
    // Readability يحتاج baseURI لحل الروابط النسبية
    try {
      const base = document.createElement("base");
      base.setAttribute("href", url);
      document.head?.appendChild(base);
    } catch {
      // غير حرج
    }
    const article = new Readability(document as unknown as Document, {
      charThreshold: 200,
    }).parse();
    if (!article?.textContent) return null;
    // النص الخام من Readability يلصق الفقرات ببعضها («مواعيدالعمل»)، فنعيد حدود الكتل من HTML
    const text = blockAwareText(article.content ?? "") || article.textContent.replace(/\s+/g, " ").trim();
    if (text.length < 200) return null;
    return {
      title: (article.title ?? "").trim(),
      text,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      excerpt: (article.excerpt ?? "").trim().slice(0, 300),
      byline: (article.byline ?? "").trim(),
    };
  } catch {
    return null;
  }
}
