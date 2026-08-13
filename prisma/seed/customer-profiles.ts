import type {
  Address,
  CustomerProfile,
  Prisma,
  PrismaClient,
} from "../../generated/prisma";
import type { SeededUsers } from "./users";

export type SeededCustomerProfiles = {
  profile: CustomerProfile;
  addresses: readonly [Address, Address];
};

type SeedCustomerProfilesInput = {
  users: SeededUsers;
};

export async function seedCustomerProfiles(
  prisma: PrismaClient,
  { users }: SeedCustomerProfilesInput,
): Promise<SeededCustomerProfiles> {
  const [customer] = users.customers;

  const profileData = {
    id: "seed-customer-profile-01",
    userId: customer.id,
    stripeCustomerId: null,
    defaultPaymentMethodId: null,
  } satisfies Prisma.CustomerProfileUncheckedCreateInput;

  const addressData = [
    {
      id: "seed-address-customer-01-home",
      userId: customer.id,
      label: "Casa",
      addressLine: "Av. Insurgentes Sur 1234, Col. Del Valle, CDMX",
      latitude: 19.3854,
      longitude: -99.1712,
      isDefault: true,
    },
    {
      id: "seed-address-customer-01-office",
      userId: customer.id,
      label: "Oficina",
      addressLine: "Paseo de la Reforma 222, Col. Juárez, CDMX",
      latitude: 19.4284,
      longitude: -99.1616,
      isDefault: false,
    },
  ] satisfies readonly Prisma.AddressUncheckedCreateInput[];

  const profile = await prisma.customerProfile.upsert({
    where: { userId: profileData.userId },
    create: profileData,
    update: {
      stripeCustomerId: profileData.stripeCustomerId,
      defaultPaymentMethodId: profileData.defaultPaymentMethodId,
    },
  });

  const seededAddresses = await Promise.all(
    addressData.map(({ id, ...values }) =>
      prisma.address.upsert({
        where: { id },
        create: { id, ...values },
        update: values,
      }),
    ),
  );

  const [home, office] = seededAddresses;
  if (!home || !office) {
    throw new Error("Seed addresses could not be created");
  }

  return { profile, addresses: [home, office] };
}
