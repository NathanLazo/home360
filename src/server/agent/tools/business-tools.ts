import {
  OrderStatus,
  OrderType,
  ProductStatus,
  QuoteStatus,
  ServiceStatus,
} from "@generated/prisma";
import { tool } from "ai";
import { z } from "zod";

import {
  branchCreateSchema,
  branchSetStatusSchema,
  branchUpdateSchema,
} from "~/app/[locale]/dashboard/branches/_components/branch.schema";
import {
  productAdjustStockSchema,
  productCreateSchema,
  productListSchema,
  productUpdateSchema,
} from "~/app/[locale]/dashboard/products/_components/product.schema";
import {
  serviceCreateSchema,
  serviceListSchema,
  serviceUpdateSchema,
} from "~/app/[locale]/dashboard/services/_components/service.schema";
import { planChangeSchema } from "~/lib/subscription/subscription.schemas";
import { updateBusinessProfileSchema } from "~/schemas/settings/business-settings.schema";
import {
  workerCreateSchema,
  workerResendInvitationSchema,
  workerUpdateSchema,
} from "~/schemas/team/worker.schema";
import {
  createPaymentLinkSchema,
  deactivatePaymentLinkSchema,
  listLoyaltyBonusesSchema,
  listPaymentLinksSchema,
  listTransactionsSchema,
  listWithdrawalsSchema,
  requestWithdrawalSchema,
} from "~/server/api/routers/payment.schema";
import {
  orderAssignWorkerSchema,
  orderCancelSchema,
} from "~/server/services/orders/order.schema";
import { runTool, toDate, type AgentCaller } from "../tool-runtime";

const cuid = z.string().cuid();
const cursor = cuid.optional().describe("Cursor from the previous page.");
const branchId = cuid
  .optional()
  .describe("Restrict to one branch. Omit for the whole business.");
const isoDate = z
  .string()
  .date()
  .describe("Calendar date in YYYY-MM-DD format.");

/**
 * Business (dashboard) catalog. Every tool delegates to the `business*`
 * procedures, so tenant scoping, plan limits, subscription state and the
 * impersonation read-only rule are enforced by tRPC, never here. There are no
 * delete tools on purpose.
 */
export function createBusinessTools(caller: AgentCaller) {
  return {
    // Dashboard
    getDashboardKpis: tool({
      description:
        "Executive KPIs of the business for the last N days: revenue, orders, average ticket, rating and comparison with the previous period. Start here for any performance question.",
      inputSchema: z.object({
        branchId,
        days: z.number().int().min(1).max(365).default(30),
      }),
      execute: (input) => runTool(() => caller.dashboard.getKpis(input)),
    }),
    getWeeklyRevenue: tool({
      description:
        "Revenue per week for the last N weeks (released escrow only). Use it for trends.",
      inputSchema: z.object({
        branchId,
        weeks: z.number().int().min(1).max(26).default(8),
      }),
      execute: (input) =>
        runTool(() => caller.dashboard.getWeeklyRevenue(input)),
    }),
    getOrdersByBranch: tool({
      description:
        "Order count and revenue grouped by branch for the last N days.",
      inputSchema: z.object({
        branchId,
        days: z.number().int().min(1).max(365).default(30),
      }),
      execute: (input) =>
        runTool(() => caller.dashboard.getOrdersByBranch(input)),
    }),
    getRecentOrders: tool({
      description: "Most recent orders of the business (compact rows).",
      inputSchema: z.object({
        branchId,
        limit: z.number().int().min(1).max(20).default(5),
        days: z.number().int().min(1).max(365).optional(),
      }),
      execute: (input) =>
        runTool(() => caller.dashboard.getRecentOrders(input)),
    }),
    getActiveOrdersCount: tool({
      description: "Number of orders currently in progress.",
      inputSchema: z.object({ branchId }),
      execute: (input) =>
        runTool(() => caller.dashboard.getActiveOrdersCount(input)),
    }),
    getNotifications: tool({
      description:
        "Unread business notifications: new orders, disputes, payouts and marketplace requests.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.dashboard.getNotifications()),
    }),

    // Orders
    listOrders: tool({
      description:
        "Paginated list of the business orders with filters by branch, status, type, worker, free text and creation date range.",
      inputSchema: z.object({
        branchId,
        status: z.nativeEnum(OrderStatus).optional(),
        type: z.nativeEnum(OrderType).optional(),
        workerId: cuid.optional(),
        search: z.string().trim().min(1).max(100).optional(),
        from: isoDate.optional(),
        to: isoDate.optional(),
        cursor,
      }),
      execute: ({ from, to, ...rest }) =>
        runTool(() =>
          caller.order.list({ ...rest, from: toDate(from), to: toDate(to) }),
        ),
    }),
    getOrder: tool({
      description:
        "Full detail of one order: customer, items, payment and escrow state, worker, timeline and evidence.",
      inputSchema: z.object({ id: cuid }),
      execute: (input) => runTool(() => caller.order.getById(input)),
    }),
    acceptProductOrder: tool({
      description:
        "Accept a paid PRODUCT order so it moves to preparation. Confirm the folio with the user first.",
      inputSchema: z.object({ id: cuid }),
      execute: (input) => runTool(() => caller.order.acceptProduct(input)),
    }),
    assignOrderWorker: tool({
      description:
        "Assign or reassign a worker of the business to a service order.",
      inputSchema: orderAssignWorkerSchema,
      execute: (input) => runTool(() => caller.order.assignWorker(input)),
    }),
    cancelOrder: tool({
      description:
        "IRREVERSIBLE: cancel an order and refund the customer through escrow. Only after the user confirmed the exact folio and gave a reason in a previous turn.",
      inputSchema: orderCancelSchema,
      execute: (input) => runTool(() => caller.order.cancel(input)),
    }),

    // Payments and escrow
    getBalances: tool({
      description:
        "Money position of the business: held in escrow, available to withdraw, pending withdrawals and released this month.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.payment.getBalances()),
    }),
    listTransactions: tool({
      description:
        "Paginated escrow transactions (payments) with status, method and branch filters.",
      inputSchema: listTransactionsSchema,
      execute: (input) =>
        runTool(() => caller.payment.listTransactions(input)),
    }),
    listPaymentLinks: tool({
      description: "Payment links created by the business and their status.",
      inputSchema: listPaymentLinksSchema,
      execute: (input) =>
        runTool(() => caller.payment.listPaymentLinks(input)),
    }),
    createPaymentLink: tool({
      description:
        "Create a payment link for an external customer. Amount is the provider amount in MXN cents; the platform fee is added on top. Confirm concept and amount before calling.",
      inputSchema: createPaymentLinkSchema,
      execute: (input) =>
        runTool(() => caller.payment.createPaymentLink(input)),
    }),
    deactivatePaymentLink: tool({
      description:
        "Deactivate an unpaid payment link so it can no longer be paid.",
      inputSchema: deactivatePaymentLinkSchema,
      execute: (input) =>
        runTool(() => caller.payment.deactivatePaymentLink(input)),
    }),
    listWithdrawals: tool({
      description: "Withdrawal requests of the business and their status.",
      inputSchema: listWithdrawalsSchema,
      execute: (input) =>
        runTool(() => caller.payment.listWithdrawals(input)),
    }),
    requestWithdrawal: tool({
      description:
        "MONEY MOVEMENT: request a withdrawal of available balance to a bank account. Requires explicit confirmation of the amount in a previous turn.",
      inputSchema: requestWithdrawalSchema,
      execute: (input) =>
        runTool(() => caller.payment.requestWithdrawal(input)),
    }),
    listLoyaltyBonuses: tool({
      description: "Loyalty bonuses earned by the business.",
      inputSchema: listLoyaltyBonusesSchema,
      execute: (input) =>
        runTool(() => caller.payment.listLoyaltyBonuses(input)),
    }),
    getConnectStatus: tool({
      description:
        "Stripe Connect onboarding state: whether payouts are enabled and what is pending.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.payment.getConnectStatus()),
    }),

    // Catalog: products
    listProducts: tool({
      description:
        "Paginated product catalog with search, category, status, low-stock and branch filters.",
      inputSchema: productListSchema,
      execute: (input) => runTool(() => caller.product.list(input)),
    }),
    listProductCategories: tool({
      description: "Distinct product categories used by the business.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.product.listCategories()),
    }),
    getProductStockByBranch: tool({
      description: "Stock and low-stock threshold of one product per branch.",
      inputSchema: z.object({ productId: cuid }),
      execute: (input) =>
        runTool(() => caller.product.getStockByBranch(input)),
    }),
    createProduct: tool({
      description:
        "Create a product (price in MXN cents, optional initial stock per branch). Confirm name, SKU and price when the request was ambiguous.",
      inputSchema: productCreateSchema,
      execute: (input) => runTool(() => caller.product.create(input)),
    }),
    updateProduct: tool({
      description: "Update product fields; omitted fields are kept.",
      inputSchema: productUpdateSchema,
      execute: (input) => runTool(() => caller.product.update(input)),
    }),
    adjustProductStock: tool({
      description: "Set the stock of a product per branch.",
      inputSchema: productAdjustStockSchema,
      execute: (input) => runTool(() => caller.product.adjustStock(input)),
    }),
    setProductStatus: tool({
      description: "Publish or unpublish a product (DRAFT or PUBLISHED).",
      inputSchema: z.object({
        id: cuid,
        status: z.nativeEnum(ProductStatus),
      }),
      execute: (input) => runTool(() => caller.product.setStatus(input)),
    }),

    // Catalog: services
    listServices: tool({
      description:
        "Paginated service catalog with search, category and status filters.",
      inputSchema: serviceListSchema,
      execute: (input) => runTool(() => caller.service.list(input)),
    }),
    listServiceCategories: tool({
      description: "Distinct service categories used by the business.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.service.listCategories()),
    }),
    listServiceWorkers: tool({
      description:
        "Workers that can be assigned to services (id, name, branch).",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.service.listWorkers()),
    }),
    createService: tool({
      description:
        "Create a service (base price in MXN cents, duration in minutes, assigned workers).",
      inputSchema: serviceCreateSchema,
      execute: (input) => runTool(() => caller.service.create(input)),
    }),
    updateService: tool({
      description: "Update service fields; omitted fields are kept.",
      inputSchema: serviceUpdateSchema,
      execute: (input) => runTool(() => caller.service.update(input)),
    }),
    setServiceStatus: tool({
      description: "Activate or pause a service (ACTIVE or PAUSED).",
      inputSchema: z.object({
        id: cuid,
        status: z.nativeEnum(ServiceStatus),
      }),
      execute: (input) => runTool(() => caller.service.setStatus(input)),
    }),

    // Branches
    listBranches: tool({
      description: "Branches of the business with status and coverage radius.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.branch.list()),
    }),
    createBranch: tool({
      description:
        "Create a branch. Coordinates are optional but required for the request radar. Plan limits apply.",
      inputSchema: branchCreateSchema,
      execute: (input) => runTool(() => caller.branch.create(input)),
    }),
    updateBranch: tool({
      description: "Update branch fields; omitted fields are kept.",
      inputSchema: branchUpdateSchema,
      execute: (input) => runTool(() => caller.branch.update(input)),
    }),
    setBranchStatus: tool({
      description: "Activate or pause a branch.",
      inputSchema: branchSetStatusSchema,
      execute: (input) => runTool(() => caller.branch.setStatus(input)),
    }),

    // Team
    listTeam: tool({
      description:
        "Workers of the business with branch, specialty, availability and invitation state.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.team.list()),
    }),
    createWorker: tool({
      description:
        "Add a worker and optionally email an invitation. `locale` is the language of the invitation email. Plan limits apply.",
      inputSchema: workerCreateSchema,
      execute: (input) => runTool(() => caller.team.create(input)),
    }),
    updateWorker: tool({
      description: "Update worker name, branch or specialty.",
      inputSchema: workerUpdateSchema,
      execute: (input) => runTool(() => caller.team.update(input)),
    }),
    resendWorkerInvitation: tool({
      description:
        "Resend the invitation email of a worker that has not joined yet.",
      inputSchema: workerResendInvitationSchema,
      execute: (input) => runTool(() => caller.team.resendInvitation(input)),
    }),

    // Subscription and settings
    getSubscription: tool({
      description:
        "Current plan, status, renewal date, commission and usage against plan limits.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.subscription.getCurrent()),
    }),
    listPlans: tool({
      description:
        "Available subscription plans with limits and monthly price.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.subscription.listPlans()),
    }),
    previewPlanChange: tool({
      description:
        "Preview what changing to a plan implies (proration, limits exceeded). Read-only: the actual change must be done from the subscription screen.",
      inputSchema: planChangeSchema,
      execute: (input) =>
        runTool(() => caller.subscription.previewChange(input)),
    }),
    listInvoices: tool({
      description: "Subscription invoices of the business.",
      inputSchema: z.object({ cursor }),
      execute: (input) =>
        runTool(() => caller.subscription.listInvoices(input)),
    }),
    getBusinessSettings: tool({
      description:
        "Business profile: name, type, guarantee notes and owner data.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.businessSettings.get()),
    }),
    updateBusinessProfile: tool({
      description:
        "Update business name, type or guarantee notes. All three fields are sent; read the settings first.",
      inputSchema: updateBusinessProfileSchema,
      execute: (input) =>
        runTool(() => caller.businessSettings.updateBusinessProfile(input)),
    }),

    // Marketplace: radar and quotes
    listOpenRequests: tool({
      description:
        "Service requests near an active branch that the business can quote (the radar). Excludes requests already quoted.",
      inputSchema: z.object({ branchId, cursor }),
      execute: (input) => runTool(() => caller.radar.listOpenRequests(input)),
    }),
    getOpenRequest: tool({
      description:
        "Detail of one radar request, including the AI diagnosis when available.",
      inputSchema: z.object({ id: cuid, branchId }),
      execute: (input) => runTool(() => caller.radar.getRequest(input)),
    }),
    listMyQuotes: tool({
      description: "Quotes sent by the business and their status.",
      inputSchema: z.object({
        status: z.nativeEnum(QuoteStatus).optional(),
        cursor,
      }),
      execute: (input) => runTool(() => caller.quote.listMine(input)),
    }),
    submitQuote: tool({
      description:
        "Send a quote for a radar request: price in MXN cents, scheduled date-time (ISO 8601), worker and optional message. Confirm price and date with the user before calling.",
      inputSchema: z.object({
        requestId: cuid,
        priceCents: z.number().int().positive(),
        scheduledAt: z.string().datetime({ offset: true }),
        workerId: cuid,
        message: z.string().trim().max(500).optional(),
        branchId,
      }),
      execute: ({ scheduledAt, ...rest }) =>
        runTool(() =>
          caller.quote.submit({ ...rest, scheduledAt: new Date(scheduledAt) }),
        ),
    }),
    withdrawQuote: tool({
      description: "Withdraw a pending quote.",
      inputSchema: z.object({ id: cuid }),
      execute: (input) => runTool(() => caller.quote.withdraw(input)),
    }),

    // Disputes
    getDisputeForOrder: tool({
      description:
        "Dispute opened by a customer on one of the business orders.",
      inputSchema: z.object({ orderId: cuid }),
      execute: (input) => runTool(() => caller.dispute.getForBusiness(input)),
    }),
    respondToDispute: tool({
      description:
        "Send the business argument (20 to 2000 characters) and evidence URLs for a dispute. Confirm the text with the user first.",
      inputSchema: z.object({
        orderId: cuid,
        argument: z.string().trim().min(20).max(2_000),
        evidenceUrls: z
          .array(z.string().trim().min(1).max(500))
          .max(10)
          .default([]),
      }),
      execute: (input) => runTool(() => caller.dispute.respond(input)),
    }),
  };
}
