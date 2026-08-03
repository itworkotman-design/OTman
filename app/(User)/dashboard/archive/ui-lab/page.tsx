"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ArchiveContextInput } from "@customprojects/custom-archive";
import type { ArchiveUiNavigationIntent } from "@/lib/archiveUi/vendor/bridge";
import { ArchiveRootScreen } from "@/lib/archiveUi/vendor/root-screen";
import { ArchiveFolderScreen } from "@/lib/archiveUi/vendor/folder-screen";
import { ArchiveItemScreen } from "@/lib/archiveUi/vendor/item-screen";
import { ArchiveSearchScreen } from "@/lib/archiveUi/vendor/search-screen";
import { ArchivePermissionsScreen } from "@/lib/archiveUi/vendor/permissions-screen";
import { ArchiveRecoveryScreen } from "@/lib/archiveUi/vendor/recovery-screen";
import { ArchiveHistoryScreen } from "@/lib/archiveUi/vendor/history-screen";
import { createArchiveUiHostBridge } from "@/lib/archiveUi/hostBridge";
import { getModuleAccess } from "@/lib/users/access";
import type { AppModuleAccess } from "@/lib/users/types";

type ArchiveUiLabTab = "root" | "folder" | "item" | "search" | "permissions" | "recovery" | "history";

const TABS: { key: ArchiveUiLabTab; label: string }[] = [
  { key: "root", label: "Root" },
  { key: "folder", label: "Folder" },
  { key: "item", label: "Item" },
  { key: "search", label: "Search" },
  { key: "permissions", label: "Permissions" },
  { key: "recovery", label: "Recovery" },
  { key: "history", label: "History" },
];

type PermissionsTargetType = "namespace" | "folder" | "item";
type HistoryTargetType = "folder" | "item";

export default function ArchiveUiLabPage() {
  const [me, setMe] = useState<{
    userId: string;
    companyId: string;
    role: string;
    permissions: string[];
    appAccess: AppModuleAccess[];
    displayName: string;
    email: string;
  } | null>(null);
  const [meError, setMeError] = useState("");

  const [activeTab, setActiveTab] = useState<ArchiveUiLabTab>("root");

  const [folderId, setFolderId] = useState("");
  const [folderIdDraft, setFolderIdDraft] = useState("");

  const [itemId, setItemId] = useState("");
  const [itemIdDraft, setItemIdDraft] = useState("");

  const [permissionsTargetType, setPermissionsTargetType] = useState<PermissionsTargetType>("folder");
  const [permissionsTargetId, setPermissionsTargetId] = useState("");
  const [permissionsTargetIdDraft, setPermissionsTargetIdDraft] = useState("");

  const [historyTargetType, setHistoryTargetType] = useState<HistoryTargetType>("folder");
  const [historyTargetId, setHistoryTargetId] = useState("");
  const [historyTargetIdDraft, setHistoryTargetIdDraft] = useState("");

  useEffect(() => {
    async function loadMe() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.ok || !data.activeTenant) {
          setMeError(data?.reason || "Could not load current user/company");
          return;
        }

        setMe({
          userId: data.user.id,
          companyId: data.activeTenant.companyId,
          role: data.activeTenant.role,
          permissions: data.activeTenant.permissions ?? [],
          appAccess: data.activeTenant.appAccess ?? [],
          displayName: data.user.username || "",
          email: data.user.email || "",
        });
      } catch {
        setMeError("Could not load current user/company");
      }
    }
    void loadMe();
  }, []);

  const meArchiveAccess = me ? getModuleAccess(me, "ARCHIVE") : { enabled: true, level: "ADMIN" as const };
  const hasAccess = meArchiveAccess.enabled && meArchiveAccess.level === "ADMIN";

  function handleNavigate(intent: ArchiveUiNavigationIntent) {
    switch (intent.screen) {
      case "root":
        setActiveTab("root");
        break;
      case "folder":
        setFolderId(intent.folderId);
        setFolderIdDraft(intent.folderId);
        setActiveTab("folder");
        break;
      case "item":
        setItemId(intent.itemId);
        setItemIdDraft(intent.itemId);
        setActiveTab("item");
        break;
      case "search":
        setActiveTab("search");
        break;
      case "recovery":
        setActiveTab("recovery");
        break;
      case "permissions":
        setPermissionsTargetType(intent.target.targetType);
        setPermissionsTargetId(intent.target.targetId);
        setPermissionsTargetIdDraft(intent.target.targetId);
        setActiveTab("permissions");
        break;
      case "history":
        if (intent.target.targetType === "folder" || intent.target.targetType === "item") {
          setHistoryTargetType(intent.target.targetType);
          setHistoryTargetId(intent.target.targetId);
          setHistoryTargetIdDraft(intent.target.targetId);
          setActiveTab("history");
        }
        break;
    }
  }

  const bridge = useMemo(() => {
    if (!me) return null;

    const context: ArchiveContextInput = {
      userId: me.userId,
      companyId: me.companyId,
      tenantId: me.companyId,
      archiveModuleAccess: hasAccess,
    };

    return createArchiveUiHostBridge({
      context,
      currentUserDisplay: { displayName: me.displayName || undefined, email: me.email || undefined },
      onNavigate: handleNavigate,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, hasAccess]);

  if (meError) {
    return (
      <div className="w-full">
        <div className="customContainer border-red-200! bg-red-50 py-4 px-4 text-sm font-medium text-red-600">
          {meError}
        </div>
      </div>
    );
  }

  if (me && !hasAccess) {
    return (
      <div className="w-full">
        <p className="text-textColorThird">You do not have access to the archive.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="whitespace-nowrap text-2xl font-semibold text-logoblue lg:text-4xl">
            Archive UI lab
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-textColorThird">
            Mounts the college&apos;s vendored archive-ui screens (
            <code>lib/archiveUi/vendor</code>) against the real backend through a host bridge, so you
            can click through and test their UI directly. Not linked into normal navigation flows.
          </p>
        </div>

        <Link href="/dashboard/archive" className="text-sm text-textColorThird hover:underline">
          Back to archive
        </Link>
      </div>

      <div className="customContainer mb-6 flex flex-wrap gap-2 p-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={tab.key === activeTab ? "customButtonEnabled" : "customButtonDefault"}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!bridge ? (
        <div className="customContainer flex items-center justify-center py-10 text-sm text-textColorThird">
          Loading current user...
        </div>
      ) : (
        <div className="customContainer p-4">
          {activeTab === "root" && <ArchiveRootScreen bridge={bridge} />}

          {activeTab === "folder" &&
            (folderId ? (
              <ArchiveFolderScreen key={folderId} bridge={bridge} folderId={folderId} />
            ) : (
              <TargetPicker
                label="Folder id"
                value={folderIdDraft}
                onChange={setFolderIdDraft}
                onLoad={() => setFolderId(folderIdDraft.trim())}
              />
            ))}

          {activeTab === "item" &&
            (itemId ? (
              <ArchiveItemScreen key={itemId} bridge={bridge} itemId={itemId} />
            ) : (
              <TargetPicker
                label="Item id"
                value={itemIdDraft}
                onChange={setItemIdDraft}
                onLoad={() => setItemId(itemIdDraft.trim())}
              />
            ))}

          {activeTab === "search" && <ArchiveSearchScreen bridge={bridge} />}

          {activeTab === "permissions" &&
            (permissionsTargetId ? (
              <ArchivePermissionsScreen
                key={`${permissionsTargetType}:${permissionsTargetId}`}
                bridge={bridge}
                target={{ targetType: permissionsTargetType, targetId: permissionsTargetId }}
              />
            ) : (
              <TargetPicker
                label="Target id"
                value={permissionsTargetIdDraft}
                onChange={setPermissionsTargetIdDraft}
                onLoad={() => setPermissionsTargetId(permissionsTargetIdDraft.trim())}
                targetType={permissionsTargetType}
                onTargetTypeChange={(t) => setPermissionsTargetType(t as PermissionsTargetType)}
                targetTypeOptions={["namespace", "folder", "item"]}
                onUseNamespace={() => {
                  setPermissionsTargetType("namespace");
                  setPermissionsTargetIdDraft(me?.companyId ?? "");
                }}
              />
            ))}

          {activeTab === "recovery" && <ArchiveRecoveryScreen bridge={bridge} />}

          {activeTab === "history" &&
            (historyTargetId ? (
              <ArchiveHistoryScreen
                key={`${historyTargetType}:${historyTargetId}`}
                bridge={bridge}
                target={{ targetType: historyTargetType, targetId: historyTargetId }}
              />
            ) : (
              <TargetPicker
                label="Target id"
                value={historyTargetIdDraft}
                onChange={setHistoryTargetIdDraft}
                onLoad={() => setHistoryTargetId(historyTargetIdDraft.trim())}
                targetType={historyTargetType}
                onTargetTypeChange={(t) => setHistoryTargetType(t as HistoryTargetType)}
                targetTypeOptions={["folder", "item"]}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function TargetPicker(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onLoad: () => void;
  targetType?: string;
  onTargetTypeChange?: (value: string) => void;
  targetTypeOptions?: string[];
  onUseNamespace?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {props.targetTypeOptions && (
        <div className="min-w-[140]">
          <label className="block pb-2 text-sm">Target type</label>
          <select
            className="customInput w-full"
            value={props.targetType}
            onChange={(e) => props.onTargetTypeChange?.(e.target.value)}
          >
            {props.targetTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="min-w-[280] flex-1">
        <label className="block pb-2 text-sm">{props.label}</label>
        <input
          className="customInput w-full"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          type="text"
          placeholder="paste an id, or navigate here from another tab"
        />
      </div>

      <button type="button" className="customButtonEnabled h-10 px-6" onClick={props.onLoad} disabled={!props.value.trim()}>
        Load
      </button>

      {props.onUseNamespace && (
        <button type="button" className="customButtonDefault h-10 px-4" onClick={props.onUseNamespace}>
          Use my namespace
        </button>
      )}
    </div>
  );
}
