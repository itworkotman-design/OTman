// app/(User)/dashboard/website/blog/page.tsx
import { Suspense } from "react";
import BlogAdminList from "@/app/_components/Dahsboard/website/BlogAdminList";

export default function BlogAdminPage() {
  return (
    <Suspense fallback={<div className="p-6 text-textColorSecond">Loading...</div>}>
      <BlogAdminList />
    </Suspense>
  );
}
