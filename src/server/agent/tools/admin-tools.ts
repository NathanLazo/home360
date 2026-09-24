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
  approveBusinessSchema,
  getBusinessDetailSchema,
  getCustomerDetailSchema,
  listUsersSchema,
  reactivateBusinessSchema,
  reactivateUserSchema,
  rejectBusinessSchema,
  reopenBusinessReviewSchema,
  reviewDocumentSchema,
  suspendBusinessSchema,
  suspendUserSchema,
} from "~/app/[locale]/admin/users/_components/users.schema";
import { runTool, type AgentCaller } from "../tool-runtime";

/**
 * Platform admin catalog. Every write is already audited by the admin
 * services (`writeAdminAudit`). Impersonation, platform settings, campaigns
 * and CSV exports are intentionally excluded: they stay in the UI.
 */
export function createAdminTools(caller: AgentCaller) {
  return {
    // Overview
    getPlatformKpis: tool({
      description:
        "Platform KPIs for a month (YYYY-MM, defaults to the current one): GMV, commissions, active businesses, orders and disputes. Start here for any performance question.",
      inputSchema: overviewKpisSchema,
      execute: (input) => runTool(() => caller.admin.overview.getKpis(input)),
    }),
    getSidebarStats: tool({
      description: "Live counters: open disputes and businesses awaiting review.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.admin.overview.getSidebarStats()),
    }),
    getPendingBusinesses: tool({
      description: "Businesses waiting for approval, with submitted documents.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.admin.overview.getPendingBusinesses()),
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
      inputSchema: reviewDocumentSchema,
      execute: (input) =>
        runTool(() => caller.admin.users.reviewDocument(input)),
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
      description: "Tier catalog with default commission, fee and location cap.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.admin.corporate.listTiers()),
    }),
    listAccountManagers: tool({
      description: "Admins that can be assigned as corporate account managers.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.admin.corporate.listAccountManagers()),
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
      description: "Push campaigns sent so far with audience and recipient count.",
      inputSchema: listCampaignsSchema,
      execute: (input) =>
        runTool(() => caller.admin.settings.listCampaigns(input)),
    }),
  };
}
