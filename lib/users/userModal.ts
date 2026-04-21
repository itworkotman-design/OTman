import React from "react";
import type { Role, AppPermission } from "@/lib/users/types";

export type { Role, AppPermission };

export type UserProvisionMode = "DIRECT_PASSWORD" | "INVITE";

export interface UserFormData {
  username: string;
  email: string;
  phoneNumber: string;
  address: string;
  role: string;
  active: boolean;
  description: string;
  logoPath: string | null;
  logoFile: File | null;
  usernameDisplayColor: string;
  priceListId: string | null;
  permissions: AppPermission[];
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
  initialValuePhoneNumber: string;
  initialValueAddress: string;
  initialValueDescription: string;
  initialValueLogoPath?: string | null;
  initialValueUsernameDisplayColor?: string | null;
  initialValueRole: string;
  initialValueActive: boolean;
  initialValuePermissions?: AppPermission[];
  actorRole: Role;
  targetRole: Role;
  priceLists?: { id: string; name: string }[];
  initialPriceListId?: string | null;
}

export type UserFormSource = Pick<
  UserModalProps,
  | "initialValueUsername"
  | "initialValueEmail"
  | "initialValuePhoneNumber"
  | "initialValueAddress"
  | "initialValueDescription"
  | "initialValueLogoPath"
  | "initialValueUsernameDisplayColor"
  | "initialValueRole"
  | "initialValueActive"
  | "initialValuePermissions"
  | "initialPriceListId"
>;

export function buildInitialForm(source: UserFormSource): UserFormData {
  return {
    username: source.initialValueUsername ?? "",
    email: source.initialValueEmail ?? "",
    phoneNumber: source.initialValuePhoneNumber ?? "",
    address: source.initialValueAddress ?? "",
    description: source.initialValueDescription ?? "",
    logoPath: source.initialValueLogoPath ?? null,
    logoFile: null,
    usernameDisplayColor: source.initialValueUsernameDisplayColor ?? "",
    role: source.initialValueRole || "USER",
    active: source.initialValueActive,
    priceListId: source.initialPriceListId ?? null,
    permissions: source.initialValuePermissions ?? ["BOOKING_VIEW"],
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
  key: "role" | "priceListId" | "provisionMode",
  setForm: React.Dispatch<React.SetStateAction<UserFormData>>,
) {
  return (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm((prev) => ({
      ...prev,
      [key]: key === "priceListId" ? e.target.value || null : e.target.value,
    }));
}

export type UserAccessType = "SUBCONTRACTOR" | "ORDER_CREATOR";

export function getAccessTypeFromPermissions(
  permissions: AppPermission[],
): UserAccessType {
  return permissions.includes("BOOKING_CREATE")
    ? "ORDER_CREATOR"
    : "SUBCONTRACTOR";
}

export function getPermissionsFromAccessType(
  accessType: UserAccessType,
): AppPermission[] {
  return accessType === "ORDER_CREATOR"
    ? ["BOOKING_VIEW", "BOOKING_CREATE"]
    : ["BOOKING_VIEW"];
}
