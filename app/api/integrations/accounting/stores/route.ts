import { NextResponse } from "next/server";

import { authenticateAccountingRequest } from "@/lib/integrations/accounting/authenticateAccountingRequest";
import { loadStoreAccounts } from "@/lib/integrations/accounting/companyAccounts";

export async function GET(request: Request) {
  const authentication = authenticateAccountingRequest(request);

  if (!authentication.ok) {
    return NextResponse.json({ ok: false, reason: authentication.reason }, { status: authentication.status });
  }

  try {
    const stores = await loadStoreAccounts(authentication.companyId);
    return NextResponse.json({ ok: true, stores });
  } catch (error) {
    console.error("Accounting stores lookup failed", { error: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ ok: false, reason: "SERVICE_UNAVAILABLE" }, { status: 503 });
  }
}
