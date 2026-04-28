# Order Attachments Index Route

## Source

- `app/api/orders/attachments/route.ts`

## Responsibility

Returns company-scoped order file metadata across orders for authenticated users in the active company. Returned attachment URLs point at the authenticated app download endpoint.

## Functions

| Function | Description |
| --- | --- |
| `GET` | Returns company-scoped file metadata, the stored file category, and the app download URL. |
