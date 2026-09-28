# `lib/email/htmlToText.ts`

`htmlToText(html)` — minimal HTML → plain text for the transactional emails
this app builds (paragraphs/`<br>` → newlines, `<a href>` → `label: url`, images
dropped, the entities `escapeHtml` emits decoded). Used to give lifecycle
emails a real `text/plain` alternative when sent through Gmail. Not a
general-purpose HTML parser.
