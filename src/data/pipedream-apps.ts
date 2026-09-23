/**
 * خريطة منصاتنا ← تطبيقات Pipedream وإجراءاتها الجاهزة.
 * كل موظف يعمل على منصاته عبر Pipedream كوسيط واحد لكل التكاملات.
 *
 * المنطق مطابق لمنظومة Marblism (Eva/Sonny/Penny/Stan) وأوسع منها:
 * لكل تطبيق «قراءة» تغذّي الموظف بالواقع، و«إجراءات» ينفّذها فعلياً بعد اعتمادك.
 */

export type PipedreamAction = {
  /** معرّف المكوّن لدى Pipedream. */
  component: string;
  /** اسم خانة الحساب داخل configured_props. */
  accountProp: string;
  /** وصف عربي للإجراء يظهر في الواجهة. */
  label: string;
};

export type PipedreamApp = {
  /** المعرّف داخل منصتنا (نفس عمود provider في جدول integrations). */
  provider: string;
  /** اسم التطبيق لدى Pipedream (app slug). */
  slug: string;
  /** الاسم العربي للعرض. */
  label: string;
  /** إجراء النشر/الإرسال الأساسي إن وُجد. */
  publishComponent?: string;
  /** اسم خانة الحساب داخل configured_props للإجراء. */
  accountProp?: string;
  /** ملاحظة تشغيلية تُعرض للمستخدم قبل الربط. */
  note?: string;
  /** إجراءات إضافية يستطيع الموظف تنفيذها على هذا التطبيق. */
  actions?: Record<string, PipedreamAction>;
};

export const pipedreamApps: PipedreamApp[] = [
  {
    provider: "instagram",
    slug: "instagram_business",
    label: "إنستجرام",
    publishComponent: "instagram_business-create-post",
    accountProp: "instagram",
    note: "يتطلب حساب Instagram احترافي مرتبط بصفحة فيسبوك.",
  },
  {
    provider: "facebook",
    slug: "facebook_pages",
    label: "فيسبوك",
    publishComponent: "facebook_pages-create-post",
    accountProp: "facebookPages",
    note: "الربط يتم على مستوى الصفحة وليس الحساب الشخصي.",
  },
  {
    provider: "linkedin",
    slug: "linkedin",
    label: "لينكدإن",
    publishComponent: "linkedin-create-text-post-user",
    accountProp: "linkedin",
  },
  {
    provider: "x",
    slug: "twitter",
    label: "إكس",
    publishComponent: "twitter-create-tweet",
    accountProp: "app",
    note: "النشر عبر واجهة X يتطلب خطة مطوّر مدفوعة لدى X.",
  },
  {
    provider: "tiktok",
    slug: "tiktok_ads_manager",
    label: "تيك توك",
    note: "متاح لدى Pipedream عبر TikTok Ads Manager (تقارير وحملات)؛ النشر العضوي يحتاج اعتماد تطبيق من TikTok.",
    actions: {
      report: {
        component: "tiktok_ads_manager-get-report",
        accountProp: "app",
        label: "تقرير حملات تيك توك",
      },
    },
  },
  {
    provider: "youtube",
    slug: "youtube_data_api",
    label: "يوتيوب",
    publishComponent: "youtube_data_api-upload-video",
    accountProp: "youtubeDataApi",
  },
  {
    provider: "pinterest",
    slug: "pinterest",
    label: "بينترست",
    publishComponent: "pinterest-create-pin",
    accountProp: "pinterest",
    actions: {
      createPin: {
        component: "pinterest-create-pin",
        accountProp: "pinterest",
        label: "إنشاء بِن",
      },
    },
  },
  {
    provider: "gmail",
    slug: "gmail",
    label: "جيميل",
    publishComponent: "gmail-send-email",
    accountProp: "gmail",
    actions: {
      send: { component: "gmail-send-email", accountProp: "gmail", label: "إرسال بريد" },
      draft: { component: "gmail-create-draft", accountProp: "gmail", label: "حفظ مسودة بريد" },
    },
  },
  {
    provider: "outlook",
    slug: "microsoft_outlook",
    label: "أوتلوك",
    publishComponent: "microsoft_outlook-send-email",
    accountProp: "microsoftOutlook",
    actions: {
      send: {
        component: "microsoft_outlook-send-email",
        accountProp: "microsoftOutlook",
        label: "إرسال بريد",
      },
    },
  },
  {
    provider: "calendar",
    slug: "google_calendar",
    label: "تقويم جوجل",
    actions: {
      createEvent: {
        component: "google_calendar-create-event",
        accountProp: "googleCalendar",
        label: "إنشاء موعد",
      },
    },
  },
  {
    provider: "search-console",
    slug: "google_search_console",
    label: "Google Search Console",
    note: "تقرأ نور المواقع والكلمات والنقرات عبر ربط Google الرسمي.",
    actions: {
      performance: {
        component: "google_search_console-retrieve-site-performance-data",
        accountProp: "googleSearchConsole",
        label: "تقرير أداء البحث",
      },
      indexUrl: {
        component: "google_search_console-submit-url-for-indexing",
        accountProp: "googleSearchConsole",
        label: "طلب فهرسة رابط",
      },
    },
  },
  {
    provider: "analytics",
    slug: "google_analytics",
    label: "Google Analytics 4",
    note: "يقرأ آدم خصائص GA4 والجلسات والتحويلات عبر ربط Google الرسمي.",
    actions: {
      runReport: {
        component: "google_analytics-run-report-in-ga4",
        accountProp: "analytics",
        label: "تقرير GA4",
      },
    },
  },
  {
    provider: "whatsapp",
    slug: "whatsapp_business",
    label: "واتساب للأعمال",
    note: "التحكّم بسِراج عبر واتساب: يرسل لك المسودة وينتظر موافقتك الصريحة قبل النشر.",
    publishComponent: "whatsapp_business-send-text-message",
    accountProp: "whatsapp",
    actions: {
      sendText: {
        component: "whatsapp_business-send-text-message",
        accountProp: "whatsapp",
        label: "إرسال رسالة واتساب",
      },
      sendTemplate: {
        component: "whatsapp_business-send-text-using-template",
        accountProp: "whatsapp",
        label: "إرسال رسالة بقالب معتمد",
      },
    },
  },
  {
    provider: "hubspot",
    slug: "hubspot",
    label: "هابسبوت",
    publishComponent: "hubspot-create-or-update-contact",
    accountProp: "hubspot",
    actions: {
      createContact: {
        component: "hubspot-create-or-update-contact",
        accountProp: "hubspot",
        label: "إضافة جهة اتصال",
      },
      createDeal: { component: "hubspot-create-deal", accountProp: "hubspot", label: "إنشاء صفقة" },
    },
  },
  {
    provider: "salesforce",
    slug: "salesforce_rest_api",
    label: "سيلزفورس",
    actions: {
      createLead: {
        component: "salesforce_rest_api-create-lead",
        accountProp: "salesforce",
        label: "إضافة عميل محتمل",
      },
    },
  },
  {
    provider: "sheets",
    slug: "google_sheets",
    label: "جوجل شيتس",
    actions: {
      appendRow: {
        component: "google_sheets-add-single-row",
        accountProp: "googleSheets",
        label: "إضافة صف",
      },
    },
  },
  {
    provider: "drive",
    slug: "google_drive",
    label: "جوجل درايف",
    actions: {
      createTextFile: {
        component: "google_drive-create-file-from-text",
        accountProp: "googleDrive",
        label: "إنشاء ملف نصي",
      },
      searchFiles: {
        component: "google_drive-search-files",
        accountProp: "googleDrive",
        label: "بحث في الملفات",
      },
    },
  },
  {
    provider: "slack",
    slug: "slack_v2",
    label: "سلاك",
    publishComponent: "slack_v2-send-message",
    accountProp: "slack",
    actions: {
      send: { component: "slack_v2-send-message", accountProp: "slack", label: "إرسال رسالة" },
    },
  },
  {
    provider: "notion",
    slug: "notion",
    label: "نوشن",
    actions: {
      createPage: { component: "notion-create-page", accountProp: "notion", label: "إنشاء صفحة" },
    },
  },
  {
    provider: "airtable",
    slug: "airtable_oauth",
    label: "إيرتيبل",
    actions: {
      createRecord: {
        component: "airtable_oauth-create-single-record",
        accountProp: "airtable",
        label: "إضافة سجل",
      },
    },
  },
  {
    provider: "mailchimp",
    slug: "mailchimp",
    label: "ميلتشمب",
    actions: {
      addSubscriber: {
        component: "mailchimp-add-or-update-subscriber",
        accountProp: "mailchimp",
        label: "إضافة مشترك",
      },
    },
  },
  {
    provider: "stripe",
    slug: "stripe",
    label: "سترايب",
    actions: {
      createCustomer: {
        component: "stripe-create-customer",
        accountProp: "app",
        label: "إضافة عميل",
      },
      createInvoice: {
        component: "stripe-create-invoice",
        accountProp: "app",
        label: "إنشاء فاتورة",
      },
      createPayment: {
        component: "stripe-create-payment-intent",
        accountProp: "app",
        label: "إنشاء طلب دفع",
      },
    },
  },
  {
    provider: "telegram",
    slug: "telegram_bot_api",
    label: "تيليجرام",
    publishComponent: "telegram_bot_api-send-text-message-or-reply",
    accountProp: "telegramBotApi",
    actions: {
      send: {
        component: "telegram_bot_api-send-text-message-or-reply",
        accountProp: "telegramBotApi",
        label: "إرسال رسالة تيليجرام",
      },
    },
  },
  {
    provider: "figma",
    slug: "figma",
    label: "فيجما",
    actions: {
      comment: {
        component: "figma-post-a-comment",
        accountProp: "figmaApp",
        label: "تعليق على تصميم",
      },
      listComments: {
        component: "figma-list-comments",
        accountProp: "figmaApp",
        label: "قراءة التعليقات",
      },
    },
  },
  {
    provider: "canva",
    slug: "canva",
    label: "كانفا",
    actions: {
      createDesign: {
        component: "canva-create-design",
        accountProp: "canva",
        label: "إنشاء تصميم",
      },
      listDesigns: { component: "canva-list-designs", accountProp: "canva", label: "عرض التصاميم" },
      exportDesign: {
        component: "canva-export-design",
        accountProp: "canva",
        label: "تصدير تصميم",
      },
    },
  },
  {
    provider: "meta-ads",
    slug: "facebook_graph_api",
    label: "إعلانات ميتا",
    note: "لا يوفّر Pipedream إجراءات جاهزة لإعلانات ميتا؛ يقرأ آدم الأداء مباشرة عبر وكيل Pipedream بحساب المستخدم.",
  },
  {
    provider: "google-ads",
    slug: "google_ads",
    label: "إعلانات جوجل",
    actions: {
      report: {
        component: "google_ads-create-report",
        accountProp: "googleAds",
        label: "تقرير أداء",
      },
    },
  },
  {
    provider: "discord",
    slug: "discord",
    label: "ديسكورد",
    publishComponent: "discord-send-message",
    accountProp: "discord",
    actions: {
      send: { component: "discord-send-message", accountProp: "discord", label: "إرسال رسالة" },
    },
  },
  {
    provider: "reddit",
    slug: "reddit",
    label: "ريديت",
    actions: {
      submitPost: { component: "reddit-submit-a-post", accountProp: "reddit", label: "نشر موضوع" },
    },
  },
  {
    provider: "bluesky",
    slug: "bluesky",
    label: "بلوسكاي",
    publishComponent: "bluesky-create-post",
    accountProp: "app",
    actions: {
      post: { component: "bluesky-create-post", accountProp: "app", label: "نشر منشور" },
    },
  },
  {
    provider: "trello",
    slug: "trello",
    label: "تريلو",
    actions: {
      createCard: { component: "trello-create-card", accountProp: "app", label: "إنشاء كرت" },
    },
  },
  {
    provider: "asana",
    slug: "asana",
    label: "أسانا",
    actions: {
      createTask: { component: "asana-create-task", accountProp: "asana", label: "إنشاء مهمة" },
    },
  },
  {
    provider: "jira",
    slug: "jira",
    label: "جيرا",
    actions: {
      createIssue: { component: "jira-create-issue", accountProp: "app", label: "إنشاء تذكرة" },
    },
  },
  {
    provider: "clickup",
    slug: "clickup",
    label: "كليك أب",
    actions: {
      createTask: { component: "clickup-create-task", accountProp: "clickup", label: "إنشاء مهمة" },
    },
  },
  {
    provider: "monday",
    slug: "monday",
    label: "مندي",
    actions: {
      createItem: { component: "monday-create-item", accountProp: "monday", label: "إضافة عنصر" },
    },
  },
  {
    provider: "zoom",
    slug: "zoom",
    label: "زوم",
    actions: {
      createMeeting: {
        component: "zoom-create-meeting",
        accountProp: "zoom",
        label: "إنشاء اجتماع",
      },
    },
  },
  {
    provider: "pipedrive",
    slug: "pipedrive",
    label: "بايبدرايف",
    actions: {
      addDeal: {
        component: "pipedrive-add-deal",
        accountProp: "pipedriveApp",
        label: "إنشاء صفقة",
      },
      addPerson: {
        component: "pipedrive-add-person",
        accountProp: "pipedriveApp",
        label: "إضافة جهة اتصال",
      },
    },
  },
  {
    provider: "intercom",
    slug: "intercom",
    label: "إنتركوم",
    actions: {
      sendMessage: {
        component: "intercom-send-message-to-contact",
        accountProp: "intercom",
        label: "مراسلة عميل",
      },
    },
  },
  {
    provider: "twilio",
    slug: "twilio",
    label: "تويليو (SMS)",
    publishComponent: "twilio-send-message",
    accountProp: "twilio",
    actions: {
      sendSms: { component: "twilio-send-message", accountProp: "twilio", label: "إرسال SMS" },
    },
  },
  {
    provider: "google-business",
    slug: "google_my_business",
    label: "نشاطي على جوجل",
    publishComponent: "google_my_business-create-post",
    accountProp: "app",
    actions: {
      createPost: {
        component: "google_my_business-create-post",
        accountProp: "app",
        label: "نشر تحديث على النشاط",
      },
      listReviews: {
        component: "google_my_business-list-all-reviews",
        accountProp: "app",
        label: "قراءة التقييمات",
      },
      replyReview: {
        component: "google_my_business-create-update-reply-to-review",
        accountProp: "app",
        label: "الرد على تقييم",
      },
    },
  },
];

const byProvider = new Map(pipedreamApps.map((a) => [a.provider, a]));

export function pipedreamApp(provider: string): PipedreamApp | undefined {
  return byProvider.get(provider);
}

/** المنصات التي يديرها Pipedream نيابة عنا. */
export function isPipedreamProvider(provider: string): boolean {
  return byProvider.has(provider);
}

/** إجراء محدد على منصة محددة (إن كان مدعوماً). */
export function pipedreamAction(provider: string, action: string): PipedreamAction | undefined {
  return byProvider.get(provider)?.actions?.[action];
}
