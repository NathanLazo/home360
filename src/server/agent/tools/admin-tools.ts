import { tool } from "ai";
import { z } from "zod";

import { overviewKpisSchema } from "~/app/[locale]/admin/_components/overview.schema";
import {
  activateCorporateAccountSchema,
  createCorporateAccountSchema,
  getCorporateAccountSchema,
  listCorporateAccountsSchema,
  reactivateCorporateAccountSchema,
  rejectTierChangeSchema,
  suspendCorporateAccountSchema,
  updateCorporateTermsSchema,
} from "~/app/[locale]/admin/corporate/_components/corporate.schema";
import {
  getDisputeSchema,
  listDisputesSchema,
  requestDisputeEvidenceSchema,
  resolveDisputeSchema,
} from "~/app/[locale]/admin/disputes/_components/disputes.schema";
import {
  approveWithdrawalSchema,
  cancelLoyaltyBonusSchema,
  financeKpisSchema,
  listLoyaltyBonusesSchema,
  listWithdrawalsSchema,
  payLoyaltyBonusSchema,
  rejectWithdrawalSchema,
  revenueBreakdownSchema,
} from "~/app/[locale]/admin/finance/_components/finance.schema";
import { listCampaignsSchema } from "~/app/[locale]/admin/settings/_components/campaigns.schema";
import {
  adminListBusinessTransactionsSchema,
  getBusinessFinanceSchema,
  getWithdrawalSchema,
} from "~/schemas/admin/business-finance.schema";
import {
  getPayoutReceiptUrlSchema,
  listPayoutReceiptsSchema,
  PAYOUT_RECEIPT_CONTENT_TYPES,
  PAYOUT_RECEIPT_MAX_FILES,
  type PayoutReceiptContentType,
} from "~/schemas/admin/payout-receipt.schema";
import {
  approveBusinessSchema,
  getBusinessDetailSchema,
  getCustomerDetailSchema,
  listUsersSchema,
  reactivateBusinessSchema,
  reactivateUserSchema,
  rejectBusinessSchema,
  moderationReasonSchema,
  reopenBusinessReviewSchema,
  type ReviewDocumentInput,
  suspendBusinessSchema,
  suspendUserSchema,
} from "~/app/[locale]/admin/users/_components/users.schema";
import { recordIdSchema } from "~/schemas/record-id.schema";
import type { AgentAttachmentStore } from "../agent-attachments";
import {
  runTool,
  type AgentCaller,
  type AgentToolFailure,
} from "../tool-runtime";

const registerPaymentReceiptsSchema = z.object({
  withdrawalId: recordIdSchema
    .optional()
    .describe("Withdrawal the receipts prove; exclusive with loyaltyBonusId"),
  loyaltyBonusId: recordIdSchema
    .optional()
    .describe("Loyalty bonus the receipts prove; exclusive with withdrawalId"),
  filenames: z
    .array(z.string().trim().min(1).max(200))
    .min(1)
    .max(PAYOUT_RECEIPT_MAX_FILES)
    .describe("Exact filenames of attachments in this conversation"),
  notes: z.string().trim().max(500).optional(),
});

/**
 * Flat mirror of `reviewDocumentSchema`: that one is a discriminated union,
 * which serializes to a root `anyOf` that providers reject as a tool input
 * (the whole turn fails, not just this tool). The "rejection needs notes"
 * rule is re-checked in `execute` and again by the procedure.
 */
const reviewBusinessDocumentSchema = z.object({
  documentId: recordIdSchema,
  status: z.enum(["APPROVED", "REJECTED"]),
  notes: moderationReasonSchema
    .optional()
    .describe("5 to 500 characters; required when status is REJECTED"),
});

function toReviewDocumentInput(
  input: z.infer<typeof reviewBusinessDocumentSchema>,
): ReviewDocumentInput | null {
  if (input.status === "APPROVED") {
    return {
      documentId: input.documentId,
      status: "APPROVED",
      notes: input.notes,
    };
  }

  return input.notes
    ? { documentId: input.documentId, status: "REJECTED", notes: input.notes }
    : null;
}

function isReceiptContentType(
  value: string,
): value is PayoutReceiptContentType {
  return (PAYOUT_RECEIPT_CONTENT_TYPES as readonly string[]).includes(value);
}

function attachmentFailure(
  missing: string[],
  available: string[],
): AgentToolFailure {
  return {
    result: null,
    error: "ATTACHMENT_NOT_FOUND",
    status: 404,
    message: `No attachment named: ${missing.join(", ")}. Available in this conversation: ${
      available.length > 0 ? available.join(", ") : "none"
    }. Ask the user to attach the receipt files.`,
  };
}

/**
 * Platform admin catalog. Every write is already audited by the admin
 * services (`writeAdminAudit`). Impersonation, platform settings, campaigns
 * and CSV exports are intentionally excluded: they stay in the UI.
 *
 * `attachments` are the files the admin attached in the chat, keyed by
 * filename; only the receipt tools read them, and their base64 body never
 * enters the model context.
 */
export function createAdminTools(
  caller: AgentCaller,
  attachments: AgentAttachmentStore,
) {
  return {
    // Overview
    getPlatformKpis: tool({
      description:
        "Platform KPIs for a month (YYYY-MM, defaults to the current one): GMV, commissions, active businesses, orders and disputes. Start here for any performance question.",
      inputSchema: overviewKpisSchema,
      execute: (input) => runTool(() => caller.admin.overview.getKpis(input)),
    }),
    getSidebarStats: tool({
      description:
        "Live counters: open disputes and businesses awaiting review.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.admin.overview.getSidebarStats()),
    }),
    getPendingBusinesses: tool({
      description: "Businesses waiting for approval, with submitted documents.",
      inputSchema: z.object({}),
      execute: () =>
        runTool(() => caller.admin.overview.getPendingBusinesses()),
    }),
    getOpenDisputes: tool({
      description: "Disputes that are open or in review, newest first.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.admin.overview.getOpenDisputes()),
    }),
    getAiConfigSummary: tool({
      description:
        "Current AI diagnosis settings: confidence threshold, price margin and pricing model version.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.admin.overview.getAiConfigSummary()),
    }),

    // Accounts and moderation
    listUsers: tool({
      description:
        "Paginated directory by tab (businesses, customers or workers) with search and status filters.",
      inputSchema: listUsersSchema,
      execute: (input) => runTool(() => caller.admin.users.list(input)),
    }),
    getBusinessDetail: tool({
      description:
        "Full business file: owner, plan, branches, documents, orders summary and moderation history.",
      inputSchema: getBusinessDetailSchema,
      execute: (input) =>
        runTool(() => caller.admin.users.getBusinessDetail(input)),
    }),
    getCustomerDetail: tool({
      description: "Customer or worker file with orders and access status.",
      inputSchema: getCustomerDetailSchema,
      execute: (input) =>
        runTool(() => caller.admin.users.getCustomerDetail(input)),
    }),
    listApprovalPlans: tool({
      description: "Plans available when approving a business.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.admin.users.listApprovalPlans()),
    }),
    approveBusiness: tool({
      description:
        "Approve a pending business on a plan (this creates its subscription). Confirm business and plan with the user first.",
      inputSchema: approveBusinessSchema,
      execute: (input) =>
        runTool(() => caller.admin.users.approveBusiness(input)),
    }),
    rejectBusiness: tool({
      description:
        "Reject a pending business with a reason (5 to 500 characters). Confirm with the user first.",
      inputSchema: rejectBusinessSchema,
      execute: (input) =>
        runTool(() => caller.admin.users.rejectBusiness(input)),
    }),
    suspendBusiness: tool({
      description:
        "Suspend an active business with a reason. It stops receiving orders. Confirm with the user first.",
      inputSchema: suspendBusinessSchema,
      execute: (input) =>
        runTool(() => caller.admin.users.suspendBusiness(input)),
    }),
    reactivateBusiness: tool({
      description: "Reactivate a suspended business.",
      inputSchema: reactivateBusinessSchema,
      execute: (input) =>
        runTool(() => caller.admin.users.reactivateBusiness(input)),
    }),
    reopenBusinessReview: tool({
      description: "Move a rejected business back to pending review.",
      inputSchema: reopenBusinessReviewSchema,
      execute: (input) =>
        runTool(() => caller.admin.users.reopenBusinessReview(input)),
    }),
    reviewBusinessDocument: tool({
      description:
        "Approve or reject one uploaded business document. Rejection requires notes.",
      inputSchema: reviewBusinessDocumentSchema,
      execute: (input) => {
        const review = toReviewDocumentInput(input);

        if (!review) {
          return Promise.resolve({
            result: null,
            error: "NOTES_REQUIRED",
            status: 400,
            message:
              "Rejecting a document requires notes (5 to 500 characters) explaining what to upload again.",
          } satisfies AgentToolFailure);
        }

        return runTool(() => caller.admin.users.reviewDocument(review));
      },
    }),
    suspendUser: tool({
      description:
        "Suspend a customer or worker account with a reason (revokes sessions). Confirm with the user first.",
      inputSchema: suspendUserSchema,
      execute: (input) => runTool(() => caller.admin.users.suspendUser(input)),
    }),
    reactivateUser: tool({
      description: "Reactivate a suspended customer or worker account.",
      inputSchema: reactivateUserSchema,
      execute: (input) =>
        runTool(() => caller.admin.users.reactivateUser(input)),
    }),

    // Disputes
    listDisputes: tool({
      description:
        "Paginated disputes with status (open, in_review, resolved, all), urgency and search filters.",
      inputSchema: listDisputesSchema,
      execute: (input) => runTool(() => caller.admin.disputes.list(input)),
    }),
    getDispute: tool({
      description:
        "Full dispute file: order, both arguments, evidence, escrow amounts and AI summary.",
      inputSchema: getDisputeSchema,
      execute: (input) => runTool(() => caller.admin.disputes.getById(input)),
    }),
    generateDisputeSummary: tool({
      description:
        "Generate (or refresh) the AI summary of a dispute from its arguments and evidence metadata.",
      inputSchema: getDisputeSchema,
      execute: (input) =>
        runTool(() => caller.admin.disputes.generateSummary(input)),
    }),
    requestDisputeEvidence: tool({
      description:
        "Ask both parties for more evidence with a note (10 to 1000 characters).",
      inputSchema: requestDisputeEvidenceSchema,
      execute: (input) =>
        runTool(() => caller.admin.disputes.requestEvidence(input)),
    }),
    resolveDispute: tool({
      description:
        "MONEY MOVEMENT AND IRREVERSIBLE: resolve a dispute (refund, release or split) with refund amounts in MXN cents and a justification. Only after the user confirmed resolution and amounts in a previous turn.",
      inputSchema: resolveDisputeSchema,
      execute: (input) => runTool(() => caller.admin.disputes.resolve(input)),
    }),

    // Finance
    getFinanceKpis: tool({
      description:
        "Finance KPIs for a month: escrow held, released, commissions, refunds and pending withdrawals.",
      inputSchema: financeKpisSchema,
      execute: (input) => runTool(() => caller.admin.finance.getKpis(input)),
    }),
    getRevenueBreakdown: tool({
      description: "Commission revenue per month for the last N months.",
      inputSchema: revenueBreakdownSchema,
      execute: (input) =>
        runTool(() => caller.admin.finance.getRevenueBreakdown(input)),
    }),
    listWithdrawals: tool({
      description:
        "Withdrawal requests: `view: pending` for the approval queue, `view: history` with status and date filters.",
      inputSchema: listWithdrawalsSchema,
      execute: (input) =>
        runTool(() => caller.admin.finance.listWithdrawals(input)),
    }),
    approveWithdrawal: tool({
      description:
        "MONEY MOVEMENT: approve a pending withdrawal (Stripe transfer to the business). Requires explicit confirmation of the withdrawal in a previous turn.",
      inputSchema: approveWithdrawalSchema,
      execute: (input) =>
        runTool(() => caller.admin.finance.approveWithdrawal(input)),
    }),
    rejectWithdrawal: tool({
      description:
        "Reject a pending withdrawal with a reason; the balance returns to the business.",
      inputSchema: rejectWithdrawalSchema,
      execute: (input) =>
        runTool(() => caller.admin.finance.rejectWithdrawal(input)),
    }),
    getBusinessFinance: tool({
      description:
        "Full financial file of one business: available balance (what the platform owes it), escrow held, month sales and commission, Stripe payout readiness, pending withdrawal requests with bank and last-4 destination, and its last approved payout. Start here for 'how is this business doing' or 'how much do we owe them'.",
      inputSchema: getBusinessFinanceSchema,
      execute: (input) =>
        runTool(() => caller.admin.finance.getBusinessFinance(input)),
    }),
    getWithdrawal: tool({
      description:
        "One withdrawal request in full: amount, destination bank account (name and last 4 digits), Stripe payout account and payout id, status, business payout readiness and the payment receipts already registered against it.",
      inputSchema: getWithdrawalSchema,
      execute: (input) =>
        runTool(() => caller.admin.finance.getWithdrawal(input)),
    }),
    listBusinessSales: tool({
      description:
        "Paginated sales ledger (payments) of one business, newest first, with status and method filters: gross, provider net, commission, refunds and escrow release dates per payment.",
      inputSchema: adminListBusinessTransactionsSchema,
      execute: (input) =>
        runTool(() => caller.admin.finance.listBusinessTransactions(input)),
    }),
    listLoyaltyBonuses: tool({
      description: "Loyalty bonuses per business with status filter.",
      inputSchema: listLoyaltyBonusesSchema,
      execute: (input) =>
        runTool(() => caller.admin.finance.listLoyaltyBonuses(input)),
    }),
    payLoyaltyBonus: tool({
      description:
        "MONEY MOVEMENT: mark a loyalty bonus as paid with the payout method. Confirm with the user first.",
      inputSchema: payLoyaltyBonusSchema,
      execute: (input) =>
        runTool(() => caller.admin.finance.payLoyaltyBonus(input)),
    }),
    cancelLoyaltyBonus: tool({
      description: "Cancel a pending loyalty bonus with a reason.",
      inputSchema: cancelLoyaltyBonusSchema,
      execute: (input) =>
        runTool(() => caller.admin.finance.cancelLoyaltyBonus(input)),
    }),

    // Payment receipts
    listChatAttachments: tool({
      description:
        "Files the admin attached in this conversation (name, type, size). Use it to pick the exact filenames before registering payment receipts.",
      inputSchema: z.object({}),
      execute: () =>
        runTool(() =>
          Promise.resolve({
            result: {
              attachments: [...attachments.values()].map(
                ({ filename, mediaType, sizeBytes }) => ({
                  filename,
                  mediaType,
                  sizeBytes,
                }),
              ),
            },
            error: null,
            status: 200,
            message: "Conversation attachments listed",
          }),
        ),
    }),
    registerPaymentReceipts: tool({
      description:
        "Register payment receipt files (JPEG, PNG, WebP or PDF) attached in this conversation as proof of a transfer, against exactly one withdrawal or loyalty bonus. Pass the exact attachment filenames. Files are stored privately and linked to the payout; the action is audited. Confirm target and files with the user first.",
      inputSchema: registerPaymentReceiptsSchema,
      execute: (input) => {
        const missing = input.filenames.filter(
          (filename) => !attachments.has(filename),
        );

        if (missing.length > 0) {
          return Promise.resolve(
            attachmentFailure(missing, [...attachments.keys()]),
          );
        }

        const files: Array<{
          filename: string;
          contentType: PayoutReceiptContentType;
          dataBase64: string;
        }> = [];
        const unsupported: string[] = [];

        for (const filename of input.filenames) {
          const attachment = attachments.get(filename);

          if (!attachment) {
            continue;
          }

          if (isReceiptContentType(attachment.mediaType)) {
            files.push({
              filename: attachment.filename,
              contentType: attachment.mediaType,
              dataBase64: attachment.dataBase64,
            });
          } else {
            unsupported.push(filename);
          }
        }

        if (unsupported.length > 0) {
          return Promise.resolve({
            result: null,
            error: "UNSUPPORTED_RECEIPT_TYPE",
            status: 400,
            message: `Only JPEG, PNG, WebP and PDF receipts are accepted. Rejected: ${unsupported.join(", ")}.`,
          } satisfies AgentToolFailure);
        }

        return runTool(() =>
          caller.admin.finance.registerPayoutReceipts({
            withdrawalId: input.withdrawalId,
            loyaltyBonusId: input.loyaltyBonusId,
            notes: input.notes,
            files,
          }),
        );
      },
    }),
    listPaymentReceipts: tool({
      description:
        "Registered payment receipts, newest first, filterable by withdrawal, loyalty bonus or business.",
      inputSchema: listPayoutReceiptsSchema,
      execute: (input) =>
        runTool(() => caller.admin.finance.listPayoutReceipts(input)),
    }),
    getReceiptDownloadUrl: tool({
      description:
        "Short-lived signed download URL for one registered payment receipt.",
      inputSchema: getPayoutReceiptUrlSchema,
      execute: (input) =>
        runTool(() => caller.admin.finance.getPayoutReceiptUrl(input)),
    }),

    // Corporate accounts
    listCorporateAccounts: tool({
      description:
        "Paginated corporate accounts with status, tier and search filters.",
      inputSchema: listCorporateAccountsSchema,
      execute: (input) => runTool(() => caller.admin.corporate.list(input)),
    }),
    getCorporateAccount: tool({
      description:
        "Corporate account file: terms, locations, spend, invoices and pending tier-change request.",
      inputSchema: getCorporateAccountSchema,
      execute: (input) => runTool(() => caller.admin.corporate.getById(input)),
    }),
    listCorporateTiers: tool({
      description:
        "Tier catalog with default commission, fee and location cap.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.admin.corporate.listTiers()),
    }),
    listAccountManagers: tool({
      description: "Admins that can be assigned as corporate account managers.",
      inputSchema: z.object({}),
      execute: () =>
        runTool(() => caller.admin.corporate.listAccountManagers()),
    }),
    createCorporateAccount: tool({
      description:
        "Create a corporate account and invite its owner by email (`locale` is the email language). Confirm name, owner email and tier first.",
      inputSchema: createCorporateAccountSchema,
      execute: (input) => runTool(() => caller.admin.corporate.create(input)),
    }),
    activateCorporateAccount: tool({
      description: "Activate a pending corporate account (starts billing).",
      inputSchema: activateCorporateAccountSchema,
      execute: (input) => runTool(() => caller.admin.corporate.activate(input)),
    }),
    updateCorporateTerms: tool({
      description:
        "Update tier, commission, monthly fee, location cap and account manager. All fields are sent; read the account first. Pass `requestId` when approving a tier-change request.",
      inputSchema: updateCorporateTermsSchema,
      execute: (input) =>
        runTool(() => caller.admin.corporate.updateTerms(input)),
    }),
    suspendCorporateAccount: tool({
      description: "Suspend a corporate account with a reason. Confirm first.",
      inputSchema: suspendCorporateAccountSchema,
      execute: (input) => runTool(() => caller.admin.corporate.suspend(input)),
    }),
    reactivateCorporateAccount: tool({
      description: "Reactivate a suspended corporate account.",
      inputSchema: reactivateCorporateAccountSchema,
      execute: (input) =>
        runTool(() => caller.admin.corporate.reactivate(input)),
    }),
    rejectTierChange: tool({
      description: "Reject a pending tier-change request with a reason.",
      inputSchema: rejectTierChangeSchema,
      execute: (input) =>
        runTool(() => caller.admin.corporate.rejectTierChange(input)),
    }),

    // Settings (read-only)
    getPlatformSettings: tool({
      description:
        "Platform settings: commissions per plan, escrow release window, AI thresholds and notification delays. Read-only: changes are made from the settings screen.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.admin.settings.get()),
    }),
    listCampaigns: tool({
      description:
        "Push campaigns sent so far with audience and recipient count.",
      inputSchema: listCampaignsSchema,
      execute: (input) =>
        runTool(() => caller.admin.settings.listCampaigns(input)),
    }),
  };
}
