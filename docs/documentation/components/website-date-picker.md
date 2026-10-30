# `app/_components/utils/WebsiteDatePicker.tsx`

Single-date picker used on the homepage booking flow, the "My order" page and the dashboard's website-order admin actions. Kept separate from `DatePicker.tsx` (the dashboard booking/archive picker) because it supports per-day blocking.

- Props: `value`/`onChange` (`"YYYY-MM-DD"` or `""`), `locale` (`en`/`no`), `placeholder`, `className`, `disabled`, `minDate` (earlier days are greyed out), `blockedWeekdays` (`Date.getDay()` numbers), `isDateBlocked` (extra per-day predicate, e.g. public holidays), `openUpward` (open above the field, for fields near the bottom of a scrolling modal).
- Opens on the first month that has a selectable day (`resolveVisibleMonth` from `lib/dates/calendarGrid.ts`).
