"use client";

import { useState } from "react";
import { ExpandablePanelList } from "@/app/_components/Dahsboard/archive/ExpandablePanelList";

export type ArchivePermissionAction =
  | "view"
  | "create"
  | "upload"
  | "edit"
  | "delete"
  | "restore"
  | "move"
  | "manage_metadata"
  | "manage_status"
  | "manage_permissions";

export type ArchivePermissionSubjectType = "user" | "role";

export type ArchivePermissionRule = {
  subjectType: ArchivePermissionSubjectType;
  subjectId: string;
  action: ArchivePermissionAction;
};

export type ArchiveCoworker = {
  userId: string;
  email: string;
  username: string | null;
};

export type ArchiveRoleOption = {
  id: string;
  name: string;
};

type ArchiveRoleAssignmentRow = {
  roleId: string;
  platformUserId: string;
};

// The raw action list ("view, create, upload, edit, delete, restore, move,
// manage_metadata, manage_status, manage_permissions") is what made the old
// panel unreadable — nobody could tell at a glance who was a viewer vs. a
// full co-manager. These three presets are the only combinations the grant
// form can produce, plus an optional add-on ("also manage sharing") that
// bumps a Viewer/Contributor grant up with `manage_permissions` — so
// classifyAccess can recognize the vast majority of real rules and only
// falls back to "Custom" for hand-crafted combinations (e.g. made via the
// generic permissions API directly).
const VIEWER_ACTIONS: ArchivePermissionAction[] = ["view"];
const CONTRIBUTOR_ACTIONS: ArchivePermissionAction[] = [
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
const FULL_ACTIONS: ArchivePermissionAction[] = [...CONTRIBUTOR_ACTIONS, "manage_permissions"];

type AccessLevel = "full" | "contributor" | "viewer" | "custom";
type GrantLevel = Exclude<AccessLevel, "custom">;

function sameActionSet(a: ArchivePermissionAction[], b: ArchivePermissionAction[]) {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((action) => setB.has(action));
}

function classifyAccess(actions: ArchivePermissionAction[]): AccessLevel {
  if (sameActionSet(actions, FULL_ACTIONS)) return "full";
  if (sameActionSet(actions, CONTRIBUTOR_ACTIONS)) return "contributor";
  if (sameActionSet(actions, VIEWER_ACTIONS)) return "viewer";
  return "custom";
}

const ACCESS_LEVEL_ORDER: AccessLevel[] = ["full", "contributor", "viewer", "custom"];

const ACCESS_LEVEL_META: Record<
  AccessLevel,
  { en: string; nb: string; badgeClass: string; description: { en: string; nb: string } }
> = {
  full: {
    en: "Full access",
    nb: "Full tilgang",
    badgeClass: "bg-logoblue/10 text-logoblue",
    description: {
      en: "Can view, edit, upload and delete, and can manage who else has access.",
      nb: "Kan se, redigere, laste opp og slette, og kan administrere hvem andre som har tilgang.",
    },
  },
  contributor: {
    en: "Contributor",
    nb: "Bidragsyter",
    badgeClass: "bg-emerald-50 text-emerald-700",
    description: {
      en: "Can view, edit, upload and delete, but can't change who has access.",
      nb: "Kan se, redigere, laste opp og slette, men kan ikke endre hvem som har tilgang.",
    },
  },
  viewer: {
    en: "Viewer",
    nb: "Kan se",
    badgeClass: "bg-black/5 text-textColorSecond",
    description: {
      en: "Can only view this folder's contents.",
      nb: "Kan kun se innholdet i denne mappen.",
    },
  },
  custom: {
    en: "Custom",
    nb: "Tilpasset",
    badgeClass: "bg-amber-50 text-amber-700",
    description: {
      en: "A non-standard set of permissions, set up outside this panel.",
      nb: "Et ikke-standard sett med tillatelser, satt opp utenfor dette panelet.",
    },
  },
};

function AccessBadge({ actions, locale }: { actions: ArchivePermissionAction[]; locale: string }) {
  const level = classifyAccess(actions);
  const meta = ACCESS_LEVEL_META[level];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.badgeClass}`}
      title={locale === "nb" ? meta.description.nb : meta.description.en}
    >
      {locale === "nb" ? meta.nb : meta.en}
    </span>
  );
}

function levelRank(actions: ArchivePermissionAction[]) {
  return ACCESS_LEVEL_ORDER.indexOf(classifyAccess(actions));
}

function actionsForGrant(level: GrantLevel, alsoManageSharing: boolean): ArchivePermissionAction[] {
  if (level === "full") return FULL_ACTIONS;
  const base = level === "contributor" ? CONTRIBUTOR_ACTIONS : VIEWER_ACTIONS;
  return alsoManageSharing ? [...base, "manage_permissions"] : base;
}

type SharedSubject = {
  subjectType: ArchivePermissionSubjectType;
  subjectId: string;
  actions: ArchivePermissionAction[];
};

type FolderSharingPanelProps = {
  locale: string;
  ownerUserId: string | null;
  currentUserId?: string;
  permissionRules: ArchivePermissionRule[];
  coworkers: ArchiveCoworker[];
  roles: ArchiveRoleOption[];
  canShareWithRoles: boolean;
  sharing: boolean;
  shareError: string;
  revokingSubject: string | null;
  onGrant: (
    subjectType: ArchivePermissionSubjectType,
    subjectId: string,
    actions: ArchivePermissionAction[],
  ) => Promise<boolean>;
  onRevoke: (
    subjectType: ArchivePermissionSubjectType,
    subjectId: string,
    actions: ArchivePermissionAction[],
  ) => void;
};

// Replaces the old flat "name — view, create, upload, ..." list with
// something scannable: the owner called out on their own, everyone else
// tagged with a plain-language access level (badge + hover explanation)
// instead of raw action names, and groups (Archive's own "role" concept —
// relabeled "Group" here to match how ArchiveRolesPanel already talks about
// them) expandable to show which coworkers are actually in them, since
// "who has access via this group" was previously invisible from this panel.
export function FolderSharingPanel({
  locale,
  ownerUserId,
  currentUserId,
  permissionRules,
  coworkers,
  roles,
  canShareWithRoles,
  sharing,
  shareError,
  revokingSubject,
  onGrant,
  onRevoke,
}: FolderSharingPanelProps) {
  const [shareTargetType, setShareTargetType] = useState<ArchivePermissionSubjectType>("user");
  const [shareUserId, setShareUserId] = useState("");
  const [shareRoleId, setShareRoleId] = useState("");
  const [shareLevel, setShareLevel] = useState<GrantLevel>("viewer");
  const [shareCanManageSharing, setShareCanManageSharing] = useState(false);

  const [roleAssignments, setRoleAssignments] = useState<Record<string, ArchiveRoleAssignmentRow[]>>({});
  const [loadedRoleAssignments, setLoadedRoleAssignments] = useState<Record<string, boolean>>({});

  async function loadRoleAssignments(roleId: string) {
    try {
      const res = await fetch(`/api/archive/roles/${roleId}/assignments`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) return;
      setRoleAssignments((prev) => ({ ...prev, [roleId]: data.assignments ?? [] }));
      setLoadedRoleAssignments((prev) => ({ ...prev, [roleId]: true }));
    } catch {
      // Best-effort — the group row just keeps showing "Loading members...".
    }
  }

  function handleToggleRole(roleId: string, expanded: boolean) {
    if (expanded && !loadedRoleAssignments[roleId]) void loadRoleAssignments(roleId);
  }

  async function handleSubmitGrant() {
    const subjectId = shareTargetType === "role" ? shareRoleId : shareUserId;
    if (!subjectId) return;

    const actions = actionsForGrant(shareLevel, shareLevel !== "full" && shareCanManageSharing);
    const ok = await onGrant(shareTargetType, subjectId, actions);
    if (ok) {
      setShareUserId("");
      setShareRoleId("");
      setShareCanManageSharing(false);
    }
  }

  const subjectMap = new Map<string, SharedSubject>();
  for (const rule of permissionRules) {
    if (rule.subjectType === "user" && (rule.subjectId === currentUserId || rule.subjectId === ownerUserId)) continue;
    const key = `${rule.subjectType}:${rule.subjectId}`;
    const existing = subjectMap.get(key);
    if (existing) {
      existing.actions.push(rule.action);
    } else {
      subjectMap.set(key, { subjectType: rule.subjectType, subjectId: rule.subjectId, actions: [rule.action] });
    }
  }

  const coworkerById = new Map(coworkers.map((c) => [c.userId, c]));
  const roleById = new Map(roles.map((r) => [r.id, r]));

  const userSubjects = Array.from(subjectMap.values())
    .filter((s) => s.subjectType === "user")
    .sort((a, b) => levelRank(a.actions) - levelRank(b.actions));
  const roleSubjects = Array.from(subjectMap.values())
    .filter((s) => s.subjectType === "role")
    .sort((a, b) => levelRank(a.actions) - levelRank(b.actions));

  const shareableCoworkers = coworkers.filter(
    (c) => c.userId !== ownerUserId && !userSubjects.some((s) => s.subjectId === c.userId),
  );
  const shareableRoles = roles.filter((r) => !roleSubjects.some((s) => s.subjectId === r.id));

  function labelForUser(userId: string) {
    if (userId === currentUserId) return locale === "nb" ? "Deg" : "You";
    const coworker = coworkerById.get(userId);
    return coworker?.username || coworker?.email || userId;
  }

  const ownerLabel = ownerUserId ? labelForUser(ownerUserId) : null;

  const t = {
    grantHeading: locale === "nb" ? "Gi tilgang" : "Grant access",
    coworker: locale === "nb" ? "Kollega" : "Coworker",
    group: locale === "nb" ? "Gruppe" : "Group",
    select: locale === "nb" ? "Velg..." : "Select...",
    accessLevel: locale === "nb" ? "Tilgangsnivå" : "Access level",
    alsoManageSharing: locale === "nb" ? "Kan også administrere deling" : "Can also manage sharing",
    share: locale === "nb" ? "Del" : "Share",
    sharingInProgress: locale === "nb" ? "Deler..." : "Sharing...",
    owner: locale === "nb" ? "Eier" : "Owner",
    ownerNote:
      locale === "nb"
        ? "Opprettet denne mappen og har alltid full tilgang."
        : "Created this folder and always has full access.",
    usersHeading: locale === "nb" ? "Kolleger med tilgang" : "Users with access",
    noUsers: locale === "nb" ? "Ingen kolleger har fått tilgang direkte ennå" : "No users have been individually granted access yet",
    groupsHeading: locale === "nb" ? "Grupper med tilgang" : "Groups with access",
    noGroups: locale === "nb" ? "Ingen grupper har tilgang" : "No groups have access",
    remove: locale === "nb" ? "Fjern" : "Remove",
    loadingMembers: locale === "nb" ? "Laster medlemmer..." : "Loading members...",
    noMembers: locale === "nb" ? "Ingen medlemmer i denne gruppen" : "No members in this group",
    member: locale === "nb" ? "medlem" : "member",
    members: locale === "nb" ? "medlemmer" : "members",
  };

  const levelOptions: { value: GrantLevel; label: string }[] = [
    { value: "viewer", label: locale === "nb" ? ACCESS_LEVEL_META.viewer.nb : ACCESS_LEVEL_META.viewer.en },
    { value: "contributor", label: locale === "nb" ? ACCESS_LEVEL_META.contributor.nb : ACCESS_LEVEL_META.contributor.en },
    { value: "full", label: locale === "nb" ? ACCESS_LEVEL_META.full.nb : ACCESS_LEVEL_META.full.en },
  ];

  const roleGroupPanelItems = roleSubjects.map((subject) => {
    const assignments = roleAssignments[subject.subjectId] ?? [];
    const memberCount = loadedRoleAssignments[subject.subjectId] ? assignments.length : null;

    return {
      id: subject.subjectId,
      title: roleById.get(subject.subjectId)?.name ?? subject.subjectId,
      subtitle: memberCount === null ? "" : memberCount === 1 ? `1 ${t.member}` : `${memberCount} ${t.members}`,
      headerActions: (
        <div className="flex shrink-0 items-center gap-2">
          <AccessBadge actions={subject.actions} locale={locale} />
          <button
            type="button"
            className="shrink-0 rounded-full border border-lineSecondary px-3.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
            onClick={(e) => {
              e.stopPropagation();
              onRevoke("role", subject.subjectId, subject.actions);
            }}
            disabled={revokingSubject === subject.subjectId}
          >
            {t.remove}
          </button>
        </div>
      ),
      content: !loadedRoleAssignments[subject.subjectId] ? (
        <div className="text-sm text-textColorThird">{t.loadingMembers}</div>
      ) : assignments.length === 0 ? (
        <div className="text-sm text-textColorThird">{t.noMembers}</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {assignments.map((assignment) => (
            <span
              key={assignment.platformUserId}
              className="rounded-full border border-lineSecondary bg-black/2 px-3 py-1 text-sm font-semibold text-textcolor"
            >
              {labelForUser(assignment.platformUserId)}
            </span>
          ))}
        </div>
      ),
    };
  });

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-lineSecondary p-4">
        <h3 className="mb-3 text-sm font-semibold text-textColorThird">{t.grantHeading}</h3>

        {canShareWithRoles && (
          <div className="mb-3 flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={shareTargetType === "user"}
                onChange={() => setShareTargetType("user")}
                disabled={sharing}
              />
              {t.coworker}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={shareTargetType === "role"}
                onChange={() => setShareTargetType("role")}
                disabled={sharing}
              />
              {t.group}
            </label>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          {shareTargetType === "role" ? (
            <div className="min-w-[200] flex-1">
              <label className="block pb-2 text-sm">{t.group}</label>
              <select
                className="customInput w-full"
                value={shareRoleId}
                onChange={(e) => setShareRoleId(e.target.value)}
                disabled={sharing}
              >
                <option value="">{t.select}</option>
                {shareableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="min-w-[200] flex-1">
              <label className="block pb-2 text-sm">{t.coworker}</label>
              <select
                className="customInput w-full"
                value={shareUserId}
                onChange={(e) => setShareUserId(e.target.value)}
                disabled={sharing}
              >
                <option value="">{t.select}</option>
                {shareableCoworkers.map((coworker) => (
                  <option key={coworker.userId} value={coworker.userId}>
                    {coworker.username || coworker.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="min-w-[180] flex-1">
            <label className="block pb-2 text-sm">{t.accessLevel}</label>
            <select
              className="customInput w-full"
              value={shareLevel}
              onChange={(e) => setShareLevel(e.target.value as GrantLevel)}
              disabled={sharing}
            >
              {levelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="customButtonEnabled h-10 px-6"
            onClick={() => void handleSubmitGrant()}
            disabled={sharing || (shareTargetType === "role" ? !shareRoleId : !shareUserId)}
          >
            {sharing ? t.sharingInProgress : t.share}
          </button>
        </div>

        {shareLevel !== "full" && (
          <label className="mt-3 flex items-center gap-2 text-sm text-textColorSecond">
            <input
              type="checkbox"
              checked={shareCanManageSharing}
              onChange={(e) => setShareCanManageSharing(e.target.checked)}
              disabled={sharing}
            />
            {t.alsoManageSharing}
          </label>
        )}

        {shareError && <p className="mt-3 text-sm font-medium text-red-600">{shareError}</p>}
      </div>

      {ownerUserId && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-logoblue/20 bg-logoblue/3 px-4 py-3">
          <div>
            <span className="font-medium text-textcolor">{ownerLabel}</span>
            <span className="ml-2 text-sm text-textColorThird">{t.ownerNote}</span>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full bg-logoblue/10 px-2.5 py-0.5 text-xs font-semibold text-logoblue">
            {t.owner}
          </span>
        </div>
      )}

      <div className="grid gap-4">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-textColorThird">
            {t.usersHeading} {userSubjects.length > 0 && `(${userSubjects.length})`}
          </h4>
          {userSubjects.length > 0 ? (
            <div className="divide-y divide-lineSecondary border-y border-lineSecondary">
              {userSubjects.map((subject) => (
                <div
                  key={`${subject.subjectType}:${subject.subjectId}`}
                  className="flex items-center justify-between gap-4 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium text-textcolor">{labelForUser(subject.subjectId)}</span>
                    <AccessBadge actions={subject.actions} locale={locale} />
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-red-600 hover:underline"
                    onClick={() => onRevoke(subject.subjectType, subject.subjectId, subject.actions)}
                    disabled={revokingSubject === subject.subjectId}
                  >
                    {t.remove}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-textColorThird">{t.noUsers}</p>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-textColorThird">
            {t.groupsHeading} {roleSubjects.length > 0 && `(${roleSubjects.length})`}
          </h4>
          {roleGroupPanelItems.length > 0 ? (
            <ExpandablePanelList items={roleGroupPanelItems} onToggle={handleToggleRole} emptyMessage={t.noGroups} />
          ) : (
            <p className="text-sm text-textColorThird">{t.noGroups}</p>
          )}
        </div>
      </div>
    </div>
  );
}
