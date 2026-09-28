// Minimal HTML -> plain-text for the transactional emails this app builds
// (paragraphs, line breaks, button links, the entities escapeHtml emits).
// Used for the text/plain alternative of Gmail messages; not a general-purpose
// HTML parser.
function decodeEntities(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&");
}

export function htmlToText(html: string): string {
  const text = html
    // Keep a button's destination visible: <a href="url">label</a> -> "label: url"
    .replace(/<a\b[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_match, href: string, label: string) => {
      const plainLabel = label.replace(/<[^>]+>/g, "").trim();
      return `${plainLabel}: ${href}`;
    })
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/(div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  return decodeEntities(text)
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
