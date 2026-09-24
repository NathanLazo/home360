import { Skeleton } from "~/components/ui/skeleton";

/**
 * Same silhouette as the empty chat: header actions, orb, two lines of copy,
 * three suggestion pills and the composer. No spinner (DESIGN-DIRECTIVE §7).
 */
export function AgentChatSkeleton() {
  return (
    <div
      aria-busy="true"
      className="relative flex h-[calc(100dvh-7.5rem)] min-h-[28rem] flex-col justify-center pt-16 sm:h-[calc(100dvh-8.5rem)] md:pt-24 lg:h-[calc(100dvh-9.5rem)]"
    >
      <div className="absolute top-0 right-0 flex items-center gap-2">
        <Skeleton className="h-8 w-40 rounded-md" />
        <Skeleton className="size-9 rounded-md" />
      </div>
      <div className="mx-auto mb-4 flex w-full max-w-3xl flex-col items-center gap-4 px-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-72 max-w-full" />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Skeleton className="h-7 w-44 rounded-full" />
          <Skeleton className="h-7 w-40 rounded-full" />
          <Skeleton className="h-7 w-48 rounded-full" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl pt-2">
        <Skeleton className="h-[5.5rem] w-full rounded-2xl" />
      </div>
    </div>
  );
}
