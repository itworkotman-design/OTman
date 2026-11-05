"use client";

import { useState } from "react";
import { OTMAN_PHONE, OTMAN_PHONE_HREF } from "@/lib/content/companyContact";
import { ArrowLeftIcon, BoxIcon, CheckIcon, EyeIcon, EyeOffIcon, KeyIcon, MailIcon, PhoneIcon } from "./myOrderIcons";

type Props = {
  locale: "en" | "no";
  // Where to go once logged in (already checked to be inside My order).
  next: string;
  startWithForgot?: boolean;
};

const TEXT = {
  no: {
    heading: "Min bestilling",
    intro: "Se bestillingen din, følg leveringen og legg til tjenester.",
    email: "E-post",
    emailPlaceholder: "din@epost.no",
    password: "Passord",
    passwordPlaceholder: "Passordet fra e-posten",
    show: "Vis passord",
    hide: "Skjul passord",
    login: "Logg inn",
    loggingIn: "Logger inn…",
    invalid: "Feil e-post eller passord. Sjekk at du bruker e-posten du bestilte med.",
    rateLimited: "For mange forsøk. Vent litt og prøv igjen.",
    error: "Noe gikk galt. Prøv igjen.",
    forgot: "Glemt passord?",
    whereTitle: "Hvor finner jeg passordet?",
    whereText: "Brukernavn og passord står i e-posten «Takk for bestillingen» som vi sendte da du bestilte. Sjekk også søppelpost.",
    help: "Trenger du hjelp? Ring oss på",
    forgotHeading: "Glemt passord",
    forgotIntro: "Skriv e-postadressen du bestilte med, så sender vi deg et nytt passord.",
    send: "Send nytt passord",
    sending: "Sender…",
    sentTitle: "Sjekk e-posten din",
    sent: "Hvis e-postadressen har en aktiv bestilling, har vi sendt et nytt passord. Det kan ta et par minutter — sjekk også søppelpost.",
    back: "Tilbake til innlogging",
  },
  en: {
    heading: "My order",
    intro: "See your order, follow the delivery and add services.",
    email: "Email",
    emailPlaceholder: "you@example.com",
    password: "Password",
    passwordPlaceholder: "The password from the email",
    show: "Show password",
    hide: "Hide password",
    login: "Log in",
    loggingIn: "Logging in…",
    invalid: "Wrong email or password. Check that you're using the email you ordered with.",
    rateLimited: "Too many attempts. Wait a little and try again.",
    error: "Something went wrong. Please try again.",
    forgot: "Forgot password?",
    whereTitle: "Where do I find my password?",
    whereText: "Your username and password are in the “Thank you for your order” email we sent when you ordered. Check your spam folder too.",
    help: "Need help? Call us on",
    forgotHeading: "Forgot password",
    forgotIntro: "Enter the email you ordered with and we'll send you a new password.",
    send: "Send new password",
    sending: "Sending…",
    sentTitle: "Check your email",
    sent: "If that email has an active order, we've sent a new password. It can take a couple of minutes — check your spam folder too.",
    back: "Back to login",
  },
} as const;

const inputClass =
  "h-12 w-full rounded-xl border border-black/15 bg-white pl-11 pr-3 text-[15px] text-black/85 outline-none transition placeholder:text-black/35 focus:border-logoblue focus:ring-3 focus:ring-logoblue/15";
const buttonClass =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-logoblue px-6 text-[15px] font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:pointer-events-none disabled:opacity-60";
const linkClass = "text-sm font-semibold text-logoblue underline-offset-2 hover:underline";

function Spinner() {
  return <span aria-hidden className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}

export default function CustomerLoginClient({ locale, next, startWithForgot = false }: Props) {
  const t = TEXT[locale];
  const [mode, setMode] = useState<"login" | "forgot">(startWithForgot ? "forgot" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  const switchMode = (next: "login" | "forgot") => {
    setMode(next);
    setSent(false);
    setError("");
  };

  const emailField = (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-black/75">{t.email}</span>
      <span className="relative block">
        <MailIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-black/35" />
        <input
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.emailPlaceholder}
          className={inputClass}
        />
      </span>
    </label>
  );

  return (
    <div className="flex justify-center px-1 py-12 sm:py-20">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_12px_40px_-12px_rgba(39,48,151,0.25)] sm:p-8">
          {mode === "login" ? (
            <>
              <div className="mb-6 flex flex-col items-center text-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-logoblue/10 text-logoblue">
                  <BoxIcon className="h-7 w-7" />
                </span>
                <h1 className="text-2xl font-semibold text-logoblue">{t.heading}</h1>
                <p className="mt-1.5 text-sm text-black/55">{t.intro}</p>
              </div>

              <form onSubmit={login} className="flex flex-col gap-4">
                {emailField}
                <div>
                  <span className="mb-1.5 flex items-baseline justify-between gap-3">
                    <label htmlFor="customer-password" className="text-sm font-semibold text-black/75">
                      {t.password}
                    </label>
                    <button type="button" onClick={() => switchMode("forgot")} className={linkClass}>
                      {t.forgot}
                    </button>
                  </span>
                  <span className="relative block">
                    <KeyIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-black/35" />
                    <input
                      id="customer-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.passwordPlaceholder}
                      className={`${inputClass} pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? t.hide : t.show}
                      title={showPassword ? t.hide : t.show}
                      className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-black/40 transition hover:bg-black/5 hover:text-black/70"
                    >
                      {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </span>
                </div>

                {error && (
                  <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
                    {error}
                  </p>
                )}

                <button type="submit" disabled={busy} className={`${buttonClass} mt-1`}>
                  {busy && <Spinner />}
                  {busy ? t.loggingIn : t.login}
                </button>
              </form>

              <div className="mt-6 rounded-2xl bg-logoblue/[0.05] px-4 py-3.5 text-sm">
                <p className="font-semibold text-logoblue">{t.whereTitle}</p>
                <p className="mt-1 leading-relaxed text-black/60">{t.whereText}</p>
              </div>
            </>
          ) : (
            <>
              <button type="button" onClick={() => switchMode("login")} className={`${linkClass} mb-5 inline-flex items-center gap-1.5`}>
                <ArrowLeftIcon className="h-4 w-4" />
                {t.back}
              </button>

              {sent ? (
                <div className="flex flex-col items-center py-2 text-center">
                  <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
                    <CheckIcon className="h-7 w-7" />
                  </span>
                  <h1 className="text-2xl font-semibold text-logoblue">{t.sentTitle}</h1>
                  <p className="mt-2 text-sm leading-relaxed text-black/60">{t.sent}</p>
                  <button type="button" onClick={() => switchMode("login")} className={`${buttonClass} mt-6`}>
                    {t.back}
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-6 flex flex-col items-center text-center">
                    <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-logoblue/10 text-logoblue">
                      <KeyIcon className="h-7 w-7" />
                    </span>
                    <h1 className="text-2xl font-semibold text-logoblue">{t.forgotHeading}</h1>
                    <p className="mt-1.5 text-sm text-black/55">{t.forgotIntro}</p>
                  </div>
                  <form onSubmit={forgot} className="flex flex-col gap-4">
                    {emailField}
                    <button type="submit" disabled={busy} className={`${buttonClass} mt-1`}>
                      {busy && <Spinner />}
                      {busy ? t.sending : t.send}
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-sm text-black/55">
          <PhoneIcon className="h-4 w-4" />
          {t.help}{" "}
          <a href={OTMAN_PHONE_HREF} className="font-semibold text-logoblue hover:underline">
            {OTMAN_PHONE}
          </a>
        </p>
      </div>
    </div>
  );
}
