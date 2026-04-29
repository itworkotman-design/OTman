# Attachment Categories

## Source

- `lib/orders/attachmentCategories.ts`

## Responsibility

Defines the allowed user upload categories and the shared attachment item shape used by both the API routes and React components, including distinct open and download URLs.

## Functions

| Function | Description |
| --- | --- |
| `isAttachmentCategory` | Checks whether a string is one of the supported category values. |
| `normalizeAttachmentCategory` | Converts incoming request values into a safe category, defaulting to `ATTACHMENT` when the input is missing or invalid. |
| `getAttachmentCategoryLabel` | Converts a category value into a short UI label. |
