# Order Fields Form

## Source

- `app/_components/Dahsboard/booking/create/OrderFieldsForm.tsx`

## Responsibility

Renders the booking form fields and passes attachment-related state and handlers into the shared attachments section component.

## Functions

| Function | Description |
| --- | --- |
| `FormSectionSpacer` | Renders the horizontal separator used between major field groups. |
| `OrderFieldsForm` | Main order field renderer. Connects form state, validation messages, and categorized file uploads into the UI. The global `Model number` field is no longer rendered here because model numbers now live on each selected product card. For custom delivery windows it now shows 24-hour `From` and `To` selectors in 30-minute intervals, a `Contact customer?` checkbox, and an optional `Contact note` textarea that is only shown while that checkbox is enabled. The lift radios only render when `Floor No.` has a value. |
