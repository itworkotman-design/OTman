// Archive UI capability-aware action helpers — Correction Phase 6 TASK-03
// (A-UI-ACTION-001). Consumes only the real, closed `ArchiveEffectiveCapabilityMap`
// shape the public `getEffectiveCapabilities` host-adapter method already
// returns (`@customprojects/archive-service`) — no parallel authorization
// model is invented here.
//
// IMPORTANT — presentation guard only, never authoritative: these helpers
// decide whether a control is hidden, disabled, or enabled for PRESENTATION
// purposes only. Backend authorization (the host adapter's own permission
// evaluation on every mutating call) remains the sole authoritative
// enforcement boundary; a client-visible "enabled" decision here never implies
// the corresponding host-adapter call will succeed, and callers must not treat
// this module as a substitute for server-side authorization.
import type {
  ArchiveEffectiveCapabilityMap,
  ArchivePermissionAction,
} from "@customprojects/archive-service";

export type ArchiveUiCapabilityPresentation = "hidden" | "disabled" | "enabled";

export interface ArchiveUiCapabilityActionOptions {
  // When the capability is denied, hide the control entirely instead of
  // rendering it disabled. Defaults to `false` (render disabled) so a
  // caller must make an explicit choice to hide rather than disable.
  readonly hideWhenDenied?: boolean;
}

export interface ArchiveUiCapabilityActionDescriptor {
  readonly presentation: ArchiveUiCapabilityPresentation;
  readonly hidden: boolean;
  readonly disabled: boolean;
  readonly allowed: boolean;
}

// Deterministic, pure: the exact same capability map + action + options
// always yields the exact same descriptor. No host/database/network call.
export function describeArchiveUiCapabilityAction(
  capabilities: ArchiveEffectiveCapabilityMap,
  action: ArchivePermissionAction,
  options?: ArchiveUiCapabilityActionOptions,
): ArchiveUiCapabilityActionDescriptor {
  const capability = capabilities[action];
  const allowed = capability?.allowed ?? false;

  if (allowed) {
    return { presentation: "enabled", hidden: false, disabled: false, allowed: true };
  }

  const hideWhenDenied = options?.hideWhenDenied ?? false;
  if (hideWhenDenied) {
    return { presentation: "hidden", hidden: true, disabled: true, allowed: false };
  }
  return { presentation: "disabled", hidden: false, disabled: true, allowed: false };
}

// Convenience helper for a screen that needs every action's presentation
// decision at once (e.g. rendering a toolbar of capability-gated controls).
// The returned map's keys are exactly the requested actions — nothing more.
// This is an exact generic over the supplied action list `T`: the type-level
// key set (`T[number]`) always agrees with the runtime key set (one entry
// per element of `actions`, no others). Passing the full
// `ARCHIVE_PERMISSION_ACTIONS` list yields a complete map over all ten
// actions; passing a subset yields a map that only has those keys, and the
// type system will not let a caller read an unrequested key as though it
// were guaranteed present.
export function describeArchiveUiCapabilityActions<
  T extends readonly ArchivePermissionAction[],
>(
  capabilities: ArchiveEffectiveCapabilityMap,
  actions: T,
  options?: ArchiveUiCapabilityActionOptions,
): Readonly<Record<T[number], ArchiveUiCapabilityActionDescriptor>> {
  const result = {} as Record<T[number], ArchiveUiCapabilityActionDescriptor>;
  for (const action of actions) {
    result[action as T[number]] = describeArchiveUiCapabilityAction(
      capabilities,
      action,
      options,
    );
  }
  return result;
}
