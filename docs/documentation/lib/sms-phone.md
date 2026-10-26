# `lib/sms/phone.ts`

| Function | Description |
| --- | --- |
| `normalizeSmsRecipient` | Turns a typed phone number into a digits-only MSISDN. It strips spaces, dashes, parentheses and `+`/`00` prefixes, and prefixes a bare 8-digit number with `47`. Accepts 10–15 digits; anything else returns `null`. |
