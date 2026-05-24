"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { publishEventAction } from "@/lib/actions/events";
import type { EventStatus } from "@/types/api";

export function PublishButton({
  eventId,
  status,
}: {
  eventId: number;
  status: EventStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const disabled = status !== "DRAFT" || pending;

  function onConfirm() {
    startTransition(async () => {
      const result = await publishEventAction(eventId);
      if (!result.ok) {
        toast.error(result.error.message);
        setOpen(false);
        return;
      }
      toast.success("Event published.");
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
        title={status !== "DRAFT" ? "Only draft events can be published" : undefined}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Send />}
        Publish
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Publish this event?"
        description="It will become visible to everyone and open for reservations. Most fields will lock after publishing."
        confirmText="Publish"
        loading={pending}
        onConfirm={onConfirm}
      />
    </>
  );
}
