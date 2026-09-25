import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

const NAV_ITEMS = [0, 1, 2, 3, 4, 5];
/** Rows per card, in section order: account, security, devices, assistant, billing, workspace. */
const CARD_ROWS = [3, 4, 2, 3, 4, 3];

/**
 * Same shape as the loaded profile (identity header, sticky index, six cards),
 * so nothing shifts when the data lands.
 */
export function ProfileSkeleton() {
  const t = useTranslations("profile");

  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[12rem_minmax(0,40rem)] lg:gap-10">
        <ul className="flex gap-1 lg:flex-col" aria-hidden="true">
          {NAV_ITEMS.map((item) => (
            <li key={item}>
              <Skeleton className="h-8 w-24 rounded-full" />
            </li>
          ))}
        </ul>

        <div className="flex max-w-[40rem] flex-col gap-6">
          {CARD_ROWS.map((rows, index) => (
            <Card key={index}>
              <CardHeader className="gap-2">
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <Skeleton className="h-4 w-64 max-w-full" />
                {Array.from({ length: rows }, (_, row) => (
                  <div key={row} className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ))}
                <Skeleton className="h-8 w-36 self-end rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
