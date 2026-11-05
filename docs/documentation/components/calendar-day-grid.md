# app/_components/utils/CalendarDayGrid.tsx

One month of days for the custom pickers (`DatePicker`, `PeriodPicker`):

- weekday header, then a Monday-first 6-week grid (`buildCalendarDays`);
- today ringed and the selected day filled;
- Saturdays orange and Sundays red;
- days before `min` or on `disabledWeekdays` struck through and disabled.

Props: `month`, `value`, `onSelect`, `min?`, `disabledWeekdays?`, `locale`.
