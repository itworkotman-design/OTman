import { prisma } from "@/lib/db";

// Mirrors the "ADMIN" booking view mode (lib/orders/archiveAccess.ts):
// subcontractors and order creators must not see or set the shift leader.
export async function canAccessShiftLeader(userId: string, companyId: string): Promise<boolean> {
  const membership = await prisma.membership.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { role: true, status: true },
  });

  return (
    membership?.status === "ACTIVE" &&
    (membership.role === "OWNER" || membership.role === "ADMIN")
  );
}
