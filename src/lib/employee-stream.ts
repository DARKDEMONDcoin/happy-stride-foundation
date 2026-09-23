import { supabase } from "@/integrations/supabase/client";

export type EmployeeTurnPayload = {
  workspaceId: string;
  employeeId: string;
  conversationId: string;
  message: string;
  attachments?: {
    url: string;
    type: "image" | "video" | "file";
    alt?: string;
    mime?: string;
    size?: number;
  }[];
  imageMode?: "auto" | "off" | "manual";
  imagePrompt?: string | undefined;
  imageAspect?: "square" | "portrait" | "landscape" | "story";
  postLength?: "auto" | "short" | "medium" | "long";
};

export type EmployeeTurnResult = {
  qualityScore: number | null;
  savedDecisions: number;
  reply: string;
  messageId: string;
  createdTaskId: string | null;
  needsConnection: { provider: string; reason: string } | null;
  /** إجراء حقيقي جهّزه الموظف على تكامله المربوط، ينتظر اعتماد المالك. */
  action?: {
    id: string;
    provider: string;
    label: string;
    inputs: { name: string; label: string; required?: boolean }[];
    values: Record<string, string>;
  } | null;
  imageUrl: string | null;
  siteSuggestions: { url: string; alt: string; pageUrl: string }[];
};

export type EmployeeTurnHandlers = {
  /** مرحلة تنفيذ حقيقية بدأت الآن. */
  onStep?: (label: string) => void;
  /** حروف جديدة من ردّ الموظف وهو يُكتب. */
  onDelta?: (text: string) => void;
  /** إعادة البداية بعد تبديل المزوّد — يُفرَّغ النص المعروض. */
  onReset?: () => void;
};

/**
 * بثّ حقيقي لتنفيذ طلب الموظف: مراحل العمل الفعلية ثم نص الرد وهو يُكتب.
 * يُرجع نفس نتيجة askEmployee تماماً عند الانتهاء.
 */
export async function streamEmployeeTurn(
  payload: EmployeeTurnPayload,
  handlers: EmployeeTurnHandlers = {},
): Promise<EmployeeTurnResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("انتهت الجلسة — أعد تسجيل الدخول.");

  const res = await fetch("/api/employee-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: EmployeeTurnResult | null = null;
  let failure: string | null = null;

  const handle = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const body = trimmed.slice(5).trim();
    if (!body) return;
    let event:
      | { type: "step"; label: string }
      | { type: "delta"; text: string }
      | { type: "reset" }
      | { type: "done"; result: EmployeeTurnResult }
      | { type: "error"; message: string };
    try {
      event = JSON.parse(body);
    } catch {
      return;
    }
    if (event.type === "step") handlers.onStep?.(event.label);
    else if (event.type === "delta") handlers.onDelta?.(event.text);
    else if (event.type === "reset") handlers.onReset?.();
    else if (event.type === "done") result = event.result;
    else if (event.type === "error") failure = event.message;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) handle(line);
  }
  if (buffer) handle(buffer);

  if (failure) throw new Error(failure);
  if (!result) throw new Error("انقطع الاتصال قبل اكتمال الرد.");
  return result;
}
