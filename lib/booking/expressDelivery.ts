// An order is express when its delivery window starts less than 24h after
// `referenceTime` — "now" for a new order, the creation time for a saved one.
export function isExpressDelivery({
  deliveryDate,
  timeWindow,
  customTimeFrom,
  referenceTime,
}: {
  deliveryDate: string;
  timeWindow: string;
  customTimeFrom: string;
  referenceTime: Date;
}): boolean {
  if (!deliveryDate) {
    return false;
  }

  let startHH = 0;
  let startMM = 0;

  if (timeWindow === "10:00-16:00") {
    startHH = 10;
  } else if (timeWindow === "16:00-21:00") {
    startHH = 16;
  } else if (timeWindow === "custom") {
    const match = customTimeFrom.match(/^(\d{2}):(\d{2})$/);
    if (!match) {
      return false;
    }
    startHH = Number(match[1]);
    startMM = Number(match[2]);
  }

  const deliveryStart = new Date(
    `${deliveryDate}T${String(startHH).padStart(2, "0")}:${String(startMM).padStart(2, "0")}:00`,
  );
  const diffHours = (deliveryStart.getTime() - referenceTime.getTime()) / (1000 * 60 * 60);

  return diffHours < 24;
}
