"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { deleteEventAction } from "@/lib/actions/events";
import type { EventStatus } from "@/types/api";

export function DeleteEventButton({
  eventId,
  status,
}: {
  eventId: number;
  status: EventStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const disabled = status !== "DRAFT" || pending;

  function onConfirm() {
    startTransition(async () => {
      const result = await deleteEventAction(eventId);
      if (!result.ok) {
        toast.error(result.error.message);
        setOpen(false);
        return;
      }
      toast.success("Event deleted.");
      setOpen(false);
      router.push("/dashboard/events");
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={status !== "DRAFT" ? "Only draft events can be deleted" : undefined}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
        Delete
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete this event?"
        description="This permanently removes the event. This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        loading={pending}
        onConfirm={onConfirm}
      />
    </>
  );
}
