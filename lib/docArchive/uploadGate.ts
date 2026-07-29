// Archive's `uploadFile` (and the storage provider `write` contract behind
// it) only accepts a full in-memory Uint8Array — there's no chunked/streaming
// entry point anywhere in the package's surface, so a large upload always
// buffers its whole size in this Node process regardless of what the host
// (this app) does. What the host *can* control is how many of those buffers
// can be resident at once — an unbounded number of concurrent uploads on a
// fixed-memory Render instance risks an OOM kill that takes down every other
// request being served by that instance, not just the uploads.
//
// This is a simple counting semaphore bounding concurrent large uploads. A
// request that can't get a slot right away waits briefly (short bursts are
// normal) rather than being rejected outright, but gives up after a timeout
// so it doesn't hang the client indefinitely.
const MAX_CONCURRENT_UPLOADS = Number(process.env.ARCHIVE_MAX_CONCURRENT_UPLOADS ?? 3);
const QUEUE_WAIT_TIMEOUT_MS = 30_000;

let active = 0;
const waiters: Array<() => void> = [];

export async function acquireUploadSlot(): Promise<boolean> {
  if (active < MAX_CONCURRENT_UPLOADS) {
    active++;
    return true;
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;

    const onFree = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      active++;
      resolve(true);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const idx = waiters.indexOf(onFree);
      if (idx !== -1) waiters.splice(idx, 1);
      resolve(false);
    }, QUEUE_WAIT_TIMEOUT_MS);

    waiters.push(onFree);
  });
}

export function releaseUploadSlot(): void {
  active--;
  const next = waiters.shift();
  if (next) next();
}

// Content-Length reflects the whole multipart body (file bytes plus a small
// amount of boundary/header overhead), so a generous margin avoids rejecting
// a right-at-the-limit file over that overhead. Checked before the body is
// ever read, so an obviously oversized request never gets buffered at all.
const CONTENT_LENGTH_OVERHEAD_MARGIN_BYTES = 64 * 1024;

export function requestTooLargeByContentLength(req: Request, maxContentBytes: number): boolean {
  const raw = req.headers.get("content-length");
  if (!raw) return false;

  const contentLength = Number(raw);
  if (!Number.isFinite(contentLength)) return false;

  return contentLength > maxContentBytes + CONTENT_LENGTH_OVERHEAD_MARGIN_BYTES;
}
