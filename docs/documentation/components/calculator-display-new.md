# Calculator Display New

## Source

- `app/_components/Dahsboard/booking/create/CalculatorDisplay.tsx`

## Responsibility

Displays the booking price breakdown and totals for the selected product cards. Existing orders can force stored customer and subcontractor totals so saved snapshots remain price-frozen while the editor compares against current catalog prices separately. The calculator localizes built-in labels from `locale`, renders applied discount and extra rows above `Total`, renders read-only WordPress mismatch groups in gray with their import comment, keeps negative totals visible when admin adjustments exceed the subtotal, shows product and adjustment rows as whole kroner, and keeps `Total`, `VAT`, and `Total incl. VAT` at two decimals using the summary formatter.

## Functions

| Function | Description |
| --- | --- |
| `formatNOK` | Formats product and adjustment rows as whole-kroner `NOK` strings without decimal places. |
| `formatSumNOK` | Formats summary totals with two decimals for the calculator footer rows. |
| `formatQty` | Formats a quantity for display, keeping half steps when needed. |
| `AmountInput` | Amount text input that keeps the typed text while reporting the parsed number, and picks up external amount changes (e.g. a linked partner minus recalculating). |
| `AdjustmentLineRows` | Renders adjustment lines of the given kinds. Freshly added lines open as a `DraftAdjustmentRow`; others render as an `AppliedAdjustmentRow` (zero amounts hidden). Which lines are open is tracked with `trackNewAdjustmentLines` (`adjustmentLineEditing.ts`). |
| `DraftAdjustmentRow` | Standard form card: an `Add/Edit <type>` title with a "Subtracted from / Added to total" hint, labelled `Description (optional)` and `Amount (ex VAT)` fields side by side (the unit pill inside the amount box toggles NOK ⇄ %; in % mode the label reads `Percent` and the resulting `= … NOK` shows underneath), and equal-width `Cancel` / `Apply` buttons. Enter applies, Escape cancels. Totals and a discount's linked partner minus update live while typing; Apply only collapses the line. Cancel discards a new line or restores an edited line's original values. |
| `AppliedAdjustmentRow` | `Discount – <description> (10 %)  -500.00 NOK` row (percent shown only for % lines) with subtle ✎ (reopen as draft) and × (remove) buttons for admins. |
| `AddAdjustmentLineButtons` | Footer of the calculator card, below `Total incl. VAT`: two full-bleed halves split by a divider (negative margins cancel `.customContainer`'s 20px padding, so the hover fill reaches the card's edges and rounded bottom corners), each adding an empty draft line. Always available; "Set to 0" checkboxes stay usable alongside adjustment lines; zeroed lines are only shown struck through (no separate total row). |
| `SubcontractorCalculatorDisplay` | Partner view: editable partner minus/plus lines (a discount's linked minus updates live as the discount is typed) and `Add partner minus` / `Add partner plus` buttons. |
| `CalculatorDisplayNew` | Main calculator display component. It renders a saved product-card `modelNumber` in muted gray parentheses beside the product heading when one exists, can force stored customer and subcontractor totals for frozen existing orders, shows read-only WordPress mismatch groups in gray, shows customer discount/extra adjustment lines above the total — editable in place for admins, with localized `Add discount` / `Add extra` buttons — and leaves negative totals visible instead of hiding them. |
