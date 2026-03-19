import { URL } from "url";

type InviteDeliveryParams = {
  email: string;
  token: string;
};

type InviteDeliveryAdapterParams = {
  email: string;
  inviteUrl: string;
};

export type InviteDeliveryAdapter = (
  params: InviteDeliveryAdapterParams
) => Promise<void>;

let inviteDeliveryAdapter: InviteDeliveryAdapter | null = null;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function registerInviteDeliveryAdapter(
  adapter: InviteDeliveryAdapter
): void {
  inviteDeliveryAdapter = adapter;
}

export function clearInviteDeliveryAdapter(): void {
  inviteDeliveryAdapter = null;
}

export function buildInviteUrl(token: string): string {
  const baseUrl = process.env.INVITE_BASE_URL;

  if (!baseUrl) {
    throw new Error("INVITE_BASE_URL is not configured");
  }

  const url = new URL(baseUrl);
  url.searchParams.set("token", token);

  return url.toString();
}

export async function deliverInvite(
  params: InviteDeliveryParams
): Promise<void> {
  const baseUrl = process.env.INVITE_BASE_URL;

  if (inviteDeliveryAdapter) {
    if (!baseUrl) {
      throw new Error("INVITE_BASE_URL is not configured");
    }

    const inviteUrl = buildInviteUrl(params.token);

    await inviteDeliveryAdapter({
      email: params.email,
      inviteUrl,
    });

    return;
  }

  if (!isProduction()) {
    if (baseUrl) {
      const inviteUrl = buildInviteUrl(params.token);
      console.log(`[auth] Invite link for ${params.email}: ${inviteUrl}`);
    } else {
      console.log(
        `[auth] Invite token for ${params.email}: ${params.token}`
      );
    }

    return;
  }

  throw new Error(
    "Invite delivery adapter is not configured in production"
  );
}
