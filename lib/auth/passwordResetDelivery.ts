import { URL } from "url";

type PasswordResetDeliveryParams = {
  email: string;
  token: string;
};

type PasswordResetDeliveryAdapterParams = {
  email: string;
  resetUrl: string;
};

export type PasswordResetDeliveryAdapter = (
  params: PasswordResetDeliveryAdapterParams
) => Promise<void>;

let passwordResetDeliveryAdapter: PasswordResetDeliveryAdapter | null = null;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function registerPasswordResetDeliveryAdapter(
  adapter: PasswordResetDeliveryAdapter
): void {
  passwordResetDeliveryAdapter = adapter;
}

export function clearPasswordResetDeliveryAdapter(): void {
  passwordResetDeliveryAdapter = null;
}

export function buildPasswordResetUrl(token: string): string {
  const baseUrl = process.env.PASSWORD_RESET_BASE_URL;

  if (!baseUrl) {
    throw new Error("PASSWORD_RESET_BASE_URL is not configured");
  }

  const url = new URL(baseUrl);
  url.searchParams.set("token", token);

  return url.toString();
}

export async function deliverPasswordReset(params: PasswordResetDeliveryParams): Promise<void> {
  const baseUrl = process.env.PASSWORD_RESET_BASE_URL;

  if (passwordResetDeliveryAdapter) {
    if (!baseUrl) {
      throw new Error("PASSWORD_RESET_BASE_URL is not configured");
    }

    const resetUrl = buildPasswordResetUrl(params.token);

    await passwordResetDeliveryAdapter({
      email: params.email,
      resetUrl,
    });

    return;
  }

  if (!isProduction()) {
    if (baseUrl) {
      const resetUrl = buildPasswordResetUrl(params.token);
      console.log(`[auth] Password reset link for ${params.email}: ${resetUrl}`);
    } else {
      console.log(
        `[auth] Password reset token for ${params.email}: ${params.token}`
      );
    }

    return;
  }

  throw new Error(
    "Password reset delivery adapter is not configured in production"
  );
}

