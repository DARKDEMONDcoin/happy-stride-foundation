/**
 * لوحة «الإجراءات الحقيقية» للموظف داخل المحادثة:
 * يعرض ما يستطيع الموظف تنفيذه فعلياً (إرسال بريد، حجز موعد، تحديث CRM…)
 * ولا ينفّذ شيئاً إلا بعد تعبئة الحقول والضغط على «نفّذ الآن» صراحة.
 */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Zap } from "lucide-react";

import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { listEmployeeActions, runEmployeeAction } from "@/lib/employee-actions.functions";
import { cn } from "@/lib/utils";

type Props = {
  employeeId: string;
  workspaceId: string | undefined;
  /** المزودون المربوطون فعلاً لهذا الموظف. */
  connected: string[];
};

export function ActionPanel({ employeeId, workspaceId, connected }: Props) {
  const list = useServerFn(listEmployeeActions);
  const run = useServerFn(runEmployeeAction);
  const [openId, setOpenId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: actions } = useQuery({
    queryKey: ["employee-actions", employeeId],
    queryFn: () => list({ data: { employeeId } }),
  });

  const exec = useMutation({
    mutationFn: (actionId: string) =>
      run({ data: { workspaceId: workspaceId!, actionId, values } }),
    onSuccess: () => {
      setNote({ ok: true, text: "تم التنفيذ بنجاح." });
      setOpenId(null);
      setValues({});
    },
    onError: (e: unknown) =>
      setNote({ ok: false, text: e instanceof Error ? e.message : "تعذّر تنفيذ الإجراء" }),
  });

  if (!actions || actions.length === 0) return null;

  return (
    <section className="mt-5">
      <h2 className="text-sm font-black">تنفيذ مباشر</h2>
      <p className="mt-1 text-xs text-muted-foreground">يبدأ التنفيذ فقط بعد اعتمادك.</p>

      <ul className="mt-3 space-y-2">
        {actions.map((a) => {
          const ready = connected.includes(a.provider);
          const open = openId === a.id;
          return (
            <li key={a.id} className="rounded-lg border border-border/70">
              <button
                type="button"
                onClick={() => {
                  setNote(null);
                  setValues({});
                  setOpenId(open ? null : a.id);
                }}
                className="flex w-full items-center gap-2.5 p-2.5 text-start"
              >
                <AppIcon name={a.provider} className="size-5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{a.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {ready ? appLabel(a.provider) : `${appLabel(a.provider)} — غير مربوط`}
                  </span>
                </span>
                <Zap
                  className={cn("size-4 shrink-0", ready ? "text-jade" : "text-muted-foreground")}
                />
              </button>

              {open ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!workspaceId) return;
                    setNote(null);
                    exec.mutate(a.id);
                  }}
                  className="space-y-2 border-t border-border/70 p-3"
                >
                  {a.inputs.map((f) => (
                    <label key={f.name} className="block">
                      <span className="text-xs font-semibold text-ink-soft">{f.label}</span>
                      <input
                        dir="auto"
                        required={f.required}
                        value={values[f.name] ?? ""}
                        onChange={(ev) => setValues((v) => ({ ...v, [f.name]: ev.target.value }))}
                        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </label>
                  ))}
                  <button
                    type="submit"
                    disabled={!ready || !workspaceId || exec.isPending}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-bold text-background disabled:opacity-40"
                  >
                    {exec.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                    {ready ? "نفّذ الآن" : "اربط الحساب أولاً"}
                  </button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>

      {note ? (
        <p
          className={cn(
            "mt-3 rounded-2xl px-3 py-2 text-sm font-semibold",
            note.ok ? "bg-jade/12 text-jade-deep" : "bg-coral/12 text-coral",
          )}
        >
          {note.text}
        </p>
      ) : null}
    </section>
  );
}
