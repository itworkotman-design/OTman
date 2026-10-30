// Order columns the SMS routes need: the phones plus everything
// buildSmsTemplateVariables reads.
export const ORDER_SMS_SELECT = {
  id: true,
  companyId: true,
  phone: true,
  phoneTwo: true,
  displayId: true,
  orderNumber: true,
  customerName: true,
  deliveryDate: true,
  timeWindow: true,
  deliveryAddress: true,
  productsSummary: true,
  deliveryTypeSummary: true,
  servicesSummary: true,
} as const;

// sendOrderSms reasons that mean the request itself was bad (not a provider
// failure), so the routes answer 400 instead of 502.
export const SMS_CLIENT_ERROR_REASONS = new Set(["EMPTY_MESSAGE", "MISSING_PHONE", "INVALID_PHONE"]);
