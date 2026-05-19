const FALLBACK_ORDER_EMAIL_LOGO_URL =
  "https://public-otman-img.s3.eu-north-1.amazonaws.com/LogoLG.png";

export function getOrderEmailLogoUrl() {
  return (
    process.env.ORDER_EMAIL_LOGO_URL?.trim() || FALLBACK_ORDER_EMAIL_LOGO_URL
  );
}
