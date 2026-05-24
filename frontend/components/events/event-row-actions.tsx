"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  cancelEventAction,
  deleteEventAction,
  publishEventAction,
} from "@/lib/actions/events";

type EventRowActionsProps = {
  eventId: number;
  eventTitle: string;
};

type DialogKind = null | "publish" | "cancel" | "delete";

export function EventRowActions({ eventId, eventTitle }: EventRowActionsProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [pending, startTransition] = useTransition();

  function runPublish() {
    startTransition(async () => {
      const result = await publishEventAction(eventId);
      if (!result.ok) {
        toast.error(result.error.message);
        setDialog(null);
        return;
      }
      toast.success("Event published.");
      setDialog(null);
      router.refresh();
    });
  }

  function runCancel() {
    startTransition(async () => {
      const result = await cancelEventAction(eventId);
      if (!result.ok) {
        toast.error(result.error.message);
        setDialog(null);
        return;
      }
      toast.success("Event cancelled.");
      setDialog(null);
      router.refresh();
    });
  }

  function runDelete() {
    startTransition(async () => {
      const result = await deleteEventAction(eventId);
      if (!result.ok) {
        toast.error(result.error.message);
        setDialog(null);
        return;
      }
      toast.success("Event deleted.");
      setDialog(null);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Event actions"
              disabled={pending}
            >
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            render={
              <Link href={`/events/${eventId}`}>
                <Eye />
                View
              </Link>
            }
          />
          <DropdownMenuItem
            render={
              <Link href={`/dashboard/events/${eventId}/edit`}>
                <Pencil />
                Edit
              </Link>
            }
          />
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialog("publish")}>
            <Send />
            Publish
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("cancel")}>
            <XCircle />
            Cancel event
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDialog("delete")}
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={dialog === "publish"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Publish this event?"
        description={`"${eventTitle}" will become visible to everyone and open for reservations.`}
        confirmText="Publish"
        loading={pending}
        onConfirm={runPublish}
      />
      <ConfirmDialog
        open={dialog === "cancel"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Cancel this event?"
        description={`"${eventTitle}" will be marked cancelled. Active reservations will be voided.`}
        confirmText="Yes, cancel"
        cancelText="Keep it"
        variant="destructive"
        loading={pending}
        onConfirm={runCancel}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Delete this event?"
        description={`"${eventTitle}" will be permanently deleted. This can't be undone.`}
        confirmText="Delete"
        variant="destructive"
        loading={pending}
        onConfirm={runDelete}
      />
    </>
  );
}
