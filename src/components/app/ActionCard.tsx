/**
 * بطاقة «اعتماد إجراء حقيقي» داخل المحادثة.
 * الموظف يجهّز الإجراء بقيمه كاملة على تكامله المربوط (بريد، موعد، صفقة، رسالة…)
 * والمالك يعتمده بضغطة واحدة — أو يعدّل أي حقل قبل التنفيذ.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { runEmployeeAction } from "@/lib/employee-actions.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type PendingAction = {
  id: string;
  provider: string;
  label: string;
  inputs: { name: string; label: string; required?: boolean }[];
  values: Record<string, string>;
};

export function ActionCard({
  workspaceId,
  action,
  onDone,
}: {
  workspaceId: string;
  action: PendingAction;
  onDone?: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(action.values ?? {});
  const [edit, setEdit] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exec = useServerFn(runEmployeeAction);
  const run = useMutation({
    mutationFn: () => exec({ data: { workspaceId, actionId: action.id, values } }),
    onSuccess: () => {
      setDone(true);
      setError(null);
      onDone?.();
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "تعذّر تنفيذ الإجراء."),
  });

  const missing = action.inputs
    .filter((i) => i.required && !(values[i.name] ?? "").trim())
    .map((i) => i.label);

  if (done) {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-mint/30 bg-mint/10 px-4 py-3 text-sm font-semibold animate-pop-in">
        <AppIcon name={action.provider} className="size-5 shrink-0" />
        <span>
          تم تنفيذ «{action.label}» فعلياً على {appLabel(action.provider)}.
        </span>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-sky/30 bg-sky/10 px-4 py-3 text-sm animate-pop-in">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 font-semibold sm:flex">
        <AppIcon name={action.provider} className="size-5 shrink-0" />
        <span className="min-w-0 flex-1">
          {action.label} — جاهز للتنفيذ على <b>{appLabel(action.provider)}</b>
        </span>
        <Button
          variant="ghost"
          type="button"
          onClick={() => setEdit((v) => !v)}
          aria-expanded={edit}
          className="col-span-2 min-h-9 shrink-0 text-xs text-muted-foreground hover:text-foreground"
        >
          {edit ? "إخفاء التفاصيل" : "مراجعة وتعديل"}
        </Button>
      </div>

      <div className={cn("mt-2 space-y-2", edit ? "" : "hidden")}>
        {action.inputs.map((i) => (
          <label key={i.name} className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              {i.label}
              {i.required ? " *" : ""}
            </span>
            <textarea
              dir="auto"
              rows={3}
              value={values[i.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [i.name]: e.target.value }))}
              className="w-full min-w-0 resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        ))}
      </div>

      {!edit ? (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {action.inputs
            .filter((i) => (values[i.name] ?? "").trim())
            .slice(0, 4)
            .map((i) => (
              <li key={i.name} className="truncate" dir="auto">
                <b>{i.label}:</b> {values[i.name]}
              </li>
            ))}
        </ul>
      ) : null}

      {error ? <p className="mt-2 text-xs font-semibold text-coral">{error}</p> : null}
      {missing.length ? (
        <p className="mt-2 text-xs font-semibold text-muted-foreground">
          أكمل: {missing.join("، ")}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={run.isPending || missing.length > 0}
          onClick={() => run.mutate()}
          className="min-h-10 rounded-xl bg-foreground px-4 py-2 text-xs font-bold text-background disabled:opacity-50"
        >
          {run.isPending ? "جارٍ التنفيذ…" : "اعتمد ونفّذ"}
        </Button>
        <Button
          variant="ghost"
          type="button"
          onClick={() => onDone?.()}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          لاحقاً
        </Button>
      </div>
    </div>
  );
}
