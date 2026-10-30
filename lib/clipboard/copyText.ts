// Text a copy button should put on the clipboard, or null when the value is
// empty (or the "-" placeholder tables render for missing values).
export function getCopyText(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return String(value);
  const trimmed = value.trim();
  return trimmed === "" || trimmed === "-" ? null : trimmed;
}
