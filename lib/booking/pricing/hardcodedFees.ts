export const EXTRA_WORK_FEE_CODE = "XTRAARBEID";
export const EXTRA_WORK_FEE_LABEL =
  "Extra work fee per started 20 min";
export const ADD_TO_ORDER_FEE_CODE = "ADDORDER";
export const ADD_TO_ORDER_FEE_LABEL = "Gebyr for tillegg av bestilling";

export function calculateExtraWorkFee(minutes: number): {
  blocks: number;
  price: number;
} {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return { blocks: 0, price: 0 };
  }

  const blocks = Math.ceil(minutes / 20);
  return {
    blocks,
    price: blocks * 150,
  };
}
