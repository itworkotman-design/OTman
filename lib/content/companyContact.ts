// The number customers call. Same number as ContactContent.
export const OTMAN_PHONE = "+47 402 84 977";
export const OTMAN_PHONE_HREF = "tel:+4740284977";

// Where customers write — e.g. to cancel an order (there is no self-service
// cancel).
export const OTMAN_EMAIL = "info@otman.no";
export const OTMAN_EMAIL_HREF = `mailto:${OTMAN_EMAIL}`;

// How to cancel — in "My order", its rules and the customer emails.
export const HOW_TO_CANCEL = {
  no: `Vil du avbestille, skriv til oss på ${OTMAN_EMAIL}.`,
  en: `To cancel, email us at ${OTMAN_EMAIL}.`,
} as const;
