# app/_components/site/pageComponents/myOrder/CustomerLoginClient.tsx

The "Min bestilling" login page (`/{locale}/min-bestilling/logg-inn`).

- **Login card:** a centred card with an icon, heading and intro.
  - Email and password fields with icons, and a show/hide toggle on the password.
  - "Glemt passord?" next to the password label.
  - Errors in a red box; a spinner on the button while logging in.
  - A "Hvor finner jeg passordet?" note pointing to the "Takk for bestillingen" email.
- **Forgot password** (`?glemt=1` opens it straight away): asks for the email, then shows a "Sjekk e-posten din" confirmation with a back button.
- **Below the card:** a "need help" line with the phone number.
- **APIs:** `/api/customer/login`, `/api/customer/password-reset`.
