import { employeeDirectory, type EmployeeId } from "./team-knowledge";
/**
 * «الإجراءات الحقيقية» لكل موظف: بعد اعتمادك، ينفّذ الموظف الفعل نفسه
 * (إرسال بريد، حجز موعد، إضافة جهة اتصال أو صفقة، تسجيل صف في شيتس، رسالة سلاك…)
 * عبر إجراءات Pipedream الجاهزة — بلا أي توكن مخزّن لدينا.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { pipedreamAction, pipedreamApp } from "@/data/pipedream-apps";
import { extraEmployeeActions } from "./employee-actions-extra";
import {
  pipedreamConfig,
  runAction,
  missingConfigError,
  type PipedreamConfig,
} from "./pipedream.server";
import {
  pageTarget,
  replyToFacebookComment,
  replyToInstagramComment,
  hideComment,
  replyToMessenger,
} from "./social-inbox.server";
import { createPin } from "./social-extra.server";
import { metaAdsSummary } from "./ads-insights.server";
import { sendWhatsappText, createDriveFolder } from "./messaging-extra.server";

type Admin = SupabaseClient<Database>;

export type CustomActionContext = {
  config: PipedreamConfig;
  workspaceId: string;
  accountId: string;
  values: Record<string, string>;
};

export type EmployeeActionDef = {
  /** معرّف الإجراء داخل منصتنا. */
  id: string;
  employeeId: string;
  provider: string;
  /** مفتاح الإجراء داخل خريطة التطبيق (لإجراءات Pipedream الجاهزة). */
  action?: string;
  label: string;
  /** الحقول المطلوبة من المستخدم. */
  inputs: { name: string; label: string; required?: boolean }[];
  /** تحويل مدخلات المستخدم إلى خصائص إجراء Pipedream. */
  toProps?: (v: Record<string, string>) => Record<string, unknown>;
  /** تنفيذ مباشر عبر وكيل Pipedream حين لا يوجد إجراء جاهز. */
  run?: (ctx: CustomActionContext) => Promise<unknown>;
};

export const employeeActions: EmployeeActionDef[] = [
  {
    id: "eva-send-email",
    employeeId: "eva",
    provider: "gmail",
    action: "send",
    label: "إرسال بريد من جيميل",
    inputs: [
      { name: "to", label: "المستلم", required: true },
      { name: "subject", label: "الموضوع", required: true },
      { name: "body", label: "النص", required: true },
    ],
    toProps: (v) => ({
      to: [v["to"]],
      subject: v["subject"],
      body: v["body"],
      bodyType: "plaintext",
    }),
  },
  {
    id: "eva-draft-email",
    employeeId: "eva",
    provider: "gmail",
    action: "draft",
    label: "حفظ مسودة بريد",
    inputs: [
      { name: "to", label: "المستلم", required: true },
      { name: "subject", label: "الموضوع", required: true },
      { name: "body", label: "النص", required: true },
    ],
    toProps: (v) => ({
      to: [v["to"]],
      subject: v["subject"],
      body: v["body"],
      bodyType: "plaintext",
    }),
  },
  {
    id: "eva-outlook-send",
    employeeId: "eva",
    provider: "outlook",
    action: "send",
    label: "إرسال بريد من أوتلوك",
    inputs: [
      { name: "to", label: "المستلم", required: true },
      { name: "subject", label: "الموضوع", required: true },
      { name: "body", label: "النص", required: true },
    ],
    toProps: (v) => ({
      recipients: [v["to"]],
      subject: v["subject"],
      content: v["body"],
      contentType: "Text",
    }),
  },
  {
    id: "eva-create-event",
    employeeId: "eva",
    provider: "calendar",
    action: "createEvent",
    label: "حجز موعد في التقويم",
    inputs: [
      { name: "summary", label: "عنوان الموعد", required: true },
      { name: "start", label: "البداية (ISO)", required: true },
      { name: "end", label: "النهاية (ISO)", required: true },
      { name: "attendees", label: "الحضور (بريد مفصول بفاصلة)" },
    ],
    toProps: (v) => ({
      calendarId: "primary",
      summary: v["summary"],
      eventStartDate: v["start"],
      eventEndDate: v["end"],
      attendees: (v["attendees"] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    }),
  },
  {
    id: "sam-create-contact",
    employeeId: "sam",
    provider: "hubspot",
    action: "createContact",
    label: "إضافة جهة اتصال في هابسبوت",
    inputs: [
      { name: "email", label: "البريد", required: true },
      { name: "firstname", label: "الاسم الأول" },
      { name: "lastname", label: "الاسم الأخير" },
      { name: "company", label: "الشركة" },
    ],
    toProps: (v) => ({
      objectProperties: {
        email: v["email"],
        firstname: v["firstname"] ?? "",
        lastname: v["lastname"] ?? "",
        company: v["company"] ?? "",
      },
      updateIfExists: true,
    }),
  },
  {
    id: "sam-create-deal",
    employeeId: "sam",
    provider: "hubspot",
    action: "createDeal",
    label: "إنشاء صفقة في هابسبوت",
    inputs: [
      { name: "dealname", label: "اسم الصفقة", required: true },
      { name: "pipeline", label: "خط البيع", required: true },
      { name: "dealstage", label: "المرحلة", required: true },
      { name: "amount", label: "القيمة" },
      { name: "closedate", label: "تاريخ الإغلاق (YYYY-MM-DD)" },
    ],
    toProps: (v) => ({
      dealname: v["dealname"],
      pipeline: v["pipeline"],
      dealstage: v["dealstage"],
      objectProperties: {
        ...(v["amount"]?.trim() ? { amount: v["amount"].trim() } : {}),
        ...(v["closedate"]?.trim() ? { closedate: v["closedate"].trim() } : {}),
      },
    }),
  },
  {
    id: "sam-log-sheet",
    employeeId: "sam",
    provider: "sheets",
    action: "appendRow",
    label: "تسجيل صف في جوجل شيتس",
    inputs: [
      { name: "sheetId", label: "معرّف الملف", required: true },
      { name: "worksheetId", label: "معرّف الورقة (رقم gid)", required: true },
      { name: "row", label: "القيم مفصولة بفاصلة", required: true },
    ],
    toProps: (v) => ({
      sheetId: v["sheetId"],
      worksheetId: Number(v["worksheetId"]) || 0,
      myColumnData: (v["row"] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    }),
  },
  {
    id: "adam-log-sheet",
    employeeId: "adam",
    provider: "sheets",
    action: "appendRow",
    label: "تسجيل نتيجة قياس في شيتس",
    inputs: [
      { name: "sheetId", label: "معرّف الملف", required: true },
      { name: "worksheetId", label: "معرّف الورقة (رقم gid)", required: true },
      { name: "row", label: "القيم مفصولة بفاصلة", required: true },
    ],
    toProps: (v) => ({
      sheetId: v["sheetId"],
      worksheetId: Number(v["worksheetId"]) || 0,
      myColumnData: (v["row"] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    }),
  },
  {
    id: "team-slack-note",
    employeeId: "*",
    provider: "slack",
    action: "send",
    label: "إرسال رسالة سلاك للفريق",
    inputs: [
      { name: "channel", label: "القناة", required: true },
      { name: "text", label: "النص", required: true },
    ],
    toProps: (v) => ({
      channelType: "PUBLIC",
      conversation: v["channel"],
      text: v["text"],
      mrkdwn: true,
    }),
  },

  /* ————— السوشيال: تعليقات ورسائل الصفحات ————— */
  {
    id: "sonny-reply-fb-comment",
    employeeId: "sonny",
    provider: "facebook",
    label: "الرد على تعليق في فيسبوك",
    inputs: [
      { name: "commentId", label: "معرّف التعليق", required: true },
      { name: "message", label: "نص الرد", required: true },
    ],
    run: async ({ config, workspaceId, accountId, values }) => {
      const page = await requirePage(config, workspaceId, accountId);
      return replyToFacebookComment(
        config,
        workspaceId,
        accountId,
        page,
        values["commentId"]!,
        values["message"]!,
      );
    },
  },
  {
    id: "sonny-hide-fb-comment",
    employeeId: "sonny",
    provider: "facebook",
    label: "إخفاء تعليق مسيء",
    inputs: [{ name: "commentId", label: "معرّف التعليق", required: true }],
    run: async ({ config, workspaceId, accountId, values }) => {
      const page = await requirePage(config, workspaceId, accountId);
      return hideComment(config, workspaceId, accountId, page, values["commentId"]!, true);
    },
  },
  {
    id: "sonny-reply-messenger",
    employeeId: "sonny",
    provider: "facebook",
    label: "الرد على رسالة ماسنجر",
    inputs: [
      { name: "recipientId", label: "معرّف المرسِل", required: true },
      { name: "text", label: "نص الرد", required: true },
    ],
    run: async ({ config, workspaceId, accountId, values }) => {
      const page = await requirePage(config, workspaceId, accountId);
      return replyToMessenger(
        config,
        workspaceId,
        accountId,
        page,
        values["recipientId"]!,
        values["text"]!,
      );
    },
  },
  {
    id: "sonny-reply-ig-comment",
    employeeId: "sonny",
    provider: "instagram",
    label: "الرد على تعليق في إنستجرام",
    inputs: [
      { name: "commentId", label: "معرّف التعليق", required: true },
      { name: "message", label: "نص الرد", required: true },
    ],
    run: async ({ config, workspaceId, accountId, values }) => {
      const page = await requirePage(config, workspaceId, accountId);
      return replyToInstagramComment(
        config,
        workspaceId,
        accountId,
        page,
        values["commentId"]!,
        values["message"]!,
      );
    },
  },

  /* ————— CRM والبريد الجماعي ————— */
  {
    id: "sam-create-lead",
    employeeId: "sam",
    provider: "salesforce",
    action: "createLead",
    label: "إضافة عميل محتمل في سيلزفورس",
    inputs: [
      { name: "LastName", label: "الاسم الأخير", required: true },
      { name: "Company", label: "الشركة", required: true },
      { name: "Email", label: "البريد" },
      { name: "Phone", label: "الهاتف" },
    ],
    toProps: (v) => ({
      LastName: v["LastName"],
      Company: v["Company"],
      ...(v["Email"]?.trim() ? { Email: v["Email"].trim() } : {}),
      ...(v["Phone"]?.trim() ? { Phone: v["Phone"].trim() } : {}),
    }),
  },
  {
    id: "sam-add-subscriber",
    employeeId: "sam",
    provider: "mailchimp",
    action: "addSubscriber",
    label: "إضافة مشترك في ميلتشمب",
    inputs: [
      { name: "listId", label: "معرّف القائمة", required: true },
      { name: "email", label: "البريد", required: true },
      { name: "status", label: "الحالة (subscribed/pending)" },
    ],
    toProps: (v) => ({
      listId: v["listId"],
      subscriberHash: (v["email"] ?? "").trim().toLowerCase(),
      emailAddress: (v["email"] ?? "").trim(),
      statusIfNew: v["status"] || "subscribed",
      status: v["status"] || "subscribed",
    }),
  },
  {
    id: "team-notion-page",
    employeeId: "*",
    provider: "notion",
    action: "createPage",
    label: "حفظ صفحة في نوشن",
    inputs: [
      { name: "parentId", label: "معرّف الصفحة الأم", required: true },
      { name: "title", label: "العنوان", required: true },
      { name: "content", label: "المحتوى" },
    ],
    toProps: (v) => ({
      parent: v["parentId"],
      title: v["title"],
      ...(v["content"]?.trim() ? { content: v["content"].trim() } : {}),
    }),
  },

  /* ————— تطبيقات إضافية: تواصل، مبيعات، وإدارة مشاريع ————— */
  {
    id: "team-discord-send",
    employeeId: "*",
    provider: "discord",
    action: "send",
    label: "إرسال رسالة ديسكورد",
    inputs: [
      { name: "channel", label: "معرّف القناة", required: true },
      { name: "message", label: "النص", required: true },
    ],
    toProps: (v) => ({ channel: v["channel"], message: v["message"] }),
  },
  {
    id: "sonny-reddit-post",
    employeeId: "sonny",
    provider: "reddit",
    action: "submitPost",
    label: "نشر موضوع على ريديت",
    inputs: [
      { name: "subreddit", label: "المجتمع (subreddit)", required: true },
      { name: "title", label: "العنوان", required: true },
      { name: "text", label: "النص" },
      { name: "url", label: "رابط (بدلاً من النص)" },
    ],
    toProps: (v) => ({
      subreddit: v["subreddit"],
      title: v["title"],
      kind: v["url"]?.trim() ? "link" : "self",
      ...(v["url"]?.trim() ? { url: v["url"].trim() } : { text: v["text"] ?? "" }),
    }),
  },
  {
    id: "sonny-bluesky-post",
    employeeId: "sonny",
    provider: "bluesky",
    action: "post",
    label: "نشر منشور على بلوسكاي",
    inputs: [{ name: "text", label: "النص", required: true }],
    toProps: (v) => ({ text: v["text"] }),
  },
  {
    id: "sam-twilio-sms",
    employeeId: "sam",
    provider: "twilio",
    action: "sendSms",
    label: "إرسال رسالة SMS",
    inputs: [
      { name: "from", label: "الرقم المرسل", required: true },
      { name: "to", label: "رقم العميل", required: true },
      { name: "body", label: "النص", required: true },
      { name: "accountSid", label: "معرّف حساب تويليو (اختياري)" },
    ],
    toProps: (v) => ({ from: v["from"], to: v["to"], body: v["body"] }),
  },
  {
    id: "sam-intercom-message",
    employeeId: "sam",
    provider: "intercom",
    action: "sendMessage",
    label: "مراسلة عميل في إنتركوم",
    inputs: [
      { name: "fromId", label: "معرّف الموظف المرسل", required: true },
      { name: "toId", label: "معرّف العميل", required: true },
      { name: "subject", label: "الموضوع", required: true },
      { name: "body", label: "النص", required: true },
    ],
    toProps: (v) => ({
      messageType: "email",
      template: "plain",
      toType: "user",
      fromId: v["fromId"],
      toId: v["toId"],
      subject: v["subject"],
      body: v["body"],
    }),
  },
  {
    id: "sam-pipedrive-deal",
    employeeId: "sam",
    provider: "pipedrive",
    action: "addDeal",
    label: "إنشاء صفقة في بايبدرايف",
    inputs: [
      { name: "title", label: "اسم الصفقة", required: true },
      { name: "value", label: "القيمة" },
      { name: "currency", label: "العملة" },
      { name: "personId", label: "معرّف جهة الاتصال (اختياري)" },
    ],
    toProps: (v) => ({
      title: v["title"],
      ...(v["value"]?.trim() ? { value: v["value"].trim() } : {}),
      ...(v["currency"]?.trim() ? { currency: v["currency"].trim() } : {}),
    }),
  },
  {
    id: "sam-pipedrive-person",
    employeeId: "sam",
    provider: "pipedrive",
    action: "addPerson",
    label: "إضافة جهة اتصال في بايبدرايف",
    inputs: [
      { name: "name", label: "الاسم", required: true },
      { name: "email", label: "البريد" },
      { name: "phone", label: "الهاتف" },
    ],
    toProps: (v) => ({
      name: v["name"],
      ...(v["email"]?.trim() ? { emails: [v["email"].trim()] } : {}),
      ...(v["phone"]?.trim() ? { phones: [v["phone"].trim()] } : {}),
    }),
  },
  {
    id: "team-trello-card",
    employeeId: "*",
    provider: "trello",
    action: "createCard",
    label: "إنشاء كرت في تريلو",
    inputs: [
      { name: "board", label: "معرّف اللوحة (اختياري)" },
      { name: "idList", label: "معرّف القائمة", required: true },
      { name: "name", label: "عنوان الكرت", required: true },
      { name: "desc", label: "الوصف" },
      { name: "due", label: "تاريخ الاستحقاق (ISO)" },
    ],
    toProps: (v) => ({
      board: v["board"],
      idList: v["idList"],
      name: v["name"],
      desc: v["desc"] ?? "",
      ...(v["due"]?.trim() ? { due: v["due"].trim() } : {}),
    }),
  },
  {
    id: "team-asana-task",
    employeeId: "*",
    provider: "asana",
    action: "createTask",
    label: "إنشاء مهمة في أسانا",
    inputs: [
      { name: "workspace", label: "معرّف المساحة (اختياري)" },
      { name: "project", label: "معرّف المشروع", required: true },
      { name: "name", label: "عنوان المهمة", required: true },
      { name: "notes", label: "التفاصيل" },
      { name: "due_on", label: "تاريخ التسليم (YYYY-MM-DD)" },
    ],
    toProps: (v) => ({
      workspace: v["workspace"],
      project: v["project"],
      name: v["name"],
      notes: v["notes"] ?? "",
      ...(v["due_on"]?.trim() ? { due_on: v["due_on"].trim() } : {}),
    }),
  },
  {
    id: "team-jira-issue",
    employeeId: "*",
    provider: "jira",
    action: "createIssue",
    label: "إنشاء تذكرة في جيرا",
    inputs: [
      { name: "cloudId", label: "معرّف السحابة", required: true },
      { name: "projectId", label: "معرّف المشروع", required: true },
      { name: "issueTypeId", label: "نوع التذكرة", required: true },
      { name: "summary", label: "العنوان", required: true },
    ],
    toProps: (v) => ({
      cloudId: v["cloudId"],
      projectId: v["projectId"],
      issueTypeId: v["issueTypeId"],
      additionalProperties: { summary: v["summary"] },
    }),
  },
  {
    id: "team-clickup-task",
    employeeId: "*",
    provider: "clickup",
    action: "createTask",
    label: "إنشاء مهمة في كليك أب",
    inputs: [
      { name: "workspaceId", label: "معرّف المساحة (اختياري)" },
      { name: "spaceId", label: "معرّف الفضاء (اختياري)" },
      { name: "listId", label: "معرّف القائمة", required: true },
      { name: "name", label: "عنوان المهمة", required: true },
      { name: "description", label: "التفاصيل" },
    ],
    toProps: (v) => ({
      workspaceId: v["workspaceId"],
      spaceId: v["spaceId"],
      listId: v["listId"],
      name: v["name"],
      description: v["description"] ?? "",
    }),
  },
  {
    id: "team-monday-item",
    employeeId: "*",
    provider: "monday",
    action: "createItem",
    label: "إضافة عنصر في مندي",
    inputs: [
      { name: "boardId", label: "معرّف اللوحة", required: true },
      { name: "itemName", label: "اسم العنصر", required: true },
    ],
    toProps: (v) => ({ boardId: v["boardId"], itemName: v["itemName"], columns: [] }),
  },
  {
    id: "eva-zoom-meeting",
    employeeId: "eva",
    provider: "zoom",
    action: "createMeeting",
    label: "إنشاء اجتماع زوم",
    inputs: [
      { name: "topic", label: "عنوان الاجتماع", required: true },
      { name: "start_time", label: "البداية (ISO)" },
      { name: "duration", label: "المدة بالدقائق" },
    ],
    toProps: (v) => ({
      topic: v["topic"],
      type: 2,
      ...(v["start_time"]?.trim() ? { start_time: v["start_time"].trim() } : {}),
      ...(v["duration"]?.trim() ? { duration: Number(v["duration"]) } : {}),
    }),
  },

  /* ————— منصات إضافية: بينترست ————— */
  {
    id: "sonny-create-pin",
    employeeId: "sonny",
    provider: "pinterest",
    label: "إنشاء بِن على بينترست",
    inputs: [
      { name: "title", label: "العنوان", required: true },
      { name: "imageUrl", label: "رابط الصورة", required: true },
      { name: "description", label: "الوصف" },
      { name: "link", label: "رابط الوجهة" },
      { name: "boardId", label: "معرّف اللوحة (اختياري)" },
    ],
    run: ({ config, workspaceId, accountId, values }) =>
      createPin(config, workspaceId, accountId, {
        title: values["title"]!,
        imageUrl: values["imageUrl"]!,
        ...(values["description"] ? { description: values["description"] } : {}),
        ...(values["link"] ? { link: values["link"] } : {}),
        ...(values["boardId"] ? { boardId: values["boardId"] } : {}),
      }),
  },

  /* ————— واتساب وتيليجرام ودرايف ————— */
  {
    id: "eva-whatsapp-send",
    employeeId: "eva",
    provider: "whatsapp",
    label: "إرسال رسالة واتساب لعميل",
    inputs: [
      { name: "to", label: "رقم العميل بصيغة دولية", required: true },
      { name: "text", label: "نص الرسالة", required: true },
      { name: "phoneNumberId", label: "معرّف رقم الإرسال (اختياري)" },
    ],
    run: ({ config, workspaceId, accountId, values }) =>
      sendWhatsappText(config, workspaceId, accountId, {
        to: values["to"]!,
        text: values["text"]!,
        ...(values["phoneNumberId"]?.trim()
          ? { phoneNumberId: values["phoneNumberId"].trim() }
          : {}),
      }),
  },
  {
    id: "team-telegram-send",
    employeeId: "*",
    provider: "telegram",
    action: "send",
    label: "إرسال رسالة تيليجرام",
    inputs: [
      { name: "chatId", label: "معرّف المحادثة", required: true },
      { name: "text", label: "النص", required: true },
    ],
    toProps: (v) => ({ chatId: v["chatId"], text: v["text"] }),
  },
  {
    id: "dana-drive-folder",
    employeeId: "dana",
    provider: "drive",
    label: "إنشاء مجلد أصول في درايف",
    inputs: [
      { name: "name", label: "اسم المجلد", required: true },
      { name: "parentId", label: "معرّف المجلد الأب (اختياري)" },
    ],
    run: ({ config, workspaceId, accountId, values }) =>
      createDriveFolder(config, workspaceId, accountId, {
        name: values["name"]!,
        ...(values["parentId"]?.trim() ? { parentId: values["parentId"].trim() } : {}),
      }),
  },

  /* ————— قياس الإعلانات ————— */
  {
    id: "adam-meta-ads-report",
    employeeId: "adam",
    provider: "meta-ads",
    label: "تقرير أداء حملات ميتا (٣٠ يوماً)",
    inputs: [],
    run: ({ config, workspaceId, accountId }) =>
      metaAdsSummary(config, workspaceId, accountId).then((report) => ({ report })),
  },

  /* ————— سيو وقياس: نور وآدم ————— */
  {
    id: "nour-gsc-performance",
    employeeId: "nour",
    provider: "search-console",
    action: "performance",
    label: "تقرير أداء البحث (كلمات ونقرات)",
    inputs: [
      { name: "siteUrl", label: "الموقع في Search Console", required: true },
      { name: "days", label: "عدد الأيام (افتراضي ٢٨)" },
    ],
    toProps: (v) => {
      const days = Math.max(1, Math.min(180, Number(v["days"] ?? 28) || 28));
      const end = new Date();
      const start = new Date(end.getTime() - days * 86_400_000);
      return {
        siteUrl: v["siteUrl"],
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        dimensions: ["query"],
        rowLimit: 25,
      };
    },
  },
  {
    id: "nour-gsc-index",
    employeeId: "nour",
    provider: "search-console",
    action: "indexUrl",
    label: "طلب فهرسة رابط من جوجل",
    inputs: [{ name: "siteUrl", label: "الرابط المطلوب فهرسته", required: true }],
    toProps: (v) => ({ siteUrl: v["siteUrl"], notificationType: "URL_UPDATED" }),
  },
  {
    id: "adam-ga4-report",
    employeeId: "adam",
    provider: "analytics",
    action: "runReport",
    label: "تقرير GA4 (جلسات وتحويلات)",
    inputs: [
      { name: "property", label: "معرّف خاصية GA4", required: true },
      { name: "days", label: "عدد الأيام (افتراضي ٢٨)" },
    ],
    toProps: (v) => {
      const days = Math.max(1, Math.min(365, Number(v["days"] ?? 28) || 28));
      return {
        property: v["property"],
        startDate: `${days}daysAgo`,
        endDate: "today",
        metrics: ["sessions", "totalUsers", "conversions"],
        dimensions: ["sessionDefaultChannelGroup"],
      };
    },
  },

  /* ————— تصميم: دانة ————— */
  {
    id: "dana-canva-design",
    employeeId: "dana",
    provider: "canva",
    action: "createDesign",
    label: "إنشاء تصميم في كانفا",
    inputs: [
      { name: "designType", label: "نوع التصميم (مثل presentation)", required: true },
      { name: "title", label: "اسم التصميم" },
    ],
    toProps: (v) => ({
      designType: v["designType"],
      ...(v["title"]?.trim() ? { title: v["title"].trim() } : {}),
    }),
  },
  {
    id: "dana-figma-comment",
    employeeId: "dana",
    provider: "figma",
    action: "comment",
    label: "تعليق على ملف فيجما",
    inputs: [
      { name: "projectId", label: "معرّف المشروع (اختياري)" },
      { name: "fileId", label: "معرّف الملف", required: true },
      { name: "message", label: "نص التعليق", required: true },
    ],
    toProps: (v) => ({ projectId: v["projectId"], fileId: v["fileId"], message: v["message"] }),
  },
  {
    id: "dana-drive-text-file",
    employeeId: "dana",
    provider: "drive",
    action: "createTextFile",
    label: "إنشاء ملف نصي في درايف",
    inputs: [
      { name: "name", label: "اسم الملف", required: true },
      { name: "content", label: "المحتوى", required: true },
      { name: "parentId", label: "معرّف المجلد (اختياري)" },
    ],
    toProps: (v) => ({
      name: v["name"],
      content: v["content"],
      mimeType: "text/plain",
      ...(v["parentId"]?.trim() ? { parentId: v["parentId"].trim() } : {}),
    }),
  },

  /* ————— مبيعات وفواتير: سام على سترايب ————— */
  {
    id: "sam-stripe-customer",
    employeeId: "sam",
    provider: "stripe",
    action: "createCustomer",
    label: "إضافة عميل في سترايب",
    inputs: [
      { name: "name", label: "الاسم", required: true },
      { name: "email", label: "البريد" },
      { name: "phone", label: "الجوال" },
    ],
    toProps: (v) => ({
      name: v["name"],
      ...(v["email"]?.trim() ? { email: v["email"].trim() } : {}),
      ...(v["phone"]?.trim() ? { phone: v["phone"].trim() } : {}),
    }),
  },
  {
    id: "sam-stripe-invoice",
    employeeId: "sam",
    provider: "stripe",
    action: "createInvoice",
    label: "إنشاء فاتورة سترايب",
    inputs: [
      { name: "customer", label: "معرّف العميل (cus_…)", required: true },
      { name: "description", label: "وصف الفاتورة" },
      { name: "daysUntilDue", label: "أيام الاستحقاق (افتراضي ٧)" },
    ],
    toProps: (v) => ({
      customer: v["customer"],
      collectionMethod: "send_invoice",
      daysUntilDue: Math.max(1, Number(v["daysUntilDue"] ?? 7) || 7),
      ...(v["description"]?.trim() ? { description: v["description"].trim() } : {}),
    }),
  },
  {
    id: "sam-stripe-payment",
    employeeId: "sam",
    provider: "stripe",
    action: "createPayment",
    label: "إنشاء طلب دفع سترايب",
    inputs: [
      { name: "amount", label: "المبلغ بأصغر وحدة (هللة/سنت)", required: true },
      { name: "currency", label: "العملة (مثل sar)", required: true },
      { name: "country", label: "الدولة (مثل SA)" },
      { name: "description", label: "وصف الطلب (اختياري)" },
    ],
    toProps: (v) => ({
      amount: Math.max(1, Number(v["amount"]) || 1),
      currency: (v["currency"] ?? "sar").toLowerCase(),
      country: (v["country"] ?? "SA").toUpperCase(),
    }),
  },

  /* ————— نشاطي على جوجل: سِراج ————— */
  {
    id: "sonny-gbp-post",
    employeeId: "sonny",
    provider: "google-business",
    action: "createPost",
    label: "نشر تحديث على نشاطي على جوجل",
    inputs: [
      { name: "account", label: "معرّف الحساب", required: true },
      { name: "location", label: "معرّف الفرع", required: true },
      { name: "summary", label: "نص التحديث", required: true },
    ],
    toProps: (v) => ({
      account: v["account"],
      location: v["location"],
      topicType: "STANDARD",
      languageCode: "ar",
      summary: v["summary"],
    }),
  },
  {
    id: "sonny-gbp-reply",
    employeeId: "sonny",
    provider: "google-business",
    action: "replyReview",
    label: "الرد على تقييم في نشاطي على جوجل",
    inputs: [
      { name: "account", label: "معرّف الحساب", required: true },
      { name: "location", label: "معرّف الفرع", required: true },
      { name: "review", label: "معرّف التقييم", required: true },
      { name: "comment", label: "نص الرد", required: true },
    ],
    toProps: (v) => ({
      account: v["account"],
      location: v["location"],
      review: v["review"],
      comment: v["comment"],
    }),
  },
];

const allActions: EmployeeActionDef[] = [...employeeActions, ...extraEmployeeActions];

export function actionsFor(employeeId: string): EmployeeActionDef[] {
  // الإجراءات المشتركة تظهر فقط لمنصات هذا الموظف — لا يرى سِراج أدوات سلاك/جيرا الخاصة بأمَل.
  const own = new Set(
    employeeDirectory[employeeId as EmployeeId]?.integrations.map((i) => i.provider) ?? [],
  );
  return allActions.filter(
    (a) =>
      a.employeeId === employeeId ||
      (a.employeeId === "*" && (own.size === 0 || own.has(a.provider))),
  );
}

export function getEmployeeAction(id: string): EmployeeActionDef | undefined {
  return allActions.find((a) => a.id === id);
}

async function requirePage(config: PipedreamConfig, workspaceId: string, accountId: string) {
  const page = await pageTarget(config, workspaceId, accountId);
  if (!page) throw new Error("لا توجد صفحة فيسبوك مرتبطة بالحساب المربوط.");
  return page;
}

/** ينفّذ إجراءً فعلياً على حساب مربوط للمساحة. */
/**
 * منع تكرار الإجراءات الخارجية (بريد، رسالة، فاتورة، جهة اتصال): ضغطة مزدوجة أو
 * إعادة محاولة كانت تُرسل الشيء نفسه مرتين. المفتاح = مساحة العمل + الإجراء + القيم.
 */
const recentActions = new Map<string, number>();
const ACTION_DEDUPE_MS = 60_000;

function actionDedupeKey(params: {
  workspaceId: string;
  actionId: string;
  values: Record<string, string>;
}): string {
  const values = Object.keys(params.values)
    .sort()
    .map((k) => `${k}=${(params.values[k] ?? "").trim()}`)
    .join("&");
  return `${params.workspaceId}|${params.actionId}|${values}`;
}

export async function runEmployeeActionServer(
  admin: Admin,
  params: { workspaceId: string; actionId: string; values: Record<string, string> },
): Promise<{ actionId: string; provider: string; result: unknown }> {
  const dedupeKey = actionDedupeKey(params);
  const now = Date.now();
  for (const [k, at] of recentActions) if (now - at > ACTION_DEDUPE_MS) recentActions.delete(k);
  if (recentActions.has(dedupeKey)) {
    throw new Error("نفّذنا هذا الإجراء نفسه قبل لحظات — منعنا تكراره. غيّر البيانات أو انتظر دقيقة.");
  }
  recentActions.set(dedupeKey, now);
  try {
    return await runEmployeeActionInner(admin, params);
  } catch (error) {
    // فشل = لم يُنفَّذ شيء، فنحرّر المفتاح ليعيد المالك المحاولة فوراً.
    recentActions.delete(dedupeKey);
    throw error;
  }
}

async function runEmployeeActionInner(
  admin: Admin,
  params: { workspaceId: string; actionId: string; values: Record<string, string> },
): Promise<{ actionId: string; provider: string; result: unknown }> {
  const def = getEmployeeAction(params.actionId);
  if (!def) throw new Error("إجراء غير معروف.");

  const missing = def.inputs
    .filter((i) => i.required && !params.values[i.name]?.trim())
    .map((i) => i.label);
  if (missing.length) throw new Error(`حقول ناقصة: ${missing.join("، ")}`);

  const app = pipedreamApp(def.provider);
  if (!app) throw new Error("هذا الإجراء غير مدعوم على هذه المنصة بعد.");
  const action = def.action ? pipedreamAction(def.provider, def.action) : undefined;
  if (def.action && !action) throw new Error("هذا الإجراء غير مدعوم على هذه المنصة بعد.");

  const config = await pipedreamConfig();
  if (!config) throw missingConfigError();

  const { data: account } = await admin
    .from("pipedream_accounts")
    .select("account_id")
    .eq("workspace_id", params.workspaceId)
    .eq("provider", def.provider)
    .eq("status", "connected")
    .maybeSingle();
  if (!account) throw new Error(`${app.label} غير مربوط بعد — اربطه من صفحة التكاملات.`);

  if (def.run) {
    const result = await def.run({
      config,
      workspaceId: params.workspaceId,
      accountId: account.account_id,
      values: params.values,
    });
    return { actionId: def.id, provider: def.provider, result };
  }

  // المسار المضمون: تنفيذ مباشر على واجهة المنصة عبر وكيل Pipedream.
  const { directActions } = await import("./direct-actions.server");
  const { extraDirectActions } = await import("./direct-actions-extra.server");
  const direct = directActions[def.id] ?? extraDirectActions[def.id];
  if (direct) {
    const result = await direct({
      config,
      workspaceId: params.workspaceId,
      accountId: account.account_id,
      values: params.values,
    });
    return { actionId: def.id, provider: def.provider, result };
  }

  if (!action) throw new Error("هذا الإجراء غير مدعوم على هذه المنصة بعد.");

  const result = await runAction(config, {
    workspaceId: params.workspaceId,
    componentId: action.component,
    configuredProps: {
      [action.accountProp]: { authProvisionId: account.account_id },
      ...(def.toProps ? def.toProps(params.values) : {}),
    },
  });

  return { actionId: def.id, provider: def.provider, result };
}
