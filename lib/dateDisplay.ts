function padDateSegment(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateParts(day: number, month: number, year: number) {
  return `${padDateSegment(day)}/${padDateSegment(month)}/${year}`;
}

function isValidDate(value: Date) {
  return !Number.isNaN(value.getTime());
}

export function formatDisplayDate(value: Date | string | null | undefined) {
  if (!value) return "-";

  if (value instanceof Date) {
    if (!isValidDate(value)) return "-";
    return formatDateParts(
      value.getDate(),
      value.getMonth() + 1,
      value.getFullYear(),
    );
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) return "-";

  const isoDateMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch;
    return `${day}/${month}/${year}`;
  }

  const parsedDate = new Date(trimmedValue);
  if (!isValidDate(parsedDate)) return trimmedValue;

  return formatDateParts(
    parsedDate.getDate(),
    parsedDate.getMonth() + 1,
    parsedDate.getFullYear(),
  );
}

export function formatDisplayDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";

  const parsedDate = value instanceof Date ? value : new Date(value);
  if (!isValidDate(parsedDate)) {
    return typeof value === "string" && value.trim() ? value.trim() : "-";
  }

  const datePart = formatDateParts(
    parsedDate.getDate(),
    parsedDate.getMonth() + 1,
    parsedDate.getFullYear(),
  );
  const timePart = `${padDateSegment(parsedDate.getHours())}:${padDateSegment(parsedDate.getMinutes())}`;

  return `${datePart} ${timePart}`;
}
