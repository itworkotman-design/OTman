export function isDiscountActive(params: {
  discountAmount: number | null;
  discountEndsAt: Date | null;
  now?: Date;
}) {
  const { discountAmount, discountEndsAt, now = new Date() } = params;

  return (
    discountAmount !== null &&
    discountEndsAt !== null &&
    discountEndsAt.getTime() > now.getTime()
  );
}

export function getEffectivePrice(params: {
  basePrice: number;
  discountAmount: number | null;
  discountEndsAt: Date | null;
  now?: Date;
}) {
  const {
    basePrice,
    discountAmount,
    discountEndsAt,
    now = new Date(),
  } = params;

  if (
    !isDiscountActive({
      discountAmount,
      discountEndsAt,
      now,
    })
  ) {
    return basePrice;
  }

  return Math.max(0, basePrice - (discountAmount ?? 0));
}

export function shouldClearExpiredDiscount(params: {
  discountEndsAt: Date | null;
  now?: Date;
}) {
  const { discountEndsAt, now = new Date() } = params;

  return discountEndsAt !== null && discountEndsAt.getTime() <= now.getTime();
}
