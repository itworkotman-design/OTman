# `lib/sms/gatewayApi.ts`

GatewayAPI Mobile Messaging API client. See `integrations/gatewayapi-sms.md` for setup.

| Function | Description |
| --- | --- |
| `isSmsConfigured` | Returns true when `GATEWAYAPI_TOKEN` is set. |
| `sendGatewayApiSms` | `POST {base}/mobile/single` with `Authorization: Token …`, `sender`, numeric `recipient`, `message` and optional `reference`. Returns `{ msgId }`. On a non-2xx response it throws an error containing GatewayAPI's validation detail. |
| `verifyGatewayApiSignature` | Constant-time check that the `Signature: v1=<hex>` header is the HMAC-SHA256 of the raw body under the webhook secret. |
| `mapGatewayApiStatus` | Maps provider states to the app status: DELIVERED/ACCEPTED → `DELIVERED`; EXPIRED/UNDELIVERABLE/REJECTED/SKIPPED → `FAILED`; anything else → `SENT`. |
