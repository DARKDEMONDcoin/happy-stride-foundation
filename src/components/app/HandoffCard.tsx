import { Link } from "@tanstack/react-router";
import { ArrowUpLeft } from "lucide-react";

import { Portrait } from "@/components/site/Portrait";
import type { Handoff } from "@/lib/handoff";

/** بطاقة إحالة: هذا الطلب من اختصاص زميل — زر واحد ينقل الطلب إليه. */
export function HandoffCard({
  handoff,
  request,
  currentName,
}: {
  handoff: Handoff;
  request: string;
  currentName: string;
}) {
  return (
    <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] sm:flex sm:flex-wrap items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-3">
      <span className="block size-9 shrink-0 overflow-hidden rounded-xl shadow-sm">
        <Portrait memberId={handoff.id} name={handoff.name} className="size-full" />
      </span>
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere] text-sm">
        <span className="block font-bold">
          {handoff.topic} من اختصاص {handoff.name}
        </span>
        <span className="block text-xs text-muted-foreground">
          {handoff.role} — ينفّذها بعمق أكثر مني. أنقل له طلبك كما هو، أو أكمل معي هنا.
        </span>
      </span>
      <Link
        to="/app/chat/$id"
        params={{ id: handoff.id }}
        search={{ prompt: request.slice(0, 4000) }}
        className="col-span-2 inline-flex min-h-10 max-w-full whitespace-normal shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background transition-transform hover:-translate-y-0.5"
      >
        التوجّه إلى {handoff.name}
        <ArrowUpLeft className="size-3.5" />
      </Link>
      <span className="sr-only">أنت الآن مع {currentName}</span>
    </div>
  );
}
