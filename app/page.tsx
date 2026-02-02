import { Suspense } from "react";
import { CatalogSection, CatalogSectionSkeleton } from "./_components/CatalogSection";

export default function Home() {
  return (
    <main className="mx-auto w-full">
      <header className="space-y-2 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Otman Transport</h1>
        <p className="text-sm text-muted-foreground">
          Smart Transport. Simple Ordering.
        </p>

        <div className="pt-2">
          <a
            href="#request"
            className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Request a service
          </a>
        </div>
      </header>
      
      <section id="request" className="mt-12 rounded-2xl border p-6 text-sm">
        <h2 className="text-base font-semibold">Request a service</h2>
        <p className="mt-2 text-muted-foreground">
          Tell us what you need and weâ€™ll confirm availability and pricing.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="mailto:hello@example.com?subject=Service%20request"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 font-medium hover:bg-accent"
          >
            Email us
          </a>
          <a
            href="tel:+4700000000"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 font-medium hover:bg-accent"
          >
            Call
          </a>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Replace the email/phone with real contact details later.
        </p>
      </section>
    </main>
  );
}
