"use client";

import { useState } from "react";

export default function CustomerLogoutButton({ locale }: { locale: "en" | "no" }) {
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/customer/logout", { method: "POST", credentials: "include" });
    } finally {
      window.location.href = `/${locale}/min-bestilling/logg-inn`;
    }
  }

  return (
    <button type="button" onClick={logout} disabled={busy} className="text-sm font-semibold text-logoblue disabled:opacity-50">
      {locale === "no" ? "Logg ut" : "Log out"}
    </button>
  );
}
