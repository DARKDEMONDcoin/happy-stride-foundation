import { createFileRoute } from "@tanstack/react-router";

/**
 * عودة تفويض ميتا: يبدّل الرمز بتوكن طويل المدى، يجلب الصفحات وحسابات إنستجرام،
 * ويحفظها في meta_connections ثم يعيد المستخدم إلى صفحة التكاملات.
 */
export const Route = createFileRoute("/api/public/meta/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const back = (path: string, params: Record<string, string>) => {
          const target = new URL(path, url.origin);
          for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
          return Response.redirect(target.toString(), 302);
        };
        const finishPopup = (
          returnTo: string,
          result: { ok: boolean; number?: string; reason?: string },
        ) => {
          const targetOrigin = new URL(returnTo, url.origin).origin;
          const message = JSON.stringify({ type: "siraj-whatsapp-connect", ...result }).replace(
            /</g,
            "\\u003c",
          );
          const origin = JSON.stringify(targetOrigin);
          const title = result.ok ? "تم ربط واتساب" : "تعذّر ربط واتساب";
          const detail = result.ok
            ? "تم الربط بنجاح. يمكنك إغلاق هذه النافذة."
            : result.reason || "تعذّر إكمال الربط. يمكنك إغلاق هذه النافذة والمحاولة مجددًا.";
          return new Response(
            `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;padding:32px;text-align:center"><h1>${title}</h1><p>${detail}</p><script>window.opener?.postMessage(${message},${origin});window.close();</script></body></html>`,
            {
              headers: {
                "content-type": "text/html; charset=utf-8",
                "cache-control": "no-store",
                "content-security-policy":
                  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
              },
            },
          );
        };

        const meta = await import("@/lib/meta.server");
        const config = await meta.metaConfig();
        if (!config) return back("/app/integrations", { meta: "failed", reason: "no-config" });

        const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");
        if (error)
          return back("/app/integrations", { meta: "failed", reason: error.slice(0, 160) });

        // اقرأ كود OAuth من الاستعلام الخام. URLSearchParams يعامل علامة + كمسافة
        // وفق form-urlencoded، وهو ما يفسد بعض أكواد ميتا ويؤدي إلى
        // "Invalid verification code format" رغم اكتمال موافقة المستخدم.
        const rawCode = /(?:^|&)code=([^&]*)/.exec(url.search.slice(1))?.[1];
        let code: string | null = null;
        try {
          code = rawCode ? decodeURIComponent(rawCode) : null;
        } catch {
          code = null;
        }
        const state = url.searchParams.get("state") ?? "";
        if (!code) return back("/app/integrations", { meta: "failed", reason: "no-code" });

        const verified = await meta.verifyState(config, state);
        if (!verified) return back("/app/integrations", { meta: "failed", reason: "bad-state" });

        try {
          const redirectUri = meta.metaRedirectUri(url.origin);
          const short = await meta.exchangeCode(config, code, redirectUri);
          let token = short;
          let expiresAt: string | null = null;
          try {
            const longLived = await meta.longLivedToken(config, short);
            token = longLived.token;
            expiresAt = longLived.expiresAt;
          } catch (tokenError) {
            // نجاح كود OAuth يكفي لإكمال الربط. لا نفشل الرحلة كلها إذا رفضت
            // ميتا فقط ترقية التوكن إلى طويل المدى؛ يمكن إعادة الربط لاحقاً.
            console.warn(
              "[meta] long-lived token exchange failed; using short-lived token",
              tokenError instanceof Error ? tokenError.message : tokenError,
            );
          }

          // مسار قناة واتساب: نكتشف الحساب والرقم تلقائياً بلا أي إدخال من المستخدم.
          if (verified.kind === "whatsapp") {
            const phones = await meta.discoverWabaPhones(config, token);
            if (!phones.length)
              return finishPopup(verified.returnTo, {
                ok: false,
                reason: "لم نجد رقم واتساب للأعمال في الحساب المصرّح به.",
              });
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { saveWhatsappFromMeta } = await import("@/lib/whatsapp.server");
            const saved = await saveWhatsappFromMeta(supabaseAdmin, verified.workspaceId, {
              token,
              phones,
            });
            // اشتراك تطبيقنا في ويبهوك كل حساب — حتى تصل الرسائل بلا إعداد يدوي.
            for (const wabaId of new Set(phones.map((p) => p.wabaId))) {
              try {
                await meta.subscribeWaba(wabaId, token);
              } catch (e) {
                console.error("[whatsapp] subscribe failed", e instanceof Error ? e.message : e);
              }
            }
            return finishPopup(verified.returnTo, {
              ok: true,
              number: saved.displayNumber,
            });
          }

          const [scopes, pages] = await Promise.all([
            meta.grantedScopes(token),
            meta.fetchPages(token),
          ]);
          if (!pages.length) return back(verified.returnTo, { meta: "failed", reason: "no-pages" });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const saved = await meta.saveConnections(supabaseAdmin, verified.workspaceId, {
            userToken: token,
            expiresAt,
            scopes,
            pages,
          });
          return back(verified.returnTo, {
            meta: "connected",
            pages: String(saved.facebook),
            ig: String(saved.instagram),
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "failed";
          console.error("[meta] callback failed", message);
          if (verified.kind === "whatsapp") {
            return finishPopup(verified.returnTo, { ok: false, reason: message.slice(0, 160) });
          }
          return back(verified.returnTo, { meta: "failed", reason: message.slice(0, 160) });
        }
      },
    },
  },
});
