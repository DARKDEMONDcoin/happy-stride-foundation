import { memo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/** يسمح فقط بوسوم نصية بسيطة داخل مخرجات الموظفين (فاصل سطر، تمييز، مرتفع/منخفض). */
const schema = {
  ...defaultSchema,
  tagNames: ["br", "sub", "sup", "mark", "kbd", "abbr", ...(defaultSchema.tagNames ?? [])],
};

/** عرض مخرجات الموظفين بتنسيق Markdown كامل (جداول، قوائم، عناوين، أكواد) بشكل احترافي وRTL. */
function MarkdownView({
  body,
  className,
  onOpenApp,
}: {
  body: string;
  className?: string;
  /** يفتح مسار داخلي (/app/...) داخل المحادثة نفسها؛ يرجع true إذا تعامل معه. */
  onOpenApp?: (path: string) => boolean;
}) {
  return (
    <div
      dir="auto"
      className={cn(
        "prose prose-sm min-w-0 max-w-full text-foreground [overflow-wrap:anywhere] prose-headings:font-display prose-headings:font-black",
        "prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-li:my-0.5",
        "prose-a:text-primary prose-a:underline-offset-4 prose-strong:font-bold",
        "prose-table:my-0 prose-table:text-sm prose-th:bg-secondary/60 prose-th:p-2",
        "break-words [&_pre]:max-w-full",
        "prose-td:p-2 prose-th:border prose-td:border prose-th:border-border prose-td:border-border",
        "prose-img:rounded-2xl prose-img:my-3 prose-img:w-full prose-img:border prose-img:border-border",
        "prose-hr:my-4 prose-blockquote:border-s-2 prose-blockquote:border-e-0 prose-blockquote:ps-3",
        "prose-blockquote:not-italic prose-blockquote:text-muted-foreground",
        "prose-code:rounded prose-code:bg-secondary prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:overflow-x-auto prose-pre:rounded-2xl prose-pre:bg-secondary prose-pre:text-foreground",
        // الأكواد دائماً بالاتجاه اللاتيني حتى لا تتشوّه وسوم HTML داخل واجهة عربية
        "[&_pre]:text-left [&_pre]:[direction:ltr] [&_pre_code]:[unicode-bidi:plaintext]",
        "[&_td>code]:[direction:ltr] [&_td>code]:inline-block",
        // الجداول: أعمدة مقروءة بدل حشر النص
        "[&_table]:w-full [&_th]:align-top [&_td]:align-top [&_td]:leading-6",
        "[&_th]:min-w-[6rem] [&_td]:min-w-[9rem] [&_td]:max-w-[22rem]",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
        components={{
          p: ({ children }) => <p dir="auto">{children}</p>,
          li: ({ children }) => <li dir="auto">{children}</li>,
          h1: ({ children }) => <h1 dir="auto">{children}</h1>,
          h2: ({ children }) => <h2 dir="auto">{children}</h2>,
          h3: ({ children }) => <h3 dir="auto">{children}</h3>,
          h4: ({ children }) => <h4 dir="auto">{children}</h4>,
          h5: ({ children }) => <h5 dir="auto">{children}</h5>,
          h6: ({ children }) => <h6 dir="auto">{children}</h6>,
          pre: ({ children }) => (
            <pre dir="ltr" tabIndex={0}>
              {children}
            </pre>
          ),
          code: ({ children, className: codeClass }) => (
            <code dir="auto" className={cn("[unicode-bidi:isolate]", codeClass)}>
              {children}
            </code>
          ),
          table: ({ children }) => (
            <div
              className="my-3 w-full min-w-0 overflow-x-auto rounded-lg border border-border focus-visible:outline-2 focus-visible:outline-ring"
              role="region"
              aria-label="جدول النتائج"
              tabIndex={0}
            >
              <table>{children}</table>
            </div>
          ),
          ...(onOpenApp
            ? {
                a: ({ href, children, ...rest }) => {
                  const path = typeof href === "string" ? href : "";
                  if (path.startsWith("/app")) {
                    return (
                      <button
                        type="button"
                        className="text-primary underline underline-offset-4"
                        onClick={() => {
                          onOpenApp(path);
                        }}
                      >
                        {children}
                      </button>
                    );
                  }
                  return (
                    <a href={href} target="_blank" rel="noreferrer" {...rest}>
                      {children}
                    </a>
                  );
                },
              }
            : {}),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}

/** الرسائل القديمة لا يعاد تحليل Markdown الخاص بها مع كل جزء يصل من البث. */
export const Markdown = memo(
  MarkdownView,
  (previous, next) => previous.body === next.body && previous.className === next.className,
);
