"use client";

import { useEffect, useRef, useState } from "react";
import { getCopyText } from "@/lib/clipboard/copyText";

// Small icon button that copies `value`; renders nothing when there's nothing
// to copy, and briefly shows a checkmark after copying.
export default function CopyButton({
  value,
  ariaLabel = "Copy",
  dataAttribute,
  className = "",
}: {
  value: string | number | null | undefined;
  ariaLabel?: string;
  // Marker attribute (e.g. "data-phone-cell") so parent click handlers can
  // ignore clicks that came from the button.
  dataAttribute?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  }, []);

  const text = getCopyText(value);
  if (text === null) return null;

  return (
    <button
      type="button"
      {...(dataAttribute ? { [dataAttribute]: "true" } : {})}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
          resetTimerRef.current = setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard unavailable (insecure context / denied) — nothing to show.
        }
      }}
      className={`inline-flex shrink-0 items-center align-middle text-logoblue transition-opacity ${
        copied ? "opacity-100" : "opacity-40 hover:opacity-100"
      } ${className}`}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      )}
    </button>
  );
}
