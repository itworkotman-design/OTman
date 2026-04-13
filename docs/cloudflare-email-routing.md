# Cloudflare Email Routing Setup

This project uses Brevo for outbound email and Cloudflare Email Routing for inbound replies.

## App environment

Set these variables in the Next.js app:

```env
BREVO_API_KEY=...
BREVO_SENDER_EMAIL=bestilling@otman.no
BREVO_SENDER_NAME=Otman Transport

EMAIL_REPLY_DOMAIN=otman.no
EMAIL_INBOUND_SECRET=...
```

`EMAIL_REPLY_DOMAIN` is used when generating `reply+<threadToken>@otman.no`.

## Cloudflare dashboard

1. Move `otman.no` to Cloudflare nameservers.
2. Open `Email > Email Routing`.
3. Enable Email Routing for the zone.
4. Enable subaddressing in `Email Routing > Settings`.
5. Create a custom address rule:
   - Address: `reply`
   - Action: `Send to a Worker`
6. Deploy the Worker from [`cloudflare/email-routing`](../cloudflare/email-routing/README.md).
7. Bind the deployed Worker to the `reply@otman.no` rule.

## Worker secrets

Set these secrets on the Cloudflare Worker:

```bash
wrangler secret put EMAIL_FORWARD_URL
wrangler secret put EMAIL_INBOUND_SECRET
```

Values:

- `EMAIL_FORWARD_URL`: the public app endpoint, for example `https://otman.no/api/integrations/email/inbound`
- `EMAIL_INBOUND_SECRET`: the same value as the app's `EMAIL_INBOUND_SECRET`

## Flow

1. App sends an outbound email with `replyTo: reply+<threadToken>@otman.no`.
2. Customer replies to that address.
3. Cloudflare Email Routing accepts the mail for `reply@otman.no`.
4. Subaddressing preserves the `+<threadToken>` portion.
5. The Email Worker parses the MIME message and posts normalized JSON to the app.
6. The app matches the thread token and stores the inbound message on the correct order.

## Important limitation

Cloudflare Email Routing handles inbound mail only. Outbound mail still goes through Brevo.
