import { adminCorporateRouter } from "~/server/api/routers/admin/corporate";
import { adminDisputesRouter } from "~/server/api/routers/admin/disputes";
import { adminFinanceRouter } from "~/server/api/routers/admin/finance";
import { adminImpersonationRouter } from "~/server/api/routers/admin/impersonation";
import { adminOverviewRouter } from "~/server/api/routers/admin/overview";
import { adminSettingsRouter } from "~/server/api/routers/admin/settings";
import { adminUsersRouter } from "~/server/api/routers/admin/users";
import { createTRPCRouter } from "~/server/api/trpc";

/**
 * Aggregator for every `admin.*` namespace. Sub-routers are registered here in
 * ticket order (overview → users → disputes → finance → settings → corporate)
 * so this file stays the single serial merge point of F5/F7.
 */
export const adminRouter = createTRPCRouter({
  corporate: adminCorporateRouter,
  disputes: adminDisputesRouter,
  finance: adminFinanceRouter,
  impersonation: adminImpersonationRouter,
  overview: adminOverviewRouter,
  settings: adminSettingsRouter,
  users: adminUsersRouter,
});
