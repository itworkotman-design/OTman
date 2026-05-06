# Gmail Sync Route

## Source

- `app/api/integrations/gmail/sync/route.ts`

## Responsibility

Exposes a manual Gmail polling trigger for importing OTman order conversation replies into the app.

## Functions

| Function | Description |
| --- | --- |
| `POST` | Runs Gmail order-conversation sync and returns import, duplicate, token-missing, and order-missing counts. |
