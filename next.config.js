/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import createNextIntlPlugin from "next-intl/plugin";

/** @type {import("next").NextConfig} */
const config = {
  // `pnpm check` runs the type-aware ESLint CLI. Next's deprecated embedded
  // runner cannot resolve Resend's `.d.mts` declarations consistently.
  eslint: { ignoreDuringBuilds: true },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(config);
