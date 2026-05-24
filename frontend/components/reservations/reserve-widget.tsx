"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, Ticket } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reserveAction } from "@/lib/actions/reservations";
import type { EventResponse, UserResponse } from "@/types/api";

function formatPrice(price: string): string {
  const n = Number(price);
  if (!Number.isFinite(n) || n === 0) return "Free";
  return `$${n.toFixed(2)}`;
}

export function ReserveWidget({
  event,
  me,
}: {
  event: EventResponse;
  me: UserResponse | null;
}) {
  const router = useRouter();
  const seatsLeft = Math.max(0, event.capacity - event.seatsTaken);
  const maxQty = Math.min(20, seatsLeft);

  const [quantity, setQuantity] = useState<number>(1);
  const [pending, startTransition] = useTransition();

  const startInPast = useMemo(() => {
    try {
      return new Date(event.startAt).getTime() <= Date.now();
    } catch {
      return true;
    }
  }, [event.startAt]);

  const notPublished = event.status !== "PUBLISHED";
  const soldOut = seatsLeft <= 0;
  const isSignedIn = me !== null;

  let blockedReason: string | null = null;
  if (event.status === "CANCELLED") blockedReason = "This event has been cancelled.";
  else if (event.status === "DRAFT") blockedReason = "This event isn't open for reservations yet.";
  else if (startInPast) blockedReason = "This event has already started.";
  else if (soldOut) blockedReason = "Sold out.";

  const disabled = notPublished || soldOut || startInPast || pending || !isSignedIn;

  function onReserve() {
    startTransition(async () => {
      const result = await reserveAction(event.id, { quantity });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(
        quantity === 1 ? "Reserved 1 seat." : `Reserved ${quantity} seats.`,
      );
      router.refresh();
    });
  }

  const quantityOptions = Array.from(
    { length: Math.max(1, maxQty) },
    (_, i) => i + 1,
  );

  return (
    <aside className="sticky top-20 flex w-full flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <span className="font-heading text-2xl font-semibold tabular-nums text-foreground">
          {formatPrice(event.price)}
        </span>
        <span
          className={
            soldOut
              ? "text-sm font-medium text-destructive"
              : "text-sm text-muted-foreground tabular-nums"
          }
        >
          {soldOut
            ? "Sold out"
            : `${seatsLeft.toLocaleString()} / ${event.capacity.toLocaleString()} seats left`}
        </span>
      </div>

      {!isSignedIn ? (
        <Button
          size="lg"
          className="w-full"
          render={
            <Link href={`/login?next=/events/${event.id}`}>
              <LogIn />
              Sign in to reserve
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Quantity
            </label>
            <Select
              value={String(quantity)}
              onValueChange={(value) => {
                const n = Number.parseInt(String(value), 10);
                if (Number.isFinite(n)) setQuantity(n);
              }}
              disabled={disabled && !pending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select quantity" />
              </SelectTrigger>
              <SelectContent>
                {quantityOptions.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} {n === 1 ? "seat" : "seats"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={onReserve}
            disabled={disabled}
          >
            {pending ? <Loader2 className="animate-spin" /> : <Ticket />}
            {pending ? "Reserving…" : "Reserve"}
          </Button>

          {blockedReason ? (
            <p className="text-center text-xs text-muted-foreground">
              {blockedReason}
            </p>
          ) : null}
        </>
      )}
    </aside>
  );
}
