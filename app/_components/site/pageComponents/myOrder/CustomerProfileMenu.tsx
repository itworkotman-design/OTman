"use client";

import { useEffect, useRef, useState } from "react";
import CustomerPasswordForm from "./CustomerPasswordForm";
import { ChevronDownIcon, KeyIcon, LogoutIcon } from "./myOrderIcons";

// The logged-in customer's badge on the "My order" pages: their initial and
// email; opens a menu with "change password" (the form opens in the menu)
// and "log out".
export default function CustomerProfileMenu({ locale, email }: { locale: "en" | "no"; email: string }) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "password">("menu");
  const [loggingOut, setLoggingOut] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/customer/logout", { method: "POST", credentials: "include" });
    } finally {
      window.location.href = `/${locale}/min-bestilling/logg-inn`;
    }
  }

  const initial = email.trim().charAt(0).toUpperCase() || "?";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => {
          setView("menu");
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 rounded-full border border-gray-200 bg-white py-1.5 pl-1.5 pr-3 shadow-sm transition hover:border-logoblue"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-logoblue text-sm font-bold text-white">{initial}</span>
        <span className="hidden max-w-48 truncate text-sm font-medium text-gray-900 sm:block">{email}</span>
        <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-2xl border border-gray-100 bg-white p-2 shadow-lg max-sm:left-0 max-sm:right-auto">
          {view === "menu" ? (
            <>
              <div className="px-3 py-2">
                <p className="text-xs text-textColorThird">{t("Logged in as", "Innlogget som")}</p>
                <p className="truncate text-sm font-semibold text-gray-900">{email}</p>
              </div>
              <div className="my-1 border-t border-gray-100" />
              <button
                type="button"
                role="menuitem"
                onClick={() => setView("password")}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-gray-900 hover:bg-gray-50"
              >
                <KeyIcon className="h-5 w-5 text-logoblue" />
                {t("Change password", "Endre passord")}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={logout}
                disabled={loggingOut}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <LogoutIcon className="h-5 w-5" />
                {loggingOut ? t("Logging out…", "Logger ut…") : t("Log out", "Logg ut")}
              </button>
            </>
          ) : (
            <div className="p-3">
              <p className="mb-3 font-semibold text-gray-900">{t("Change password", "Endre passord")}</p>
              <CustomerPasswordForm locale={locale} onBack={() => setView("menu")} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
