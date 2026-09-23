const platforms = [
  "إنستغرام",
  "لينكدإن",
  "فيسبوك",
  "إكس",
  "تيك توك",
  "يوتيوب",
  "بينترست",
  "واتساب",
  "جيميل",
  "سلاك",
  "شوبيفاي",
  "نوشن",
  "ووردبريس",
  "فيجما",
  "كانفا",
  "تحليلات جوجل",
];

export function Marquee() {
  const row = [...platforms, ...platforms];
  return (
    <section className="border-y border-border bg-background py-10">
      <p className="mb-6 text-center text-sm font-semibold tracking-wide text-muted-foreground">
        فريقك ينشر ويشتغل مباشرة على المنصات اللي تستخدمها
      </p>
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className="marquee-track brand-icon-track gap-3">
          {row.map((p, i) => (
            <span key={`${p}-${i}`} className="brand-word-chip">
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
