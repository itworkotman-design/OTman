// Pinning has no backing field on ArchiveFolder (see API.md) and is not
// implemented — see docs/documentation/integrations/archive-ui-known-gaps.md.
// This is a visible placeholder, not a functional feature: it never reads or
// writes any pin state.
export function PinnedFoldersSection({ locale }: { locale: string }) {
  return (
    <section className="my-6">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-[2rem] font-bold text-logoblue">{locale === "nb" ? "Festede mapper" : "Pinned folders"}</h2>
        <span className="rounded-full bg-textColorThird/10 px-3 py-1 text-xs font-semibold text-textColorThird">
          {locale === "nb" ? "Kommer snart" : "Coming soon"}
        </span>
      </div>
      <div className="customContainer flex items-center justify-center py-8 text-sm text-textColorThird">
        {locale === "nb"
          ? "Det er ikke mulig å feste mapper ennå."
          : "Pinning folders isn't available yet."}
      </div>
    </section>
  );
}
