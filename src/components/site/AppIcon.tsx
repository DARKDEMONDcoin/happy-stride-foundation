import * as si from "simple-icons";
import { cn } from "@/lib/utils";

type Icon = { title: string; hex: string; path: string };

const siLinkedin: Icon = {
  title: "LinkedIn",
  hex: "0A66C2",
  path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
};

const siSlack: Icon = {
  title: "Slack",
  hex: "4A154B",
  path: "M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z",
};

const siCanva: Icon = {
  title: "Canva",
  hex: "00C4CC",
  path: "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm1.36 6.4c1.53 0 2.71.63 2.71 1.86 0 .78-.47 1.34-1.14 1.34-.53 0-.9-.3-.9-.79 0-.34.15-.6.15-.86 0-.35-.3-.58-.85-.58-1.9 0-3.62 2.53-3.62 5.13 0 1.9.94 3.02 2.42 3.02 1.4 0 2.62-.85 3.5-2.2.16-.25.33-.36.5-.36.24 0 .43.2.43.5 0 .13-.03.28-.11.43-1.04 2.03-2.86 3.32-5.02 3.32-2.53 0-4.23-1.83-4.23-4.53 0-3.6 2.83-6.28 6.26-6.28z",
};

const map: Record<string, { icon?: Icon; label: string }> = {
  instagram: { icon: si.siInstagram, label: "إنستجرام" },
  x: { icon: si.siX, label: "إكس" },
  linkedin: { icon: siLinkedin, label: "لينكدإن" },
  tiktok: { icon: si.siTiktok, label: "تيك توك" },
  facebook: { icon: si.siFacebook, label: "فيسبوك" },
  youtube: { icon: si.siYoutube, label: "يوتيوب" },
  threads: { icon: si.siThreads, label: "ثريدز" },
  gmail: { icon: si.siGmail, label: "جيميل" },
  outlook: { icon: si.siGmail, label: "أوتلوك" },
  calendar: { icon: si.siGooglecalendar, label: "التقويم" },
  slack: { icon: siSlack, label: "سلاك" },
  notion: { icon: si.siNotion, label: "نوشن" },
  whatsapp: { icon: si.siWhatsapp, label: "واتساب" },
  hubspot: { icon: si.siHubspot, label: "هابسبوت" },
  sheets: { icon: si.siGooglesheets, label: "جوجل شيتس" },
  drive: { icon: si.siGoogledrive, label: "جوجل درايف" },
  wordpress: { icon: si.siWordpress, label: "ووردبريس" },
  shopify: { icon: si.siShopify, label: "شوبيفاي" },
  webflow: { icon: si.siWebflow, label: "ويبفلو" },
  ghost: { icon: si.siGhost, label: "غوست" },
  figma: { icon: si.siFigma, label: "فيجما" },
  canva: { icon: siCanva, label: "كانفا" },
  analytics: { icon: si.siGoogleanalytics, label: "جوجل أناليتكس" },
  "search-console": { icon: si.siGooglesearchconsole, label: "سيرش كونسول" },
  indexnow: { icon: si.siGooglesearchconsole, label: "IndexNow" },
  "meta-ads": { icon: si.siMeta, label: "إعلانات ميتا" },
  telegram: { icon: si.siTelegram, label: "تيليجرام" },
  stripe: { icon: si.siStripe, label: "سترايب" },
  salla: { icon: si.siShopify, label: "سلة" },
  discord: { icon: si.siDiscord, label: "ديسكورد" },
  reddit: { icon: si.siReddit, label: "ريديت" },
  bluesky: { icon: si.siBluesky, label: "بلوسكاي" },
  trello: { icon: si.siTrello, label: "تريلو" },
  asana: { icon: si.siAsana, label: "أسانا" },
  jira: { icon: si.siJira, label: "جيرا" },
  clickup: { icon: si.siClickup, label: "كليك أب" },
  monday: { label: "مندي" },
  pipedrive: { label: "بايبدرايف" },
  intercom: { icon: si.siIntercom, label: "إنتركوم" },
  twilio: { label: "تويليو" },
  airtable: { icon: si.siAirtable, label: "إيرتيبل" },
  mailchimp: { icon: si.siMailchimp, label: "ميلتشمب" },
  salesforce: { label: "سيلزفورس" },
  pinterest: { icon: si.siPinterest, label: "بينترست" },
  "google-ads": { icon: si.siGoogleads, label: "إعلانات جوجل" },
  "google-business": { icon: si.siGoogle, label: "نشاطي على جوجل" },
  zoom: { icon: si.siZoom, label: "زوم" },
};

export function appLabel(key: string) {
  return map[key]?.label ?? key;
}

export const appKeys = Object.keys(map);

export function AppIcon({
  name,
  className,
  colored = true,
}: {
  name: string;
  className?: string;
  colored?: boolean;
}) {
  const entry = map[name];
  if (!entry?.icon) {
    return (
      <span
        className={cn(
          "grid place-items-center rounded-md bg-secondary text-[0.6rem] font-bold",
          className,
        )}
      >
        {name.slice(0, 2)}
      </span>
    );
  }
  return (
    <svg
      role="img"
      aria-label={entry.label}
      viewBox="0 0 24 24"
      className={cn("size-5", className)}
      fill={colored ? `#${entry.icon.hex}` : "currentColor"}
    >
      <path d={entry.icon.path} />
    </svg>
  );
}

export function AppRow({
  apps,
  className,
  size = "size-4.5",
}: {
  apps: string[];
  className?: string;
  size?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {apps.map((a) => (
        <span
          key={a}
          title={appLabel(a)}
          className="grid size-9 place-items-center rounded-xl border border-border bg-card shadow-card transition-transform duration-300 hover:-translate-y-0.5"
        >
          <AppIcon name={a} className={size} />
        </span>
      ))}
    </div>
  );
}
