"use client";

import { useState } from "react";

type Props = {
  locale: "en" | "no";
  // Where to go once logged in (already checked to be inside My order).
  next: string;
  startWithForgot?: boolean;
};

const TEXT = {
  no: {
    heading: "Min bestilling",
    intro: "Logg inn med e-postadressen du bestilte med og passordet du fikk på e-post.",
    email: "E-post",
    password: "Passord",
    login: "Logg inn",
    loggingIn: "Logger inn…",
    invalid: "Feil e-post eller passord.",
    rateLimited: "For mange forsøk. Vent litt og prøv igjen.",
    error: "Noe gikk galt. Prøv igjen.",
    forgot: "Glemt passord?",
    forgotIntro: "Skriv e-postadressen du bestilte med, så sender vi deg et nytt passord.",
    send: "Send nytt passord",
    sending: "Sender…",
    sent: "Hvis e-postadressen har en aktiv bestilling, har vi sendt et nytt passord. Sjekk innboksen (og søppelpost).",
    back: "Tilbake til innlogging",
  },
  en: {
    heading: "My order",
    intro: "Log in with the email you ordered with and the password we emailed you.",
    email: "Email",
    password: "Password",
    login: "Log in",
    loggingIn: "Logging in…",
    invalid: "Wrong email or password.",
    rateLimited: "Too many attempts. Wait a little and try again.",
    error: "Something went wrong. Please try again.",
    forgot: "Forgot password?",
    forgotIntro: "Enter the email you ordered with and we'll send you a new password.",
    send: "Send new password",
    sending: "Sending…",
    sent: "If that email has an active order, we've sent a new password. Check your inbox (and spam).",
    back: "Back to login",
  },
} as const;

const inputClass = "mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-logoblue focus:outline-none";

export default function CustomerLoginClient({ locale, next, startWithForgot = false }: Props) {
  const t = TEXT[locale];
  const [mode, setMode] = useState<"login" | "forgot">(startWithForgot ? "forgot" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/customer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        window.location.href = next;
        return;
      }
      setError(json?.reason === "RATE_LIMITED" ? t.rateLimited : json?.reason === "INVALID_CREDENTIALS" ? t.invalid : t.error);
    } catch {
      setError(t.error);
    }
    setBusy(false);
  }

  async function forgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch("/api/customer/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } finally {
      setSent(true);
      setBusy(false);
    }
  }

  return (
    <div className="py-16">
      <h1 className="text-xl font-semibold">{t.heading}</h1>
      <div className="mt-6 max-w-md rounded-lg border border-gray-200 p-6">
        {mode === "login" ? (
          <form onSubmit={login} className="flex flex-col gap-4">
            <p className="text-sm text-textColorThird">{t.intro}</p>
            <label className="block text-sm font-medium">
              {t.email}
              <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </label>
            <label className="block text-sm font-medium">
              {t.password}
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </label>
            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
            <button type="submit" disabled={busy} className="customButtonEnabled h-11 px-6 disabled:opacity-50!">
              {busy ? t.loggingIn : t.login}
            </button>
            <button type="button" onClick={() => setMode("forgot")} className="self-start text-sm font-semibold text-logoblue">
              {t.forgot}
            </button>
          </form>
        ) : (
          <form onSubmit={forgot} className="flex flex-col gap-4">
            {sent ? (
              <p className="text-sm font-medium text-green-700">{t.sent}</p>
            ) : (
              <>
                <p className="text-sm text-textColorThird">{t.forgotIntro}</p>
                <label className="block text-sm font-medium">
                  {t.email}
                  <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
                </label>
                <button type="submit" disabled={busy} className="customButtonEnabled h-11 px-6 disabled:opacity-50!">
                  {busy ? t.sending : t.send}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setSent(false);
              }}
              className="self-start text-sm font-semibold text-logoblue"
            >
              {t.back}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
