"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <section className="rounded-2xl border p-6 text-sm">
        <h1 className="text-lg font-semibold">Noe gikk galt</h1>

        <p className="mt-2 text-muted-foreground">
          Vi kunne ikke laste booking akkurat nå. Prøv igjen.
        </p>

        <div className="mt-4 flex gap-3">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Prøv igjen
          </button>

          <a
            href="#request"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Kontakt oss
          </a>
        </div>
      </section>
    </main>
  );
}
