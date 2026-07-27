import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Correction Phase 6 TASK-02. Companion to
// `archive-ui-package-surface.test.tsx`'s existing Shell-specifier check
// (which already scans this same production source tree). This file adds
// the complementary check the card's scope item 6 also requires: no Archive
// UI production file may import an Archive INTERNAL implementation module —
// only the public Archive root/self-referenced package surface
// (`@customprojects/archive-service`, no deep subpath) or a local, in-tree
// relative Archive UI file. A relative import that resolves outside
// `src/archive-ui/` would both reach an internal implementation module and
// violate `tsconfig.ui.build.json`'s `rootDir: "src/archive-ui"` — this test
// proves the source-level import-specifier discipline directly, independent
// of whether a build has run.

const here = dirname(fileURLToPath(import.meta.url));
// src/archive-ui/__tests__ -> src/archive-ui -> src -> repo root
const repoRoot = resolve(here, "..", "..", "..");
const uiSourceDir = join(repoRoot, "src", "archive-ui");

const IMPORT_SPECIFIER_PATTERN =
  /(?:import|export)(?:[^'";]*?)from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/gm;

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function extractSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const clean = stripComments(source);
  IMPORT_SPECIFIER_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMPORT_SPECIFIER_PATTERN.exec(clean)) !== null) {
    const specifier = match[1] ?? match[2];
    if (specifier) specifiers.push(specifier);
  }
  return specifiers;
}

function collectProductionFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    // Product source only — this file and its siblings under __tests__
    // legitimately reference the self-referenced package name in fixtures.
    if (entry.isDirectory() && entry.name === "__tests__") return [];
    const fullPath = join(dir, entry.name);
    return entry.isDirectory() ? collectProductionFiles(fullPath) : [fullPath];
  });
}

function resolveRelativeSpecifier(fromFile: string, specifier: string): string {
  const target = resolve(dirname(fromFile), specifier);
  if (target.endsWith(".js")) {
    const tsxCandidate = `${target.slice(0, -3)}.tsx`;
    if (existsSync(tsxCandidate)) return tsxCandidate;
    const tsCandidate = `${target.slice(0, -3)}.ts`;
    if (existsSync(tsCandidate)) return tsCandidate;
  }
  if (existsSync(target)) return target;
  throw new Error(`Cannot resolve relative import "${specifier}" from ${fromFile}`);
}

describe("Archive UI production source boundary (Correction Phase 6 TASK-02)", () => {
  it("every relative import in Archive UI production source resolves inside src/archive-ui/", () => {
    const files = collectProductionFiles(uiSourceDir);
    expect(files.length, "expected at least one Archive UI production file").toBeGreaterThan(0);

    const escapes: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const specifier of extractSpecifiers(source)) {
        if (!specifier.startsWith(".")) continue;
        const resolved = resolveRelativeSpecifier(file, specifier);
        const rel = relative(uiSourceDir, resolved);
        if (rel.startsWith("..")) {
          escapes.push(`${file} -> "${specifier}" (resolves to ${resolved})`);
        }
      }
    }

    expect(
      escapes,
      `relative imports escaping src/archive-ui/ (forbidden — internal Archive implementation module or rootDir violation): ${escapes.join(", ")}`,
    ).toEqual([]);
  });

  it("every non-relative import in Archive UI production source is exactly the public self-referenced package name, never a deep internal subpath", () => {
    const files = collectProductionFiles(uiSourceDir);

    const deepOrForeignImports: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const specifier of extractSpecifiers(source)) {
        if (specifier.startsWith(".")) continue;
        if (specifier === "@customprojects/archive-service") continue;
        if (specifier === "react") continue; // permitted future peer dep; none used by TASK-02's type-only files
        deepOrForeignImports.push(`${file} -> "${specifier}"`);
      }
    }

    expect(
      deepOrForeignImports,
      `non-relative imports must be exactly "@customprojects/archive-service" (the public root surface), never a deep/internal subpath or a foreign package: ${deepOrForeignImports.join(", ")}`,
    ).toEqual([]);
  });
});
