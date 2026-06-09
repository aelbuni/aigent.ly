"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "aigently-launch-banner-v2-dismissed";
const PRESS_RELEASE_URL =
  "https://github.com/aelbuni/aigently-catalog";

export function HomeLaunchBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // SSR-safe — only check localStorage after mount
    try {
      if (!localStorage.getItem(DISMISS_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable (e.g. private browsing with strict settings)
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch { /* ignore */ }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="relative border-b border-primary/20 bg-primary-fixed-dim/15 px-4 py-3 text-center text-sm text-on-surface">
      <span className="mr-1">🆕</span>
      <strong>Catalog doubles to 12 stacks</strong> — Django, Rails, Go, iOS, Android, and AI/LLM Apps now live.
      Plus EPSS exploit-probability scoring on every CVE.{" "}
      <a
        href={PRESS_RELEASE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-primary underline-offset-2 hover:underline"
      >
        Read the launch post →
      </a>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
        aria-label="Dismiss announcement"
      >
        ✕
      </button>
    </div>
  );
}
