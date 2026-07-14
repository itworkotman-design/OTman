import { z } from "zod";
import type { Locale } from "@/lib/content/NavbarContent";

export const localizedTextSchema = z.object({
  en: z.string(),
  no: z.string(),
});

export type LocalizedTextValue = z.infer<typeof localizedTextSchema>;

export function boundedLocalizedText(maxLen: number) {
  return z.object({
    en: z.string().max(maxLen),
    no: z.string().max(maxLen),
  });
}

export function getLocalizedText(
  value: LocalizedTextValue | null | undefined,
  locale: Locale,
): string {
  if (!value) return "";
  return value[locale] ?? "";
}
