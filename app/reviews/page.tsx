import type { Metadata } from "next";
import { cookies } from "next/headers";
import { REVIEW_COOKIE } from "@/lib/reviews";
import ReviewsForm from "./ReviewsForm";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ReviewsPage() {
  const cookieStore = await cookies();
  const alreadySubmitted = cookieStore.has(REVIEW_COOKIE);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <iframe
        src="/no"
        title=""
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full scale-110 blur-md pointer-events-none select-none"
      />
      <div className="absolute inset-0 bg-black/30" />

      <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
        <ReviewsForm alreadySubmitted={alreadySubmitted} />
      </div>
    </div>
  );
}
