import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, FileText, Link2, StickyNote, Images, Search, Trash2, Loader2 } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { BrandVoiceExtractor } from "@/components/app/BrandVoiceExtractor";
import { BusinessProfileCard } from "@/components/app/BusinessProfileCard";
import { getMember } from "@/data/team";
import { brainKindLabel } from "@/data/app";
import { useAddBrainItem, useBrainItems, useDeleteBrainItem, useWorkspace } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Portrait } from "@/components/site/Portrait";
import { BrandLoader } from "@/components/site/BrandLoader";

export const Route = createFileRoute("/app/brain")({
  head: () => ({
    meta: [
      { title: "عقل العلامة | سهل" },
      {
        name: "description",
        content: "كل ما يعرفه فريقك عن علامتك: مستندات، روابط، قواعد نبرة، وصور.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BrainPage,
});

const kindIcon: Record<string, typeof FileText> = {
  doc: FileText,
  link: Link2,
  note: StickyNote,
  image: Images,
};

function BrainPage() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const { data: workspace } = useWorkspace();
  const { data: items, isLoading } = useBrainItems(workspace?.id);
  const add = useAddBrainItem(workspace?.id);
  const del = useDeleteBrainItem(workspace?.id);

  const list = (items ?? []).filter(
    (i) => (kind === "all" || i.kind === kind) && i.title.includes(query.trim()),
  );
  const filled = new Set((items ?? []).map((i) => i.kind)).size;

  return (
    <AppShell
      title="عقل العلامة"
      lead="كلما أطعمته أكثر، صار فريقك أدق — النبرة والأسعار والقواعد الممنوعة."
      actions={
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-foreground px-3 py-2 text-xs font-bold text-background sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
        >
          <Plus className="size-4" /> <span className="hidden sm:inline">أضف معرفة</span>
        </button>
      }
    >
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {workspace ? (
            <BusinessProfileCard
              workspaceId={workspace.id}
              website={(workspace as { website?: string | null }).website}
              profile={(workspace as { profile?: Record<string, unknown> }).profile as never}
              compact
              className="mb-4 sm:mb-6"
            />
          ) : null}
          <BrandVoiceExtractor workspaceId={workspace?.id} />
          <div className="mt-5 grid gap-2 sm:mt-6">
            <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5 sm:px-4">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث في معرفة علامتك…"
                aria-label="ابحث في معرفة علامتك"
                className="min-h-6 min-w-0 flex-1 bg-transparent py-1 text-sm outline-none sm:text-base"
              />
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
              {(["all", "doc", "link", "note", "image"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors sm:px-4 sm:py-2 sm:text-sm",
                    kind === k
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:bg-secondary",
                  )}
                >
                  {k === "all" ? "الكل" : brainKindLabel[k]}
                </button>
              ))}
            </div>
          </div>

          <form
            className={cn(
              "mt-5 space-y-3 rounded-3xl border border-border bg-card p-6",
              open ? "block" : "hidden",
            )}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const form = e.currentTarget;
              await add.mutateAsync({
                kind: String(f.get("kind")),
                title: String(f.get("title")),
                body: String(f.get("body")),
                meta: `${brainKindLabel[String(f.get("kind")) as keyof typeof brainKindLabel]} · أضيف يدوياً`,
              });
              form.reset();
              setOpen(false);
            }}
          >
            <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              <select
                name="kind"
                defaultValue="note"
                className="rounded-2xl border border-border px-4 py-3 outline-none focus:border-jade"
              >
                <option value="note">ملاحظة</option>
                <option value="doc">مستند</option>
                <option value="link">رابط</option>
                <option value="image">صورة</option>
              </select>
              <input
                name="title"
                required
                placeholder="العنوان — مثال: قائمة الأسعار ٢٠٢٥"
                className="rounded-2xl border border-border px-4 py-3 outline-none focus:border-jade"
              />
            </div>
            <textarea
              name="body"
              required
              placeholder="اكتب المحتوى الذي سيقرأه فريقك…"
              className="min-h-28 w-full resize-none rounded-2xl border border-border px-4 py-3 outline-none focus:border-jade"
            />
            <button
              type="submit"
              disabled={add.isPending || !workspace}
              className="rounded-full bg-foreground px-6 py-2.5 text-sm font-bold text-background disabled:opacity-60"
            >
              {add.isPending ? "جارٍ الحفظ…" : "احفظ في عقل العلامة"}
            </button>
          </form>

          {isLoading ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <BrandLoader size="sm" />
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {list.map((item) => {
                const Icon = kindIcon[item.kind] ?? StickyNote;
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{item.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.meta ?? item.body}
                      </span>
                    </span>
                    <span className="flex -space-x-2 space-x-reverse">
                      {item.used_by.map((uid) => {
                        const m = getMember(uid);
                        if (!m) return null;
                        return (
                          <span
                            key={uid}
                            title={m.name}
                            className="size-7 overflow-hidden rounded-full border-2 border-card"
                            style={{ background: m.tintSoft }}
                          >
                            <Portrait memberId={m.id} name={m.name} className="size-full" />
                          </span>
                        );
                      })}
                    </span>
                    <button
                      onClick={() => del.mutate(item.id)}
                      className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-coral"
                      aria-label="حذف"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                );
              })}
              {list.length === 0 ? (
                <li className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  لا توجد عناصر — أضف أول معرفة لعلامتك.
                </li>
              ) : null}
            </ul>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-border bg-card p-6">
            <h2 className="font-display font-black">اكتمال المعرفة</h2>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, ((items?.length ?? 0) / 8) * 100)}%`,
                  backgroundImage: "var(--gradient-aurora)",
                }}
              />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {items?.length ?? 0} عنصراً · {filled} أنواع مغطاة
            </p>
          </section>

          <section className="rounded-3xl border border-border bg-secondary/50 p-6">
            <h2 className="font-display font-black">قاعدة إلزامية</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              كل ما يُكتب في عقل العلامة يُطبَّق على جميع الموظفين فوراً — بدون إعادة تدريب.
            </p>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
