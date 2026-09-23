/**
 * موجّه الأدلة الميدانية: يعيد كتلة الدليل الثابت المناسبة لكل موظف.
 * مصدر واحد يستخدمه مسار الدردشة ومسار تنفيذ المهارات معاً (منعاً للتباعد بينهما).
 */
import { socialPlaybookBlock } from "./social-playbook";
import { seoPlaybookBlock } from "./seo-playbook";
import { execPlaybookBlock } from "./exec-playbook";
import { salesPlaybookBlock } from "./sales-playbook";
import { designPlaybookBlock } from "./design-playbook";
import { analyticsPlaybookBlock } from "./analytics-playbook";
import { adsPlaybookBlock, isAdsRequest } from "./ads-playbook";

const CORE: Record<string, string> = {
  sonny: socialPlaybookBlock,
  nour: seoPlaybookBlock,
  eva: execPlaybookBlock,
  sam: salesPlaybookBlock,
  dana: designPlaybookBlock,
  adam: analyticsPlaybookBlock,
};

const ADS_EMPLOYEES = new Set(["sonny", "adam", "dana", "sam"]);

/**
 * كتلة الدليل لموظف. `message` اختياري: كتلة الإعلانات تُضاف لسِراج/آدم/دانة/سالم
 * فقط عندما يكون الطلب إعلانياً فعلاً (توفيراً للتوكنات وزمن الرد).
 * بلا رسالة لا تُحقن لأحد — لا استثناء ضمني لأي موظف.
 */
export function playbookFor(employeeId: string, message?: string): string {
  const blocks: string[] = [];
  const core = CORE[employeeId];
  if (core) blocks.push(core);
  if (ADS_EMPLOYEES.has(employeeId) && message && isAdsRequest(message)) {
    blocks.push(adsPlaybookBlock());
  }
  return blocks.filter(Boolean).join("\n\n");
}
