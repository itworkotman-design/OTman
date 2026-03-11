"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function LanguageSwitcher() {
  const pathname = usePathname();

  function getPath(locale: "en" | "no") {
    const segments = pathname.split("/");
    segments[1] = locale;
    return segments.join("/");
  }

  return (
    <div className="flex md:text-sm font-light gap-10 md:gap-2">
      <Link
        href={getPath("en")}
        className="py-1 rounded-lg text-black/50 hover:text-logoblue"
      >
        EN
      </Link>

      <Link
        href={getPath("no")}
        className="py-1 rounded-lg text-black/50 hover:text-logoblue"
      >
        NO
      </Link>
    </div>
  );
}