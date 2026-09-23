import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  countryOf,
  type Country,
  type Region,
} from "@/data/team-portraits";

const STORAGE_KEY = "sahl.country";

/** يكتشف بلد الزائر من المنطقة الزمنية ثم من لغة المتصفح. */
function detectCountry(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone) {
      const byZone = COUNTRIES.find((c) => c.zones.includes(zone));
      if (byZone) return byZone.code;
    }
    const langs = [navigator.language, ...(navigator.languages ?? [])].filter(Boolean);
    for (const l of langs) {
      const m = /-([a-z]{2})$/i.exec(l ?? "");
      if (m) {
        const code = m[1]!.toUpperCase();
        if (COUNTRIES.some((c) => c.code === code)) return code;
      }
    }
  } catch {
    /* تجاهل */
  }
  return DEFAULT_COUNTRY;
}

type Ctx = {
  /** رمز الدولة المختارة (مثل EG). */
  country: string;
  countryInfo: Country;
  /** طقم الزي المرتبط بالدولة. */
  region: Region;
  setCountry: (code: string) => void;
  /** هل الاختيار تلقائي (لم يغيّره الزائر بنفسه)؟ */
  auto: boolean;
};

const RegionContext = createContext<Ctx>({
  country: DEFAULT_COUNTRY,
  countryInfo: countryOf(DEFAULT_COUNTRY),
  region: countryOf(DEFAULT_COUNTRY).attire,
  setCountry: () => {},
  auto: true,
});

export function RegionProvider({ children }: { children: React.ReactNode }) {
  // نبدأ دائماً بمصر حتى يتطابق الخادم مع المتصفح، ثم نكتشف البلد بعد التحميل.
  const [country, setCountryState] = useState<string>(DEFAULT_COUNTRY);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && COUNTRIES.some((c) => c.code === saved)) {
        setCountryState(saved);
        setAuto(false);
        return;
      }
    } catch {
      /* تجاهل */
    }
    setCountryState(detectCountry());
  }, []);

  const setCountry = useCallback((code: string) => {
    if (!COUNTRIES.some((c) => c.code === code)) return;
    setCountryState(code);
    setAuto(false);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* تجاهل */
    }
  }, []);

  const value = useMemo<Ctx>(() => {
    const info = countryOf(country);
    return { country, countryInfo: info, region: info.attire, setCountry, auto };
  }, [country, setCountry, auto]);

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

export const useRegion = () => useContext(RegionContext);
