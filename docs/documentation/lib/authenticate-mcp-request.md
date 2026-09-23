# MCP service authentication

Source: `lib/integrations/mcp/authenticateMcpRequest.ts`

The MCP integration uses a dedicated server-to-server bearer key from `OTMAN_API_KEY`. The key must contain at least 32 characters and is compared with a timing-safe digest comparison.

Every request must also send `X-Otman-Company-Id`. Its value must exactly match the fixed `OTMAN_API_COMPANY_ID`; callers cannot select another company. Missing configuration fails closed with `503`, invalid credentials return `401`, and a company mismatch returns `403`.

The service key is independent of end-user OAuth. It must be stored only in the booking app and MCP service environment settings and must never be returned to MCP clients.
