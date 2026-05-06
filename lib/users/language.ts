"use client";

import { useEffect, useState } from "react";
import type { CurrentUser } from "@/lib/users/useCurrentUser";
import type { BookingUiLocale } from "@/lib/booking/bookingUiText";

export type UserLanguagePreference = "EN" | "NO";

export const USER_LANGUAGE_CHANGED_EVENT = "otman:user-language-changed";

export function isUserLanguagePreference(
  value: string | null | undefined,
): value is UserLanguagePreference {
  return value === "EN" || value === "NO";
}

export function getDefaultUserLanguage(
  user: Pick<CurrentUser, "role" | "permissions"> | null,
): UserLanguagePreference {
  if (user?.role === "OWNER" || user?.role === "ADMIN") {
    return "EN";
  }

  return "NO";
}

export function getUserLanguage(
  user: Pick<
    CurrentUser,
    "languagePreference" | "role" | "permissions"
  > | null,
): UserLanguagePreference {
  if (isUserLanguagePreference(user?.languagePreference)) {
    return user.languagePreference;
  }

  return getDefaultUserLanguage(user);
}

export function userLanguageToBookingLocale(
  language: UserLanguagePreference,
): BookingUiLocale {
  return language === "NO" ? "nb" : "en";
}

export function dispatchUserLanguageChanged(
  language: UserLanguagePreference,
) {
  window.dispatchEvent(
    new CustomEvent<UserLanguagePreference>(USER_LANGUAGE_CHANGED_EVENT, {
      detail: language,
    }),
  );
}

export function useUserLanguage(user: CurrentUser | null) {
  const [language, setLanguage] = useState<UserLanguagePreference>(() =>
    getUserLanguage(user),
  );

  useEffect(() => {
    setLanguage(getUserLanguage(user));
  }, [user]);

  useEffect(() => {
    function handleLanguageChanged(event: Event) {
      if (!(event instanceof CustomEvent)) return;
      if (!isUserLanguagePreference(event.detail)) return;

      setLanguage(event.detail);
    }

    window.addEventListener(
      USER_LANGUAGE_CHANGED_EVENT,
      handleLanguageChanged,
    );

    return () => {
      window.removeEventListener(
        USER_LANGUAGE_CHANGED_EVENT,
        handleLanguageChanged,
      );
    };
  }, []);

  return {
    language,
    locale: userLanguageToBookingLocale(language),
  };
}
