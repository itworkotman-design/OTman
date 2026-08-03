import React from "react";
import type { AppModule, Role } from "@/lib/users/types";
import { defaultAppAccessRows } from "@/lib/users/appAccessDefaults";

export type { Role };

export type UserProvisionMode = "DIRECT_PASSWORD" | "INVITE";

export type AppAccessFormRow = {
  module: AppModule;
  enabled: boolean;
  level: "VIEWER" | "ADMIN";
};

export interface UserFormData {
  username: string;
  email: string;
  warehouseEmail: string;
  phoneNumber: string;
  address: string;
  role: string;
  active: boolean;
  description: string;
  logoPath: string | null;
  logoFile: File | null;
  usernameDisplayColor: string;
  priceListIds: string[];
  appAccess: AppAccessFormRow[];
  provisionMode: UserProvisionMode;
  password: string;
  confirmPassword: string;
}

export interface UserModalProps {
  isOpen: boolean;
  formResetKey: string;
  onClose: () => void;
  onSave: (data: UserFormData) => void | Promise<void>;
  onToggleActive: () => void | Promise<void>;
  initialValueUsername: string;
  initialValueEmail: string;
  initialValueWarehouseEmail?: string;
  initialValuePhoneNumber: string;
  initialValueAddress: string;
  initialValueDescription: string;
  initialValueLogoPath?: string | null;
  initialValueUsernameDisplayColor?: string | null;
  initialValueRole: string;
  initialValueActive: boolean;
  initialValueAppAccess?: AppAccessFormRow[];
  actorRole: Role;
  targetRole: Role;
  priceLists?: { id: string; name: string }[];
  initialPriceListIds?: string[];
}

export type UserFormSource = Pick<
  UserModalProps,
  | "initialValueUsername"
  | "initialValueEmail"
  | "initialValueWarehouseEmail"
  | "initialValuePhoneNumber"
  | "initialValueAddress"
  | "initialValueDescription"
  | "initialValueLogoPath"
  | "initialValueUsernameDisplayColor"
  | "initialValueRole"
  | "initialValueActive"
  | "initialValueAppAccess"
  | "initialPriceListIds"
>;

export function buildInitialForm(source: UserFormSource): UserFormData {
  const role = (source.initialValueRole || "USER") as Role;

  return {
    username: source.initialValueUsername ?? "",
    email: source.initialValueEmail ?? "",
    warehouseEmail: source.initialValueWarehouseEmail ?? "",
    phoneNumber: source.initialValuePhoneNumber ?? "",
    address: source.initialValueAddress ?? "",
    description: source.initialValueDescription ?? "",
    logoPath: source.initialValueLogoPath ?? null,
    logoFile: null,
    usernameDisplayColor: source.initialValueUsernameDisplayColor ?? "",
    role,
    active: source.initialValueActive,
    priceListIds: source.initialPriceListIds ?? [],
    appAccess:
      source.initialValueAppAccess && source.initialValueAppAccess.length > 0
        ? source.initialValueAppAccess
        : defaultAppAccessRows(role, []),
    provisionMode: "DIRECT_PASSWORD",
    password: "",
    confirmPassword: "",
  };
}

export function getPermissions(
  actorRole: Role,
  targetRole: Role,
  isCreateMode: boolean,
) {
  const isActorOwner = actorRole === "OWNER";
  const isActorAdmin = actorRole === "ADMIN";
  const isTargetOwner = targetRole === "OWNER";

  const canEditTarget =
    isCreateMode || isActorOwner || (isActorAdmin && targetRole === "USER");

  const canToggleActive =
    !isCreateMode &&
    ((isActorOwner && !isTargetOwner) ||
      (isActorAdmin && targetRole === "USER"));

  return { isActorOwner, isActorAdmin, canEditTarget, canToggleActive };
}

export function getSaveButtonLabel(
  isCreateMode: boolean,
  canEditTarget: boolean,
  provisionMode: UserProvisionMode,
) {
  if (isCreateMode) {
    return provisionMode === "INVITE" ? "Send Invite" : "Create User";
  }
  if (!canEditTarget) return "You cannot edit this user";
  return "Save Changes";
}

export function makeFieldUpdater(
  key:
    | "username"
    | "email"
    | "warehouseEmail"
    | "phoneNumber"
    | "description"
    | "password"
    | "confirmPassword",
  setForm: React.Dispatch<React.SetStateAction<UserFormData>>,
) {
  return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
}

export function makeSelectUpdater(
  key: "role" | "provisionMode",
  setForm: React.Dispatch<React.SetStateAction<UserFormData>>,
) {
  return (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
}

export function togglePriceListId(
  priceListId: string,
  setForm: React.Dispatch<React.SetStateAction<UserFormData>>,
) {
  setForm((prev) => ({
    ...prev,
    priceListIds: prev.priceListIds.includes(priceListId)
      ? prev.priceListIds.filter((id) => id !== priceListId)
      : [...prev.priceListIds, priceListId],
  }));
}

export function updateAppAccessModule(
  module: AppModule,
  patch: Partial<Pick<AppAccessFormRow, "enabled" | "level">>,
  setForm: React.Dispatch<React.SetStateAction<UserFormData>>,
) {
  setForm((prev) => ({
    ...prev,
    appAccess: prev.appAccess.map((row) =>
      row.module === module ? { ...row, ...patch } : row,
    ),
  }));
}
