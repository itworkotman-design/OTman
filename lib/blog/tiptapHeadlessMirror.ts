import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { sanitizeBlogHtml } from "@/lib/blog/sanitizeRichText";
import { NonExtendingLink } from "@/lib/blog/tiptapLinkExtension";

export type WholeDocMarkChange =
  | { type: "bold" | "italic" | "underline"; value: boolean }
  | { type: "color"; value: string | null };

// Blog's rich-text sections mirror bold/italic/underline/color across both
// languages, but only when the change was applied to the *entire* text (see
// RichTextEditorField's onWholeDocMark) — the other language's HTML isn't
// mounted in any visible editor at that point, so this replays the same
// mark change against a detached, unmounted Editor instance (tiptap creates
// its own offscreen <div> when no `element` is passed) purely to transform
// the string, then discards it.
export function applyWholeDocMarkToHtml(html: string, mark: WholeDocMarkChange): string {
  const editor = new Editor({
    extensions: [
      StarterKit.configure({ bulletList: false, link: false, underline: false }),
      Underline,
      NonExtendingLink.configure({ openOnClick: false, autolink: false }),
      TextStyle,
      Color,
    ],
    content: html,
  });

  switch (mark.type) {
    case "bold":
      (mark.value ? editor.chain().selectAll().setBold() : editor.chain().selectAll().unsetBold()).run();
      break;
    case "italic":
      (mark.value ? editor.chain().selectAll().setItalic() : editor.chain().selectAll().unsetItalic()).run();
      break;
    case "underline":
      (mark.value ? editor.chain().selectAll().setUnderline() : editor.chain().selectAll().unsetUnderline()).run();
      break;
    case "color":
      (mark.value ? editor.chain().selectAll().setColor(mark.value) : editor.chain().selectAll().unsetColor()).run();
      break;
  }

  const result = sanitizeBlogHtml(editor.getHTML());
  editor.destroy();
  return result;
}
