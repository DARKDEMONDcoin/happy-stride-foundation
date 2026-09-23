import sonnyGulf from "@/assets/team/sonny-gulf.jpg";
import evaGulf from "@/assets/team/eva-gulf.jpg";
import samGulf from "@/assets/team/sam-gulf.jpg";
import nourGulf from "@/assets/team/nour-gulf.jpg";
import danaGulf from "@/assets/team/dana-gulf.jpg";
import adamGulf from "@/assets/team/adam-gulf.jpg";

import sonnyEg from "@/assets/team/sonny-eg.jpg";
import evaEg from "@/assets/team/eva-eg.jpg";
import samEg from "@/assets/team/sam-eg.jpg";
import nourEg from "@/assets/team/nour-eg.jpg";
import danaEg from "@/assets/team/dana-eg.jpg";
import adamEg from "@/assets/team/adam-eg.jpg";

import sonnySham from "@/assets/team/sonny-sham.jpg";
import evaSham from "@/assets/team/eva-sham.jpg";
import samSham from "@/assets/team/sam-sham.jpg";
import nourSham from "@/assets/team/nour-sham.jpg";
import danaSham from "@/assets/team/dana-sham.jpg";
import adamSham from "@/assets/team/adam-sham.jpg";

import sonnyMaghreb from "@/assets/team/sonny-maghreb.jpg";
import evaMaghreb from "@/assets/team/eva-maghreb.jpg";
import samMaghreb from "@/assets/team/sam-maghreb.jpg";
import nourMaghreb from "@/assets/team/nour-maghreb.jpg";
import danaMaghreb from "@/assets/team/dana-maghreb.jpg";
import adamMaghreb from "@/assets/team/adam-maghreb.jpg";

import sonnyIraq from "@/assets/team/sonny-iraq.jpg";
import evaIraq from "@/assets/team/eva-iraq.jpg";
import samIraq from "@/assets/team/sam-iraq.jpg";
import nourIraq from "@/assets/team/nour-iraq.jpg";
import danaIraq from "@/assets/team/dana-iraq.jpg";
import adamIraq from "@/assets/team/adam-iraq.jpg";

import sonnySudan from "@/assets/team/sonny-sudan.jpg";
import evaSudan from "@/assets/team/eva-sudan.jpg";
import samSudan from "@/assets/team/sam-sudan.jpg";
import nourSudan from "@/assets/team/nour-sudan.jpg";
import danaSudan from "@/assets/team/dana-sudan.jpg";
import adamSudan from "@/assets/team/adam-sudan.jpg";

import sonnyYemen from "@/assets/team/sonny-yemen.jpg";
import evaYemen from "@/assets/team/eva-yemen.jpg";
import samYemen from "@/assets/team/sam-yemen.jpg";
import nourYemen from "@/assets/team/nour-yemen.jpg";
import danaYemen from "@/assets/team/dana-yemen.jpg";
import adamYemen from "@/assets/team/adam-yemen.jpg";

/** أطقم الأزياء المتاحة لصور الفريق. */
export const REGIONS = ["gulf", "eg", "sham", "maghreb", "iraq", "sudan", "yemen"] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_LABELS: Record<Region, string> = {
  gulf: "الخليج",
  eg: "مصر",
  sham: "الشام",
  maghreb: "المغرب العربي",
  iraq: "العراق",
  sudan: "السودان",
  yemen: "اليمن",
};

/** كل الدول العربية الـ22 — كل دولة مرتبطة بطقم الزي الأقرب لها. */
export type Country = {
  code: string;
  name: string;
  attire: Region;
  group: string;
  zones: string[];
};

export const COUNTRIES: Country[] = [
  { code: "EG", name: "مصر", attire: "eg", group: "مصر والسودان", zones: ["Africa/Cairo"] },
  {
    code: "SD",
    name: "السودان",
    attire: "sudan",
    group: "مصر والسودان",
    zones: ["Africa/Khartoum"],
  },
  { code: "SA", name: "السعودية", attire: "gulf", group: "الخليج", zones: ["Asia/Riyadh"] },
  { code: "AE", name: "الإمارات", attire: "gulf", group: "الخليج", zones: ["Asia/Dubai"] },
  { code: "KW", name: "الكويت", attire: "gulf", group: "الخليج", zones: ["Asia/Kuwait"] },
  { code: "QA", name: "قطر", attire: "gulf", group: "الخليج", zones: ["Asia/Qatar"] },
  { code: "BH", name: "البحرين", attire: "gulf", group: "الخليج", zones: ["Asia/Bahrain"] },
  { code: "OM", name: "عُمان", attire: "gulf", group: "الخليج", zones: ["Asia/Muscat"] },
  { code: "YE", name: "اليمن", attire: "yemen", group: "الخليج", zones: ["Asia/Aden"] },
  { code: "IQ", name: "العراق", attire: "iraq", group: "الشام والعراق", zones: ["Asia/Baghdad"] },
  { code: "JO", name: "الأردن", attire: "sham", group: "الشام والعراق", zones: ["Asia/Amman"] },
  {
    code: "PS",
    name: "فلسطين",
    attire: "sham",
    group: "الشام والعراق",
    zones: ["Asia/Gaza", "Asia/Hebron", "Asia/Jerusalem"],
  },
  { code: "LB", name: "لبنان", attire: "sham", group: "الشام والعراق", zones: ["Asia/Beirut"] },
  { code: "SY", name: "سوريا", attire: "sham", group: "الشام والعراق", zones: ["Asia/Damascus"] },
  {
    code: "MA",
    name: "المغرب",
    attire: "maghreb",
    group: "المغرب العربي",
    zones: ["Africa/Casablanca", "Africa/El_Aaiun"],
  },
  {
    code: "DZ",
    name: "الجزائر",
    attire: "maghreb",
    group: "المغرب العربي",
    zones: ["Africa/Algiers"],
  },
  { code: "TN", name: "تونس", attire: "maghreb", group: "المغرب العربي", zones: ["Africa/Tunis"] },
  {
    code: "LY",
    name: "ليبيا",
    attire: "maghreb",
    group: "المغرب العربي",
    zones: ["Africa/Tripoli"],
  },
  {
    code: "MR",
    name: "موريتانيا",
    attire: "maghreb",
    group: "المغرب العربي",
    zones: ["Africa/Nouakchott"],
  },
  {
    code: "SO",
    name: "الصومال",
    attire: "sudan",
    group: "القرن الأفريقي",
    zones: ["Africa/Mogadishu"],
  },
  {
    code: "DJ",
    name: "جيبوتي",
    attire: "sudan",
    group: "القرن الأفريقي",
    zones: ["Africa/Djibouti"],
  },
  {
    code: "KM",
    name: "جزر القمر",
    attire: "sudan",
    group: "القرن الأفريقي",
    zones: ["Indian/Comoro"],
  },
];

export const COUNTRY_GROUPS = Array.from(new Set(COUNTRIES.map((c) => c.group)));

export const DEFAULT_COUNTRY = "EG";

export function countryOf(code: string): Country {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0]!;
}

const portraits: Record<Region, Record<string, string>> = {
  gulf: {
    sonny: sonnyGulf,
    eva: evaGulf,
    sam: samGulf,
    nour: nourGulf,
    dana: danaGulf,
    adam: adamGulf,
  },
  eg: { sonny: sonnyEg, eva: evaEg, sam: samEg, nour: nourEg, dana: danaEg, adam: adamEg },
  sham: {
    sonny: sonnySham,
    eva: evaSham,
    sam: samSham,
    nour: nourSham,
    dana: danaSham,
    adam: adamSham,
  },
  maghreb: {
    sonny: sonnyMaghreb,
    eva: evaMaghreb,
    sam: samMaghreb,
    nour: nourMaghreb,
    dana: danaMaghreb,
    adam: adamMaghreb,
  },
  iraq: {
    sonny: sonnyIraq,
    eva: evaIraq,
    sam: samIraq,
    nour: nourIraq,
    dana: danaIraq,
    adam: adamIraq,
  },
  sudan: {
    sonny: sonnySudan,
    eva: evaSudan,
    sam: samSudan,
    nour: nourSudan,
    dana: danaSudan,
    adam: adamSudan,
  },
  yemen: {
    sonny: sonnyYemen,
    eva: evaYemen,
    sam: samYemen,
    nour: nourYemen,
    dana: danaYemen,
    adam: adamYemen,
  },
};

/**
 * صورة الموظف حسب طقم بلد المستخدم — ونفس الصورة في كل صفحات الموقع،
 * لأن كل المكوّنات تقرأ نفس المصدر (طقم البلد الحالي من useRegion).
 */
export const DEFAULT_REGION: Region = "eg";

export function portraitOf(memberId: string, region?: Region): string {
  const set = portraits[region ?? DEFAULT_REGION] ?? portraits[DEFAULT_REGION];
  return set[memberId] ?? portraits[DEFAULT_REGION][memberId] ?? sonnyEg;
}

/** صورة الموظف حسب رمز الدولة. */
export function portraitForCountry(memberId: string, countryCode?: string): string {
  return portraitOf(memberId, countryCode ? countryOf(countryCode).attire : undefined);
}
