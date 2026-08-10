import type { ArchiveContentSectionType } from "@prisma/client";

export function getContentSectionLabel(
  type: ArchiveContentSectionType,
  locale: string,
): { name: string; description: string } {
  const nb = locale === "nb";
  switch (type) {
    case "IMAGES":
      return { name: nb ? "Bilder" : "Images", description: nb ? "Et bildegalleri" : "A gallery of images" };
    case "FILES":
      return { name: nb ? "Filer" : "Files", description: nb ? "Opplastede filer" : "Uploaded files" };
    case "TEXT_FIELDS":
      return { name: nb ? "Tekstfelt" : "Text fields", description: nb ? "Navngitte tekstfelt" : "Named text fields" };
    case "SPREADSHEET":
      return { name: nb ? "Regneark" : "Spreadsheet", description: nb ? "Et redigerbart regneark" : "An editable spreadsheet" };
  }
}
