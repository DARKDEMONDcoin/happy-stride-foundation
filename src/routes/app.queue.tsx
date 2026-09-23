import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { AppIcon, appLabel } from "@/components/site/AppIcon";
import { useSocialPosts, useWorkspace, type SocialPost } from "@/lib/data";
import { updateSocialPost } from "@/lib/social-queue.functions";
import { BrandLoader } from "@/components/site/BrandLoader";

export const Route = createFileRoute("/app/queue")({
  head: () => ({
    meta: [
      { title: "طابور النشر | سهل" },
      {
        name: "description",
        content:
          "تابع منشوراتك المجدولة على إنستجرام وفيسبوك ولينكدإن وإكس، وانشرها أو ألغِها بضغطة.",
      },
      { property: "og:title", content: "طابور النشر | سهل" },
      { property: "og:description", content: "منشوراتك المجدولة والمنشورة في مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QueuePage,
});

const STATUS: Record<string, { label: string; className: string }> = {
  scheduled: { label: "مجدول", className: "bg-secondary text-ink-soft" },
  idea: { label: "فكرة", className: "bg-amber/12 text-ink" },
  draft: { label: "مسودة", className: "bg-amber/12 text-ink" },
  publishing: { label: "ينشر الآن", className: "bg-jade/12 text-jade-deep" },
  published: { label: "منشور", className: "bg-jade/12 text-jade-deep" },
  failed: { label: "فشل", className: "bg-destructive/10 text-destructive" },
  cancelled: { label: "ملغى", className: "bg-secondary text-muted-foreground" },
};

function when(post: SocialPost) {
  const date = new Date(post.published_at ?? post.scheduled_at);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const text = date.toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
  return tz ? `${text} · بتوقيتك` : text;
}


function QueuePage() {
  const { data: workspace } = useWorkspace();
  const { data: posts, isLoading } = useSocialPosts(workspace?.id);
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (id: string, action: "cancel" | "retry") => {
    if (!workspace?.id) return;
    setBusyId(id);
    setError(null);
    try {
      await updateSocialPost({ data: { workspaceId: workspace.id, id, action } });
      void qc.invalidateQueries({ queryKey: ["social-posts", workspace.id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر تنفيذ الطلب.");
    } finally {
      setBusyId(null);
    }
  };

  const rows = posts ?? [];
  const upcoming = rows.filter((p) => p.status === "scheduled").length;

  return (
    <AppShell
      title="طابور النشر"
      lead={upcoming ? `${upcoming} منشوراً بانتظار موعده` : "لا منشورات مجدولة حالياً"}
      actions={
        <Link
          to="/app/calendar"
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-sm font-bold hover:bg-secondary"
        >
          <CalendarDays className="size-4" /> تقويم المحتوى
        </Link>
      }
    >
      {error ? (
        <p className="mb-4 rounded-2xl bg-destructive/10 p-4 text-sm font-bold text-destructive">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BrandLoader size="sm" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-14 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-ink-soft">
            <CalendarClock className="size-7" />
          </span>
          <h2 className="mt-5 font-display text-2xl font-black">الطابور فاضي</h2>
          <p className="mt-2 text-ink-soft">
            اعتمد منشوراً من صفحة الموافقات واختر «جدولة» ليظهر هنا وينشر في موعده تلقائياً.
          </p>
          <Link
            to="/app/calendar"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background"
          >
            <CalendarDays className="size-4" /> خطط أسبوعاً كاملاً مع سِراج
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {rows.map((p) => {
            const badge = STATUS[p.status] ?? STATUS["scheduled"]!;
            return (
              <article key={p.id} className="rounded-3xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-bold">
                    <AppIcon name={p.provider} className="size-4" />
                    {appLabel(p.provider)}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 font-bold ${badge.className}`}>
                    {badge.label}
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    {p.status === "published" ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : (
                      <CalendarClock className="size-3.5" />
                    )}
                    {when(p)}
                  </span>
                  {p.attempts > 1 ? (
                    <span className="text-muted-foreground">محاولات: {p.attempts}</span>
                  ) : null}
                </div>

                <div className="mt-3 flex gap-4">
                  {p.image_url ? (
                    <a href={p.image_url} target="_blank" rel="noreferrer" className="shrink-0">
                      <img
                        src={p.image_url}
                        alt=""
                        loading="lazy"
                        className="size-24 rounded-2xl border border-border object-cover sm:size-28"
                      />
                    </a>
                  ) : null}
                  <p className="line-clamp-5 min-w-0 whitespace-pre-wrap leading-relaxed text-ink-soft">
                    {p.body}
                  </p>
                </div>

                {p.last_error ? (
                  <p className="mt-3 inline-flex items-start gap-2 rounded-xl bg-destructive/8 p-3 text-xs text-destructive">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                    {p.last_error}
                  </p>
                ) : null}

                {p.status !== "published" && p.status !== "cancelled" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => void act(p.id, "retry")}
                      disabled={busyId === p.id}
                      className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-bold text-background disabled:opacity-60"
                    >
                      {busyId === p.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : p.status === "failed" ? (
                        <RefreshCw className="size-4" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      {p.status === "failed" ? "أعد المحاولة" : "انشر الآن"}
                    </button>
                    <button
                      onClick={() => void act(p.id, "cancel")}
                      disabled={busyId === p.id}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-60"
                    >
                      <Trash2 className="size-4" /> إلغاء
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
