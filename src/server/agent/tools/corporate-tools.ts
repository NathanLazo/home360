import { tool } from "ai";
import { z } from "zod";

import {
  corporateInvoiceListSchema,
  corporateLocationCreateSchema,
  corporateLocationIdSchema,
  corporateLocationListSchema,
  corporateLocationUpdateSchema,
  corporateOpenDisputeSchema,
  corporateOrderIdSchema,
  corporateOrderListSchema,
  corporateOverviewSchema,
  corporateQuoteIdSchema,
  corporateRequestCreateSchema,
  corporateRequestIdSchema,
  corporateRequestListSchema,
  corporateReworkSchema,
  corporateTierChangeRequestSchema,
} from "~/server/api/schemas/corporate";
import { runTool, type AgentCaller } from "../tool-runtime";

/**
 * Corporate portal catalog. The account is always resolved by the
 * `corporate*` procedures from the session owner; nothing here accepts an
 * account id. Deletions do not exist: locations are deactivated, never removed.
 */
export function createCorporateTools(caller: AgentCaller) {
  return {
    // Account
    getAccountSettings: tool({
      description:
        "Corporate account profile: name, tier, status, commission, location cap and owner data.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.corporate.getSettings()),
    }),
    getMembership: tool({
      description:
        "Membership and billing summary: tier, monthly fee, pending tier-change request and Stripe status.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.corporate.getMembership()),
    }),
    listInvoices: tool({
      description: "Corporate membership invoices.",
      inputSchema: corporateInvoiceListSchema,
      execute: (input) => runTool(() => caller.corporate.listInvoices(input)),
    }),
    requestTierChange: tool({
      description:
        "Ask the platform to move the account to another tier. Confirm the target tier with the user first.",
      inputSchema: corporateTierChangeRequestSchema,
      execute: (input) =>
        runTool(() => caller.corporate.requestTierChange(input)),
    }),
    cancelTierChangeRequest: tool({
      description: "Cancel the pending tier-change request.",
      inputSchema: z.object({}),
      execute: () => runTool(() => caller.corporate.cancelTierChangeRequest()),
    }),

    // Spending
    getOverview: tool({
      description:
        "Monthly spend overview: total, per location, per category and order counts. `month` is YYYY-MM and defaults to the current month.",
      inputSchema: corporateOverviewSchema,
      execute: (input) => runTool(() => caller.corporate.getOverview(input)),
    }),

    // Orders
    listOrders: tool({
      description:
        "Paginated corporate orders with location and status filters.",
      inputSchema: corporateOrderListSchema,
      execute: (input) => runTool(() => caller.corporate.listOrders(input)),
    }),
    getOrder: tool({
      description:
        "Detail of one corporate order: business, worker, escrow state, evidence and timeline.",
      inputSchema: corporateOrderIdSchema,
      execute: (input) => runTool(() => caller.corporate.getOrder(input)),
    }),
    confirmDelivery: tool({
      description:
        "MONEY MOVEMENT: confirm the work was delivered so the escrow is released to the business. Requires explicit confirmation of the order in a previous turn.",
      inputSchema: corporateOrderIdSchema,
      execute: (input) =>
        runTool(() => caller.corporate.confirmDelivery(input)),
    }),
    requestRework: tool({
      description:
        "Ask the business to redo part of the work before releasing the escrow. The note explains what is wrong (10 to 1000 characters).",
      inputSchema: corporateReworkSchema,
      execute: (input) => runTool(() => caller.corporate.requestRework(input)),
    }),
    openDispute: tool({
      description:
        "Open a dispute on an order while the escrow is held. Confirm reason and description with the user first.",
      inputSchema: corporateOpenDisputeSchema,
      execute: (input) => runTool(() => caller.corporate.openDispute(input)),
    }),
    cancelOrder: tool({
      description:
        "IRREVERSIBLE: cancel an order that has not started. Only after the user confirmed the exact order in a previous turn.",
      inputSchema: corporateOrderIdSchema,
      execute: (input) => runTool(() => caller.corporate.cancelOrder(input)),
    }),

    // Locations
    listLocations: tool({
      description: "Locations of the account (optionally including inactive).",
      inputSchema: corporateLocationListSchema,
      execute: (input) => runTool(() => caller.corporate.listLocations(input)),
    }),
    createLocation: tool({
      description:
        "Create a location. Coordinates are optional but required for the request radar. The tier location cap applies.",
      inputSchema: corporateLocationCreateSchema,
      execute: (input) => runTool(() => caller.corporate.createLocation(input)),
    }),
    updateLocation: tool({
      description: "Update location fields; omitted fields are kept.",
      inputSchema: corporateLocationUpdateSchema,
      execute: (input) => runTool(() => caller.corporate.updateLocation(input)),
    }),
    deactivateLocation: tool({
      description: "Deactivate a location (it stops receiving new requests).",
      inputSchema: corporateLocationIdSchema,
      execute: (input) =>
        runTool(() => caller.corporate.deactivateLocation(input)),
    }),
    reactivateLocation: tool({
      description: "Reactivate a previously deactivated location.",
      inputSchema: corporateLocationIdSchema,
      execute: (input) =>
        runTool(() => caller.corporate.reactivateLocation(input)),
    }),

    // Requests and quotes
    listRequests: tool({
      description: "Service requests created by the account and their status.",
      inputSchema: corporateRequestListSchema,
      execute: (input) => runTool(() => caller.corporate.listRequests(input)),
    }),
    createRequest: tool({
      description:
        "Publish a service request from a location so nearby businesses can quote. Confirm category and description with the user first.",
      inputSchema: corporateRequestCreateSchema,
      execute: (input) => runTool(() => caller.corporate.createRequest(input)),
    }),
    listRequestQuotes: tool({
      description: "Quotes received for one request, with business rating.",
      inputSchema: corporateRequestIdSchema,
      execute: (input) =>
        runTool(() => caller.corporate.listRequestQuotes(input)),
    }),
    acceptQuote: tool({
      description:
        "MONEY MOVEMENT: accept a quote, which creates the order and starts the payment flow. Requires explicit confirmation of the quote and amount in a previous turn.",
      inputSchema: corporateQuoteIdSchema,
      execute: (input) => runTool(() => caller.corporate.acceptQuote(input)),
    }),
  };
}
