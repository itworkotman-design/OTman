import type {
  ArchiveContextInput,
  ArchiveHostAdapterError,
} from "@customprojects/custom-archive";
import type {
  ArchiveUiBridge,
  ArchiveUiCurrentUserDisplay,
  ArchiveUiErrorPresentation,
  ArchiveUiFileTransport,
  ArchiveUiIdentityPort,
  ArchiveUiIdentityResult,
  ArchiveUiNavigationIntent,
  ArchiveUiPlatformUserDisplay,
  ArchiveUiServiceMethodName,
  ArchiveUiServicePort,
} from "@/lib/archiveUi/vendor/bridge";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

// The real `ArchiveHostAdapter` methods return live `Date` instances; once
// serialized through our JSON RPC route they arrive back as ISO strings.
// Screens format dates directly (e.g. `archiveUiFolderDateToInputValue`
// expects a real `Date | null`), so this reviver walks every RPC response and
// turns ISO-8601 timestamp strings back into `Date` objects before handing
// the result to the vendored screens.
function reviveDates(value: unknown): unknown {
  if (typeof value === "string" && ISO_DATE_RE.test(value)) {
    return new Date(value);
  }
  if (Array.isArray(value)) {
    return value.map(reviveDates);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = reviveDates(val);
    }
    return out;
  }
  return value;
}

async function callRpc(method: ArchiveUiServiceMethodName, args: unknown[]): Promise<unknown> {
  const res = await fetch("/api/archive/ui-bridge/rpc", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, args }),
  });

  const text = await res.text();
  if (!text) {
    return { ok: false, error: { category: "server_error", message: `Empty response from ${method}` } };
  }
  return reviveDates(JSON.parse(text));
}

const SERVICE_METHOD_NAMES: readonly ArchiveUiServiceMethodName[] = [
  "assignArchiveRole",
  "createArchiveRole",
  "createFolder",
  "createItem",
  "deleteArchiveRole",
  "explainPermissions",
  "getEffectiveCapabilities",
  "getFolderPath",
  "listArchiveRoleAssignmentsForRole",
  "listArchiveRoles",
  "listChildFolders",
  "listFilesForItem",
  "listItemsInFolder",
  "listPermissionHistory",
  "listPermissionRules",
  "listRecoverableContent",
  "listRecoverableFilesForItem",
  "listResourceHistory",
  "listRootFolders",
  "readFolder",
  "readItem",
  "renameArchiveRole",
  "restoreFile",
  "restoreFolder",
  "restoreItem",
  "revokePermissionRule",
  "searchFolders",
  "searchItems",
  "setFolderDates",
  "setFolderStatus",
  "setItemDates",
  "setItemStatus",
  "setPermissionRule",
  "softDeleteFile",
  "softDeleteFolder",
  "softDeleteItem",
  "unassignArchiveRole",
];

function buildServicePort(): ArchiveUiServicePort {
  const service = {} as Record<string, (...args: unknown[]) => Promise<unknown>>;
  for (const name of SERVICE_METHOD_NAMES) {
    service[name] = (...args: unknown[]) => callRpc(name, args);
  }
  return service as unknown as ArchiveUiServicePort;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function buildFileTransport(): ArchiveUiFileTransport {
  return {
    uploadFile: async (_ctx, input) => {
      const formData = new FormData();
      formData.append("archiveItemId", input.archiveItemId);
      formData.append(
        "file",
        new File([input.content as BlobPart], input.originalFileName, { type: input.mimeType }),
      );

      const res = await fetch("/api/archive/ui-bridge/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      return reviveDates(await res.json()) as Awaited<ReturnType<ArchiveUiFileTransport["uploadFile"]>>;
    },
    downloadFile: async (_ctx, fileId) => {
      const res = await fetch("/api/archive/ui-bridge/download", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });

      const data = await res.json();
      if (!data.ok) {
        return reviveDates(data) as Awaited<ReturnType<ArchiveUiFileTransport["downloadFile"]>>;
      }

      return {
        ok: true,
        value: {
          file: reviveDates(data.value.file),
          content: base64ToUint8Array(data.value.contentBase64),
        },
      } as Awaited<ReturnType<ArchiveUiFileTransport["downloadFile"]>>;
    },
  };
}

function toPlatformUserDisplay(user: {
  userId: string;
  email: string;
  username: string | null;
}): ArchiveUiPlatformUserDisplay {
  return {
    platformUserId: user.userId,
    displayName: user.username ?? undefined,
    email: user.email,
  };
}

function buildIdentityPort(): ArchiveUiIdentityPort {
  return {
    resolvePlatformUsers: async (platformUserIds) => {
      try {
        const res = await fetch("/api/archive/coworkers/resolve", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds: platformUserIds }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          return {
            ok: false,
            failure: { kind: "error", title: "Could not resolve users", description: "Request failed." },
          };
        }
        return { ok: true, value: (data.users ?? []).map(toPlatformUserDisplay) };
      } catch {
        return {
          ok: false,
          failure: { kind: "error", title: "Could not resolve users", description: "Network error." },
        };
      }
    },
    listAssignableCompanyMembers: async () => {
      try {
        const res = await fetch("/api/archive/coworkers", { credentials: "include", cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          return {
            ok: false,
            failure: { kind: "error", title: "Could not list coworkers", description: "Request failed." },
          };
        }
        return {
          ok: true,
          value: (data.coworkers ?? []).map(toPlatformUserDisplay),
        };
      } catch {
        return {
          ok: false,
          failure: { kind: "error", title: "Could not list coworkers", description: "Network error." },
        };
      }
    },
  } satisfies ArchiveUiIdentityPort;
}

const ERROR_TITLES: Record<ArchiveHostAdapterError["category"], string> = {
  unauthorized: "Not signed in",
  not_found: "Not found or not permitted",
  validation: "Invalid input",
  server_error: "Something went wrong",
};

function translateError(error: ArchiveHostAdapterError): ArchiveUiErrorPresentation {
  return {
    category: error.category,
    title: ERROR_TITLES[error.category],
    description: error.message,
  };
}

export interface CreateHostBridgeOptions {
  readonly context: ArchiveContextInput;
  readonly currentUserDisplay: ArchiveUiCurrentUserDisplay | undefined;
  readonly onNavigate: (intent: ArchiveUiNavigationIntent) => void;
}

export function createArchiveUiHostBridge(options: CreateHostBridgeOptions): ArchiveUiBridge {
  const service = buildServicePort();
  const transport = buildFileTransport();
  const identity = buildIdentityPort();

  return {
    getContext: () => options.context,
    getCurrentUserDisplay: () => options.currentUserDisplay,
    navigate: options.onNavigate,
    service,
    transport,
    translateError,
    identity,
  };
}

export type { ArchiveUiIdentityResult };
