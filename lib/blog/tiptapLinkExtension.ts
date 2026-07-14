import Link from "@tiptap/extension-link";

// Forces the link mark to be non-inclusive: typing immediately before or
// after a link should never grow it to cover the new characters — the link
// always stays exactly the range that was explicitly selected when it was
// created/edited. Deleting characters from within it still shrinks it
// normally, since that's just removing marked text, not a boundary issue.
export const NonExtendingLink = Link.extend({
  inclusive: false,
});
