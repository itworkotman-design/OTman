# Language Switch Button

## Source

- `app/_components/Users/LanguageSwitchButton.tsx`

## Responsibility

Renders the sidebar language toggle and persists the current user's `EN` or `NO` preference.

## Functions

| Function | Description |
| --- | --- |
| `LanguageSwitchButton` | Shows the active and alternate language, saves changes through `/api/auth/me/language`, and broadcasts the updated language to mounted pages. |
