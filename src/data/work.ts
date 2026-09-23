export type WorkItem = {
  id: string;
  employee: string;
  title: string;
  detail: string;
  channel: string;
  status: "done" | "running" | "review";
  time: string;
};

export const workFeed: WorkItem[] = [
  {
    id: "w1",
    employee: "sonny",
    title: "نشر كاروسيل «٣ أخطاء تستنزف ميزانيتك»",
    detail: "٥ شرائح بهوية العلامة + نص عربي مدقّق، نُشر في ذروة التفاعل.",
    channel: "instagram",
    status: "done",
    time: "قبل ١٢ دقيقة",
  },
  {
    id: "w2",
    employee: "eva",
    title: "فرز ٤٢ رسالة بريد وتحضير ٧ ردود",
    detail: "٣ رسائل تحتاج قرارك، والباقي رُدّ عليه بنبرتك تلقائياً.",
    channel: "gmail",
    status: "review",
    time: "قبل ٢٥ دقيقة",
  },
  {
    id: "w3",
    employee: "sam",
    title: "تسلسل متابعة لـ ١٨ عميلاً محتملاً",
    detail: "رسائل مخصّصة حسب القطاع، مع تذكير بعد ٣ أيام لغير المستجيبين.",
    channel: "linkedin",
    status: "running",
    time: "الآن",
  },
  {
    id: "w4",
    employee: "dana",
    title: "توليد ٦ بانرات لحملة نهاية الأسبوع",
    detail: "٣ مقاسات لكل منصة + نسخة داكنة، جاهزة للتصدير.",
    channel: "figma",
    status: "done",
    time: "قبل ساعة",
  },
  {
    id: "w5",
    employee: "nour",
    title: "مقال «دليل التسعير للمتاجر الصغيرة» (١٤٠٠ كلمة)",
    detail: "محسّن لكلمات مفتاحية عربية، مع وصف ميتا وروابط داخلية.",
    channel: "wordpress",
    status: "review",
    time: "قبل ٣ ساعات",
  },
  {
    id: "w6",
    employee: "adam",
    title: "تقرير الأسبوع: أفضل ٣ منشورات وأسوأ قناة إنفاق",
    detail: "توصية واحدة قابلة للتنفيذ: نقل ٢٠٪ من ميزانية الإعلانات إلى تيك توك.",
    channel: "analytics",
    status: "done",
    time: "أمس",
  },
];

export const kpis = [
  { k: "مهمة أُنجزت هذا الأسبوع", v: "184", d: "+23% عن الأسبوع الماضي" },
  { k: "ساعة عمل موفَّرة", v: "68", d: "ما يعادل موظفَين بدوام كامل" },
  { k: "منشور مجدول", v: "26", d: "على ٧ منصات" },
  { k: "تحتاج موافقتك", v: "3", d: "متوسط الانتظار ٩ دقائق" },
];

export const statusLabel: Record<WorkItem["status"], string> = {
  done: "مُنجز",
  running: "قيد التنفيذ",
  review: "بانتظار موافقتك",
};
