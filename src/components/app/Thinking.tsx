import { Portrait } from "@/components/site/Portrait";
import { cn } from "@/lib/utils";

/**
 * مؤشر انتظار الموظف: صورته فقط بلا أي أيقونة فوقها.
 * - سؤال أو دردشة: ثلاث نقاط والرد يظهر كاملاً مرة واحدة.
 * - طلب صريح: سطر يوصف ما يفعله الآن فعلاً، ثم نص ردّه وهو يُكتب حرفاً بحرف.
 */
export function Thinking({
  memberId,
  name,
  className,
  step,
  text,
}: {
  memberId: string;
  name: string;
  className?: string;
  /** المرحلة الحقيقية التي ينفّذها الموظف الآن. */
  step?: string | null;
  /** نص الرد المتدفّق حتى هذه اللحظة. */
  text?: string;
  /** محفوظة للتوافق مع مواضع الاستخدام — لا تؤثر على العرض. */
  request?: string;
  imageRequested?: boolean;
  attachments?: number;
}) {
  const streaming = Boolean(text && text.trim());

  return (
    <div
      className={cn(
        "chat-thinking-row flex min-w-0 justify-end gap-3 animate-bubble-in",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={`${name} يجهّز الرد`}
    >
      <span className="order-2 block size-9 shrink-0 overflow-hidden rounded-xl shadow-sm">
        <Portrait memberId={memberId} name={name} className="size-full" />
      </span>

      <div
        className={cn(
          "order-1 min-w-0 [overflow-wrap:anywhere] rounded-3xl rounded-se-lg border border-border bg-card px-4 py-3 shadow-sm",
          streaming || step ? "chat-thinking-content max-w-[min(46rem,82%)]" : "",
        )}
      >
        {step ? (
          <p
            dir="auto"
            className="mb-1.5 flex min-w-0 items-center gap-2 text-[0.72rem] font-semibold text-muted-foreground"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-primary think-dot" aria-hidden />
            <span className="min-w-0 [overflow-wrap:anywhere]">{step}</span>
          </p>
        ) : null}

        {streaming ? (
          <p dir="auto" className="whitespace-pre-wrap break-words text-sm leading-7">
            {text}
            <span className="typewriter-caret align-middle" aria-hidden="true" />
          </p>
        ) : step ? null : (
          <span className="flex items-center gap-1.5 py-0.5">
            <span className="size-2 rounded-full bg-primary think-dot" aria-hidden />
            <span
              className="size-2 rounded-full bg-primary think-dot [animation-delay:0.18s]"
              aria-hidden
            />
            <span
              className="size-2 rounded-full bg-primary think-dot [animation-delay:0.36s]"
              aria-hidden
            />
          </span>
        )}
      </div>
    </div>
  );
}
