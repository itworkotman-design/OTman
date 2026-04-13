# Cloudflare Email Worker

This Worker receives inbound mail from Cloudflare Email Routing and forwards a normalized JSON payload to the OTman app.

## Files

- `src/index.js`: Email Worker source
- `wrangler.jsonc`: Worker config template

## Required secrets

Set these before deploying:

```bash
wrangler secret put EMAIL_FORWARD_URL
wrangler secret put EMAIL_INBOUND_SECRET
```

Expected values:

- `EMAIL_FORWARD_URL=https://otman.no/api/integrations/email/inbound`
- `EMAIL_INBOUND_SECRET=<same secret as Next.js app>`

## Deploy

```bash
npm install
npx wrangler deploy
```

After deployment, bind the Worker to the `reply@otman.no` Email Routing rule in Cloudflare and make sure subaddressing is enabled.
