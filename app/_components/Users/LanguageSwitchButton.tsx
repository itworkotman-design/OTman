"use client";

import { useState } from "react";
import { bookingText } from "@/lib/booking/bookingUiText";
import type { CurrentUser } from "@/lib/users/useCurrentUser";
import {
  dispatchUserLanguageChanged,
  useUserLanguage,
  type UserLanguagePreference,
} from "@/lib/users/language";

type Props = {
  currentUser: CurrentUser | null;
  className?: string;
};

export default function LanguageSwitchButton({
  currentUser,
  className = "",
}: Props) {
  const { language, locale } = useUserLanguage(currentUser);
  const [saving, setSaving] = useState(false);

  async function handleToggleLanguage() {
    if (saving) return;

    const nextLanguage: UserLanguagePreference =
      language === "EN" ? "NO" : "EN";
    const previousLanguage = language;

    setSaving(true);
    dispatchUserLanguageChanged(nextLanguage);

    try {
      const res = await fetch("/api/auth/me/language", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          languagePreference: nextLanguage,
        }),
      });

      const data: unknown = await res.json().catch(() => null);

      if (
        !res.ok ||
        !data ||
        typeof data !== "object" ||
        !("ok" in data) ||
        data.ok !== true
      ) {
        dispatchUserLanguageChanged(previousLanguage);
      }
    } catch {
      dispatchUserLanguageChanged(previousLanguage);
    } finally {
      setSaving(false);
    }
  }

  const inactiveLanguage = language === "EN" ? "NO" : "EN";

  return (
    <button
      type="button"
      onClick={handleToggleLanguage}
      disabled={saving || !currentUser}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
      aria-label={bookingText(locale, "Switch language")}
      suppressHydrationWarning
    >
      <span>{bookingText(locale, "Language")}</span>
      <span className="ml-auto rounded bg-logoblue px-2 py-0.5 text-xs font-semibold text-white">
        {language}
      </span>
      <span className="text-xs text-textColorThird">/ {inactiveLanguage}</span>
    </button>
  );
}
