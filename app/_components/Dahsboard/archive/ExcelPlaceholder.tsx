// Structured/spreadsheet items have no backend support at all (items have no
// type discriminator and there's no tabular-data storage in
// @customprojects/custom-archive) — see
// docs/documentation/integrations/archive-ui-known-gaps.md. Visible but
// permanently disabled; never calls any API.
export function ExcelPlaceholder({ locale }: { locale: string }) {
  return (
    <button
      type="button"
      disabled
      title={locale === "nb" ? "Regneark støttes ikke ennå" : "Spreadsheet items aren't supported yet"}
      className="flex items-center gap-2 rounded-xl border border-dashed border-lineSecondary px-4 py-2 text-sm font-semibold text-textColorThird/50"
    >
      <span className="text-lg leading-none">+</span>
      {locale === "nb" ? "Legg til regneark (kommer snart)" : "Add spreadsheet (coming soon)"}
    </button>
  );
}
