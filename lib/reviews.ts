export const REVIEW_COOKIE = "review_submitted";
export const REVIEW_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export const COMMENT_MAX_LENGTH = 1000;

const UNSAFE_LITERAL_CHARS = ["<", ">", "`"];

function isUnsafeChar(ch: string): boolean {
  if (UNSAFE_LITERAL_CHARS.includes(ch)) return true;
  const code = ch.codePointAt(0) ?? 0;
  return code <= 0x1f || code === 0x7f;
}

export function hasUnsafeChars(value: string): boolean {
  for (const ch of value) {
    if (isUnsafeChar(ch)) return true;
  }
  return false;
}

export function stripUnsafeChars(value: string): string {
  let result = "";
  for (const ch of value) {
    if (!isUnsafeChar(ch)) result += ch;
  }
  return result;
}
