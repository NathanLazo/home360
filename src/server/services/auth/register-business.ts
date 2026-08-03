import {
  BusinessStatus,
  Prisma,
  UserRole,
  type PrismaClient,
} from "../../../../generated/prisma";
import type { AuthErrorCode } from "~/schemas/auth/auth-errors";
import type { RegisterBusinessInput } from "~/schemas/auth/register-business.schema";
import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import { hashPassword } from "~/server/services/auth/password";

export const registerBusiness = async (
  db: PrismaClient,
  input: RegisterBusinessInput,
): Promise<TrpcResponse<{ userId: string }, AuthErrorCode>> => {
  try {
    const passwordHash = await hashPassword(input.password);
    const user = await db.user.create({
      data: {
        name: input.ownerName,
        email: input.email,
        role: UserRole.BUSINESS,
        passwordHash,
        business: {
          create: {
            name: input.businessName,
            type: input.businessType,
            status: BusinessStatus.PENDING,
            guaranteeType: input.guaranteeType,
            guaranteeNotes: input.guaranteeNotes ?? null,
          },
        },
      },
      select: { id: true },
    });

    return ok(
      { userId: user.id },
      "Business registered, pending approval",
      201,
    );
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return fail("EMAIL_TAKEN", 409, "Email already registered");
    }

    const { code, status } = normalizeError(error);
    return fail(code, status, "Business registration failed");
  }
};
