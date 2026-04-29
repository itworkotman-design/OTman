# Upload Route

## Source

- `app/api/upload/route.ts`

## Responsibility

Provides an authenticated direct S3 upload endpoint for PDF and image files. This route stores files only when S3 attachment storage is configured and returns both the S3 key and internal `s3://...` storage path.

## Functions

| Function | Description |
| --- | --- |
| `isAllowedUploadFile` | Validates whether the uploaded file type is supported. |
| `POST` | Validates the session, validates the uploaded file, stores it in S3, and returns the stored object key and storage path. |
