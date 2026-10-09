import { NextResponse } from "next/server";
import { requireWebsiteUsersAdmin } from "@/lib/customerAccounts/requireWebsiteUsersAdmin";
import {
  changeCustomerAccountEmail,
  deleteCustomerAccount,
  findManageableCustomerAccount,
  sendNewCustomerPassword,
  setCustomerAccountPassword,
  signOutCustomerAccount,
} from "@/lib/customerAccounts/adminCustomerAccounts";

// User management → "Website users": change one "My order" login.
// PATCH { action: "setPassword", password } | { action: "sendNewPassword" }
//     | { action: "changeEmail", email } | { action: "signOut" }
// DELETE removes the login (the orders stay).

type Params = { params: Promise<{ accountId: string }> };

const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status });

async function loadAccount(req: Request, params: Params["params"]) {
  const auth = await requireWebsiteUsersAdmin(req);
  if (!auth.ok) return { ok: false, response: json({ ok: false, reason: auth.reason }, auth.status) } as const;

  const { accountId } = await params;
  const found = await findManageableCustomerAccount(auth.companyId, accountId);
  if (!found.ok) return { ok: false, response: json({ ok: false, reason: found.reason }, found.reason === "NOT_FOUND" ? 404 : 409) } as const;

  return { ok: true, auth, account: found.account } as const;
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const body = await req.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";

  const loaded = await loadAccount(req, params);
  if (!loaded.ok) return loaded.response;
  const { auth, account } = loaded;
  const actor = auth.actor;

  if (action === "setPassword" && typeof body.password === "string") {
    const result = await setCustomerAccountPassword({ account, password: body.password, actor });
    return result.ok ? json({ ok: true }) : json({ ok: false, reason: result.reason }, 422);
  }
  if (action === "sendNewPassword") {
    const result = await sendNewCustomerPassword({ account, actor });
    return result.ok ? json({ ok: true }) : json({ ok: false, reason: result.reason }, 502);
  }
  if (action === "changeEmail" && typeof body.email === "string") {
    const result = await changeCustomerAccountEmail({ account, companyId: auth.companyId, email: body.email, actor });
    if (result.ok) return json({ ok: true, email: result.email });
    return json({ ok: false, reason: result.reason }, result.reason === "EMAIL_TAKEN" ? 409 : 422);
  }
  if (action === "signOut") {
    await signOutCustomerAccount({ account, actor });
    return json({ ok: true });
  }
  return json({ ok: false, reason: "INVALID_BODY" }, 400);
}

export async function DELETE(req: Request, { params }: Params): Promise<NextResponse> {
  const loaded = await loadAccount(req, params);
  if (!loaded.ok) return loaded.response;

  await deleteCustomerAccount({ account: loaded.account, actor: loaded.auth.actor });
  return json({ ok: true });
}
