import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Send, Trash2 } from "lucide-react";

import { BrandLoader } from "@/components/site/BrandLoader";
import { createLinkCode, removeCommandLink } from "@/lib/command-channels.functions";
import {
  connectTelegram,
  disconnectTelegram,
  discoverTelegramChats,
  telegramStatus,
  testTelegram,
} from "@/lib/telegram.functions";

const field =
  "w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-jade";

/** ربط بوت تيليجرام الخاص بالعميل: النشر على قناته + التحكّم بالفريق من المحادثة. */
export function TelegramCommand({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const status = useServerFn(telegramStatus);
  const connect = useServerFn(connectTelegram);
  const test = useServerFn(testTelegram);
  const disconnect = useServerFn(disconnectTelegram);
  const code = useServerFn(createLinkCode);
  const remove = useServerFn(removeCommandLink);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [botToken, setBotToken] = useState("");
  const [mode, setMode] = useState<"shared" | "own" | null>(null);
  const [chatId, setChatId] = useState("");
  const [chats, setChats] = useState<{ id: string; title: string; type: string }[] | null>(null);
  const discover = useServerFn(discoverTelegramChats);

  const discoverMutation = useMutation({
    mutationFn: () => discover({ data: { workspaceId, botToken: botToken.trim() } }),
    onSuccess: (r) => {
      setError(null);
      setChats(r.chats);
      if (!r.chats.length) {
        setNotice(
          "لم أجد أي قناة بعد. أضف البوت مشرفاً في قناتك وانشر فيها أي رسالة (أو ابعت /start للبوت)، ثم اضغط اكتشاف مرة أخرى.",
        );
      } else {
        setNotice(null);
      }
    },
    onError: (e: Error) => {
      setNotice(null);
      setError(e.message);
    },
  });

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["telegram-channel", workspaceId],
    queryFn: () => status({ data: { workspaceId } }),
  });
  // الوضع الافتراضي: بوت سهل الجاهز متى كان متاحاً، إلا إن اختار المستخدم غير ذلك.
  const activeMode: "shared" | "own" =
    mode ?? (data?.usesSharedBot || (!data?.connected && data?.sharedBotAvailable) ? "shared" : "own");
  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["telegram-channel", workspaceId] }),
      qc.invalidateQueries({ queryKey: ["pipedream-accounts", workspaceId] }),
      qc.invalidateQueries({ queryKey: ["integrations", workspaceId] }),
    ]);

  const connectMutation = useMutation({
    mutationFn: (input: { botToken: string; chatId: string; sendTest: boolean }) =>
      connect({ data: { workspaceId, ...input } }),
    onSuccess: (r) => {
      setError(null);
      setNotice(`تم الربط بقناة ${r.chatTitle}.`);
      invalidate();
    },
    onError: (e: Error) => {
      setNotice(null);
      setError(e.message);
    },
  });

  const testMutation = useMutation({
    mutationFn: () => test({ data: { workspaceId } }),
    onSuccess: (r) => {
      setError(null);
      setNotice(`الربط سليم · ${r.chatTitle} · وصلت رسالة الاختبار.`);
    },
    onError: (e: Error) => {
      setNotice(null);
      setError(e.message);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => disconnect({ data: { workspaceId } }),
    onSuccess: () => {
      setNotice("تم فكّ الربط.");
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const codeMutation = useMutation({
    mutationFn: (label: string) =>
      code({ data: { workspaceId, label: label || null, role: "owner", channel: "telegram" } }),
    onSuccess: (r) => {
      setNewCode(r.code);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <BrandLoader size="sm" />
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <Send className="size-5 text-jade" /> تيليجرام: النشر والتحكّم
        </h2>
        <p className="text-sm text-muted-foreground">
          اربط بوت شركتك وقناتك، فينشر الفريق عليها مثل باقي المنصات، وتقدر تدير شغلك من المحادثة:
          «يا سِراج اكتب بوست عن عرض اليوم» ← يرد بمسودة ← ترد «انشر».
        </p>
      </header>

      {error ? (
        <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-2xl bg-jade/12 px-4 py-3 text-sm font-semibold text-jade-deep">
          {notice}
        </p>
      ) : null}

      <section className="space-y-3 rounded-3xl border border-border p-4">
        <h3 className="text-sm font-black">اربط البوت والقناة</h3>
        {data?.connected ? (
          <p className="text-sm font-semibold text-jade-deep">
            مربوط · {data.usesSharedBot ? "بوت سهل الجاهز" : "بوت شركتك"}
            {data.botUsername ? ` · @${data.botUsername}` : ""}
            {data.chatTitle ? ` · ${data.chatTitle}` : ""}
          </p>
        ) : null}

        {data?.sharedBotAvailable ? (
          <div className="flex flex-wrap gap-2">
            {(["shared", "own"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-2xl border px-4 py-2 text-sm font-bold ${
                  activeMode === m ? "border-jade bg-jade/12" : "border-border hover:bg-secondary"
                }`}
              >
                {m === "shared" ? "بوت سهل الجاهز (بدون إعداد)" : "بوت شركتك من BotFather"}
              </button>
            ))}
          </div>
        ) : null}

        {!data?.connected ? (
          <ol className="list-decimal space-y-1 pe-5 text-sm text-muted-foreground">
            {activeMode === "shared" ? (
              <>
                <li>
                  أضف بوت سهل{data?.sharedBotUsername ? ` @${data.sharedBotUsername}` : ""} مشرفاً في
                  قناتك بصلاحية نشر الرسائل (أو ابعت له /start في محادثة خاصة).
                </li>
                <li>اكتب معرّف القناة (مثل ‎@mychannel) أو رقمها، ثم اضغط ربط.</li>
              </>
            ) : (
              <>
                <li>افتح @BotFather في تيليجرام وأنشئ بوتاً باسم شركتك، وانسخ التوكن.</li>
                <li>أضف البوت مشرفاً في قناتك أو مجموعتك بصلاحية نشر الرسائل.</li>
                <li>اكتب معرّف القناة (مثل ‎@mychannel) أو رقمها، ثم اضغط ربط.</li>
              </>
            )}
          </ol>
        ) : null}

        <form
          className="grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            connectMutation.mutate({
              botToken: activeMode === "shared" ? "" : botToken.trim(),
              chatId: chatId.trim(),
              sendTest: false,
            });
          }}
        >
          {activeMode === "own" ? (
            <input
              dir="ltr"
              required
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="123456789:AA..."
              className={field}
              autoComplete="off"
            />
          ) : null}
          <div className="flex gap-2">
            <input
              dir="ltr"
              required
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="@mychannel"
              className={field}
            />
            {activeMode === "own" ? (
              <button
                type="button"
                onClick={() => discoverMutation.mutate()}
                disabled={discoverMutation.isPending || !botToken.trim()}
                className="shrink-0 rounded-2xl border border-border px-4 py-3 text-sm font-bold hover:bg-secondary disabled:opacity-60"
              >
                {discoverMutation.isPending ? "…" : "اكتشف"}
              </button>
            ) : null}
          </div>
          {chats?.length ? (
            <ul className="sm:col-span-2 flex flex-wrap gap-2">
              {chats.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setChatId(c.id)}
                    className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${
                      chatId === c.id ? "border-jade bg-jade/12" : "border-border hover:bg-secondary"
                    }`}
                  >
                    {c.title} · {c.type}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-muted-foreground">
            الربط صامت تماماً: لن تظهر أي رسالة نظام في قناتك، أول رسالة يراها متابعوك هي منشورك
            أنت.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={connectMutation.isPending}
              className="rounded-2xl bg-foreground px-5 py-3 text-sm font-bold text-background disabled:opacity-60"
            >
              {connectMutation.isPending
                ? "جارٍ الربط…"
                : data?.connected
                  ? "إعادة الربط"
                  : "اربط تيليجرام"}
            </button>
            <button
              type="button"
              onClick={() => refetch()}
              className="flex items-center gap-2 rounded-2xl border border-border px-5 py-3 text-sm font-bold hover:bg-secondary"
            >
              <RefreshCw className={`size-4 ${isRefetching ? "animate-spin" : ""}`} /> تحديث
            </button>
          </div>
        </form>

        {data?.connected ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              className="rounded-2xl border border-border px-5 py-3 text-sm font-bold hover:bg-secondary disabled:opacity-60"
            >
              {testMutation.isPending ? "…" : "اختبر الربط"}
            </button>
            <button
              type="button"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="rounded-2xl border border-border px-5 py-3 text-sm font-bold text-destructive hover:bg-secondary disabled:opacity-60"
            >
              فكّ الربط
            </button>
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-3xl border border-border p-4">
        <h3 className="text-sm font-black">من يحقّ له إصدار الأوامر من تيليجرام</h3>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            codeMutation.mutate(String(f.get("label") ?? "").trim());
          }}
        >
          <input name="label" placeholder="اسم الشخص (اختياري)" className={`${field} sm:w-64`} />
          <button
            type="submit"
            disabled={codeMutation.isPending}
            className="rounded-2xl border border-border px-5 py-3 text-sm font-bold hover:bg-secondary disabled:opacity-60"
          >
            {codeMutation.isPending ? "…" : "أنشئ كود ربط"}
          </button>
        </form>
        {newCode ? (
          <p className="rounded-2xl bg-jade/12 px-4 py-3 text-sm font-semibold text-jade-deep">
            افتح البوت{data?.botUsername ? ` @${data.botUsername}` : ""} وأرسل له هذا الكود خلال ١٥
            دقيقة:{" "}
            <span dir="ltr" className="font-mono">
              {newCode}
            </span>
          </p>
        ) : null}

        <ul className="space-y-2">
          {(data?.links ?? []).map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 text-sm"
            >
              <span className="min-w-0 truncate">
                <span className="me-2 rounded-full bg-jade/12 px-2 py-0.5 text-[11px] font-black text-jade-deep">
                  مربوط
                </span>
                <span dir="ltr">{l.external_id}</span>
                {l.label ? ` · ${l.label}` : ""}
                {l.last_seen_at
                  ? ` · آخر نشاط ${new Date(l.last_seen_at).toLocaleDateString("ar-EG")}`
                  : ""}
              </span>
              <button
                type="button"
                aria-label="حذف"
                className="shrink-0 rounded-xl border border-border p-2 hover:bg-secondary"
                onClick={async () => {
                  await remove({ data: { workspaceId, id: l.id } });
                  invalidate();
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
          {!(data?.links ?? []).length ? (
            <li className="text-sm text-muted-foreground">لا أحد مربوط بعد.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
