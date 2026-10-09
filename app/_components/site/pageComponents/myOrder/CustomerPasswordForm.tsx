"use client";

import { useState } from "react";

// Lets a logged-in customer swap the generated password for their own
// (POST /api/customer/password). Shown inside the profile menu
// (CustomerProfileMenu); `onBack` returns to the menu.
export default function CustomerPasswordForm({ locale, onBack }: { locale: "en" | "no"; onBack: () => void }) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/customer/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setMessage({ ok: true, text: t("Password changed.", "Passordet er endret.") });
        setCurrentPassword("");
        setNewPassword("");
      } else {
        setMessage({
          ok: false,
          text:
            json?.reason === "PASSWORD_TOO_SHORT"
              ? t("The new password needs at least 8 characters.", "Det nye passordet må ha minst 8 tegn.")
              : json?.reason === "INVALID_CURRENT_PASSWORD"
                ? t("The current password is wrong.", "Nåværende passord er feil.")
                : t("Couldn't change the password.", "Kunne ikke endre passordet."),
        });
      }
    } catch {
      setMessage({ ok: false, text: t("Couldn't change the password.", "Kunne ikke endre passordet.") });
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-logoblue focus:outline-none";

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 text-sm">
      <label className="block font-medium">
        {t("Current password", "Nåværende passord")}
        <input
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block font-medium">
        {t("New password", "Nytt passord")}
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
        />
      </label>
      {message && <p className={`font-medium ${message.ok ? "text-green-700" : "text-red-600"}`}>{message.text}</p>}
      <button type="submit" disabled={busy} className="customButtonEnabled h-11 px-6 disabled:opacity-50!">
        {busy ? t("Saving…", "Lagrer…") : t("Change password", "Endre passord")}
      </button>
      <button type="button" onClick={onBack} className="h-9 font-semibold text-gray-600 hover:text-gray-900">
        {t("Back", "Tilbake")}
      </button>
    </form>
  );
}
