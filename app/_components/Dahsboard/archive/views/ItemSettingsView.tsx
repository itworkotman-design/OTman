import { useEffect, useState } from "react";
import type { RecurrenceType } from "@prisma/client";
import Link from "next/link";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { getModuleAccess } from "@/lib/users/access";
import { EntitySettingsPanel } from "@/app/_components/Dahsboard/archive/EntitySettingsPanel";
import { ReminderSettingsPanel } from "@/app/_components/Dahsboard/archive/ReminderSettingsPanel";
import { ContentSectionList } from "@/app/_components/Dahsboard/archive/ContentSectionList";
import { SaveToast } from "@/app/_components/Dahsboard/archive/SaveToast";
import type { ArchiveItemSummary } from "@/app/_components/Dahsboard/archive/types";

type ArchiveItemDetail = ArchiveItemSummary & {
  reminderDescription: string | null;
  reminderRecurrenceType: RecurrenceType | null;
  reminderRecurrenceConfig: unknown | null;
};

// Every mutation for this item lives here — status/dates and the Content
// section (Images/Files/Text-fields, see ContentSectionList) — matching the
// otman-archive prototype's EntrySettingsFields. The item view (`ItemView`)
// is pure browsing. `codePath` is this item's own code split on "." — used
// for the back link.
export function ItemSettingsView({ itemId, codePath }: { itemId: string; codePath: string[] }) {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const archiveAccess = currentUser ? getModuleAccess(currentUser, "ARCHIVE") : { enabled: true, level: "ADMIN" as const };
  const hasAccess = archiveAccess.enabled && archiveAccess.level === "ADMIN";

  const [item, setItem] = useState<ArchiveItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Matches the top tab-switching style from user management
  // (app/(User)/dashboard/users/page.tsx), same as FolderSettingsView's
  // activeControlTab — one tab always fully shown rather than a click-to-expand
  // accordion row.
  const [activeControlTab, setActiveControlTab] = useState("details");
  // Collapsed by default on entering settings, same as FolderSettingsView —
  // Content is usually what someone's here for, so Archive controls starts
  // out of the way.
  const [controlsExpanded, setControlsExpanded] = useState(false);

  // A fresh `key` per save (rather than just a boolean) so SaveToast always
  // gets its own mount + full 3s timer, even if two saves land in quick
  // succession.
  const [savedToastKey, setSavedToastKey] = useState(0);
  const [showSavedToast, setShowSavedToast] = useState(false);

  function triggerSavedToast() {
    setSavedToastKey((key) => key + 1);
    setShowSavedToast(true);
  }

  async function loadItem() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`/api/archive/items/${itemId}`, { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.reason || "Failed to load item");
        return;
      }

      setItem(data.item);
    } catch {
      setError("Failed to load item");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!currentUser) return;
    if (!hasAccess) return;
    if (!itemId) return;
    void loadItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, hasAccess, itemId]);

  async function handleItemSettingsSaved() {
    await loadItem();
    triggerSavedToast();
  }

  if (currentUser && !hasAccess) {
    return (
      <div className="w-full">
        <p className="text-textColorThird">
          {locale === "nb" ? "Du har ikke tilgang til arkivet." : "You do not have access to the archive."}
        </p>
      </div>
    );
  }

  const itemControlTabs = item
    ? [
        {
          id: "details",
          title: locale === "nb" ? "Detaljer" : "Details",
          content: (
            <EntitySettingsPanel
              kind="item"
              id={itemId}
              name={item.name}
              description={item.description}
              status={item.status}
              ownerUserId={item.ownerUserId}
              locale={locale}
              onSaved={() => void handleItemSettingsSaved()}
            />
          ),
        },
        {
          id: "reminders",
          title: locale === "nb" ? "Påminnelser" : "Reminders",
          dotColor: item.reminderRecurrenceType ? "bg-green-500" : "bg-gray-300",
          content: (
            <ReminderSettingsPanel
              kind="item"
              id={itemId}
              dueAt={item.dueAt}
              expiresAt={item.expiresAt}
              reminderDescription={item.reminderDescription}
              reminderRecurrenceType={item.reminderRecurrenceType}
              reminderRecurrenceConfig={item.reminderRecurrenceConfig}
              locale={locale}
              onSaved={() => void handleItemSettingsSaved()}
            />
          ),
        },
      ]
    : [];

  return (
    <div className="w-full">
      <div className="mb-6">
        <Link href={`/dashboard/archive/${codePath.join("/")}`} className="text-sm text-textColorThird hover:underline">
          ← {loading ? "..." : item?.name || (locale === "nb" ? "Ukjent element" : "Unknown item")}
        </Link>
      </div>

      <h1 className="mb-8 text-center text-2xl font-semibold text-logoblue lg:text-4xl">
        {loading
          ? "..."
          : `${item?.name || (locale === "nb" ? "Ukjent element" : "Unknown item")} ${locale === "nb" ? "innstillinger" : "Settings"}`}
      </h1>

      {error && (
        <div className="customContainer mb-6 border-red-200! bg-red-50 py-4 px-4 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {!loading && item && (
        <div className="flex flex-col gap-6">
          <section>
            <button
              type="button"
              onClick={() => setControlsExpanded((v) => !v)}
              className="mb-3 flex w-full items-center gap-2 text-left text-[1.5rem] font-bold text-logoblue"
              aria-expanded={controlsExpanded}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 16 16"
                fill="none"
                className={`shrink-0 transition-transform ${controlsExpanded ? "rotate-90" : ""}`}
                aria-hidden="true"
              >
                <path d="M5 3l6 5-6 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {locale === "nb" ? "Arkivkontroller" : "Archive controls"}
            </button>

            {controlsExpanded && (
              <>
                <div className="mb-6 flex gap-2 border-b border-lineSecondary">
                  {itemControlTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveControlTab(tab.id)}
                      className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                        activeControlTab === tab.id
                          ? "border-logoblue text-logoblue"
                          : "border-transparent text-textColorThird hover:text-textColorSecond"
                      }`}
                    >
                      {tab.title}
                      {"dotColor" in tab && <span className={`h-2 w-2 rounded-full ${tab.dotColor}`} />}
                    </button>
                  ))}
                </div>

                {itemControlTabs.map((tab) => (tab.id === activeControlTab ? <div key={tab.id}>{tab.content}</div> : null))}
              </>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-[1.5rem] font-bold text-logoblue">{locale === "nb" ? "Innhold" : "Content"}</h2>
            <ContentSectionList itemId={itemId} locale={locale} onSaved={triggerSavedToast} />
          </section>
        </div>
      )}

      {showSavedToast && (
        <SaveToast
          key={savedToastKey}
          message={locale === "nb" ? "Innstillinger lagret" : "Settings saved"}
          onDismiss={() => setShowSavedToast(false)}
        />
      )}
    </div>
  );
}
