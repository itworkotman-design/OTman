# Order Fields Form

## Source

- `app/_components/Dahsboard/booking/create/OrderFieldsForm.tsx`

## Responsibility

Renders the booking form fields and the shared attachment uploader section from the editor state passed in by `BookingEditor`.

## Functions

| Function | Description |
| --- | --- |
| `parseCustomTimeToMinutes` | Converts a `HH:mm` custom time option into minutes so the form can compare start and end selections safely. |
| `FormSectionSpacer` | Renders the horizontal divider between major field groups. |
| `FieldErrorMessage` | Renders the inline red validation box used directly under each field. |
| `OrderFieldsForm` | Main field renderer. Shows the shared address autocomplete inputs, the custom time-window controls, categorized attachments, and the editable return-address input only when the selected return options still require a store return destination. The custom start and end selectors now filter each other so the chosen range is always at least two hours long, regardless of which side the user picks first, the status-notes input now sits directly under the status selector in the modal, field-level validation is rendered under the relevant inputs, and the old summary error box above the submit button is gone. |
