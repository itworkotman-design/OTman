# Generated Password

## Source

- `lib/customerAccounts/generatedPassword.ts`

## Responsibility

Generates the password a temporary customer account is created with. It is 12 characters long, picked with `crypto.randomInt` from an alphabet without look-alike characters (`0 O 1 l I`), which gives about 70 bits.

## Functions

| Function | Purpose |
|---|---|
| `generateCustomerPassword` | Returns a new random password. |
