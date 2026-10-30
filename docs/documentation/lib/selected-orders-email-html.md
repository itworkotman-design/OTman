# `lib/orders/selectedOrdersEmailHtml.ts`

## Purpose
Builds the HTML of the "selected orders" summary email: "Hei <name>,", an optional message, one table per order and the Otman footer (login button, signature with the Gmail send-as address, logo). Used by `/api/orders/send-selected-email` and `/api/orders/send-prepare-email`.

## Exports
| Export | Description |
| --- | --- |
| `escapeHtml` | Escapes dynamic text for the email HTML (also used by the send-selected-email failure log). |
| `buildSelectedOrdersEmailHtml({ greetingName, message, orders })` | The full email HTML. Each order block has delivery date, time window, customer, Power bilagsnummer, customer name/phone, pickup, extra pickups, delivery and return address, products, cashier and price ex. VAT (from the pricing snapshot when present). Empty rows are left out. |
| `SelectedOrderEmailOrder` | The order fields the blocks read. |
