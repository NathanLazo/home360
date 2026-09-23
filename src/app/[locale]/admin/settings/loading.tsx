import { PageHeaderSkeleton } from "../_components/page-header-skeleton";
import { SettingsSkeleton } from "./_components/settings-skeleton";

export default function AdminSettingsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <PageHeaderSkeleton />
      <SettingsSkeleton />
    </div>
  );
}
