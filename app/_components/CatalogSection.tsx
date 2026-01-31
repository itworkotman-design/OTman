import { getPublicCatalog } from "@/lib/catalog";

function formatPriceNok(args: { pricingMode: "FIXED" | "REQUEST"; priceCents: number | null }) {
    if (args.pricingMode === "REQUEST") return "Price on request";
    if (args.priceCents == null) return "Price on request";
    const nok = (args.priceCents / 100).toFixed(2);
    return `${nok} NOK`;
}

export async function CatalogSection() {
    const categories = await getPublicCatalog();
    const hasServices = categories.some((c) => c.services.length > 0);

    return (
        <section className="mt-8 space-y-10">
            {!hasServices ? (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Services coming soon</p>
                    <p className="mt-1">
                        We’re preparing our service catalog. In the meantime, feel free to contact us and tell us what
                        you need.
                    </p>
                </div>

            ) : (
                categories.map((cat) => (
                    <div key={cat.id} className="space-y-3">
                        <h2 className="text-lg font-semibold">{cat.name}</h2>
                        <div className="grid gap-3">
                            {cat.services.map((s) => (
                                <article key={s.id} className="rounded-xl border p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <h3 className="text-base font-semibold">{s.title}</h3>
                                            <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
                                        </div>
                                        <div className="shrink-0 text-sm font-semibold">
                                            {formatPriceNok({ pricingMode: s.pricingMode, priceCents: s.priceCents })}
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </section>
    );
}

export function CatalogSectionSkeleton() {
    return (
        <section className="mt-8 space-y-10" aria-busy="true" aria-live="polite">
            {Array.from({ length: 2 }).map((_, groupIdx) => (
                <div key={groupIdx} className="space-y-3">
                    <div className="h-5 w-40 rounded-md bg-accent" />
                    <div className="grid gap-3">
                        {Array.from({ length: 3 }).map((__, cardIdx) => (
                            <div key={cardIdx} className="rounded-xl border p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <div className="h-4 w-56 rounded-md bg-accent" />
                                        <div className="h-3 w-full rounded-md bg-accent" />
                                        <div className="h-3 w-4/5 rounded-md bg-accent" />
                                    </div>
                                    <div className="h-4 w-24 rounded-md bg-accent" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </section>
    );
}
