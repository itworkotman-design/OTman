// Shared validation helpers for public website order-creation routes
// (transport-request, white-goods-order). Kept separate from the dashboard's
// internal booking validation — these only ever run against public,
// unauthenticated submissions.

const PHONE_RE = /^\+?[\d\s\-().]{7,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISALLOWED_RE = /[<>'"`;\\{}[\]]/;

function hasDisallowed(v: string) {
  return DISALLOWED_RE.test(v);
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
