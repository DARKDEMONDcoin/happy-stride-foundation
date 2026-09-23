import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

const CONSENT_KEY = "sahl:cookie-consent";
const SHOW_DELAY_MS = 1_500;
const AUTO_HIDE_MS = 18_000;
const EXIT_MS = 240;

type ConsentChoice = "accepted" | "declined";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    if (window.localStorage.getItem(CONSENT_KEY)) return;

    const showTimer = window.setTimeout(() => {
      setVisible(true);
      hideTimer.current = window.setTimeout(() => setLeaving(true), AUTO_HIDE_MS);
    }, SHOW_DELAY_MS);

    return () => {
      window.clearTimeout(showTimer);
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const exitTimer = window.setTimeout(() => setVisible(false), EXIT_MS);
    return () => window.clearTimeout(exitTimer);
  }, [leaving]);

  const choose = (choice: ConsentChoice) => {
    window.localStorage.setItem(CONSENT_KEY, choice);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    setLeaving(true);
  };

  if (!visible) return null;

  return (
    <aside
      className={`sahl-cookie-consent liquid-glass-sahl${leaving ? " is-leaving" : ""}`}
      aria-label="إعدادات ملفات الارتباط"
      aria-live="polite"
    >
      <p>
        بنستخدم كوكيز بسيطة لتحسين تجربتك. <Link to="/privacy">سياسة الخصوصية</Link>
      </p>
      <div className="sahl-cookie-actions">
        <Button size="sm" onClick={() => choose("accepted")}>
          موافق
        </Button>
        <Button size="sm" variant="ghost" onClick={() => choose("declined")}>
          لا شكرًا
        </Button>
      </div>
    </aside>
  );
}
