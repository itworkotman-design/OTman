import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/users/useCurrentUser";
import { useUserLanguage } from "@/lib/users/language";
import { getModuleAccess } from "@/lib/users/access";
import { ArchiveSearchBar } from "@/app/_components/Dahsboard/archive/ArchiveSearchBar";
import { CopyUrlButton } from "@/app/_components/Dahsboard/archive/CopyUrlButton";
import { EntityPill, PillFieldsHeader, type EntityPillMode, type PillField, type PillHeaderField } from "@/app/_components/Dahsboard/archive/EntityPill";
import { SettingsIcon, settingsIconButtonClass } from "@/app/_components/Dahsboard/archive/SettingsIcon";
import {
  codeBadgeWidthCh,
  codeToUrlPath,
  formatLastModified,
  groupMixedBySection,
  pillFieldLabel,
} from "@/app/_components/Dahsboard/archive/types";
import type { ArchiveFolderSummary, ArchiveItemSummary, ArchiveSectionSummary } from "@/app/_components/Dahsboard/archive/types";

// The raw GET /api/archive/folders/:id response spreads the package's full
// ArchiveFolder (which includes parentFolderId), but ArchiveFolderSummary
// only lists the fields the normal browsing view otherwise needs — widened
// here since "sharedId" mode's best-effort "Located in" lookup needs it.
type ArchiveFolderDetail = ArchiveFolderSummary & { parentFolderId?: string | null };
type ArchiveItemRow = ArchiveItemSummary;
type ArchiveChildFolderRow = ArchiveFolderSummary;

type ArchiveFolderPathEntry =
  | { hidden: false; folderId: string; name: string | null }
  | { hidden: true };

// Normal browsing arrives via the code-path route ({kind:"code"}) and every
// link (breadcrumb, settings, child rows) is built from `codePath`, which
// only resolves if the viewer has `view` on every ancestor along the way.
// The "Shared with me" entry point ({kind:"sharedId"}) instead reaches a
// folder the viewer has a DIRECT grant on with no such ancestor access —
// see lib/docArchive/sharedWithMe.ts — so it can't reuse code-path links at
// all: rendering the real breadcrumb or settings href would either 403 or
// (worse) leak clickable links into folders the viewer can't open. In this
// mode the breadcrumb collapses to a static, non-interactive indicator and
// every link (settings, child rows) is rebuilt id-based under
// /dashboard/archive/shared/... instead of the folder's own absolute code.
type ArchiveLinkMode = { kind: "code" } | { kind: "sharedId" };

// Pure browsing view: no create/upload/delete/permissions controls here —
// every mutation lives on this folder's settings page or on an item's own
// settings page, matching the otman-archive prototype's view/settings split.
// `codePath` is this folder's own code (e.g. "1.2F.3F") split on "." — the
// exact URL segments that got us here, used to build every link on this
// page instead of the folder's opaque id. Ignored when `linkMode` is
// "sharedId" (see ArchiveLinkMode above) — pass an empty array in that case.
export function FolderView({
  folderId,
  codePath,
  linkMode = { kind: "code" },
}: {
  folderId: string;
  codePath: string[];
  linkMode?: ArchiveLinkMode;
}) {
  const currentUser = useCurrentUser();
  const { locale } = useUserLanguage(currentUser);
  const archiveAccess = currentUser ? getModuleAccess(currentUser, "ARCHIVE") : null;
  const hasAccess = !currentUser || archiveAccess!.enabled;
  const canEdit = archiveAccess?.level === "ADMIN";

  const [folder, setFolder] = useState<ArchiveFolderDetail | null>(null);
  const [items, setItems] = useState<ArchiveItemRow[]>([]);
  const [childFolders, setChildFolders] = useState<ArchiveChildFolderRow[]>([]);
  const [sections, setSections] = useState<ArchiveSectionSummary[]>([]);
  const [folderPath, setFolderPath] = useState<ArchiveFolderPathEntry[]>([]);
  const [locatedInName, setLocatedInName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadFolderAndItems() {
    try {
      setLoading(true);
      setError("");

      const [folderRes, itemsRes, childrenRes, pathRes, sectionsRes] = await Promise.all([
        fetch(`/api/archive/folders/${folderId}`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/archive/folders/${folderId}/items`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/archive/folders/${folderId}/children`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/archive/folders/${folderId}/path`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/archive/folders/${folderId}/sections`, { credentials: "include", cache: "no-store" }),
      ]);

      const folderData = await folderRes.json().catch(() => null);
      const itemsData = await itemsRes.json().catch(() => null);
      const childrenData = await childrenRes.json().catch(() => null);
      const pathData = await pathRes.json().catch(() => null);
      const sectionsData = await sectionsRes.json().catch(() => null);

      if (!folderRes.ok || !folderData?.ok) {
        setError(folderData?.reason || "Failed to load folder");
        return;
      }

      setFolder(folderData.folder);

      // Best-effort "Located in" hint for the "Shared with me" entry point:
      // only attempted if this caller happens to also have access to the
      // immediate parent — a failure here (403/404, the common case) is
      // swallowed rather than shown as an error, since the parent's name is
      // decorative, not required to view this folder.
      if (linkMode.kind === "sharedId" && folderData.folder?.parentFolderId) {
        fetch(`/api/archive/folders/${folderData.folder.parentFolderId}`, { credentials: "include", cache: "no-store" })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.ok && data.folder?.name) setLocatedInName(data.folder.name);
          })
          .catch(() => {});
      }

      // Best-effort "last opened" record for the archive root page's
      // "Shared with you" preview — see SharedWithYouSection.tsx. Only
      // reached-through-"Shared with me" opens count, matching the "sharedId"
      // scoping of the "Located in" hint above.
      if (linkMode.kind === "sharedId") {
        fetch("/api/archive/shared-with-me/recent", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityKind: "FOLDER", entityId: folderId }),
        }).catch(() => {});
      }

      if (!itemsRes.ok || !itemsData?.ok) {
        setError(itemsData?.reason || "Failed to load items");
        return;
      }

      setItems(itemsData.items ?? []);

      if (childrenRes.ok && childrenData?.ok) {
        setChildFolders(childrenData.folders ?? []);
      }

      if (pathRes.ok && pathData?.ok) {
        setFolderPath(pathData.path ?? []);
      }

      if (sectionsRes.ok && sectionsData?.ok) {
        setSections(sectionsData.sections ?? []);
      }
    } catch {
      setError("Failed to load folder");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!currentUser) return;
    if (!hasAccess) return;
    if (!folderId) return;
    void loadFolderAndItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, hasAccess, folderId]);

  if (currentUser && !hasAccess) {
    return (
      <div className="w-full">
        <p className="text-textColorThird">
          {locale === "nb" ? "Du har ikke tilgang til arkivet." : "You do not have access to the archive."}
        </p>
      </div>
    );
  }

  // Status isn't shown or filterable here — this view only ever surfaces
  // active entries; anything else is managed (and made visible again) from
  // the folder's settings page.
  const activeChildFolders = childFolders.filter((childFolder) => childFolder.status === "active");
  const activeItems = items.filter((item) => item.status === "active");
  const sectionGroups = groupMixedBySection(activeChildFolders, activeItems, sections, locale);
  const codeWidthCh = codeBadgeWidthCh([
    ...activeChildFolders.map((f) => f.code),
    ...activeItems.map((i) => i.code),
  ]);

  const settingsHref = linkMode.kind === "code" ? `/dashboard/archive/${codePath.join("/")}/settings` : null;

  // Shared by every folder/item row below — see PillFieldsHeader's own doc
  // comment for why it needs the exact same mode (and field set) as the rows
  // it captions.
  const pillMode: EntityPillMode = linkMode.kind === "sharedId" ? "viewer" : canEdit ? "admin" : "viewer";
  const headerFields: PillHeaderField[] = [{ key: "entries", label: pillFieldLabel("entries", locale) }];
  if (canEdit) headerFields.push({ key: "users", label: pillFieldLabel("users", locale) });
  headerFields.push({ key: "updated", label: pillFieldLabel("updated", locale) });

  // Collapse a *run* of consecutive hidden ancestors into a single "…"
  // instead of one "…" per hidden entry (which rendered as "/…/…/…" on deep
  // trees) — one ellipsis, then the path picks back up from the next visible
  // ancestor. Only meaningful in "code" mode — in "sharedId" mode no
  // ancestor link is ever rendered (see ArchiveLinkMode above), regardless
  // of what folderPath itself reports.
  type BreadcrumbSegment =
    | { kind: "ellipsis"; key: string }
    | { kind: "link"; key: string; href: string; label: string };

  const breadcrumbSegments: BreadcrumbSegment[] = [];
  if (linkMode.kind === "code") {
    folderPath.forEach((entry, index) => {
      if (!entry.hidden && entry.folderId === folderId) return;

      if (entry.hidden) {
        if (breadcrumbSegments.at(-1)?.kind !== "ellipsis") {
          breadcrumbSegments.push({ kind: "ellipsis", key: `ellipsis-${index}` });
        }
        return;
      }

      breadcrumbSegments.push({
        kind: "link",
        key: String(index),
        href: `/dashboard/archive/${codePath.slice(0, index + 1).join("/")}`,
        label: entry.name ?? "…",
      });
    });
  }

  function childHref(kind: "folder" | "item", id: string, code: string): string {
    if (linkMode.kind === "code") return `/dashboard/archive/${codeToUrlPath(code)}`;
    return `/dashboard/archive/shared/${kind}/${id}`;
  }

  // A shortcut's own display row (see lib/docArchive/shortcuts.ts) carries
  // the SOURCE item's real code (for the badge) but must open through its
  // own dedicated shortcut page — not the item's real code path — so its
  // breadcrumb reflects THIS folder, not the item's real one. `id` here is
  // already the shortcut row's own id (never the real item's), per
  // listInjectedShortcuts.
  function itemHref(item: ArchiveItemRow): string {
    if (item.isShortcut) return `/dashboard/archive/shortcut/${item.id}`;
    return childHref("item", item.id, item.code);
  }

  return (
    <div className="w-full">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs sm:text-sm text-textColorThird">
        <Link href="/dashboard/archive" className="hover:underline">
          {locale === "nb" ? "Arkiv" : "Archive"}
        </Link>
        {linkMode.kind === "sharedId" ? (
          <span className="flex items-center gap-1">
            <span>/</span>
            <span>{locale === "nb" ? "Delt med deg" : "Shared with you"}</span>
            {locatedInName && (
              <span className="text-textColorThird">
                ({locale === "nb" ? "i" : "in"} {locatedInName})
              </span>
            )}
          </span>
        ) : (
          breadcrumbSegments.map((segment) => (
            <span key={segment.key} className="flex items-center gap-1">
              <span>/</span>
              {segment.kind === "ellipsis" ? <span>…</span> : <Link href={segment.href} className="hover:underline">{segment.label}</Link>}
            </span>
          ))
        )}
        <span>/</span>
        <span className="font-medium text-textcolor">
          {loading ? "..." : folder?.name || (locale === "nb" ? "Ukjent mappe" : "Unknown folder")}
        </span>
        <CopyUrlButton locale={locale} />
      </nav>

      <div className="mb-8 flex w-full flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-logoblue sm:text-2xl lg:text-4xl">
            {loading ? "..." : folder?.name || (locale === "nb" ? "Ukjent mappe" : "Unknown folder")}
          </h1>
          {canEdit && settingsHref && (
            <Link
              href={settingsHref}
              aria-label={locale === "nb" ? "Innstillinger" : "Settings"}
              title={locale === "nb" ? "Innstillinger" : "Settings"}
              className={settingsIconButtonClass}
            >
              <SettingsIcon />
            </Link>
          )}
        </div>
        {folder?.description && <p className="max-w-xl text-sm text-textColorThird">{folder.description}</p>}

        <div className="w-full max-w-[400]">
          <ArchiveSearchBar
            scopeFolderId={folderId}
            locale={locale}
            placeholder={locale === "nb" ? "Søk i denne mappen" : "Search this folder"}
          />
        </div>
      </div>

      {error && (
        <div className="customContainer mb-6 border-red-200! bg-red-50 py-4 px-4 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
          {locale === "nb" ? "Laster..." : "Loading..."}
        </div>
      ) : sectionGroups.length === 0 ? (
        <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
          {locale === "nb" ? "Ingen mapper eller elementer funnet" : "No folders or items found"}
        </div>
      ) : (
        <div className="grid gap-8">
          {sectionGroups.map((group) => (
            <div key={group.id} className="min-w-0 w-full overflow-x-auto">
              {group.name && <h2 className="mb-3 text-sm sm:text-base font-semibold text-logoblue">{group.name}</h2>}

              <PillFieldsHeader
                kind="folder"
                mode={pillMode}
                locale={locale}
                codeWidthCh={codeWidthCh}
                hasManageActions
                fields={headerFields}
              />
              <div className="divide-y divide-lineSecondary border-y border-lineSecondary">
                {group.folders.map((childFolder) => {
                  const folderFields: PillField[] = [{ key: "entries", value: childFolder.entryCount }];
                  if (canEdit) folderFields.push({ key: "users", value: childFolder.viewerCount });
                  folderFields.push({ key: "updated", value: formatLastModified(childFolder.updatedAt) });

                  return (
                    <EntityPill
                      key={childFolder.id}
                      kind="folder"
                      id={childFolder.id}
                      name={childFolder.name}
                      description={childFolder.description}
                      status={childFolder.status}
                      conditionFlags={childFolder}
                      href={childHref("folder", childFolder.id, childFolder.code)}
                      locale={locale}
                      code={childFolder.code}
                      mode={pillMode}
                      fields={folderFields}
                      onChanged={loadFolderAndItems}
                      codeWidthCh={codeWidthCh}
                    />
                  );
                })}
                {group.items.map((item) => {
                  // Items have no "entries" of their own (leaf nodes, nothing
                  // under them to count) — kept as a blank placeholder rather
                  // than omitted so the column still lines up with folder
                  // rows sharing this same list.
                  const itemFields: PillField[] = [{ key: "entries", value: "" }];
                  if (canEdit) itemFields.push({ key: "users", value: item.viewerCount });
                  itemFields.push({ key: "updated", value: formatLastModified(item.updatedAt) });

                  return (
                    <EntityPill
                      key={item.id}
                      kind="item"
                      id={item.id}
                      name={item.name}
                      description={item.description}
                      status={item.status}
                      conditionFlags={item}
                      href={itemHref(item)}
                      locale={locale}
                      code={item.code}
                      mode={pillMode}
                      fields={itemFields}
                      onChanged={loadFolderAndItems}
                      codeWidthCh={codeWidthCh}
                      isShortcut={item.isShortcut}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
