import { adminDisputesRouter } from "~/server/api/routers/admin/disputes";
import { adminFinanceRouter } from "~/server/api/routers/admin/finance";
import { adminOverviewRouter } from "~/server/api/routers/admin/overview";
import { adminSettingsRouter } from "~/server/api/routers/admin/settings";
import { adminUsersRouter } from "~/server/api/routers/admin/users";
import { createTRPCRouter } from "~/server/api/trpc";

/**
 * Aggregator for every `admin.*` namespace. Sub-routers are registered here in
 * ticket order (overview → users → disputes → finance → settings) so this file
 * stays the single serial merge point of F5.
 */
export const adminRouter = createTRPCRouter({
  disputes: adminDisputesRouter,
  finance: adminFinanceRouter,
  overview: adminOverviewRouter,
  settings: adminSettingsRouter,
  users: adminUsersRouter,
});
