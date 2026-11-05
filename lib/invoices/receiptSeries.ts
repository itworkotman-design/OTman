// The web-sales document series' prefix (receiptNumbers.ts). Pure, so client
// components can format a number without pulling in the database.

export const RECEIPT_SERIES_PREFIX = "W";

export function formatReceiptNumber(number: number): string {
  return `${RECEIPT_SERIES_PREFIX}-${number}`;
}
