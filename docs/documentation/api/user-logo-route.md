# User Logo Upload API

## Source

- `app/api/auth/users/logo/route.ts`

## Responsibility

Uploads authenticated user-management logo files into the shared S3 attachment storage and returns a managed `s3://orders/user-logos/...` path that can be saved on a user profile. The same route also resolves stored S3 logo paths to signed image URLs for authenticated display.

## Functions

| Function | Description |
| --- | --- |
| `isAllowedUserLogoFile` | Restricts uploads to PNG, JPEG, and WEBP logo images. |
| `getFilenameFromLogoPath` | Extracts a display filename from a managed logo path for signed S3 responses. |
| `GET` | Validates the authenticated session and managed logo path, then redirects S3-backed logos to a short-lived signed URL. |
| `POST` | Validates the authenticated session, validates the uploaded image, requires configured S3 attachment storage, uploads the logo through the shared S3 helper, and returns the stored S3 path. |
