# `lib/sms/templates.ts`

Pure functions, so they are safe to import in client components (used for the composer preview).

| Export | Description |
| --- | --- |
| `SMS_TEMPLATE_PLACEHOLDERS` | Placeholder keys and labels shown in the template editor: `name`, `address` (delivery address only; empty if the order has none, never the pickup address), `date`, `timeWindow`, `job`, `products`, `deliveryType`, `services`, `orderId`, `orderNumber`. |
| `AUTOMATIC_SMS_TEMPLATE_DEFAULTS` | Seed values (name, admin-facing description, Norwegian SMS text) per automatic kind — after seeding they live in the DB and are edited in Settings: `DAY_BEFORE_DELIVERY` (09:00 "we're coming today") and `REVIEW_REQUEST` (thank-you with the https://otman.no/reviews link). |
| `buildSmsTemplateVariables` | Order fields → placeholder values. `job` = "products (delivery type)". Services are deliberately left out to keep the SMS short; they remain available as `{services}`. |
| `renderSmsTemplate` | Replaces `{key}` placeholders. Unknown keys are left as typed. Per line, it tidies the `()`, double spaces and space-before-punctuation that empty values leave behind. |
| `findMissingPlaceholders` | The known placeholders a text uses whose value is empty for this order (each once, in order of use). Unknown placeholders are not listed. Backs the missing-value warnings in the composers. |
| `renderOrderSms` | `renderSmsTemplate(body, buildSmsTemplateVariables(order))`. |
