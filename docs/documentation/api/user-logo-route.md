# User Logo Upload API

## Source

- `app/api/auth/users/logo/route.ts`

## Responsibility

Uploads authenticated user-management logo files into the shared S3 attachment storage and returns a managed `s3://orders/user-logos/shared/<sha256><ext>` path that can be saved on a user profile. The key is content-addressed, so uploading the same picture again (by anyone) returns the same path instead of creating a duplicate in the user modal's "Previously used pictures" list. The same route also resolves stored S3 logo paths to signed image URLs for authenticated display.

## Functions

| Function | Description |
| --- | --- |
| `isAllowedUserLogoFile` | Restricts uploads to PNG, JPEG, WEBP, and SVG logo images. |
| `getFilenameFromLogoPath` | Extracts a display filename from a managed logo path for signed S3 responses. |
| `GET` | Validates the authenticated session and managed logo path, then redirects S3-backed logos to a short-lived signed URL. |
| `POST` | Validates the authenticated session, validates the uploaded image, requires configured S3 attachment storage, hashes the bytes and writes them to the content-addressed key via `putAttachmentObjectToS3`, and returns the stored S3 path. |
