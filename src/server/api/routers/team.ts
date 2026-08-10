import { env } from "~/env";
import {
  workerCreateSchema,
  workerIdSchema,
  workerResendInvitationSchema,
  workerUpdateSchema,
} from "~/schemas/team/worker.schema";
import { fail, normalizeError } from "~/server/api/contract";
import {
  activeBusinessProcedure,
  businessProcedure,
  createTRPCRouter,
} from "~/server/api/trpc";
import { createResendEmailClientFromApiKey } from "~/server/services/email/email-client";
import {
  createWorker,
  deleteWorker,
  listWorkers,
  resendWorkerInvitation,
  updateWorker,
} from "~/server/services/team/worker-team";

// The adapter is built once and injected; services never import `resend`.
const workerInvitationEmailClient =
  env.RESEND_API_KEY && env.EMAIL_FROM
    ? createResendEmailClientFromApiKey(env.RESEND_API_KEY, env.EMAIL_FROM)
    : null;

function teamFailure(error: unknown) {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, "Team operation failed");
}

export const teamRouter = createTRPCRouter({
  list: businessProcedure.query(async ({ ctx }) => {
    try {
      return await listWorkers(ctx.db, ctx.business);
    } catch (error: unknown) {
      return teamFailure(error);
    }
  }),

  create: activeBusinessProcedure
    .input(workerCreateSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createWorker(
          ctx.db,
          ctx.business,
          workerInvitationEmailClient,
          input,
        );
      } catch (error: unknown) {
        return teamFailure(error);
      }
    }),

  update: activeBusinessProcedure
    .input(workerUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateWorker(ctx.db, ctx.business.id, input);
      } catch (error: unknown) {
        return teamFailure(error);
      }
    }),

  delete: activeBusinessProcedure
    .input(workerIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await deleteWorker(ctx.db, ctx.business.id, input.id);
      } catch (error: unknown) {
        return teamFailure(error);
      }
    }),

  resendInvitation: activeBusinessProcedure
    .input(workerResendInvitationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await resendWorkerInvitation(
          ctx.db,
          ctx.business.id,
          workerInvitationEmailClient,
          input,
        );
      } catch (error: unknown) {
        return teamFailure(error);
      }
    }),
});
