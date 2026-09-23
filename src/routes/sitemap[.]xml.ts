import { createFileRoute } from "@tanstack/react-router";

import { useCases } from "@/data/use-cases";
import { team } from "@/data/team";
import { posts } from "@/data/blog";

const BASE_URL = "https://huggable-code-swap.lovable.app";

/** الصفحات العامة القابلة للفهرسة (صفحات /app محجوبة بـ noindex). */
const staticPaths = [
  "/",
  "/employees",
  "/use-cases",
  "/features",
  "/integrations",
  "/how-it-works",
  "/pricing",
  "/stories",
  "/blog",
  "/about",
  "/contact",
  "/faq",
  "/security",
  "/privacy",
  "/terms",
  "/cookies",
  "/acceptable-use",
  "/dpa",
  "/subprocessors",
  "/refunds",
];

function escapeXml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const paths = [
          ...staticPaths,
          ...useCases.map((u) => `/use-cases/${u.id}`),
          ...team.map((m) => `/employees/${m.id}`),
          ...posts.map((p) => `/blog/${p.slug}`),
        ];
        const urls = [...new Set(paths)]
          .map((p) => `<url><loc>${escapeXml(new URL(p, BASE_URL).href)}</loc></url>`)
          .join("");
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
          {
            headers: {
              "Content-Type": "application/xml",
              "Cache-Control": "public, max-age=3600",
            },
          },
        );
      },
    },
  },
});
