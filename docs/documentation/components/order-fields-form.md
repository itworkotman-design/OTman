# Order Fields Form

## Source

- `app/_components/Dahsboard/booking/create/OrderFieldsForm.tsx`

## Responsibility

Renders the booking form fields and the shared attachment uploader section from the editor state passed in by `BookingEditor`. Deviation choices are rendered from the shared hardcoded deviation-fee catalog so the English form labels match Norwegian WordPress imports by code. The owner/admin DNB checkbox renders above the order number and feeds the editor's 20% discount state for the remaining total after existing discounts and add-ons. The order-number input is required for non-owner/non-admin users and shows the editor's field-level error. The delivery-date input removes its browser `min` limit for admins and owners, while still showing field-level errors or warnings passed from the editor. Owner/admin custom delivery times use the browser-native time picker; regular users keep the `10:00` to `21:00` limited preset options.

## Functions

| Function | Description |
| --- | --- |
| `parseCustomTimeToMinutes` | Converts a `HH:mm` custom time option into minutes so the form can compare start and end selections safely. |
| `FormSectionSpacer` | Renders the horizontal divider between major field groups. |
| `FieldErrorMessage` | Renders the inline red validation box used directly under each field. |
| `OrderFieldsForm` | Main field renderer. Shows the owner/admin DNB checkbox, shared address autocomplete inputs, custom time-window controls, categorized attachments, and the editable return-address input only when the selected return options still require a store return destination. The deviation selector uses the shared deviation-fee options, the extra-work fee checkbox reveals a total-minutes input and clears those minutes when unchecked. Regular-user custom start and end selectors are limited to `10:00` through `21:00` and filter each other so the chosen range is always at least two hours long, regardless of which side the user picks first; owner/admin custom time fields are unrestricted browser-native time pickers that allow values outside the regular slots, such as `06:05`. The status selector uses canonical lowercase status values while keeping human-readable labels, the store selector is labeled `Change store`, hides required markers and browser required behavior for owners and admins, the status-notes input renders above the status selector, order-number and delivery-date errors render under their inputs, owner/admin past-date warnings render under the date input, the old summary error box above the submit button is gone, and the temporary `send to warehouse` checkbox has been removed. |
