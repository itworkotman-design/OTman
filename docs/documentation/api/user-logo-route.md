# User Logo Upload API

## Source

- `app/api/auth/users/logo/route.ts`

## Responsibility

Uploads authenticated user-management logo files into the public user-logo storage area and returns a public path that can be saved on a user profile.

## Functions

| Function | Description |
| --- | --- |
| `isAllowedUserLogoFile` | Restricts uploads to PNG, JPEG, and WEBP logo images. |
| `POST` | Validates the authenticated session, validates the uploaded image, writes it to `/public/uploads/user-logos`, and returns the stored public path. |
