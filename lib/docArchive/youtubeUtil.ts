// Pure, isomorphic (no Prisma/server imports) so both the client-side
// settings panel (live preview as the user types) and the server-side
// youtubeEmbeds.ts (validation before persisting) can share the exact same
// parsing rule — a URL that fails here is rejected identically in both
// places, never accepted client-side and then bounced by the server.
const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

// Accepts every common YouTube URL shape (watch/short-link/embed/shorts,
// with or without extra query params like `t=`/`si=`, with or without
// `www.`/`m.`, both http/https) plus a bare 11-character video id pasted on
// its own. Returns null for anything else, including non-YouTube URLs.
export function extractYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (VIDEO_ID_RE.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return VIDEO_ID_RE.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      return id && VIDEO_ID_RE.test(id) ? id : null;
    }
    const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  }

  return null;
}

export function buildYoutubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}
