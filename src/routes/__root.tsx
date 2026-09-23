import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";

/** لون واجهة المتصفح الرسمي لسهل — المصدر الوحيد لهذا اللون في المشروع. */
export const BROWSER_THEME = "#9B741E";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { RegionProvider } from "@/hooks/use-region";
import { Button } from "@/components/ui/button";
import { CookieConsent } from "@/components/site/CookieConsent";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 font-display text-xl font-bold text-foreground">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          ربما تغيّر الرابط أو نُقلت الصفحة. يمكنك العودة إلى البداية بأمان.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link to="/">العودة للرئيسية</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-bold text-foreground">تعذّر تحميل الصفحة</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          حدث خطأ غير متوقع. جرّب مرة أخرى أو عد إلى الصفحة الرئيسية.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            المحاولة مجدداً
          </Button>
          <Button variant="outline" asChild>
            <a href="/">العودة للرئيسية</a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // لون المتصفح موحّد على كل الأجهزة: نفس اللون في الوضع الفاتح والداكن،
      // ومع color-scheme: light حتى لا يقلبه المتصفح تلقائياً.
      // وسم واحد بلا media: المتصفحات تُدمج الوسوم المتشابهة، وبقاء وسم مقيّد بـ media
      // كان يجعل اللون يختفي على بعض الأجهزة.
      { name: "theme-color", content: BROWSER_THEME },
      { name: "color-scheme", content: "light" },
      { name: "msapplication-TileColor", content: BROWSER_THEME },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { title: "سهل | فريق موظفين ذكاء اصطناعي لشركتك" },
      {
        name: "description",
        content:
          "سهل يمنحك فريق موظفين بالذكاء الاصطناعي يعملون 24/7: تسويق ونشر على السوشيال، رد على العملاء، مبيعات، وتصميم — بالعربي وبفهم كامل للسوق.",
      },
      { name: "author", content: "Sahl" },
      { property: "og:title", content: "سهل | فريق موظفين ذكاء اصطناعي لشركتك" },
      {
        property: "og:description",
        content: "موظفو ذكاء اصطناعي ينشرون، يردون، ويبيعون نيابة عنك — بالعربي، على مدار الساعة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Almarai:wght@300;400;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <RegionProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <CookieConsent />
      </RegionProvider>
    </QueryClientProvider>
  );
}
