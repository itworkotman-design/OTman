# Accounting service authentication

Source: `lib/integrations/accounting/authenticateAccountingRequest.ts`

The OtmanAccounting app has its own bearer key, `ACCOUNTING_API_KEY` (at least 32 characters), separate from the MCP key so either can be revoked alone. It sends `X-Otman-Company-Id` with the same fixed company as MCP (`OTMAN_API_COMPANY_ID`).

- `authenticateAccountingRequest(request)` — `authenticateServiceRequest` (`service-auth.md`) with `ACCOUNTING_API_KEY` and `OTMAN_API_COMPANY_ID`; the MCP key is rejected.
