# Email Assets

## Source

- `lib/email/emailAssets.ts`

## Responsibility

Resolves public image asset URLs used in outbound email templates. Email images must use a stable public `https://` URL, such as a public S3 object URL or CloudFront URL, because email clients cannot render internal `s3://` storage paths or short-lived authenticated download links reliably.

## Functions

| Function | Description |
| --- | --- |
| `getOrderEmailLogoUrl` | Returns `ORDER_EMAIL_LOGO_URL` when configured, otherwise falls back to the public S3 Otman logo URL. |
