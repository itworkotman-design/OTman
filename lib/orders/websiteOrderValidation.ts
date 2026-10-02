// Shared validation helpers for public website order-creation routes
// (transport-request, white-goods-order). Kept separate from the dashboard's
// internal booking validation — these only ever run against public,
// unauthenticated submissions.

// Digits and dashes, with an optional leading "+". Spaces are still accepted
// here (a pasted "+47 412 34 567" from an older client is fine), but the site's
// own inputs strip them as they're typed — see sanitizePhoneInput.
const PHONE_RE = /^\+?[\d\s-]{7,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISALLOWED_RE = /[<>'"`;\\{}[\]]/;
const DISALLOWED_GLOBAL_RE = /[<>'"`;\\{}[\]]/g;
// Control characters other than line breaks (\n, \r) — never typed on
// purpose, but can ride along in pasted text.
const CONTROL_CHARS_RE = /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g;

function hasDisallowed(v: string) {
  return DISALLOWED_RE.test(v);
}

// Client-side counterparts of the validators below, applied on every
// keystroke/paste in the public booking forms, so a customer can't even type
// what the server would reject. The server still validates on its own.

// Phone: digits and "-" only, plus one "+" at the very start — kept when a
// "+" comes before the first digit (so pasted "tlf: +47 …" keeps it).
export function sanitizePhoneInput(v: string): string {
  const digitsAndDashes = v.replace(/[^\d-]/g, "");
  const firstDigit = v.search(/\d/);
  const plus = v.indexOf("+");
  const leadingPlus = plus !== -1 && (firstDigit === -1 || plus < firstDigit);
  return leadingPlus ? `+${digitsAndDashes}` : digitsAndDashes;
}

// Free text (names, notes, addresses, email): drops exactly what
// validateTextField rejects, plus stray control characters.
export function sanitizeTextInput(v: string): string {
  return v.replace(DISALLOWED_GLOBAL_RE, "").replace(CONTROL_CHARS_RE, "");
}

export function validatePhoneField(v: string): string | null {
  const t = v.trim();
  if (!t) return "Required";
  if (!PHONE_RE.test(t)) return "Invalid phone number";
  if (hasDisallowed(v)) return "Contains disallowed characters";
  return null;
}

export function validateEmailField(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  if (!EMAIL_RE.test(t)) return "Invalid email address";
  if (hasDisallowed(v)) return "Contains disallowed characters";
  return null;
}

export function validateTextField(v: string): string | null {
  if (hasDisallowed(v)) return "Contains disallowed characters";
  return null;
}
