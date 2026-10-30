# GSM Send Order

## Source

- `lib/integrations/gsm/sendOrder.ts`

## Responsibility

Sends one OTman order to GSM using the built payload and maps the GSM response back into OTman task references.

## Functions

| Function | Description |
| --- | --- |
| `extractTaskIdFromUrl` | Pulls the GSM task id out of a returned task URL. |
| `isTaskCategory` | Narrows a GSM task category to `pick_up` / `drop_off` / `assignment`. |
| `sendOrderToGsm` | Builds the GSM payload, posts it to GSM, validates the GSM order id, and maps the returned task URLs to category/reference pairs. GSM does not return tasks in payload order, so each task's category is read back with `GET /tasks/{id}/` rather than matched by index against `tasks_data`. |
