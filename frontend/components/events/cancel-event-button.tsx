"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { cancelEventAction } from "@/lib/actions/events";
import type { EventStatus } from "@/types/api";

export function CancelEventButton({
  eventId,
  status,
}: {
  eventId: number;
  status: EventStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const disabled = status !== "PUBLISHED" || pending;

  function onConfirm() {
    startTransition(async () => {
      const result = await cancelEventAction(eventId);
      if (!result.ok) {
        toast.error(result.error.message);
        setOpen(false);
        return;
      }
      toast.success("Event cancelled.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={
          status !== "PUBLISHED" ? "Only published events can be cancelled" : undefined
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <XCircle />}
        Cancel event
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Cancel this event?"
        description="Active reservations will be voided and the event marked cancelled."
        confirmText="Yes, cancel"
        cancelText="Keep it"
        variant="destructive"
        loading={pending}
        onConfirm={onConfirm}
      />
    </>
  );
}
