"use client";

import { useState } from "react";

function LinkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// Sits at the right edge of a breadcrumb nav (FolderView/ItemView) and
// copies the current page URL, not any particular entity's link — unlike
// PillHoverActions' per-row share button, which copies that row's href.
export function CopyUrlButton({ locale }: { locale: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access denied/unavailable — button just silently doesn't
      // show the "Copied!" confirmation.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-logoblue transition-all duration-150 hover:bg-logoblue/10 active:scale-90 ${
        copied ? "bg-green-500/15 text-green-600 hover:bg-green-500/15" : ""
      }`}
      title={copied ? (locale === "nb" ? "Kopiert!" : "Copied!") : locale === "nb" ? "Kopier lenke" : "Copy link"}
      aria-label={locale === "nb" ? "Kopier lenke" : "Copy link"}
    >
      {copied ? <CheckIcon /> : <LinkIcon />}
    </button>
  );
}
