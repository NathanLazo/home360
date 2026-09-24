/**
 * Database seed.
 *
 * Creates (or updates) the platform ADMIN user so the admin panel can be
 * accessed right after a fresh migration. The password is hashed with the
 * same bcrypt service used by the app, so the Credentials provider accepts it.
 *
 * Run with `pnpm db:seed`. Idempotent: re-running keeps a single row.
 */
import { PrismaClient } from "@generated/prisma";
import { hashPassword } from "../src/server/services/auth/password";

const ADMIN_USER = {
  email: "yericko47@hotmail.com",
  password: "Password123",
  name: "Admin HOME360",
} as const;

const db = new PrismaClient();

async function seedAdminUser(): Promise<void> {
  const passwordHash = await hashPassword(ADMIN_USER.password);

  const user = await db.user.upsert({
    where: { email: ADMIN_USER.email },
    create: {
      email: ADMIN_USER.email,
      name: ADMIN_USER.name,
      role: "ADMIN",
      passwordHash,
      emailVerified: new Date(),
      locale: "es",
    },
    update: {
      role: "ADMIN",
      passwordHash,
      emailVerified: new Date(),
      suspendedAt: null,
      suspensionReason: null,
    },
    select: { id: true, email: true, role: true },
  });

  console.log(`Seeded ${user.role} user ${user.email} (${user.id})`);
}

async function main(): Promise<void> {
  await seedAdminUser();
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
