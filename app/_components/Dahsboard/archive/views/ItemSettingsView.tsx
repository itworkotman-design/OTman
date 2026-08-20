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
import { FolderSharingPanel } from "@/app/_components/Dahsboard/archive/FolderSharingPanel";
import type {
  ArchiveCoworker,
  ArchivePermissionAction,
  ArchivePermissionRule,
  ArchivePermissionSubjectType,
  ArchiveRoleOption,
  FolderDefaultAccessRow,
} from "@/app/_components/Dahsboard/archive/FolderSharingPanel";
import type { ArchiveItemSummary } from "@/app/_components/Dahsboard/archive/types";

// Denies a person's default (Admin/Viewer role) access on this exact item —
// the only way to exclude someone whose access comes from the company
// default (see grantDefaultRoleAccessOnRootFolder in
// lib/docArchive/context.ts, inherited down through the item's containing
// folder) rather than a local grant. Mirrors FolderSettingsView.tsx's own
// DEFAULT_ACCESS_DENY_ACTIONS exactly.
const DEFAULT_ACCESS_DENY_ACTIONS: ArchivePermissionAction[] = [
  "view",
  "create",
  "upload",
  "edit",
  "delete",
  "restore",
  "move",
  "manage_metadata",
  "manage_status",
];

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

  const [canManageSharing, setCanManageSharing] = useState(false);
  const [permissionRules, setPermissionRules] = useState<ArchivePermissionRule[]>([]);
  const [defaultAccess, setDefaultAccess] = useState<FolderDefaultAccessRow[]>([]);
  const [coworkers, setCoworkers] = useState<ArchiveCoworker[]>([]);
  const [roles, setRoles] = useState<ArchiveRoleOption[]>([]);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState("");
  const [revokingSubject, setRevokingSubject] = useState<string | null>(null);

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

  async function loadSharing() {
    try {
      const [rulesRes, coworkersRes, rolesRes] = await Promise.all([
        fetch(`/api/archive/items/${itemId}/permissions`, { credentials: "include", cache: "no-store" }),
        fetch("/api/archive/coworkers", { credentials: "include", cache: "no-store" }),
        fetch("/api/archive/roles", { credentials: "include", cache: "no-store" }),
      ]);

      const rulesData = await rulesRes.json().catch(() => null);

      if (!rulesRes.ok || !rulesData?.ok) {
        setCanManageSharing(false);
        return;
      }

      setCanManageSharing(true);
      setPermissionRules(rulesData.rules ?? []);
      setDefaultAccess(
        ((rulesData.effectiveAccess ?? []) as { userId: string; source: string }[])
          .filter((row): row is { userId: string; source: "admin-role" | "viewer-role" } =>
            row.source === "admin-role" || row.source === "viewer-role",
          )
          .map((row) => ({ userId: row.userId, source: row.source })),
      );

      const coworkersData = await coworkersRes.json().catch(() => null);
      if (coworkersRes.ok && coworkersData?.ok) {
        setCoworkers(coworkersData.coworkers ?? []);
      }

      const rolesData = await rolesRes.json().catch(() => null);
      if (rolesRes.ok && rolesData?.ok) {
        setRoles(rolesData.roles ?? []);
      }
    } catch {
      setCanManageSharing(false);
    }
  }

  useEffect(() => {
    if (!currentUser) return;
    if (!hasAccess) return;
    if (!itemId) return;
    void loadSharing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, hasAccess, itemId]);

  async function handleGrantShare(
    subjectType: ArchivePermissionSubjectType,
    subjectId: string,
    alsoManageSharing: boolean,
  ): Promise<boolean> {
    try {
      setSharing(true);
      setShareError("");

      const res = await fetch(`/api/archive/items/${itemId}/permissions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectType, subjectId, alsoManageSharing }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setShareError(data?.reason || "Failed to share item");
        return false;
      }

      await loadSharing();
      return true;
    } catch {
      setShareError("Failed to share item");
      return false;
    } finally {
      setSharing(false);
    }
  }

  async function handleRevokeShare(
    subjectType: ArchivePermissionSubjectType,
    subjectId: string,
    actions: ArchivePermissionAction[],
  ) {
    if (!confirm(locale === "nb" ? "Fjerne denne tilgangen?" : "Remove this access?")) return;

    try {
      setRevokingSubject(subjectId);
      setShareError("");

      const res = await fetch(`/api/archive/items/${itemId}/permissions`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectType, subjectId, actions }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setShareError(data?.reason || "Failed to remove access");
        return;
      }

      await loadSharing();
    } catch {
      setShareError("Failed to remove access");
    } finally {
      setRevokingSubject(null);
    }
  }

  async function handleRemoveDefaultAccess(userId: string): Promise<boolean> {
    if (!confirm(locale === "nb" ? "Fjerne denne tilgangen?" : "Remove this access?")) return false;

    try {
      setShareError("");

      const res = await fetch(`/api/archive/items/${itemId}/permissions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectType: "user",
          subjectId: userId,
          actions: DEFAULT_ACCESS_DENY_ACTIONS,
          effect: "deny",
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setShareError(data?.reason || "Failed to remove access");
        return false;
      }

      await loadSharing();
      return true;
    } catch {
      setShareError("Failed to remove access");
      return false;
    }
  }

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

  const sharingContent = (
    <FolderSharingPanel
      locale={locale}
      entityKind="item"
      ownerUserId={item?.ownerUserId ?? null}
      currentUserId={currentUser?.id}
      permissionRules={permissionRules}
      defaultAccess={defaultAccess}
      coworkers={coworkers}
      roles={roles}
      sharing={sharing}
      shareError={shareError}
      revokingSubject={revokingSubject}
      onGrant={handleGrantShare}
      onRevoke={(subjectType, subjectId, actions) => void handleRevokeShare(subjectType, subjectId, actions)}
      onRemoveDefaultAccess={handleRemoveDefaultAccess}
    />
  );

  const itemControlTabs = item
    ? [
        ...(canManageSharing
          ? [
              {
                id: "permissions",
                title: locale === "nb" ? "Deling" : "Permissions",
                content: sharingContent,
              },
            ]
          : []),
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
