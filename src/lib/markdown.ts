/**
 * تحويل مخرَج نور (Markdown) إلى HTML نظيف صالح للنشر + استخراج العنوان.
 * وحدة نقية (بلا متصفح ولا خادم) يستخدمها زر النشر اليدوي والنشر التلقائي المجدول.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** تنسيق داخل السطر: **عريض** و*مائل* و[نص](رابط). */
export function inline(text: string) {
  return esc(text)
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\s)\*([^*]+)\*/g, "$1<em>$2</em>");
}

export function toArticle(body: string): { title: string; html: string } {
  const lines = body.trim().split("\n");
  const first = (lines[0] ?? "")
    .replace(/^#+\s*/, "")
    .replace(/^\*+|\*+$/g, "")
    .trim();
  const hasTitle = first.length >= 3;
  const title = (hasTitle ? first : "مقال من نور").slice(0, 180);

  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };

  for (const raw of lines.slice(hasTitle ? 1 : 0)) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }
    const heading = /^(#{2,4})\s*(.+)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1]!.length;
      out.push(`<h${level}>${inline(heading[2]!)}</h${level}>`);
      continue;
    }
    const bullet = /^[-*•]\s+(.+)$/.exec(line);
    if (bullet) {
      if (list !== "ul") {
        closeList();
        out.push("<ul>");
        list = "ul";
      }
      out.push(`<li>${inline(bullet[1]!)}</li>`);
      continue;
    }
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
    if (numbered) {
      if (list !== "ol") {
        closeList();
        out.push("<ol>");
        list = "ol";
      }
      out.push(`<li>${inline(numbered[1]!)}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();

  const html = out.join("\n");
  return { title, html: html || `<p>${inline(body.trim())}</p>` };
}
