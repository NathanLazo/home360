import "server-only";

import type { PrismaClient } from "../../../../generated/prisma";

export async function assertBranchInBusiness(
  db: PrismaClient,
  businessId: string,
  branchId: string,
): Promise<boolean> {
  const branches = await db.branch.count({
    where: { id: branchId, businessId },
  });

  return branches > 0;
}
