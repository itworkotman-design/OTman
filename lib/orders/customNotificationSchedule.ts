export const CUSTOM_NOTIFICATION_HOUR_MIN = 6;
export const CUSTOM_NOTIFICATION_HOUR_MAX = 22;

type CustomNotificationRequestBody = {
  title?: unknown;
  message?: unknown;
  date?: unknown;
  hour?: unknown;
} | null;

export type ParsedCustomNotificationInput =
  | { ok: true; title: string; message: string; scheduledFor: Date }
  | { ok: false; reason: "TITLE_AND_MESSAGE_REQUIRED" | "INVALID_SCHEDULE" };

export function parseCustomNotificationInput(
  body: CustomNotificationRequestBody,
): ParsedCustomNotificationInput {
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const date = typeof body?.date === "string" ? body.date : "";
  const hour = typeof body?.hour === "number" ? body.hour : Number(body?.hour);

  if (!title || !message) {
    return { ok: false, reason: "TITLE_AND_MESSAGE_REQUIRED" };
  }

  const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (
    !dateMatch ||
    !Number.isInteger(hour) ||
    hour < CUSTOM_NOTIFICATION_HOUR_MIN ||
    hour > CUSTOM_NOTIFICATION_HOUR_MAX
  ) {
    return { ok: false, reason: "INVALID_SCHEDULE" };
  }

  const scheduledFor = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    hour,
    0,
    0,
    0,
  );

  if (Number.isNaN(scheduledFor.getTime())) {
    return { ok: false, reason: "INVALID_SCHEDULE" };
  }

  return { ok: true, title, message, scheduledFor };
}
