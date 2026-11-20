import { NextResponse } from "next/server";

import { authenticateAccountingRequest } from "@/lib/integrations/accounting/authenticateAccountingRequest";
import { loadPartnerAccounts } from "@/lib/integrations/accounting/companyAccounts";

export async function GET(request: Request) {
  const authentication = authenticateAccountingRequest(request);

  if (!authentication.ok) {
    return NextResponse.json({ ok: false, reason: authentication.reason }, { status: authentication.status });
  }

  try {
    const partners = await loadPartnerAccounts(authentication.companyId);
    return NextResponse.json({ ok: true, partners });
  } catch (error) {
    console.error("Accounting partners lookup failed", { error: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ ok: false, reason: "SERVICE_UNAVAILABLE" }, { status: 503 });
  }
}
