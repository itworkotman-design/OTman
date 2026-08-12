"use client";

import { useEffect, useState } from "react";
import { ImagePreviewGrid, type PreviewableImage } from "@/app/_components/Dahsboard/archive/ImagePreviewGrid";

type Props = {
  images: PreviewableImage[];
  locale: string;
};

// Read-only IMAGES section content for ItemView. Unlike TitleReadOnly/
// TextFieldsReadOnly/SpreadsheetReadOnly, there's no per-section fetch here
// (the file list itself already arrived with ItemView's own /files call) —
// what's still outstanding is each image's actual bytes, so this preloads
// all of them (`new Image()`, same URLs the grid itself will render) and
// keeps the whole section behind one pulsating placeholder — sized to the
// same box the real grid renders into, so nothing jumps — until every image
// in the section has loaded (or failed; a broken image shouldn't block the
// section forever). The section then swaps to the fully-populated grid in
// one go rather than popping images in individually.
export function ImagesSectionReadOnly({ images, locale }: Props) {
  const [loaded, setLoaded] = useState(images.length === 0);
  const fileIdsKey = images.map((image) => image.id).join(",");

  useEffect(() => {
    if (images.length === 0) {
      setLoaded(true);
      return;
    }

    setLoaded(false);
    let cancelled = false;

    void Promise.all(
      images.map(
        (image) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = image.src;
          }),
      ),
    ).then(() => {
      if (!cancelled) setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileIdsKey]);

  if (!loaded) {
    return (
      <div className="flex h-64 w-full animate-pulse items-center justify-center rounded-[20px] bg-gray-300">
        <span className="text-sm font-medium text-white">
          {locale === "nb" ? "Laster..." : "Loading..."}
        </span>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-[20px] border border-linePrimary px-5 py-8 text-sm text-textColorThird">
        {locale === "nb" ? "Ingen bilder" : "No images"}
      </div>
    );
  }

  return <ImagePreviewGrid images={images} gap={false} uniformHeight />;
}
