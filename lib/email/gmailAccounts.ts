const DEFAULT_GMAIL_ACCOUNT_EMAIL = "itworkotman@gmail.com";
const DEFAULT_GMAIL_SEND_AS_EMAIL = "bestilling@otman.no";

export function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function getGmailAccountEmail() {
  return normalizeEmail(process.env.GMAIL_ACCOUNT_EMAIL || process.env.GMAIL_USER || DEFAULT_GMAIL_ACCOUNT_EMAIL);
}

export function getGmailSendAsEmail() {
  return normalizeEmail(process.env.GMAIL_SEND_AS_EMAIL || DEFAULT_GMAIL_SEND_AS_EMAIL);
}

export function getAdminEmails(): string[] {
  return Array.from(new Set([getGmailAccountEmail(), getGmailSendAsEmail()].filter((email) => email.length > 0)));
}

export function formatGmailSenderName() {
  return process.env.BREVO_SENDER_NAME?.trim() || "Otman AS";
}
