import { PrismaClient } from "../generated/prisma";
import { seedBusinesses } from "./seed/businesses";
import { seedCatalog } from "./seed/catalog";
import { seedCorporate } from "./seed/corporate";
import { seedMarketplace } from "./seed/marketplace";
import { seedOrders } from "./seed/orders";
import { seedPayments } from "./seed/payments";
import { seedPlans } from "./seed/plans";
import { seedUsers } from "./seed/users";

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    const [plans, users] = await Promise.all([
      seedPlans(prisma),
      seedUsers(prisma),
    ]);
    const businesses = await seedBusinesses(prisma, {
      users,
      standardPlan: plans.standard,
    });

    const catalog = await seedCatalog(prisma, businesses);
    const marketplace = await seedMarketplace(prisma, {
      users,
      businesses,
    });
    const orders = await seedOrders(prisma, {
      users,
      businesses,
      catalog,
      marketplace,
    });

    await seedPayments(prisma, { businesses, orders, plans });
    await seedCorporate(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  void error;
  console.error("Seed failed");
  process.exitCode = 1;
});
