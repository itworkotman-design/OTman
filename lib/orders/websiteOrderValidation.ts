// Shared validation helpers for public website order-creation routes
// (transport-request, white-goods-order). Kept separate from the dashboard's
// internal booking validation — these only ever run against public,
// unauthenticated submissions.

// Digits and dashes, with an optional leading "+". Spaces are still accepted
// here (a pasted "+47 412 34 567" from an older client is fine), but the site's
// own inputs strip them as they're typed — see sanitizePhoneInput.
const PHONE_RE = /^\+?[\d\s-]{7,20}$/;
// Email, per the practical rules every mail provider follows (a strict
// subset of RFC 5321): local part of ASCII letters/digits and . _ % + -,
// never starting/ending with a dot or containing ".."; a domain of dot-
// separated labels (letters — æøå included, for IDN domains — digits and
// inner hyphens) ending in a letters-only TLD of 2+; at most 64 characters
// before the @, 63 per label and 254 in total.
const EMAIL_LOCAL_RE = /^[A-Za-z0-9_%+-]+(\.[A-Za-z0-9_%+-]+)*$/;
const EMAIL_LABEL_RE = /^[\p{L}\p{N}]([\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?$/u;
const EMAIL_TLD_RE = /^\p{L}{2,63}$/u;
// What can appear anywhere in an address while it's typed (sanitizeEmailInput).
const EMAIL_CHAR_RE = /[^\p{L}\p{N}._%+@-]/gu;
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

// Free text (names, notes, addresses): drops exactly what
// validateTextField rejects, plus stray control characters.
export function sanitizeTextInput(v: string): string {
  return v.replace(DISALLOWED_GLOBAL_RE, "").replace(CONTROL_CHARS_RE, "");
}

// Email: drops whitespace and anything no address can contain, and keeps
// only the first "@". Letters outside ASCII survive (an IDN domain like
// blåbær.no needs them); isValidEmail decides whether the result is usable.
export function sanitizeEmailInput(v: string): string {
  const allowed = v.replace(EMAIL_CHAR_RE, "");
  const at = allowed.indexOf("@");
  if (at === -1) return allowed;
  return allowed.slice(0, at + 1) + allowed.slice(at + 1).replace(/@/g, "");
}

export function isValidEmail(v: string): boolean {
  const email = v.trim();
  if (email.length > 254) return false;
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (local.length > 64 || !EMAIL_LOCAL_RE.test(local)) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  return labels.every((label) => EMAIL_LABEL_RE.test(label)) && EMAIL_TLD_RE.test(labels[labels.length - 1]);
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
  if (!isValidEmail(t)) return "Invalid email address";
  if (hasDisallowed(v)) return "Contains disallowed characters";
  return null;
}

export function validateTextField(v: string): string | null {
  if (hasDisallowed(v)) return "Contains disallowed characters";
  return null;
}
