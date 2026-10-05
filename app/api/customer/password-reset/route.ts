import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resetCustomerPassword } from "@/lib/customerAccounts/customerLogin";
import { sendCustomerCredentialsEmail } from "@/lib/customerAccounts/customerCredentialsEmail";
import { getClientIp } from "@/lib/customerAccounts/requestIp";

// "Forgot password" on the My order login page: a live account gets a new
// generated password by email. Always answers ok — whether the email has an
// account (or the request was rate limited) is never revealed.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";

  try {
    const reset = await resetCustomerPassword({ email, ip: getClientIp(req) });
    if (reset) {
      const order = await prisma.order.findUnique({
        where: { id: reset.orderId },
        select: { id: true, companyId: true, displayId: true, orderNumber: true, customerName: true },
      });
      if (order) await sendCustomerCredentialsEmail({ order, email: reset.email, password: reset.newPassword });
    }
  } catch (error) {
    console.error("[customer password-reset] Failed", error);
  }

  return NextResponse.json({ ok: true });
}
