// The number customers call — e.g. to cancel an order, which is by phone
// only (there is no self-service cancel). Same number as ContactContent.
export const OTMAN_PHONE = "+47 402 84 977";
export const OTMAN_PHONE_HREF = "tel:+4740284977";

// "To cancel, call us" — in "My order", its rules and the customer emails.
export const CALL_TO_CANCEL = {
  no: `Vil du avbestille, ring oss på ${OTMAN_PHONE}.`,
  en: `To cancel, call us on ${OTMAN_PHONE}.`,
} as const;
