import { createFileRoute } from "@tanstack/react-router";

/** سطر التتبّع الذي يضعه المستخدم في موقعه: يرسل زيارة واحدة لكل صفحة. */
export const Route = createFileRoute("/api/public/track")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const workspaceId = url.searchParams.get("w") ?? "";
        const origin = url.origin;
        const js = `(function(){try{var w=${JSON.stringify(workspaceId)};if(!w)return;var send=function(){var i=new Image();i.referrerPolicy="no-referrer-when-downgrade";i.src=${JSON.stringify(
          origin,
        )}+"/api/public/px?w="+encodeURIComponent(w)+"&h="+encodeURIComponent(location.host)+"&p="+encodeURIComponent(location.pathname||"/")+"&r="+encodeURIComponent(document.referrer||"")+"&t="+Date.now();};send();var push=history.pushState;history.pushState=function(){push.apply(this,arguments);send();};window.addEventListener("popstate",send);}catch(e){}})();`;
        return new Response(js, {
          headers: {
            "content-type": "application/javascript; charset=utf-8",
            "cache-control": "public, max-age=300",
            "access-control-allow-origin": "*",
          },
        });
      },
    },
  },
});
