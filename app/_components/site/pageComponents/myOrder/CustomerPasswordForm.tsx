"use client";

import { useState } from "react";

// Lets a logged-in customer swap the generated password for their own
// (POST /api/customer/password). A link in the "My orders" header that opens
// the form as a small panel under it.
export default function CustomerPasswordForm({ locale }: { locale: "en" | "no" }) {
  const t = (en: string, no: string) => (locale === "no" ? no : en);
  const [open, setOpen] = useState(false);
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
    <div className="relative text-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="font-semibold text-logoblue">
        {t("Change password", "Endre passord")}
      </button>
      {open && (
        <form
          onSubmit={submit}
          className="absolute right-0 top-full z-20 mt-3 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-lg max-sm:left-0 max-sm:right-auto"
        >
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
        </form>
      )}
    </div>
  );
}
