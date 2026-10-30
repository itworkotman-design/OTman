# GSM Client

Path: `lib/integrations/gsm/client.ts`

Shared authenticated HTTP client for the GSM Tasks API.

## Authentication

- **`GSM_API_KEY` (required in practice).** GSM rejects username/password sign-in from integrations (`400 "Sign in is only supported from the GSMtasks applications. Integrations should use an API key created in the web application."`). Create the key in the GSM web app; it is sent as `Authorization: Token <key>`, with no `/authenticate/` call.
- `GSM_USERNAME` / `GSM_PASSWORD`: legacy fallback used only when `GSM_API_KEY` is empty. It logs in through `POST /authenticate/` and caches the token in memory for 50 minutes.

## Functions

| Function | Description |
|---|---|
| `getGsmToken` | Returns `GSM_API_KEY` if set; otherwise logs in with username/password. When the login fails, it throws with GSM's status and response body. |
| `gsmFetch` | Makes an authenticated JSON request to `GSM_API_BASE` using the configured `GSM_API_VERSION` Accept header. |
