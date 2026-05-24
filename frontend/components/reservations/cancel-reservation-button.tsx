"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { cancelReservationAction } from "@/lib/actions/reservations";

type CancelReservationButtonProps = {
  reservationId: number;
  eventId: number;
  eventTitle: string;
};

export function CancelReservationButton({
  reservationId,
  eventId,
  eventTitle,
}: CancelReservationButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const result = await cancelReservationAction(reservationId, eventId);
      if (!result.ok) {
        toast.error(result.error.message);
        setOpen(false);
        return;
      }
      toast.success("Reservation cancelled.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={pending}
      >
        {pending ? <Loader2 className="animate-spin" /> : <X />}
        Cancel
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Cancel reservation?"
        description={`Cancel your reservation for "${eventTitle}"? You'll lose your seat(s); cancellation may be blocked close to the event start.`}
        confirmText="Yes, cancel"
        cancelText="Keep it"
        variant="destructive"
        loading={pending}
        onConfirm={onConfirm}
      />
    </>
  );
}
