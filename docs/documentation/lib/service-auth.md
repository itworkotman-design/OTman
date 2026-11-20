# Integration service authentication

Source: `lib/integrations/serviceAuth.ts`

Shared server-to-server check for the integration APIs (MCP, accounting). Each integration passes its own key, so one can be revoked without the other.

- `authenticateServiceRequest(request, { apiKey, companyId })` — requires `Authorization: Bearer <key>` (compared as SHA-256 digests with `timingSafeEqual`) and `X-Otman-Company-Id` equal to the configured company. Returns `{ ok: true, companyId }`, or `503 SERVICE_NOT_CONFIGURED` (key missing or under 32 characters, or no company), `401 UNAUTHORIZED` (wrong key), `403 FORBIDDEN` (other company).
