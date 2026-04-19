import type { ActiveMembership } from "@/lib/auth/membership";

// ─── Re-exported from auth — single source of truth ──────────────────────────

export type Role = ActiveMembership["role"];
export type AppPermission = "BOOKING_VIEW" | "BOOKING_CREATE";

// ─── Status enums ─────────────────────────────────────────────────────────────

export type UserStatus = "ACTIVE" | "DISABLED";
export type MembershipStatus = "ACTIVE" | "DISABLED" | "INVITED";
export type PriceList = "DEFAULT" | "POWER";

// ─── Domain shapes ────────────────────────────────────────────────────────────

export type MembershipUser = {
  id: string;
  email: string;
  username: string | null;
  phoneNumber: string | null;
  address: string | null;
  description: string | null;
  status: UserStatus;
};

export type Membership = {
  id: string;
  role: Role;
  status: MembershipStatus;
  createdAt: string;
  isOnline?: boolean;
  user: MembershipUser;
  priceListId: string | null;
  permissions: { permission: AppPermission }[];
};

export type UserOption = {
  id: string;
  name: string;
  email: string;
  address?: string;
};
