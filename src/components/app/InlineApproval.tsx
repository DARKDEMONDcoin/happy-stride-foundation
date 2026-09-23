import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Pencil, X } from "lucide-react";

import { useTasks, useUpdateTask } from "@/lib/data";
import { saveLearningFeedback } from "@/lib/learning.functions";
import { sanitizePostBody } from "@/lib/post-format";

/**
 * اعتماد المخرج داخل المحادثة نفسها — بلا مغادرة الشات.
 * صفحة «الموافقات» تبقى خياراً نصياً صغيراً فقط لمن يريد المراجعة لاحقاً.
 */
export function InlineApproval({
  workspaceId,
  taskId,
  employeeName,
  onEdit,
  onDone,
}: {
  workspaceId?: string | undefined;
  taskId: string;
  employeeName: string;
  onEdit?: (text: string) => void;
  onDone?: () => void;
}) {
  const { data: tasks } = useTasks(workspaceId);
  const update = useUpdateTask(workspaceId);
  const saveFeedback = useServerFn(saveLearningFeedback);
  const [busy, setBusy] = useState<"done" | "rejected" | null>(null);
  const [state, setState] = useState<"open" | "done" | "rejected">("open");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const task = (tasks ?? []).find((item) => item.id === taskId);
  const output = sanitizePostBody(task?.output ?? task?.detail ?? "") || task?.detail || "";

  const act = async (status: "done" | "rejected") => {
    setBusy(status);
    try {
      await update.mutateAsync({
        id: taskId,
        patch:
          status === "done"
            ? {
                status,
                steps: [
                  { label: "فهم الطلب", state: "done" },
                  { label: "التنفيذ", state: "done" },
                  { label: "مراجعتك", state: "done" },
                  { label: "النشر", state: "done" },
                ],
              }
            : { status },
      });
      if (workspaceId && task) {
        await saveFeedback({
          data: {
            workspaceId,
            taskId,
            employeeId: task.employee_id,
            kind: status === "done" ? "approved" : "rejected",
            reason:
              status === "rejected"
                ? reason.trim() || "رفض المالك المخرج من المحادثة"
                : "اعتمد المالك المخرج من المحادثة",
          },
        });
      }
      setState(status);
      onDone?.();
    } finally {
      setBusy(null);
      setRejecting(false);
    }
  };

  if (state !== "open") {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-sm font-semibold animate-pop-in">
        {state === "done" ? (
          <>
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-jade text-background">
              <Check className="size-3.5" strokeWidth={3} />
            </span>
            تم الاعتماد داخل المحادثة.
          </>
        ) : (
          <>
            <X className="size-4 text-coral" /> تم الرفض، و{employeeName} تعلّم من الملاحظة.
          </>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-0 [overflow-wrap:anywhere] rounded-2xl border border-jade/25 bg-jade/8 p-4 animate-pop-in">
      <p className="flex items-center gap-2 text-sm font-bold text-jade-deep">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-jade text-background">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
        {task?.title ? task.title : "المخرج جاهز"} — بانتظار اعتمادك
      </p>

      {rejecting ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            dir="auto"
            rows={2}
            placeholder={`ما الذي لم يعجبك؟ ${employeeName} سيتعلم منه.`}
            className="w-full rounded-xl border border-border bg-background p-3 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => void act("rejected")}
              disabled={busy !== null}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-coral px-4 text-xs font-bold text-background"
            >
              {busy === "rejected" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <X className="size-3.5" />
              )}
              تأكيد الرفض
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => setRejecting(false)}
              className="min-h-10 px-3 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              تراجع
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            type="button"
            onClick={() => void act("done")}
            disabled={busy !== null}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-jade-deep px-4 text-xs font-bold text-background transition-transform hover:-translate-y-0.5"
          >
            {busy === "done" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            اعتمد الآن
          </Button>
          {onEdit && output ? (
            <Button
              variant="ghost"
              type="button"
              onClick={() => onEdit(output)}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-bold"
            >
              <Pencil className="size-3.5" /> عدّل النص هنا
            </Button>
          ) : null}
          <Button
            variant="ghost"
            type="button"
            onClick={() => setRejecting(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-bold text-coral"
          >
            <X className="size-3.5" /> ارفض
          </Button>
          <Link
            to="/app/approvals"
            className="ms-auto inline-flex min-h-10 items-center text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            أو راجعه لاحقاً في صفحة الموافقات
          </Link>
        </div>
      )}
    </div>
  );
}
