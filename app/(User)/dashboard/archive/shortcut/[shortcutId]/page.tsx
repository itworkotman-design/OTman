"use client";

import { useParams } from "next/navigation";
import { ShortcutItemView } from "@/app/_components/Dahsboard/archive/views/ShortcutItemView";

export default function ArchiveShortcutPage() {
  const params = useParams<{ shortcutId: string }>();
  return <ShortcutItemView shortcutId={params.shortcutId} />;
}
