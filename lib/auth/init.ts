import { registerBrevoPasswordResetDelivery } from "@/lib/auth/passwordResetBrevo";

let initialized = false;

export function initAuth() {
  if (initialized) return;
  initialized = true;

  registerBrevoPasswordResetDelivery();
}