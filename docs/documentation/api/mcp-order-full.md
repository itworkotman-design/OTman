# MCP full order lookup

Source: `app/api/integrations/mcp/orders/[orderNumber]/full/route.ts`

`GET /api/integrations/mcp/orders/{orderNumber}/full` is the private, read-only endpoint the Otman MCP server uses when it needs everything about one order. Auth is the same as the other MCP routes (bearer service key + fixed company header, see `authenticate-mcp-request.md`), and the lookup is the same exact `(companyId, displayId)` composite key as `mcp-order-by-number.md`.

Unlike the minimal lookup, this returns every scalar `Order` column (customer contact details, comments, status notes, driver/second driver/driver info, deviation, pricing, GSM sync state, payment/GDPR timestamps, coordinates, snapshots, etc.), plus:

- `status` (normalized) and `rawStatus` (stored value)
- `createdBy` / `lastEditedBy` / `customer` — membership `username`, `email`, `role`
- `history` — all `OrderEvent` rows, oldest first (created/updated/status-changed/GDPR, with the change payload and actor)
- `emailMessages` — order email thread, oldest first (text body only, no HTML)
- `notifications` — order alerts, including resolved ones
- `items` — `OrderItem` rows
- `attachments` — file metadata only
- `gsmTasks` — GSM task state per task, including `hasNotes`

Deliberately omitted: internal `id`/`companyId`, `actionToken` and `emailThreadToken` (bearer tokens), attachment `storagePath`, and GSM raw webhook payloads.

Responses: `200` found, `400` invalid display number, `401` bad key, `403` company mismatch, `404` not found, `503` not configured / backend unavailable.
