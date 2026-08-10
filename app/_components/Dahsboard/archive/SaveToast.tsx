"use client";

import { useEffect } from "react";

type Props = {
  message: string;
  onDismiss: () => void;
};

const AUTO_DISMISS_MS = 3000;

// A small "saved" confirmation, bottom-left of the content area — offset by
// `--dash-sidebar-width` (set on <main> in the archive dashboard layout) so
// it sits just to the right of the sidebar instead of underneath it. The
// mobile layout never sets that variable (it has a top bar, not a left
// sidebar), so the `0px` fallback there just puts it near the true screen
// edge. Render with a fresh `key` per save so each toast gets its own timer
// — see ItemSettingsView's savedToastKey.
export function SaveToast({ message, onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed bottom-6 z-50 flex items-center gap-2 rounded-xl border border-lineSecondary bg-white px-4 py-3 text-sm font-medium text-green-600 shadow-lg"
      style={{ left: "calc(var(--dash-sidebar-width, 0px) + 1rem)" }}
    >
      <span aria-hidden>✓</span>
      {message}
    </div>
  );
}
