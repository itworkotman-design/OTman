"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { sanitizeBlogHtml } from "@/lib/blog/sanitizeRichText";
import { StyledBulletList } from "@/lib/blog/tiptapListStyles";
import { FontSize } from "@/lib/blog/tiptapFontSize";
import { NonExtendingLink } from "@/lib/blog/tiptapLinkExtension";

type Props = {
  value: string;
  onChange: (html: string) => void;
  locale: string;
};

const FONT_SIZE_OPTIONS = [
  { value: "", labelEn: "Default", labelNb: "Standard" },
  { value: "14px", labelEn: "Small", labelNb: "Liten" },
  { value: "16px", labelEn: "Normal", labelNb: "Normal" },
  { value: "20px", labelEn: "Large", labelNb: "Stor" },
  { value: "28px", labelEn: "Extra large", labelNb: "Ekstra stor" },
];

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

type LinkPanelState = { range: { from: number; to: number }; hadLink: boolean; url: string };

// Trimmed version of website/RichTextEditorField.tsx for archive item text
// fields — reuses the same generic tiptap extensions/sanitizer (they have no
// blog-specific logic despite living under lib/blog/) but only exposes
// Bold/Link/Align(L·C·R)/bullet-list/font-size/color, per explicit scope —
// no italic, underline, ordered list, or the blog editor's link-specific
// color+underline sub-panel.
export function ArchiveRichTextEditorField({ value, onChange, locale }: Props) {
  const [linkPanel, setLinkPanel] = useState<LinkPanelState | null>(null);

  function openLinkPanelForCurrentSelection() {
    if (!editor) return;

    if (editor.isActive("link")) {
      editor.chain().extendMarkRange("link").run();
    }

    const { from, to } = editor.state.selection;
    if (from === to) return;

    const linkAttrs = editor.getAttributes("link");
    setLinkPanel({ range: { from, to }, hadLink: Boolean(linkAttrs.href), url: linkAttrs.href ?? "" });
  }

  function applyLinkPanel() {
    if (!editor || !linkPanel) return;

    const url = linkPanel.url.trim();
    const chain = editor.chain().focus().setTextSelection(linkPanel.range);

    if (url === "") {
      chain.extendMarkRange("link").unsetLink();
    } else {
      const normalizedUrl = /^(https?:\/\/|mailto:|tel:|\/)/i.test(url) ? url : `https://${url}`;
      chain.extendMarkRange("link").setLink({ href: normalizedUrl });
    }

    chain.setTextSelection(linkPanel.range.to).run();
    setLinkPanel(null);
  }

  function removeLinkFromPanel() {
    if (!editor || !linkPanel) return;
    editor
      .chain()
      .focus()
      .setTextSelection(linkPanel.range)
      .extendMarkRange("link")
      .unsetLink()
      .setTextSelection(linkPanel.range.to)
      .run();
    setLinkPanel(null);
  }

  const editor = useEditor({
    extensions: [
      // orderedList is deliberately NOT disabled here (unlike bulletList/link,
      // which are disabled only to be immediately replaced by a customized
      // version below) — no toolbar button creates one, but pasting external
      // content (Word/Google Docs/a webpage) that contains a numbered list
      // needs a real orderedList node in the schema to fit into, or
      // ProseMirror's paste transform crashes trying to reconcile <ol>/<li>
      // structure against a schema that has no matching node type
      // ("node.type.contentMatch.fillBefore(...) is null"). Fully excluding
      // a *node* extension (unlike a mark like underline, which pastes drop
      // silently and safely) is what caused that crash.
      StarterKit.configure({ bulletList: false, link: false, underline: false }),
      StyledBulletList,
      TextAlign.configure({ types: ["paragraph"] }),
      NonExtendingLink.configure({ openOnClick: false, autolink: false }),
      TextStyle,
      Color,
      FontSize,
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      handleClick(view, pos, event) {
        const linkType = view.state.schema.marks.link;
        if (!linkType) return false;

        const mark = view.state.doc.resolve(pos).marks().find((m) => m.type === linkType);
        if (!mark) return false;

        event.preventDefault();
        editor?.chain().setTextSelection(pos).extendMarkRange("link").run();
        const { from, to } = editor?.state.selection ?? { from: pos, to: pos };
        setLinkPanel({ range: { from, to }, hadLink: true, url: (mark.attrs.href as string) ?? "" });
        return true;
      },
    },
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

  const fontSizeValue = editor.getAttributes("textStyle").fontSize ?? "";
  const colorValue = editor.getAttributes("textStyle").color ?? "#000000";

  return (
    <div className="rounded-md border border-linePrimary">
      <div className="flex flex-wrap items-center gap-1 border-b border-linePrimary p-1">
        <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          B
        </ToolbarButton>
        <ToolbarButton label="Link" active={editor.isActive("link")} onClick={openLinkPanelForCurrentSelection}>
          Link
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
        <ToolbarButton
          label="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          {locale === "nb" ? "Liste" : "List"}
        </ToolbarButton>

        <select
          aria-label="Font size"
          className="customInput !w-auto !py-1 text-xs font-normal"
          value={fontSizeValue}
          onChange={(e) => {
            if (e.target.value) editor.chain().focus().setFontSize(e.target.value).run();
            else editor.chain().focus().unsetFontSize().run();
          }}
        >
          {FONT_SIZE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {locale === "nb" ? option.labelNb : option.labelEn}
            </option>
          ))}
        </select>

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

      {linkPanel ? (
        <div className="flex flex-col gap-3 border-b border-linePrimary bg-linePrimary/10 p-3">
          <label className="flex flex-col gap-1 text-xs text-textColorSecond">
            {locale === "nb" ? "Lenke-URL" : "Link URL"}
            <input
              autoFocus
              className="customInput font-normal"
              value={linkPanel.url}
              onChange={(e) => setLinkPanel({ ...linkPanel, url: e.target.value })}
              placeholder="google.com or /dashboard"
            />
          </label>

          <div className="flex gap-2">
            <button type="button" className="customButtonEnabled !px-3 !py-1 text-xs" onClick={applyLinkPanel}>
              {locale === "nb" ? "Bruk" : "Apply"}
            </button>
            {linkPanel.hadLink ? (
              <button type="button" className="customButtonDefault !px-3 !py-1 text-xs" onClick={removeLinkFromPanel}>
                {locale === "nb" ? "Fjern lenke" : "Remove link"}
              </button>
            ) : null}
            <button type="button" className="customButtonDefault !px-3 !py-1 text-xs" onClick={() => setLinkPanel(null)}>
              {locale === "nb" ? "Avbryt" : "Cancel"}
            </button>
          </div>
        </div>
      ) : null}

      <EditorContent editor={editor} className="rich-text-editor-surface prose max-w-none px-3 py-2 text-sm" />
    </div>
  );
}
