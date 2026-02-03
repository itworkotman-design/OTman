//import ArchiveActions from "";

export default function ArchivePage() {
  return (
    <section className="flex-1 flex flex-col min-h-0">
      {/* Archive table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="h-full rounded-xl border border-dashed flex items-center justify-center text-sm text-neutral-500">
          Booking archive table
        </div>
      </div>

      {/* Bottom-right actions */}
      <footer className="border-t px-6 py-3 flex justify-end">
        {/*<ArchiveActions />*/}
      </footer>
    </section>
  );
}
