import { NextResponse } from "next/server";
import { requireWebsiteUsersAdmin } from "@/lib/customerAccounts/requireWebsiteUsersAdmin";
import { listCompanyCustomerAccounts } from "@/lib/customerAccounts/adminCustomerAccounts";

// User management → "Website users": the live "My order" logins of the
// company's homepage customers (lib/customerAccounts/adminCustomerAccounts.ts).
export async function GET(req: Request) {
  const auth = await requireWebsiteUsersAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, reason: auth.reason }, { status: auth.status });

  const accounts = await listCompanyCustomerAccounts(auth.companyId);
  return NextResponse.json({ ok: true, accounts });
}
