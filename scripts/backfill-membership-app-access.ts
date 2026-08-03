import "dotenv/config";
import type { AppModule } from "@prisma/client";
import { prisma } from "../lib/db";
import { computeDefaultAppAccess } from "../lib/users/appAccessDefaults";

const BATCH_SIZE = 100;

async function backfillMemberships() {
  let cursor: string | undefined;
  let scanned = 0;
  let upserted = 0;
  let failed = 0;

  for (;;) {
    const memberships = await prisma.membership.findMany({
      select: {
        id: true,
        role: true,
        permissions: { select: { permission: true } },
      },
      orderBy: { id: "asc" },
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      take: BATCH_SIZE,
    });

    if (memberships.length === 0) break;

    for (const membership of memberships) {
      scanned += 1;
      const permissions = membership.permissions.map((p) => p.permission);
      const access = computeDefaultAppAccess(membership.role, permissions);

      try {
        await Promise.all(
          (Object.keys(access) as AppModule[]).map((module) =>
            prisma.membershipAppAccess.upsert({
              where: { membershipId_module: { membershipId: membership.id, module } },
              create: {
                membershipId: membership.id,
                module,
                enabled: access[module].enabled,
                level: access[module].level,
              },
              update: {
                enabled: access[module].enabled,
                level: access[module].level,
              },
            }),
          ),
        );
        upserted += 1;
      } catch (error) {
        failed += 1;
        console.error("Membership app-access backfill failed", { membershipId: membership.id, error });
      }
    }

    cursor = memberships[memberships.length - 1]?.id;
  }

  console.log("Membership app-access backfill complete", { scanned, upserted, failed });
}

async function backfillPendingInvites() {
  let cursor: string | undefined;
  let scanned = 0;
  let upserted = 0;
  let failed = 0;

  for (;;) {
    const invites = await prisma.invite.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        role: true,
        permissions: { select: { permission: true } },
      },
      orderBy: { id: "asc" },
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      take: BATCH_SIZE,
    });

    if (invites.length === 0) break;

    for (const invite of invites) {
      scanned += 1;
      const permissions = invite.permissions.map((p) => p.permission);
      const access = computeDefaultAppAccess(invite.role, permissions);

      try {
        await Promise.all(
          (Object.keys(access) as AppModule[]).map((module) =>
            prisma.inviteAppAccess.upsert({
              where: { inviteId_module: { inviteId: invite.id, module } },
              create: {
                inviteId: invite.id,
                module,
                enabled: access[module].enabled,
                level: access[module].level,
              },
              update: {
                enabled: access[module].enabled,
                level: access[module].level,
              },
            }),
          ),
        );
        upserted += 1;
      } catch (error) {
        failed += 1;
        console.error("Invite app-access backfill failed", { inviteId: invite.id, error });
      }
    }

    cursor = invites[invites.length - 1]?.id;
  }

  console.log("Invite app-access backfill complete", { scanned, upserted, failed });
}

async function main() {
  await backfillMemberships();
  await backfillPendingInvites();
}

main()
  .catch((error) => {
    console.error("Membership app-access backfill crashed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
