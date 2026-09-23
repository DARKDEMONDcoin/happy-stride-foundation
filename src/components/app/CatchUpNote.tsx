import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { getMember } from "@/data/team";

type Task = { id: string; title: string; status: string; employee_id: string; created_at: string };

const KEY = "sahl:last-visit";

/**
 * «أثناء غيابك»: زميل يحكي لك ما أنجزه الفريق منذ آخر زيارة لك — لا لوحة أرقام.
 * وقت الزيارة الأخيرة يُحفظ في هذا المتصفح، فلا نحتاج بيانات إضافية.
 */
export function CatchUpNote({ tasks }: { tasks: Task[] }) {
  const [since, setSince] = useState<number | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(KEY);
    const prev = raw ? Number(raw) : NaN;
    setSince(Number.isFinite(prev) ? prev : null);
    window.localStorage.setItem(KEY, String(Date.now()));
  }, []);

  // نعرض الملاحظة فقط لو غاب أكثر من ساعة وحدث شغل فعلي بعد آخر زيارة.
  if (!since || Date.now() - since < 60 * 60 * 1000) return null;
  const fresh = tasks.filter((t) => new Date(t.created_at).getTime() > since);
  if (!fresh.length) return null;

  const names = [
    ...new Set(fresh.map((t) => getMember(t.employee_id)?.name).filter(Boolean) as string[]),
  ].slice(0, 3);
  const doneCount = fresh.filter((t) => t.status === "done").length;
  const waiting = fresh.filter((t) => t.status === "review").length;

  return (
    <section className="app-catchup" aria-label="ما حدث أثناء غيابك">
      <span className="app-catchup-icon" aria-hidden="true">
        <CheckCircle2 className="size-4" />
      </span>
      <p>
        <strong>أثناء غيابك:</strong> {names.length ? `${names.join(" و")} ` : "فريقك "}
        شغّل {fresh.length} مهمة
        {doneCount ? `، خلّص منها ${doneCount}` : ""}
        {waiting ? ` و${waiting} مستنية موافقتك` : ""}.
      </p>
      <Link to="/app/tasks" className="app-text-link inline-flex items-center gap-1.5">
        شوف التفاصيل <ArrowLeft className="size-4" />
      </Link>
    </section>
  );
}
