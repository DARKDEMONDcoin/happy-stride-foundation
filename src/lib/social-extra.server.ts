/**
 * منصات إضافية لسِراج: بينترست، تيك توك — عبر وكيل Pipedream.
 * القراءة تغذّي سياق الموظف، والنشر لا يتم إلا بعد اعتماد المالك.
 */
import { proxyRequest, type PipedreamConfig } from "./pipedream.server";

type PinterestBoards = { items?: { id: string; name?: string }[] };
type PinterestPins = { items?: { id: string; title?: string; created_at?: string }[] };

/** إنشاء «بِن» على أول لوحة (أو لوحة محددة). */
export async function createPin(
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
  params: {
    title: string;
    description?: string;
    imageUrl: string;
    link?: string;
    boardId?: string;
  },
): Promise<{ id: string }> {
  let boardId = params.boardId;
  if (!boardId) {
    const boards = await proxyRequest<PinterestBoards>(config, {
      workspaceId,
      accountId,
      url: "https://api.pinterest.com/v5/boards?page_size=5",
    });
    boardId = boards.items?.[0]?.id;
  }
  if (!boardId) throw new Error("لا توجد لوحة بينترست — أنشئ لوحة أولاً.");

  const res = await proxyRequest<{ id?: string }>(config, {
    workspaceId,
    accountId,
    method: "POST",
    url: "https://api.pinterest.com/v5/pins",
    body: {
      board_id: boardId,
      title: params.title.slice(0, 100),
      description: (params.description ?? "").slice(0, 800),
      link: params.link,
      media_source: { source_type: "image_url", url: params.imageUrl },
    },
  });
  if (!res.id) throw new Error("تعذّر إنشاء البِن على بينترست.");
  return { id: res.id };
}

/** آخر البِنّات لسياق الموظف. */
export async function readPinterest(
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
): Promise<string> {
  const res = await proxyRequest<PinterestPins>(config, {
    workspaceId,
    accountId,
    url: "https://api.pinterest.com/v5/pins?page_size=10",
  });
  const items = res.items ?? [];
  if (!items.length) return "لا بِنّات حديثة على بينترست.";
  return items.map((p) => `- ${p.created_at ?? "?"} | ${p.title ?? "بلا عنوان"}`).join("\n");
}

type TikTokVideos = {
  data?: {
    videos?: { title?: string; like_count?: number; view_count?: number; create_time?: number }[];
  };
};

/** أداء آخر فيديوهات تيك توك (قراءة فقط). */
export async function readTikTok(
  config: PipedreamConfig,
  workspaceId: string,
  accountId: string,
): Promise<string> {
  const res = await proxyRequest<TikTokVideos>(config, {
    workspaceId,
    accountId,
    method: "POST",
    url: "https://open.tiktokapis.com/v2/video/list/?fields=title,like_count,view_count,create_time",
    body: { max_count: 10 },
  });
  const items = res.data?.videos ?? [];
  if (!items.length) return "لا فيديوهات حديثة على تيك توك.";
  return items
    .map(
      (v) =>
        `- ${v.create_time ? new Date(v.create_time * 1000).toISOString().slice(0, 10) : "?"} | ${(v.title ?? "").slice(0, 120)} | مشاهدات: ${v.view_count ?? "-"} | إعجابات: ${v.like_count ?? "-"}`,
    )
    .join("\n");
}
