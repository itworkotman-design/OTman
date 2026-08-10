"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { sanitizeBlogHtml } from "@/lib/blog/sanitizeRichText";

type Props = {
  value: string;
  onChange: (html: string) => void;
  locale: string;
};

function ToolbarButton({
  onClick,
  active,
  children,
  label,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`customButtonDefault !px-2 !py-1 text-xs ${active ? "bg-linePrimary" : ""}`}
    >
      {children}
    </button>
  );
}

// Trimmed version of ArchiveRichTextEditorField for the Title content
// section — a title is one short heading line, so this drops Link/bullet-
// list/font-size (none of which make sense on a heading) and keeps only
// Bold/Italic/Align(L·C·R)/Color, per explicit request. Italic itself needs
// no new tiptap extension: StarterKit already includes it (only its toolbar
// button was ever missing from ArchiveRichTextEditorField).
export function TitleRichTextEditorField({ value, onChange, locale }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ bulletList: false, link: false, underline: false }),
      TextAlign.configure({ types: ["paragraph"] }),
      TextStyle,
      Color,
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor: instance }) => {
      onChange(sanitizeBlogHtml(instance.getHTML()));
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  const colorValue = editor.getAttributes("textStyle").color ?? "#000000";

  return (
    <div className="rounded-md border border-linePrimary">
      <div className="flex flex-wrap items-center gap-1 border-b border-linePrimary p-1">
        <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          B
        </ToolbarButton>
        <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <span className="italic">I</span>
        </ToolbarButton>
        <ToolbarButton
          label="Align left"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          L
        </ToolbarButton>
        <ToolbarButton
          label="Align center"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          C
        </ToolbarButton>
        <ToolbarButton
          label="Align right"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          R
        </ToolbarButton>

        <label className="flex items-center gap-1 text-xs text-textColorSecond">
          {locale === "nb" ? "Farge" : "Color"}
          <input
            aria-label="Text color"
            type="color"
            className="h-6 w-8 cursor-pointer rounded border border-linePrimary"
            value={/^#[0-9a-fA-F]{6}$/.test(colorValue) ? colorValue : "#000000"}
            onChange={(e) => {
              const color = e.target.value;
              if (editor.state.selection.empty) {
                editor.chain().focus().selectAll().setColor(color).run();
              } else {
                editor.chain().focus().setColor(color).run();
              }
            }}
          />
        </label>
        <ToolbarButton
          label="Reset color"
          onClick={() => {
            if (editor.state.selection.empty) {
              editor.chain().focus().selectAll().unsetColor().run();
            } else {
              editor.chain().focus().unsetColor().run();
            }
          }}
        >
          {locale === "nb" ? "Nullstill farge" : "Reset color"}
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} className="rich-text-editor-surface prose max-w-none px-3 py-2 text-xl font-semibold" />
    </div>
  );
}
