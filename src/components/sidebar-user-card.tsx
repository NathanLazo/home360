import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";

export type SidebarUserCardProps = {
  name: string;
  subtitle?: string;
  initials: string;
  variant: "light" | "dark";
};

export function SidebarUserCard({
  name,
  subtitle,
  initials,
  variant,
}: SidebarUserCardProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-lg border p-3",
        variant === "light"
          ? "border-zinc-200 bg-zinc-50"
          : "border-zinc-800 bg-zinc-900",
      )}
    >
      <Avatar size="lg">
        <AvatarFallback
          className={cn(variant === "dark" && "bg-zinc-800 text-zinc-200")}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        {subtitle ? (
          <p
            className={cn(
              "truncate text-xs",
              variant === "light" ? "text-zinc-500" : "text-zinc-400",
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
