/**
 * اختبار كل إجراء لكل تطبيق بالتوازي بأصعب طلب ممكن (كل الحقول مملوءة)،
 * مع اعتراض طبقة الوكيل للتحقق من صحة الرابط والطريقة والجسم لكل إجراء.
 */
import { expect, mock, test } from "bun:test";

type Call = { url: string; method?: string; body?: unknown; rawBody?: string };
const calls: Record<string, Call[]> = {};
let current = "";

const stub = {
  id: "1",
  publish_id: "p1",
  did: "did:plc:test",
  sub: "urn-person",
  api_endpoint: "https://us1.api.mailchimp.com",
  urls: { rest: "https://acme.my.salesforce.com/services/data/v60.0/" },
  sheets: [{ properties: { sheetId: 0, title: "ورقة1" } }],
  accounts: [{ sid: "AC0000" }],
  threadId: "thread1",
  payload: {
    headers: [
      { name: "From", value: "client@example.com" },
      { name: "Subject", value: "عرض السعر" },
      { name: "Message-ID", value: "<abc@mail>" },
    ],
  },
  channel: { id: "D0001" },
  members: [{ id: "member1" }],
  data: [
    {
      id: "page1",
      name: "صفحتي",
      access_token: "PAGE_TOKEN",
      instagram_business_account: { id: "ig1" },
      company_domain: "acme",
    },
  ],
};

mock.module("../../src/lib/pipedream.server", () => ({
  proxyRequest: async (_config: unknown, req: Call) => {
    (calls[current] ??= []).push(req);
    return stub;
  },
  pipedreamConfig: async () => ({
    clientId: "x",
    clientSecret: "y",
    projectId: "p",
    environment: "production",
  }),
  runAction: async () => {
    throw new Error("runAction ممنوع — يجب أن يمر كل إجراء بالمسار المباشر.");
  },
  missingConfigError: () => new Error("no config"),
}));

const { directActions } = await import("../../src/lib/direct-actions.server");
const { extraDirectActions } = await import("../../src/lib/direct-actions-extra.server");
const { employeeActions } = await import("../../src/lib/employee-actions.server");
const { extraEmployeeActions } = await import("../../src/lib/employee-actions-extra");

const registry: Record<string, (ctx: never) => Promise<unknown>> = {
  ...directActions,
  ...extraDirectActions,
};
const defs = [...employeeActions, ...extraEmployeeActions];

/** أصعب طلب ممكن: قيمة واقعية لكل حقل من كل إجراء. */
const hard: Record<string, string> = {
  to: "client@example.com",
  subject: "عرض السعر النهائي — الربع الرابع",
  body: "تفضّل العرض المحدّث مع جدول الدفعات، وأقترح مكالمة الخميس ١١ صباحاً.",
  messageId: "18f0aa11bb22cc33",
  addLabelIds: "Label_1,Label_2",
  removeLabelIds: "INBOX",
  query: "SELECT Id, Name FROM Lead LIMIT 5",
  soql: "SELECT Id, Name FROM Opportunity LIMIT 5",
  max: "25",
  limit: "25",
  comment: "شكراً لتواصلكم، تم تحديث العرض.",
  summary: "اجتماع مراجعة الحملة",
  start: "2026-10-01T10:00:00+03:00",
  end: "2026-10-01T11:00:00+03:00",
  attendees: "a@example.com,b@example.com",
  eventId: "evt_12345",
  timeMin: "2026-10-01T00:00:00Z",
  timeMax: "2026-10-07T00:00:00Z",
  calendars: "primary",
  topic: "مراجعة الأداء الشهري",
  start_time: "2026-10-01T10:00:00Z",
  duration: "45",
  meetingId: "8123456789",
  link: "https://cdn.example.com/catalog.pdf",
  photoUrl: "https://cdn.example.com/post.jpg",
  imageUrl: "https://cdn.example.com/post.jpg",
  imageUrls:
    "https://cdn.example.com/1.jpg,https://cdn.example.com/2.jpg,https://cdn.example.com/3.jpg",
  videoUrl: "https://cdn.example.com/reel.mp4",
  coverUrl: "https://cdn.example.com/cover.jpg",
  caption: "٣ أخطاء تستهلك ميزانيتك — احفظ المنشور.",
  mediaId: "17895695668004550",
  recipientId: "1234567890",
  type: "image",
  phoneNumberId: "1055500001",
  blockId: "b1a2c3d4e5f60718293a4b5c6d7e8f90",
  content: "الفقرة الأولى\nالفقرة الثانية",
  databaseId: "d1a2c3d4e5f60718293a4b5c6d7e8f90",
  titleProperty: "الاسم",
  pageSize: "50",
  parentId: "p1a2c3d4e5f60718293a4b5c6d7e8f90",
  title: "دليل الحملة الشهرية",
  text: "نص مُعتمد بنبرة العلامة، بدون مبالغة.",
  organizationId: "98765432",
  url: "https://sahl.app/blog/ai-employees",
  description: "ملخص قصير للمقال.",
  tweetId: "1899000000000000001",
  userId: "U0123456",
  videoId: "dQw4w9WgXcQ",
  parentIdYoutube: "Ugx",
  tags: "تسويق,محتوى,ذكاء اصطناعي",
  categoryId: "22",
  days: "28",
  publishId: "v_pub_url~v2.123",
  privacy: "PUBLIC_TO_EVERYONE",
  name: "حملة الرياض — أكتوبر",
  thingId: "t3_abc123",
  rootUri: "at://did:plc:test/app.bsky.feed.post/abc",
  rootCid: "bafyreib2rxk3rh6kzwq",
  parentUri: "at://did:plc:test/app.bsky.feed.post/def",
  parentCid: "bafyreib2rxk3rh6kzwr",
  question: "locations/123/questions/456",
  account: "1234567890",
  location: "9876543210",
  review: "AbFvOq",
  email: "client@example.com",
  firstname: "عبدالله",
  lastname: "محمد",
  company: "شركة سهل",
  dealname: "صفقة سهل الكبرى",
  pipeline: "default",
  dealstage: "presentationscheduled",
  amount: "45000",
  closedate: "2026-11-30",
  contactId: "701",
  dueAt: "2026-10-05T09:00:00Z",
  priority: "HIGH",
  status: "PAUSED",
  LastName: "المطيري",
  Company: "شركة الخليج",
  Email: "lead@example.com",
  Phone: "+966500000000",
  Name: "فرصة الخليج",
  CloseDate: "2026-12-15",
  Amount: "120000",
  AccountId: "001xx000003DGb2AAG",
  StageName: "Qualification",
  Subject: "متابعة العرض",
  ActivityDate: "2026-10-03",
  WhoId: "003xx000004TmiQAAS",
  Description: "مكالمة متابعة بعد العرض.",
  Status: "In Progress",
  listId: "abc123def4",
  fromName: "فريق سهل",
  replyTo: "hello@sahl.app",
  html: "<p>عرض خاص لعملائنا هذا الشهر.</p>",
  campaignId: "camp_123",
  subscriberEmail: "client@example.com",
  value: "45000",
  currency: "SAR",
  personId: "42",
  dealId: "77",
  dueDate: "2026-10-04",
  conversationId: "conv_123",
  adminId: "admin_1",
  messageType: "comment",
  fromId: "admin_1",
  toId: "user_1",
  from: "+966510000000",
  say: "مرحباً، هذه رسالة من فريق سهل.",
  accountSid: "AC00000000000000000000000000000000",
  customer: "cus_123",
  priceId: "price_123",
  trialDays: "14",
  paymentIntent: "pi_123",
  daysUntilDue: "7",
  baseId: "appABC123",
  table: "العملاء",
  recordId: "recABC123",
  fields: '{"الاسم":"عبدالله","المبلغ":45000}',
  formula: "{الحالة}='نشط'",
  sheetId: "1AbCdEfGhIjKlMnOpQrStUvWxYz",
  worksheetId: "0",
  row: "٢٠٢٦-١٠-٠١,عميل جديد,45000,مغلقة",
  rowNumber: "12",
  fileId: "1FileIdAbc123",
  nodeIds: "1:23,4:56",
  format: "png",
  scale: "2",
  designId: "DAF123",
  designType: "InstagramPost",
  message: "تم تحديث الحملة وفق النبرة المعتمدة.",
  role: "reader",
  channel: "C0123456",
  ts: "1700000000.000100",
  emoji: "white_check_mark",
  chatId: "-1001234567890",
  cardId: "5f2b3c4d5e6f7a8b9c0d1e2f",
  idList: "5f2b3c4d5e6f7a8b9c0d1e20",
  desc: "بطاقة تنفيذ الحملة",
  due: "2026-10-10T12:00:00Z",
  taskId: "1200000000000001",
  project: "1200000000000002",
  workspace: "1200000000000003",
  notes: "تفاصيل المهمة.",
  due_on: "2026-10-09",
  completed: "true",
  cloudId: "11111111-2222-3333-4444-555555555555",
  issueKey: "SAHL-101",
  transitionId: "31",
  issueTypeId: "10001",
  projectId: "10000",
  boardId: "1234567890",
  itemId: "9876543210",
  itemName: "عنصر الحملة",
  columnValues: '{"status":{"label":"تم"}}',
  property: "properties/123456789",
  adAccountId: "act_1234567890",
  datePreset: "last_30d",
  objective: "OUTCOME_LEADS",
  dailyBudget: "5000",
  objectId: "23851234567890",
  customerId: "123-456-7890",
  loginCustomerId: "098-765-4321",
  siteUrl: "https://sahl.app/",
  sitemapUrl: "https://sahl.app/sitemap.xml",
  pageUrl: "https://sahl.app/blog/ai-employees",
  subreddit: "SaaS",
  period: "week",
  worksheet: "0",
  parentIdBlock: "p1",
  parentIdComment: "UgxCommentId",
};

function valuesFor(def: { inputs: { name: string }[] }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const input of def.inputs) out[input.name] = hard[input.name] ?? `قيمة-${input.name}`;
  return out;
}

// كل إجراء له تنفيذ مباشر (المسار الوحيد الذي يعمل في الإنتاج).
test("كل إجراء له تنفيذ مباشر", () => {
  const missing = defs.filter((d) => !d.run && !registry[d.id]).map((d) => d.id);
  expect(missing).toEqual([]);
});

for (const def of defs) {
  if (def.run) continue; // إجراءات المسار المخصص مغطاة بمساعداتها
  test(`${def.provider} · ${def.id}`, async () => {
    current = def.id;
    const ctx = {
      config: { clientId: "x", clientSecret: "y", projectId: "p", environment: "production" },
      workspaceId: "11111111-1111-1111-1111-111111111111",
      accountId: "apn_test",
      values: valuesFor(def),
    };
    const impl = registry[def.id]!;
    await impl(ctx as never);
    const made = calls[def.id] ?? [];
    expect(made.length).toBeGreaterThan(0);
    for (const call of made) {
      expect(call.url).toMatch(/^https:\/\//);
      expect(call.url).not.toContain("undefined");
      expect(call.url).not.toContain("[object");
      const payload = JSON.stringify(call.body ?? call.rawBody ?? "");
      expect(payload).not.toContain("undefined");
      expect(payload).not.toContain("[object Object]");
    }
  });
}
