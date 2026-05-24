import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type KpiCardProps = {
  title: string;
  value: React.ReactNode;
  icon: LucideIcon;
  hint?: React.ReactNode;
  className?: string;
};

export function KpiCard({
  title,
  value,
  icon: Icon,
  hint,
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "relative flex items-start gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm",
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary",
        className,
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </span>
        <span className="font-heading text-2xl font-semibold leading-tight text-foreground">
          {value}
        </span>
        {hint ? (
          <span className="mt-0.5 text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}
