import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedSession } from "@/lib/auth/session";
import { getModuleAccess } from "@/lib/users/access";
import { ensureCustomerAccountForOrder } from "@/lib/customerAccounts/ensureCustomerAccount";
import { sendCustomerCredentialsEmail } from "@/lib/customerAccounts/customerCredentialsEmail";
import { createOrderActionEvent } from "@/lib/orders/orderEvents";

// "Send new login" in the admin WebsiteOrderModal: gives the order's customer
// a fresh "My order" password by email. Recreates the account when it was
// already deleted (e.g. a no-show calling back days later), and moves the
// order to the account of its current email when staff corrected it. Same
// access as the website-order editor: company owner/admin, or Website orders
// at ADMIN level.

type Params = { params: Promise<{ orderId: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await getAuthenticatedSession(req);
  if (!session) return NextResponse.json({ ok: false, reason: "UNAUTHORIZED" }, { status: 401 });
  if (!session.activeCompanyId) return NextResponse.json({ ok: false, reason: "TENANT_SELECTION_REQUIRED" }, { status: 409 });
  const companyId = session.activeCompanyId;

  const membership = await prisma.membership.findFirst({
    where: { userId: session.userId, companyId, status: "ACTIVE" },
    select: { id: true, role: true, appAccess: true, user: { select: { username: true, email: true } } },
  });
  const websiteOrders = membership ? getModuleAccess(membership, "WEBSITE_ORDERS") : null;
  const canEdit =
    !!membership &&
    (membership.role === "OWNER" || membership.role === "ADMIN" || (!!websiteOrders?.enabled && websiteOrders.level === "ADMIN"));
  if (!membership || !canEdit) return NextResponse.json({ ok: false, reason: "FORBIDDEN" }, { status: 403 });

  const { orderId } = await params;
  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId, isWebsiteOrder: true },
    select: { id: true, companyId: true, displayId: true, orderNumber: true, customerName: true, email: true },
  });
  if (!order) return NextResponse.json({ ok: false, reason: "NOT_FOUND" }, { status: 404 });

  const account = await ensureCustomerAccountForOrder({ orderId: order.id, email: order.email, forceNewPassword: true });
  if (!account?.newPassword) return NextResponse.json({ ok: false, reason: "MISSING_CUSTOMER_EMAIL" }, { status: 409 });

  await createOrderActionEvent(prisma, {
    orderId: order.id,
    companyId,
    actor: { membershipId: membership.id, name: membership.user?.username ?? null, email: membership.user?.email ?? null, source: "USER" },
    title: "Sent the customer a new My order login",
    details: [`Recipient: ${account.email}`],
  });

  const sent = await sendCustomerCredentialsEmail({
    order: { id: order.id, companyId: order.companyId, displayId: order.displayId, orderNumber: order.orderNumber, customerName: order.customerName },
    email: account.email,
    password: account.newPassword,
  });
  if (!sent) return NextResponse.json({ ok: false, reason: "EMAIL_FAILED" }, { status: 502 });

  return NextResponse.json({ ok: true, email: account.email });
}
