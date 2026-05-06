# User Language

## Source

- `lib/users/language.ts`

## Responsibility

Resolves dashboard language defaults, maps saved language preferences to booking UI locales, and broadcasts client-side language changes.

## Functions

| Function | Description |
| --- | --- |
| `isUserLanguagePreference` | Checks whether a value is the supported `EN` or `NO` language code. |
| `getDefaultUserLanguage` | Defaults admins and owners to English and other users to Norwegian. |
| `getUserLanguage` | Uses the saved language when present, otherwise falls back to the role-based default. |
| `userLanguageToBookingLocale` | Maps `EN` to `en` and `NO` to `nb` for booking UI translation helpers. |
| `dispatchUserLanguageChanged` | Broadcasts a language change to other mounted client components. |
| `useUserLanguage` | React hook that resolves and listens for the current user language. |
