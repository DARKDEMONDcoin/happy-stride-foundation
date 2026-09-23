/**
 * بيانات وهمية لواجهة التطبيق (قبل ربط Supabase).
 * كل الأنواع هنا مصمّمة لتطابق جداول قاعدة البيانات المستقبلية.
 */

export type Workspace = {
  id: string;
  name: string;
  industry: string;
  initials: string;
  tint: string;
};

export const workspaces: Workspace[] = [
  {
    id: "nakhla",
    name: "نخلة للتمور الفاخرة",
    industry: "تجارة تجزئة",
    initials: "نخ",
    tint: "var(--jade)",
  },
  {
    id: "madar",
    name: "مدار للاستشارات",
    industry: "خدمات احترافية",
    initials: "مد",
    tint: "var(--sky)",
  },
  { id: "ritaj", name: "رتاج العقارية", industry: "عقارات", initials: "رت", tint: "var(--amber)" },
];

export type UsageStat = { label: string; used: number; total: number; unit: string };

export const usage: UsageStat[] = [
  { label: "ساعات العمل هذا الشهر", used: 31.5, total: 50, unit: "ساعة" },
  { label: "المنشورات المجدولة", used: 26, total: 40, unit: "منشور" },
  { label: "المقاعد المستخدمة", used: 3, total: 5, unit: "مقعد" },
];

export type Integration = {
  id: string;
  owner: string; // employee id
  status: "connected" | "disconnected" | "error";
  account?: string;
};

export const integrations: Integration[] = [
  { id: "instagram", owner: "sonny", status: "connected", account: "@nakhla.dates" },
  { id: "x", owner: "sonny", status: "connected", account: "@nakhla" },
  { id: "linkedin", owner: "sonny", status: "error", account: "Nakhla Co." },
  { id: "tiktok", owner: "sonny", status: "disconnected" },
  { id: "facebook", owner: "sonny", status: "connected", account: "Nakhla" },
  { id: "gmail", owner: "eva", status: "connected", account: "hi@nakhla.sa" },
  { id: "calendar", owner: "eva", status: "connected", account: "hi@nakhla.sa" },
  { id: "whatsapp", owner: "eva", status: "disconnected" },
  { id: "hubspot", owner: "sam", status: "connected", account: "Nakhla CRM" },
  { id: "sheets", owner: "sam", status: "connected", account: "قوائم العملاء" },
  { id: "wordpress", owner: "nour", status: "connected", account: "nakhla.sa/blog" },
  { id: "search-console", owner: "nour", status: "connected", account: "nakhla.sa" },
  { id: "figma", owner: "dana", status: "disconnected" },
  { id: "canva", owner: "dana", status: "connected", account: "Nakhla Brand" },
  { id: "analytics", owner: "adam", status: "connected", account: "GA4 — nakhla.sa" },
  { id: "meta-ads", owner: "adam", status: "error", account: "Nakhla Ads" },
];

export const integrationStatusLabel: Record<Integration["status"], string> = {
  connected: "مرتبط",
  disconnected: "غير مرتبط",
  error: "يحتاج إعادة ربط",
};

export type BrainItem = {
  id: string;
  kind: "doc" | "link" | "note" | "image";
  title: string;
  meta: string;
  usedBy: string[];
};

export const brainItems: BrainItem[] = [
  {
    id: "b1",
    kind: "note",
    title: "نبرة العلامة: دافئة، واثقة، بدون مبالغة",
    meta: "ملاحظة · حُدّثت أمس",
    usedBy: ["sonny", "nour", "eva"],
  },
  {
    id: "b2",
    kind: "doc",
    title: "دليل الهوية البصرية 2026.pdf",
    meta: "مستند · 4.2MB",
    usedBy: ["dana", "sonny"],
  },
  {
    id: "b3",
    kind: "doc",
    title: "قائمة الأسعار وسياسة الشحن.xlsx",
    meta: "مستند · 180KB",
    usedBy: ["eva", "sam"],
  },
  {
    id: "b4",
    kind: "link",
    title: "nakhla.sa — صفحة من نحن",
    meta: "رابط · تمت قراءته",
    usedBy: ["nour", "sam"],
  },
  {
    id: "b5",
    kind: "note",
    title: "كلمات ممنوعة: «الأفضل في العالم»، «مجاناً 100%»",
    meta: "ملاحظة · قاعدة إلزامية",
    usedBy: ["sonny", "nour", "sam"],
  },
  {
    id: "b6",
    kind: "image",
    title: "٢٤ صورة منتجات عالية الدقة",
    meta: "صور · مجلد",
    usedBy: ["dana", "sonny"],
  },
  {
    id: "b7",
    kind: "doc",
    title: "أسئلة العملاء المتكررة (٣٢ سؤالاً)",
    meta: "مستند · 96KB",
    usedBy: ["eva", "sam"],
  },
];

export const brainKindLabel: Record<BrainItem["kind"], string> = {
  doc: "مستند",
  link: "رابط",
  note: "ملاحظة",
  image: "صور",
};

export type ChatMessage = {
  id: string;
  from: "user" | "agent";
  body: string;
  time: string;
};

export const conversations: Record<string, ChatMessage[]> = {
  sonny: [
    {
      id: "m1",
      from: "user",
      body: "جهّز لي خطة منشورات الأسبوع القادم مع التركيز على عرض التمور الفاخرة.",
      time: "٩:٠٤ ص",
    },
    {
      id: "m2",
      from: "agent",
      body: "تمام. بنيت ٧ منشورات: ٣ كاروسيل تعليمي، ٢ عرض مباشر، ريلز واحد، وقصة استفتاء. كلها بنبرة العلامة وبدون الكلمات الممنوعة. تحب أعرضها للمراجعة أم أجدولها مباشرة؟",
      time: "٩:٠٤ ص",
    },
    { id: "m3", from: "user", body: "اعرضها للمراجعة، وخلي الريلز يوم الخميس.", time: "٩:٠٦ ص" },
    {
      id: "m4",
      from: "agent",
      body: "نُقل الريلز للخميس ٨:٣٠ م (أعلى تفاعل لجمهورك). أرسلت ٧ عناصر إلى طابور الموافقات.",
      time: "٩:٠٦ ص",
    },
  ],
  eva: [
    {
      id: "m1",
      from: "agent",
      body: "ملخص الصباح: ٤ رسائل تحتاج قرارك، اجتماعان اليوم، وعرض مورّد ينتهي غداً. الباقي (٤١ رسالة) فُرز وأُرشف.",
      time: "٧:٣٠ ص",
    },
    { id: "m2", from: "user", body: "أرسل للمورّد أننا نحتاج مهلة أسبوع.", time: "٨:١٢ ص" },
    {
      id: "m3",
      from: "agent",
      body: "كتبت الرد بنبرتك ووضعته في الموافقات — سيُرسل فور اعتمادك.",
      time: "٨:١٢ ص",
    },
  ],
  sam: [
    { id: "m1", from: "user", body: "ابحث عن ٥٠ متجر هدايا في الرياض وجدة.", time: "أمس" },
    {
      id: "m2",
      from: "agent",
      body: "وجدت ٦٤ متجراً مطابقاً، فلترت ٥١ منها بمعلومات تواصل مؤكدة. بدأت تسلسل تواصل من ٣ رسائل على مدى ٧ أيام.",
      time: "أمس",
    },
  ],
  nour: [
    { id: "m1", from: "user", body: "نحتاج مقالاً عن فوائد التمور للرياضيين.", time: "قبل ساعتين" },
    {
      id: "m2",
      from: "agent",
      body: "الكلمة المستهدفة «تمور للرياضيين» — بحث شهري ٢٬٤٠٠ ومنافسة منخفضة. المسودة ١٤٠٠ كلمة جاهزة في الموافقات.",
      time: "قبل ساعتين",
    },
  ],
  dana: [
    {
      id: "m1",
      from: "user",
      body: "بانر لعرض نهاية الأسبوع بألوان الهوية.",
      time: "قبل ٤٠ دقيقة",
    },
    {
      id: "m2",
      from: "agent",
      body: "٦ نسخ جاهزة (مربع، ستوري، لاندسكيب، بنر موقع) + عنوانان بديلان لاختبار A/B.",
      time: "قبل ٣٨ دقيقة",
    },
  ],
  adam: [
    {
      id: "m1",
      from: "agent",
      body: "تنبيه: معدل إتمام السلة انخفض ١٨٪ منذ أمس — سياسة الشحن الجديدة هي السبب الأرجح.",
      time: "قبل ٣ ساعات",
    },
  ],
};

export const starterPrompts: Record<string, string[]> = {
  sonny: ["خطة محتوى لشهر كامل", "حوّل هذا المقال إلى ٥ منشورات", "رد على تعليقات اليوم"],
  eva: ["ملخص بريد اليوم", "رتّب اجتماعات الأسبوع", "اكتب رداً على هذا العميل"],
  sam: ["ابحث عن ٥٠ عميلاً محتملاً", "اكتب تسلسل متابعة", "حدّث حالة الصفقات"],
  nour: ["اقترح ١٠ كلمات مفتاحية", "اكتب مقالاً ١٥٠٠ كلمة", "حسّن صفحة قديمة"],
  dana: ["بانر لعرض جديد", "قوالب ستوري لأسبوع", "نظّف خلفية صور المنتجات"],
  adam: ["تقرير أداء الأسبوع", "ما القناة الأسوأ إنفاقاً؟", "توقع مبيعات الشهر"],
};

export type Approval = {
  id: string;
  employee: string;
  channel: string;
  type: string;
  title: string;
  preview: string;
  scheduled: string;
};

export const approvals: Approval[] = [
  {
    id: "a1",
    employee: "sonny",
    channel: "instagram",
    type: "منشور كاروسيل",
    title: "٣ علامات تدل أن تمورك مخزّنة غلط",
    preview:
      "الحرارة فوق ٢٥° تحوّل التمر الفاخر إلى عادي خلال أسبوعين. احفظ المنشور قبل ما تشتري كرتونتك الجاية 🌴",
    scheduled: "يُنشر غداً ٨:٣٠ م",
  },
  {
    id: "a2",
    employee: "eva",
    channel: "gmail",
    type: "رد بريد",
    title: "رد على مورّد التغليف — طلب مهلة",
    preview:
      "شكراً لعرضكم المحدّث. نحتاج مهلة أسبوع لاستكمال المراجعة الداخلية، ونعود لكم بقرار نهائي الأحد القادم.",
    scheduled: "يُرسل فور الاعتماد",
  },
  {
    id: "a3",
    employee: "nour",
    channel: "wordpress",
    type: "مقال",
    title: "التمور للرياضيين: دليل عملي (١٤٠٠ كلمة)",
    preview:
      "طاقة سريعة بدون سكر مصنّع… المقال يستهدف «تمور للرياضيين» مع ٤ روابط داخلية ووصف ميتا جاهز.",
    scheduled: "جاهز للنشر",
  },
  {
    id: "a4",
    employee: "sam",
    channel: "linkedin",
    type: "رسالة تواصل",
    title: "تسلسل تواصل لـ ١٨ متجر هدايا",
    preview:
      "أستاذة ريم، لاحظت توسّعكم بفرع جديد. نورّد لثلاث سلاسل مشابهة بهامش أعلى ١٩٪ — أرسل التفاصيل برسالة واحدة؟",
    scheduled: "يبدأ الإرسال ١٠:٠٠ ص",
  },
];

export type TaskItem = {
  id: string;
  employee: string;
  title: string;
  status: "queued" | "running" | "review" | "done" | "paused";
  when: string;
  steps: { label: string; state: "done" | "active" | "todo" | "blocked" }[];
};

export const tasks: TaskItem[] = [
  {
    id: "t1",
    employee: "sonny",
    title: "تقويم محتوى أكتوبر — ٣٠ منشوراً",
    status: "running",
    when: "يعمل الآن · ١٨/٣٠",
    steps: [
      { label: "بحث المواضيع", state: "done" },
      { label: "كتابة النصوص", state: "done" },
      { label: "توليد الصور", state: "active" },
      { label: "الجدولة", state: "todo" },
    ],
  },
  {
    id: "t2",
    employee: "adam",
    title: "مزامنة بيانات إعلانات ميتا",
    status: "paused",
    when: "متوقفة · انقطع الربط",
    steps: [
      { label: "الاتصال بالحساب", state: "blocked" },
      { label: "سحب البيانات", state: "todo" },
      { label: "بناء التقرير", state: "todo" },
    ],
  },
  {
    id: "t3",
    employee: "sam",
    title: "تسلسل متابعة ١٨ عميلاً",
    status: "review",
    when: "بانتظار موافقتك",
    steps: [
      { label: "بناء القائمة", state: "done" },
      { label: "كتابة الرسائل", state: "done" },
      { label: "اعتمادك", state: "active" },
      { label: "الإرسال", state: "todo" },
    ],
  },
  {
    id: "t4",
    employee: "nour",
    title: "تحديث ٦ مقالات قديمة",
    status: "queued",
    when: "تبدأ ١١:٠٠ م",
    steps: [
      { label: "تحليل الترتيب", state: "todo" },
      { label: "إعادة الكتابة", state: "todo" },
      { label: "النشر", state: "todo" },
    ],
  },
  {
    id: "t5",
    employee: "dana",
    title: "٦ بانرات لحملة نهاية الأسبوع",
    status: "done",
    when: "اكتملت قبل ساعة",
    steps: [
      { label: "المفاهيم", state: "done" },
      { label: "التصميم", state: "done" },
      { label: "التصدير", state: "done" },
    ],
  },
];

export const taskStatusLabel: Record<TaskItem["status"], string> = {
  queued: "في الطابور",
  running: "قيد التنفيذ",
  review: "بانتظار موافقتك",
  done: "مُنجزة",
  paused: "متوقفة",
};
