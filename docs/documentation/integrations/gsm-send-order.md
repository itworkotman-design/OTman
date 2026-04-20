# GSM Send Order

## Source

- `lib/integrations/gsm/sendOrder.ts`

## Responsibility

Sends one OTman order to GSM using the built payload and maps the GSM response back into OTman task references.

## Functions

| Function | Description |
| --- | --- |
| `extractTaskIdFromUrl` | Pulls the GSM task id out of a returned task URL. |
| `sendOrderToGsm` | Builds the GSM payload, posts it to GSM, validates the GSM order id, and maps the returned task URLs to category/reference pairs. |
