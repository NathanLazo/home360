import { z } from "zod";

/**
 * tRPC 11 injects `direction` into every `useInfiniteQuery` / `prefetchInfinite`
 * input next to `cursor`, so `.strict()` cursor schemas must accept it.
 */
export const infiniteQueryDirectionSchema = z
  .enum(["forward", "backward"])
  .optional();
