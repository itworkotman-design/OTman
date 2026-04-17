# Order Attachments Section

## Source

- `app/_components/Dahsboard/booking/create/OrderAttachmentsSection.tsx`

## Responsibility

Renders the upload UI for order files, split into two user-facing categories: receipts and attachments.

## Functions

| Function | Description |
| --- | --- |
| `isImage` | Checks whether an uploaded file should render with an image preview. |
| `isPdf` | Checks whether an uploaded file should render with the PDF placeholder. |
| `OrderAttachmentsSection` | Main upload and listing component. Renders separate left-aligned upload buttons and grouped file lists for each category, with receipts shown before attachments. |
