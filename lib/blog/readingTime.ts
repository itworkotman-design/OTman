import type { Locale } from "@/lib/content/NavbarContent";
import type { BlogSectionData } from "@/lib/blog/blogSectionSchemas";
import { getLocalizedText } from "@/lib/blog/localizedText";

const WORDS_PER_MINUTE = 200;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function sectionWordCount(section: BlogSectionData, locale: Locale): number {
  switch (section.type) {
    case "RICH_TEXT":
    case "IMAGE_TEXT":
      return countWords(stripHtml(getLocalizedText(section.html, locale)));
    case "QUOTE":
      return (
        countWords(getLocalizedText(section.quote, locale)) +
        countWords(getLocalizedText(section.attribution, locale))
      );
    case "CTA":
      return (
        countWords(getLocalizedText(section.heading, locale)) +
        countWords(getLocalizedText(section.text, locale))
      );
    case "IMAGE":
      return countWords(getLocalizedText(section.caption, locale));
    case "GALLERY":
      return section.images.reduce(
        (sum, image) => sum + countWords(getLocalizedText(image.caption, locale)),
        0,
      );
    case "DIVIDER":
    case "SPACER":
      return 0;
    default:
      return 0;
  }
}

export function computeReadingTimeMinutes(
  sections: BlogSectionData[],
  locale: Locale,
): number {
  const totalWords = sections.reduce(
    (sum, section) => sum + sectionWordCount(section, locale),
    0,
  );

  return Math.max(1, Math.round(totalWords / WORDS_PER_MINUTE));
}
