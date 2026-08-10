import type { RouterOutputs } from "~/trpc/react";

type SettingsOutput = RouterOutputs["admin"]["settings"];

export type PlatformSettingsResult = NonNullable<
  SettingsOutput["get"]["result"]
>;
