/**
 * استخراج نص «reply» تدريجياً من JSON لم يكتمل بعد.
 * النموذج يُرجع JSON، لذا لا نعرض الخام للمستخدم — نعرض قيمة reply وهي تُكتب.
 */
export function partialReplyText(buffer: string): string {
  const key = buffer.search(/"reply"\s*:/);
  if (key < 0) return "";
  const colon = buffer.indexOf(":", key);
  let i = colon + 1;
  while (i < buffer.length && /\s/.test(buffer[i]!)) i++;
  if (buffer[i] !== '"') return "";
  i++;
  let raw = "";
  while (i < buffer.length) {
    const ch = buffer[i]!;
    if (ch === "\\") {
      const next = buffer[i + 1];
      if (next === undefined) break; // هروب لم يكتمل — نتوقف قبله
      raw += ch + next;
      i += 2;
      continue;
    }
    if (ch === '"') break;
    raw += ch;
    i++;
  }
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return "";
  }
}

/**
 * يحوّل دفعات النموذج الخام إلى دفعات نصية من ردّه المرئي فقط،
 * فلا يُرسل للمستخدم إلا الحروف الجديدة من الرد.
 */
export function createReplyStreamer(onText: (chunk: string) => void) {
  let buffer = "";
  let sent = 0;
  return {
    push(chunk: string) {
      buffer += chunk;
      const text = partialReplyText(buffer);
      if (text.length > sent) {
        onText(text.slice(sent));
        sent = text.length;
      }
    },
    reset() {
      buffer = "";
      sent = 0;
    },
  };
}
