const NORWAY_COUNTRY_CODE = "47";

// Turns whatever was typed into an order's phone field into the MSISDN
// GatewayAPI expects (country code + number, digits only). Bare 8-digit
// numbers are assumed Norwegian. Returns null when it can't be a phone number.
export function normalizeSmsRecipient(raw: string | null | undefined): string | null {
  let value = (raw ?? "").replace(/[\s\-().]/g, "");
  if (!value) return null;

  if (value.startsWith("+")) value = value.slice(1);
  else if (value.startsWith("00")) value = value.slice(2);

  if (!/^\d+$/.test(value)) return null;
  if (value.length === 8) return `${NORWAY_COUNTRY_CODE}${value}`;
  if (value.length >= 10 && value.length <= 15) return value;
  return null;
}
