# app/_components/site/BookingModal/BookingTermsNotice.tsx

Shown above the submit button on the homepage booking summaries (white goods, moving, service request).

- Cancellation and fees box (`showFees`, default on): free cancellation until 48 h before, 40 % after, wasted-trip fee, how to cancel. Same rules as the terms page (`LegalContent.ts` → Avbestilling).
- Withdrawal-period checkbox when `consentRequired` (`lib/orders/withdrawalConsent.ts`); the flow keeps the submit button disabled until it is ticked.
- "By sending the order you accept our terms" line with links to `/{locale}/terms` and `/{locale}/privacy-policy` (`isRequest` switches the wording to "request").
