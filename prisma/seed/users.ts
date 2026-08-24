import { UserRole } from "../../generated/prisma";
import type { Prisma, PrismaClient, User } from "../../generated/prisma";
import { hashPassword } from "../../src/server/services/auth/password";

type SeedUserDefinition = {
  id: string;
  email: string;
  name: string;
  role: Prisma.UserUncheckedCreateInput["role"];
  locale: "es" | "en";
  password?: string;
};

export type SeededUsers = {
  admin: User;
  garciaOwner: User;
  voltaOwner: User;
  climaOwner: User;
  customers: readonly [User, User, User, User, User];
};

const userData: readonly SeedUserDefinition[] = [
  {
    id: "seed-user-admin",
    email: "admin@home360.mx",
    name: "Administración Home360",
    role: UserRole.ADMIN,
    locale: "es",
    password: "Home360!admin",
  },
  {
    id: "seed-user-owner-garcia",
    email: "garcia@plomeriagarcia.mx",
    name: "Roberto García",
    role: UserRole.BUSINESS,
    locale: "es",
    password: "Home360!demo",
  },
  {
    id: "seed-user-owner-volta",
    email: "contacto@electricavolta.mx",
    name: "Mariana Vázquez",
    role: UserRole.BUSINESS,
    locale: "es",
    password: "Home360!demo",
  },
  {
    id: "seed-user-owner-clima",
    email: "contacto@climanorte.mx",
    name: "Sergio Núñez",
    role: UserRole.BUSINESS,
    locale: "es",
    password: "Home360!demo",
  },
  {
    id: "seed-user-customer-01",
    email: "ana.lopez@example.com",
    name: "Ana López",
    role: UserRole.CUSTOMER,
    locale: "es",
  },
  {
    id: "seed-user-customer-02",
    email: "carlos.mendoza@example.com",
    name: "Carlos Mendoza",
    role: UserRole.CUSTOMER,
    locale: "es",
  },
  {
    id: "seed-user-customer-03",
    email: "lucia.ortiz@example.com",
    name: "Lucía Ortiz",
    role: UserRole.CUSTOMER,
    locale: "es",
  },
  {
    id: "seed-user-customer-04",
    email: "miguel.torres@example.com",
    name: "Miguel Torres",
    role: UserRole.CUSTOMER,
    locale: "es",
  },
  {
    id: "seed-user-customer-05",
    email: "sofia.ramos@example.com",
    name: "Sofía Ramos",
    role: UserRole.CUSTOMER,
    // One en customer so localized flows have a non-default case to test.
    locale: "en",
  },
];

export async function seedUsers(prisma: PrismaClient): Promise<SeededUsers> {
  const users = await Promise.all(
    userData.map(async ({ id, email, name, role, locale, password }) => {
      const passwordHash = password ? await hashPassword(password) : null;

      return prisma.user.upsert({
        where: { email },
        create: { id, email, name, role, locale, passwordHash },
        update: { name, role, locale, passwordHash },
      });
    }),
  );

  const [
    admin,
    garciaOwner,
    voltaOwner,
    climaOwner,
    customerOne,
    customerTwo,
    customerThree,
    customerFour,
    customerFive,
  ] = users;

  if (
    !admin ||
    !garciaOwner ||
    !voltaOwner ||
    !climaOwner ||
    !customerOne ||
    !customerTwo ||
    !customerThree ||
    !customerFour ||
    !customerFive
  ) {
    throw new Error("Seed users could not be created");
  }

  return {
    admin,
    garciaOwner,
    voltaOwner,
    climaOwner,
    customers: [
      customerOne,
      customerTwo,
      customerThree,
      customerFour,
      customerFive,
    ],
  };
}
