# Order Attachments Index Route

## Source

- `app/api/orders/attachments/route.ts`

## Responsibility

Returns company-scoped order file metadata across orders for authenticated users in the active company. Returned attachment payloads include separate open and download URLs, with signed open URLs for S3-backed files.

## Functions

| Function | Description |
| --- | --- |
| `GET` | Returns company-scoped file metadata, the stored file category, and separate open and download URLs. |
