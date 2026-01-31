import { prisma } from "@/lib/db";

type ServiceView = {
  id: string;
  title: string;
  description: string;
  category: string;
  priceCents: number | null;
};

function formatPriceNok(priceCents: number | null) {
  if (priceCents == null) return "Price on request";
  const nok = (priceCents / 100).toFixed(2);
  return `${nok} NOK`;
}

export default async function Home() {
  const services = (await prisma.service.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      priceCents: true,
    },
  })) as ServiceView[];

  const grouped = services.reduce<Record<string, ServiceView[]>>((acc, s) => {
    const key = s.category?.trim() || "Other";
    acc[key] ??= [];
    acc[key].push(s);
    return acc;
  }, {});

  const categories = Object.keys(grouped);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Service catalog</h1>
        <p className="text-sm text-muted-foreground">
          Browse our available services. Clear pricing, fast response.
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

      <section className="mt-8 space-y-10">
        {services.length === 0 ? (
          <div className="rounded-xl border p-5 text-sm">
            No services yet. Check back soon.
          </div>
        ) : (
          categories.map((cat) => (
            <div key={cat} className="space-y-3">
              <h2 className="text-lg font-semibold">{cat}</h2>
              <div className="grid gap-3">
                {grouped[cat].map((s) => (
                  <article key={s.id} className="rounded-xl border p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold">{s.title}</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {s.description}
                        </p>
                      </div>
                      <div className="shrink-0 text-sm font-semibold">
                        {formatPriceNok(s.priceCents)}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section
        id="request"
        className="mt-12 rounded-2xl border p-6 text-sm"
      >
        <h2 className="text-base font-semibold">Request a service</h2>
        <p className="mt-2 text-muted-foreground">
          Tell us what you need and we’ll confirm availability and pricing.
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
