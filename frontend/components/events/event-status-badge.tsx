import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EventStatus } from "@/types/api";

const labels: Record<EventStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  CANCELLED: "Cancelled",
};

const variants: Record<EventStatus, "default" | "secondary" | "outline"> = {
  DRAFT: "secondary",
  PUBLISHED: "default",
  CANCELLED: "outline",
};

export function EventStatusBadge({
  status,
  className,
}: {
  status: EventStatus;
  className?: string;
}) {
  return (
    <Badge
      variant={variants[status]}
      className={cn(
        status === "CANCELLED" && "text-muted-foreground line-through",
        className,
      )}
    >
      {labels[status]}
    </Badge>
  );
}
