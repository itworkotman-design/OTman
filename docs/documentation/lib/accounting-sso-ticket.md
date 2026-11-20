# Accounting sign-in ticket

Source: `lib/integrations/accounting/ssoTicket.ts`

Single sign-on from the dashboard into the OtmanAccounting app (`accounting.otman.no`). The apps share no cookies or database: Otman vouches for the person with a short signed ticket, and the accounting app starts its own session.

- `ACCOUNTING_SSO_AUDIENCE` — `"otman-accounting"`, the ticket's `aud`.
- `createAccountingSsoTicket(user, privateKeyB64, now?)` — `v1.<claims>.<signature>`: base64url JSON claims (`iss: "otman"`, `aud`, `sub` = user ID, `email`, `name`, `iat`, `exp` = `iat` + 60 s, random `jti`) signed with Ed25519. The key is `ACCOUNTING_SSO_PRIVATE_KEY`, base64 PKCS#8 DER; throws for anything else. The accounting app has only the public key (it can check tickets, never make them) and accepts each `jti` once.

Key pair (once; the public half goes to the accounting app as `OTMAN_SSO_PUBLIC_KEY`):

```bash
node -e "const {generateKeyPairSync}=require('crypto');const k=generateKeyPairSync('ed25519');console.log('ACCOUNTING_SSO_PRIVATE_KEY='+k.privateKey.export({format:'der',type:'pkcs8'}).toString('base64'));console.log('OTMAN_SSO_PUBLIC_KEY='+k.publicKey.export({format:'der',type:'spki'}).toString('base64'))"
```
