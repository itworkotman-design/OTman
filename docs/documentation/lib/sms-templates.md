# `lib/sms/templates.ts`

Pure functions, so they are safe to import in client components (used for the composer preview).

| Export | Description |
| --- | --- |
| `SMS_TEMPLATE_PLACEHOLDERS` | Placeholder keys and labels shown in the template editor: `name`, `address` (delivery, falling back to pickup), `date`, `timeWindow`, `job`, `products`, `deliveryType`, `services`, `orderId`, `orderNumber`. |
| `AUTOMATIC_SMS_TEMPLATE_DEFAULTS` | Seed values (name, admin-facing description, Norwegian SMS text) per automatic kind — after seeding they live in the DB and are edited in Settings: `DAY_OF_DELIVERY` (09:00 "we're coming today") and `REVIEW_REQUEST` (thank-you with the https://otman.no/reviews link). |
| `buildSmsTemplateVariables` | Order fields → placeholder values. `job` = "products (delivery type)". Services are deliberately left out to keep the SMS short; they remain available as `{services}`. |
| `renderSmsTemplate` | Replaces `{key}` placeholders. Unknown keys are left as typed. Per line, it tidies the `()`, double spaces and space-before-punctuation that empty values leave behind. |
| `renderOrderSms` | `renderSmsTemplate(body, buildSmsTemplateVariables(order))`. |
