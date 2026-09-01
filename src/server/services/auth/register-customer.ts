import {
  Prisma,
  UserRole,
  type PrismaClient,
} from "@generated/prisma";
import type { AuthErrorCode } from "~/schemas/auth/auth-errors";
import type { CustomerRegisterInput } from "~/server/api/schemas/customer-register.schema";
import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import { hashPassword } from "~/server/services/auth/password";

/**
 * Registers a CUSTOMER user with an empty `CustomerProfile` (M1-W1). Customers
 * are born in the mobile app; the app logs in afterwards through the mobile
 * auth endpoint, so only `{ id }` is returned here. Same shape as
 * `registerBusiness`: the email unique constraint answers `EMAIL_TAKEN`
 * (M3-W0 unified both registrations on the domain's de facto code) and the
 * password reuses the shared bcrypt service.
 */
export const registerCustomer = async (
  db: PrismaClient,
  input: CustomerRegisterInput,
): Promise<TrpcResponse<{ id: string }, AuthErrorCode>> => {
  try {
    const passwordHash = await hashPassword(input.password);
    const user = await db.user.create({
      data: {
        name: input.name,
        email: input.email,
        role: UserRole.CUSTOMER,
        locale: input.locale,
        passwordHash,
        customerProfile: {
          create: {},
        },
      },
      select: { id: true },
    });

    return ok({ id: user.id }, "Customer registered", 201);
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return fail("EMAIL_TAKEN", 409, "Email already registered");
    }

    const { code, status } = normalizeError(error);
    return fail(code, status, "Customer registration failed");
  }
};
