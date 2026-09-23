/**
 * نشر على Ghost عبر Admin API (مجاني مع أي تنصيب Ghost أو Ghost Pro).
 * المصادقة: مفتاح إداري بالشكل `id:secret` يُحوَّل إلى JWT موقّع HS256 عبر Web Crypto.
 */

export type GhostConfig = { apiUrl: string; adminKey: string; title?: string };

function b64url(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlText(text: string): string {
  return b64url(new TextEncoder().encode(text));
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    throw new Error("المفتاح الإداري لـ Ghost غير صحيح — انسخه كاملاً بالشكل id:secret.");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

/** ينشئ رمز JWT قصير الأجل مطلوباً من Ghost Admin API. */
export async function ghostToken(adminKey: string): Promise<string> {
  const [id, secret] = adminKey.trim().split(":");
  if (!id || !secret) throw new Error("المفتاح الإداري لـ Ghost يجب أن يكون بالشكل id:secret.");
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlText(JSON.stringify({ alg: "HS256", typ: "JWT", kid: id }));
  const payload = b64urlText(JSON.stringify({ iat: now, exp: now + 300, aud: "/admin/" }));
  const key = await crypto.subtle.importKey(
    "raw",
    hexToBytes(secret) as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${b64url(new Uint8Array(signature))}`;
}

export function ghostBase(apiUrl: string): string {
  const raw = apiUrl.trim().replace(/\/+$/, "");
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("رابط Ghost يجب أن يكون https.");
  }
  return url.origin;
}

async function ghostFetch(config: GhostConfig, path: string, init?: RequestInit) {
  const token = await ghostToken(config.adminKey);
  const res = await fetch(`${ghostBase(config.apiUrl)}/ghost/api/admin${path}`, {
    signal: AbortSignal.timeout(30_000),
    ...init,
    headers: {
      Authorization: `Ghost ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Version": "v5.0",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("مفتاح Ghost الإداري غير صحيح أو لا يملك صلاحية النشر.");
    }
    if (res.status === 404) throw new Error("لم نجد واجهة Ghost على هذا الرابط.");
    throw new Error(`Ghost رفض الطلب [${res.status}]: ${text.slice(0, 180)}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("رد غير متوقع من Ghost — تأكد أن الرابط يشير إلى موقع Ghost.");
  }
}

/** يتحقق من الربط ويعيد اسم الموقع. */
export async function ghostSite(config: GhostConfig): Promise<string> {
  const data = (await ghostFetch(config, "/site/")) as { site?: { title?: string; url?: string } };
  return data.site?.title ?? data.site?.url ?? ghostBase(config.apiUrl);
}

/** ينشئ مقالاً (مسودة أو منشوراً) على Ghost. */
export async function ghostPublish(
  config: GhostConfig,
  article: { title: string; html: string },
  status: "draft" | "publish",
): Promise<{ id: string | null; url: string | null }> {
  const created = (await ghostFetch(config, "/posts/?source=html", {
    method: "POST",
    body: JSON.stringify({
      posts: [
        {
          title: article.title,
          html: article.html,
          status: status === "publish" ? "published" : "draft",
        },
      ],
    }),
  })) as { posts?: { id?: string; url?: string }[] };
  const post = created.posts?.[0];
  return { id: post?.id ?? null, url: post?.url ?? null };
}
