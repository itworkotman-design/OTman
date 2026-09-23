# MCP exact order lookup

Source: `app/api/integrations/mcp/orders/[orderNumber]/route.ts`

`GET /api/integrations/mcp/orders/{orderNumber}` is the private, read-only endpoint used by the Otman MCP server. It requires the MCP service bearer key and fixed company header described in `authenticate-mcp-request.md`.

The route accepts only a positive integer display number. It performs an exact Prisma `findUnique` query using the existing `Order` composite unique key `(companyId, displayId)`. It never accepts an internal order CUID and does not use the fuzzy order-search route.

The response is deliberately limited to the display number, customer reference and name/label, normalized status, schedule, operational addresses, order summaries, and timestamps. It omits internal IDs, phone numbers, email addresses, customer comments, pricing, membership IDs, and integration metadata.

Responses:

- `200` exact order found
- `400` invalid display number
- `401` invalid or missing service key
- `403` fixed-company mismatch
- `404` no order in the configured company has that display number
- `503` missing server configuration or unavailable backend
