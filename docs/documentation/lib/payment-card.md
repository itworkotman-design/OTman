# Payment Card State

## Source

- `lib/invoices/paymentCard.ts`

## Responsibility

What the Payment card in the homepage order modal says and offers (`WebsiteOrderInvoiceSummary`), following the calculator live.

## Functions

| Function | Description |
| --- | --- |
| `paymentCardState(overview, previewTotalIncVatNok)` | Headline (`not_priced`, `not_invoiced`, `pending`, `paid`, `due_more`, `owe_refund`), whether every faktura is paid ("Customer paid" vs "Customer was sent"), invoiced/paid/total/difference, and the actions: a faktura for the difference (the whole total the first time), a kreditnota for what's owed back, Mark paid while any faktura is unpaid. With an unsaved calculator total (`afterChange`) the numbers follow it but no action is offered — only a saved order can be invoiced. |
