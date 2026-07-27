import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import * as archiveUi from "../index.js";

// Correction Phase 6 TASK-01 (Archive UI package/export foundation),
// extended by TASK-02 (host-neutral UI bridge type contract, type-only —
// no runtime value), TASK-03 (shared Archive UI behavior/state
// primitives — the FIRST runtime value exports the `"./ui"` surface has
// ever had), TASK-04 (the Archive root/home screen — the FIRST
// business-screen runtime export), and TASK-05 (the Archive folder/content
// screen — the SECOND, and per that card's scope, ONLY additional,
// business-screen runtime export). This test is the `"./ui"` counterpart to
// `package-surface.test.ts`'s exact value-export-set discipline for the
// root `"."` export — it does NOT modify that file. It proves three things:
// (1) the `"./ui"` export subpath resolves and exposes EXACTLY the approved
// TASK-03 + TASK-04 + TASK-05 runtime allow-list below, so any future value
// export requires a conscious, controller-approved update here; (2)
// `package.json`'s `exports` map keeps the root `"."` entry byte-for-byte
// unchanged and adds EXACTLY one new `"./ui"` entry — no other key; (3) no
// file under the isolated Archive UI source tree references Shell or a
// Shell-relative module (the plan's §4/§5 "Archive UI must not import
// Shell" requirement).

const here = dirname(fileURLToPath(import.meta.url));
// src/archive-ui/__tests__ -> src/archive-ui -> src -> repo root
const repoRoot = resolve(here, "..", "..", "..");
const uiSourceDir = join(repoRoot, "src", "archive-ui");
const packageJsonPath = join(repoRoot, "package.json");

// The exact, deliberate TASK-03 shared runtime value-export allow-list.
// Every entry is a shared behavior/state primitive (view-state, capability,
// validation, feedback, destructive-confirmation) — no business screen,
// route, host-chrome signal, identity resolver, or role-listing surface.
// TASK-02's bridge contract stays type-only and contributes nothing here.
const SUPPORTED_UI_VALUE_EXPORTS: readonly string[] = [
  // view-state.tsx
  "ArchiveUiStatePresentation",
  "archiveUiViewStateDenied",
  "archiveUiViewStateEmpty",
  "archiveUiViewStateError",
  "archiveUiViewStateFromResult",
  "archiveUiViewStateLoading",
  "archiveUiViewStateReady",
  "describeArchiveUiViewState",
  // capabilities.tsx
  "describeArchiveUiCapabilityAction",
  "describeArchiveUiCapabilityActions",
  // validation.tsx
  "ARCHIVE_UI_EMPTY_FIELD_ERROR_MAP",
  "archiveUiFieldAccessibility",
  "archiveUiFieldErrorMapFromEntries",
  "archiveUiFieldHasError",
  "archiveUiFieldMessages",
  "archiveUiHasAnyFieldError",
  // feedback.tsx
  "ArchiveUiFeedbackBanner",
  "archiveUiFeedbackDismiss",
  "archiveUiFeedbackIdle",
  "archiveUiFeedbackLiveRegion",
  "archiveUiFeedbackReducer",
  "archiveUiFeedbackReset",
  "archiveUiFeedbackShow",
  // confirmation.tsx
  "ArchiveUiDestructiveConfirmationDialog",
  "archiveUiConfirmationCancel",
  "archiveUiConfirmationIdle",
  "archiveUiConfirmationRequest",
  "archiveUiIsConfirmableLabel",
  "archiveUiIsConfirmableLabels",
  "describeArchiveUiDestructiveConfirmation",
  // root-screen.tsx (Correction Phase 6 TASK-04) — the Archive module
  // root/home screen. One of the two deliberate, consciously allow-listed
  // business-screen exports these tasks authorize; see
  // `ARCHIVE_UI_ALLOWED_SCREEN_EXPORT_NAMES` below for the matching
  // exclusion from the forbidden-name pattern check.
  "ArchiveRootScreen",
  // folder-screen.tsx (Correction Phase 6 TASK-05) — the Archive module
  // folder/content screen with its real permission-safe full breadcrumb.
  // The second, and per that card's scope, ONLY additional, deliberate
  // business-screen export this task authorizes.
  "ArchiveFolderScreen",
  // item-screen.tsx (Correction Phase 6 TASK-06 Part A) — the Archive
  // module item/details and file-operations screen.
  "ArchiveItemScreen",
  // history-screen.tsx (Correction Phase 6 TASK-06 Part B) — the Archive
  // module resource/permission history screen. TASK-06 adds exactly these
  // two deliberate business-screen exports (32 -> 34), per its own card
  // scope, ONLY these two.
  "ArchiveHistoryScreen",
  // search-screen.tsx (Correction Phase 6 TASK-07) — the Archive module
  // folder/item search screen with real opaque cursor navigation. The ONE
  // deliberate business-screen export this task authorizes (34 -> 35).
  "ArchiveSearchScreen",
  // permissions-screen.tsx (Correction Phase 6 TASK-08) — the Archive
  // module permission-management, role-management, and role-assignment
  // screen. The ONE deliberate business-screen export this task authorizes
  // (35 -> 36).
  "ArchivePermissionsScreen",
  // recovery-screen.tsx (Correction Phase 6 TASK-09) — the Archive module
  // deleted-content recovery screen. The ONE deliberate business-screen
  // export this task authorizes (36 -> 37).
  "ArchiveRecoveryScreen",
];

// TASK-04/TASK-05's own explicit, narrow exception to the "no
// business-screen/route/chrome/identity/role-listing export" discipline the
// forbidden-name check below otherwise enforces: `ArchiveRootScreen`/
// `ArchiveFolderScreen` legitimately contain "screen" because they ARE the
// two screens these tasks' cards authorize exporting. Every OTHER
// screen/route/page/chrome/identity/role-listing export name — now and in
// every future task — remains forbidden; adding a further name to this list
// requires its own controller-approved task card. (Renamed from the
// TASK-04-only `TASK_04_ALLOWED_SCREEN_EXPORT_NAMES` to this task-neutral
// name — a narrow mechanical rename, zero semantic change to the TASK-04
// carve-out itself, which stays exactly `"ArchiveRootScreen"`.)
const ARCHIVE_UI_ALLOWED_SCREEN_EXPORT_NAMES: readonly string[] = [
  "ArchiveRootScreen",
  "ArchiveFolderScreen",
  "ArchiveItemScreen",
  "ArchiveHistoryScreen",
  "ArchiveSearchScreen",
  "ArchivePermissionsScreen",
  "ArchiveRecoveryScreen",
];

function collectFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    // Skip the test tree itself: this check scans PRODUCT source only
    // (this file's own doc comments legitimately mention Shell specifiers
    // by name while describing the check).
    if (entry.isDirectory() && entry.name === "__tests__") return [];
    const fullPath = join(dir, entry.name);
    return entry.isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}

describe("Archive UI package export foundation (Correction Phase 6 TASK-01/TASK-02/TASK-03/TASK-04)", () => {
  it('the "./ui" export resolves and exposes EXACTLY the approved TASK-03 + TASK-04 + TASK-05 runtime surface', () => {
    expect(Object.keys(archiveUi).sort()).toEqual(
      [...SUPPORTED_UI_VALUE_EXPORTS].sort(),
    );
  });

  it("the runtime export surface names no business screen, route, host-chrome signal, identity resolver, or role-listing surface beyond the explicit TASK-04 root-screen allow-list", () => {
    const forbiddenNamePattern =
      /screen|route|page|breadcrumb|chrome|sidebar|navbar|resolveIdentity|identityResolver|listRole|roleListing|assignmentListing/i;

    for (const exportName of Object.keys(archiveUi)) {
      if (ARCHIVE_UI_ALLOWED_SCREEN_EXPORT_NAMES.includes(exportName)) continue;
      expect(
        forbiddenNamePattern.test(exportName),
        `"${exportName}" looks like a forbidden business-screen/route/chrome/identity/role-listing export`,
      ).toBe(false);
    }
  });

  it('package.json keeps the root "." export entry byte-for-byte unchanged and adds EXACTLY one new "./ui" entry', () => {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      exports: Record<string, unknown>;
    };

    expect(pkg.exports["."]).toEqual({
      types: "./dist/archive/index.d.ts",
      import: "./dist/archive/index.js",
    });
    expect(pkg.exports["./ui"]).toEqual({
      types: "./dist/ui/index.d.ts",
      import: "./dist/ui/index.js",
    });
    expect(Object.keys(pkg.exports).sort()).toEqual([".", "./ui"]);
  });

  it("no file under the isolated Archive UI source tree references Shell or a Shell-relative module", () => {
    const shellSpecifierPattern =
      /platform-shell|shell-master|@customprojects\/platform-shell/i;

    const uiFiles = collectFiles(uiSourceDir);
    expect(
      uiFiles.length,
      "expected at least one Archive UI source file",
    ).toBeGreaterThan(0);

    for (const file of uiFiles) {
      const contents = readFileSync(file, "utf8");
      expect(
        shellSpecifierPattern.test(contents),
        `${file} appears to reference a Shell specifier`,
      ).toBe(false);
    }
  });
});
