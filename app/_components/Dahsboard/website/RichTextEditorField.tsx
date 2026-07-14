// app/_components/Dahsboard/website/RichTextEditorField.tsx
"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { useEffect, useState } from "react";
import { sanitizeBlogHtml } from "@/lib/blog/sanitizeRichText";
import { StyledBulletList } from "@/lib/blog/tiptapListStyles";
import { FontSize } from "@/lib/blog/tiptapFontSize";
import { NonExtendingLink } from "@/lib/blog/tiptapLinkExtension";

type Props = {
  value: string;
  onChange: (html: string) => void;
};

const FONT_SIZE_OPTIONS = [
  { label: "Default", value: "" },
  { label: "Small", value: "14px" },
  { label: "Normal", value: "16px" },
  { label: "Large", value: "20px" },
  { label: "Extra large", value: "28px" },
];

const LIST_OPTIONS = [
  { label: "No list", value: "none" },
  { label: "Numbered list", value: "ordered" },
  { label: "Bullet list", value: "dot" },
  { label: "Dashed list", value: "dashed" },
];

function ToolbarButton({
  onClick,
  active,
  disabled,
  children,
  label,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`customButtonDefault !px-2 !py-1 text-xs ${active ? "bg-linePrimary" : ""}`}
    >
      {children}
    </button>
  );
}

type LinkPanelState = {
  range: { from: number; to: number };
  hadLink: boolean;
  url: string;
  color: string;
  underline: boolean;
};

const DEFAULT_LINK_COLOR = "#273097";

export default function RichTextEditorField({ value, onChange }: Props) {
  const [linkPanel, setLinkPanel] = useState<LinkPanelState | null>(null);

  function openLinkPanelForCurrentSelection() {
    if (!editor) return;

    if (editor.isActive("link")) {
      editor.chain().extendMarkRange("link").run();
    }

    const { from, to } = editor.state.selection;
    if (from === to) return; // nothing selected to turn into a link

    const linkAttrs = editor.getAttributes("link");
    const colorAttrs = editor.getAttributes("textStyle");

    setLinkPanel({
      range: { from, to },
      hadLink: Boolean(linkAttrs.href),
      url: linkAttrs.href ?? "",
      color: /^#[0-9a-fA-F]{6}$/.test(colorAttrs.color) ? colorAttrs.color : DEFAULT_LINK_COLOR,
      underline: editor.isActive("underline"),
    });
  }

  function applyLinkPanel() {
    if (!editor || !linkPanel) return;

    const url = linkPanel.url.trim();
    const chain = editor.chain().focus().setTextSelection(linkPanel.range);

    if (url === "") {
      chain.extendMarkRange("link").unsetLink();
    } else {
      // A bare domain like "google.com" has no protocol, so browsers treat
      // it as a relative path (appended to the current page URL) instead of
      // an absolute address. Default to https:// unless the user already
      // gave an absolute URL, a root-relative path, mailto:, or tel:.
      const normalizedUrl = /^(https?:\/\/|mailto:|tel:|\/)/i.test(url) ? url : `https://${url}`;
      chain.extendMarkRange("link").setLink({ href: normalizedUrl });
    }

    if (linkPanel.underline) chain.setUnderline();
    else chain.unsetUnderline();

    chain.setColor(linkPanel.color);

    // Collapse the cursor to just after the link and clear these as
    // "stored marks" so continuing to type afterwards starts back at
    // default color/underline instead of inheriting the link's styling.
    // NOTE: unsetLink() is NOT included here — TipTap's Link command runs
    // with extendEmptyMarkRange: true, so calling it even on this collapsed
    // cursor would reach back and strip the link mark we just set.
    chain.setTextSelection(linkPanel.range.to).unsetColor().unsetUnderline();

    chain.run();
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
      // Collapse to just after the (former) link and clear stored marks so
      // continuing to type afterwards doesn't inherit its color/underline.
      // unsetLink() isn't repeated here — it runs with extendEmptyMarkRange:
      // true, so calling it again on this collapsed cursor could reach into
      // an adjacent link, if one immediately follows.
      .setTextSelection(linkPanel.range.to)
      .unsetColor()
      .unsetUnderline()
      .run();
    setLinkPanel(null);
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ bulletList: false, link: false, underline: false }),
      StyledBulletList,
      Underline,
      TextAlign.configure({ types: ["paragraph"] }),
      NonExtendingLink.configure({ openOnClick: false, autolink: false }),
      TextStyle,
      Color,
      FontSize,
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      // Intercepting at the ProseMirror view level (rather than a DOM
      // onClick handler) is what actually stops the browser from following
      // the link — returning true here tells ProseMirror the click was
      // fully handled, so no default navigation happens.
      handleClick(view, pos, event) {
        const linkType = view.state.schema.marks.link;
        if (!linkType) return false;

        const mark = view.state.doc.resolve(pos).marks().find((m) => m.type === linkType);
        if (!mark) return false;

        event.preventDefault();

        // The default click behavior (placing the cursor at `pos`) is
        // skipped because we return true below, so the selection has to be
        // set explicitly before extending it to cover the whole link.
        editor?.chain().setTextSelection(pos).extendMarkRange("link").run();
        const { from, to } = editor?.state.selection ?? { from: pos, to: pos };
        const colorAttrs = editor?.getAttributes("textStyle") ?? {};

        setLinkPanel({
          range: { from, to },
          hadLink: true,
          url: (mark.attrs.href as string) ?? "",
          color: /^#[0-9a-fA-F]{6}$/.test(colorAttrs.color) ? colorAttrs.color : DEFAULT_LINK_COLOR,
          underline: editor?.isActive("underline") ?? false,
        });
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

  const listValue = editor.isActive("orderedList")
    ? "ordered"
    : editor.isActive("bulletList")
      ? editor.getAttributes("bulletList").variant === "dashed"
        ? "dashed"
        : "dot"
      : "none";

  function applyListStyle(nextValue: string) {
    if (!editor) return;

    if (nextValue === "none") {
      if (editor.isActive("orderedList")) editor.chain().focus().toggleOrderedList().run();
      if (editor.isActive("bulletList")) editor.chain().focus().toggleBulletList().run();
      return;
    }

    if (nextValue === "ordered") {
      if (editor.isActive("bulletList")) editor.chain().focus().toggleBulletList().run();
      if (!editor.isActive("orderedList")) editor.chain().focus().toggleOrderedList().run();
      return;
    }

    // "dot" or "dashed" — both are bulletList with a different variant attribute
    if (editor.isActive("orderedList")) editor.chain().focus().toggleOrderedList().run();
    if (!editor.isActive("bulletList")) editor.chain().focus().toggleBulletList().run();
    editor.chain().focus().updateAttributes("bulletList", { variant: nextValue }).run();
  }

  const fontSizeValue = editor.getAttributes("textStyle").fontSize ?? "";
  const colorValue = editor.getAttributes("textStyle").color ?? "#000000";

  return (
    <div className="rounded-md border border-linePrimary">
      <div className="flex flex-wrap items-center gap-1 border-b border-linePrimary p-1">
        <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>B</ToolbarButton>
        <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>I</ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={editor.isActive("underline")}
          disabled={editor.isActive("link")}
          onClick={() => {
            // Underline for linked text is controlled only via the link
            // panel's own checkbox, so it stays tied to the link's styling
            // rather than being toggled independently here.
            if (editor.isActive("link")) return;
            editor.chain().focus().toggleUnderline().run();
          }}
        >
          U
        </ToolbarButton>
        <ToolbarButton label="Link" active={editor.isActive("link")} onClick={openLinkPanelForCurrentSelection}>
          Link
        </ToolbarButton>
        <ToolbarButton label="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>L</ToolbarButton>
        <ToolbarButton label="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>C</ToolbarButton>
        <ToolbarButton label="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>R</ToolbarButton>

        <select
          aria-label="List style"
          className="customInput !w-auto !py-1 text-xs font-normal"
          value={listValue}
          onChange={(e) => applyListStyle(e.target.value)}
        >
          {LIST_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

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
              {option.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1 text-xs text-textColorSecond">
          Color
          <input
            aria-label="Text color"
            type="color"
            disabled={editor.isActive("link")}
            className="h-6 w-8 cursor-pointer rounded border border-linePrimary disabled:cursor-auto disabled:opacity-60"
            value={/^#[0-9a-fA-F]{6}$/.test(colorValue) ? colorValue : "#000000"}
            onChange={(e) => {
              // Link color is controlled only via the link panel's own
              // color field, so it stays tied to the link's styling rather
              // than being changed independently here (which was corrupting
              // the link).
              if (editor.isActive("link")) return;
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
          disabled={editor.isActive("link")}
          onClick={() => {
            if (editor.isActive("link")) return;
            if (editor.state.selection.empty) {
              editor.chain().focus().selectAll().unsetColor().run();
            } else {
              editor.chain().focus().unsetColor().run();
            }
          }}
        >
          Reset color
        </ToolbarButton>
      </div>

      {linkPanel ? (
        <div className="flex flex-col gap-3 border-b border-linePrimary bg-linePrimary/10 p-3">
          <label className="flex flex-col gap-1 text-xs text-textColorSecond">
            Link URL
            <input
              autoFocus
              className="customInput font-normal"
              value={linkPanel.url}
              onChange={(e) => setLinkPanel({ ...linkPanel, url: e.target.value })}
              placeholder="google.com or /blogg"
            />
          </label>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1 text-xs text-textColorSecond">
              Color
              <input
                type="color"
                className="h-6 w-8 cursor-pointer rounded border border-linePrimary"
                value={linkPanel.color}
                onChange={(e) => setLinkPanel({ ...linkPanel, color: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-textColorSecond">
              <input
                type="checkbox"
                checked={linkPanel.underline}
                onChange={(e) => setLinkPanel({ ...linkPanel, underline: e.target.checked })}
              />
              Underline
            </label>
          </div>

          <div className="flex gap-2">
            <button type="button" className="customButtonEnabled !px-3 !py-1 text-xs" onClick={applyLinkPanel}>
              Apply
            </button>
            {linkPanel.hadLink ? (
              <button
                type="button"
                className="customButtonDefault !px-3 !py-1 text-xs"
                onClick={removeLinkFromPanel}
              >
                Remove link
              </button>
            ) : null}
            <button
              type="button"
              className="customButtonDefault !px-3 !py-1 text-xs"
              onClick={() => setLinkPanel(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <EditorContent
        editor={editor}
        className="rich-text-editor-surface prose max-w-none px-3 py-2 text-sm"
      />
    </div>
  );
}
