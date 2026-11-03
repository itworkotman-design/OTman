# `app/_components/site/BookingModal/whiteGoods/DimensionRuler.tsx`

One dimension (width / height / length) of a size-priced item (Other furniture,
"Andre møbler"), used three times by `SizeBracketPicker` under "Hvor stor er den?".

- A ruler (a styled native `<input type="range">`, 5–300 cm in 5 cm steps) to
  drag along. Faint marks behind it (`SIZE_DIMENSION_SCALE_MARKS_CM`: 50 … 300)
  show roughly where each size is. The part up to the chosen value is tinted.
- On the right, a box showing the chosen value in cm. Click it and type: the
  ruler follows as soon as the typed number is a valid 5 cm step; leaving the box
  (or Enter) applies it rounded to the nearest 5 cm and clamped to 5–300 (`parseTypedDimensionCm`); Escape leaves
  without applying an out-of-range leftover.
- Nothing is chosen until the customer drags or types: the box shows "—".

Props: `label`, `valueCm` (null = not chosen), `onChange(valueCm)`. The value
goes through `applySizeDimension` (`sizeBracketSelection.ts`), which re-derives
the volume bracket; the server re-checks the range (`isAllowedDimensionCm`).
