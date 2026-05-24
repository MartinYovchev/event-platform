"use client";

import { useMemo, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createEventAction, updateEventAction } from "@/lib/actions/events";
import {
  createEventSchema,
  updateEventSchema,
  type CreateEventInput,
  type UpdateEventInput,
} from "@/lib/schemas";
import type {
  CreateEventRequest,
  EventResponse,
  EventStatus,
  UpdateEventRequest,
} from "@/types/api";

type EventFormProps =
  | { mode: "create"; initial?: undefined; status?: undefined }
  | { mode: "edit"; initial: EventResponse; status: EventStatus };

type Editability = {
  title: boolean;
  description: boolean;
  location: boolean;
  startAt: boolean;
  endAt: boolean;
  capacity: boolean;
  price: boolean;
  coverImageUrl: boolean;
  cancellationCutoffHours: boolean;
};

function editabilityFor(
  mode: "create" | "edit",
  status: EventStatus | undefined,
): Editability {
  if (mode === "create") {
    return {
      title: true,
      description: true,
      location: true,
      startAt: true,
      endAt: true,
      capacity: true,
      price: true,
      coverImageUrl: true,
      cancellationCutoffHours: true,
    };
  }
  if (status === "CANCELLED") {
    return {
      title: false,
      description: false,
      location: false,
      startAt: false,
      endAt: false,
      capacity: false,
      price: false,
      coverImageUrl: false,
      cancellationCutoffHours: false,
    };
  }
  if (status === "PUBLISHED") {
    return {
      title: false,
      description: true,
      location: false,
      startAt: false,
      endAt: false,
      capacity: false,
      price: false,
      coverImageUrl: true,
      cancellationCutoffHours: true,
    };
  }
  return {
    title: true,
    description: true,
    location: true,
    startAt: true,
    endAt: true,
    capacity: true,
    price: true,
    coverImageUrl: true,
    cancellationCutoffHours: true,
  };
}

// Convert ISO instant to a datetime-local input value (in user's local tz).
function isoToLocalInput(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function localInputToIso(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

type FormShape = {
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  capacity: string;
  price: string;
  coverImageUrl: string;
  cancellationCutoffHours: string;
};

function initialFromEvent(e: EventResponse): FormShape {
  return {
    title: e.title,
    description: e.description,
    location: e.location,
    startAt: isoToLocalInput(e.startAt),
    endAt: isoToLocalInput(e.endAt),
    capacity: String(e.capacity),
    price: e.price,
    coverImageUrl: e.coverImageUrl ?? "",
    cancellationCutoffHours: String(e.cancellationCutoffHours),
  };
}

const EMPTY_INITIAL: FormShape = {
  title: "",
  description: "",
  location: "",
  startAt: "",
  endAt: "",
  capacity: "100",
  price: "0.00",
  coverImageUrl: "",
  cancellationCutoffHours: "24",
};

function shapeToCreate(values: FormShape): CreateEventRequest {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    location: values.location.trim(),
    startAt: localInputToIso(values.startAt),
    endAt: localInputToIso(values.endAt),
    capacity: Number.parseInt(values.capacity, 10),
    price: values.price.trim(),
    coverImageUrl: values.coverImageUrl.trim() || null,
    cancellationCutoffHours: Number.parseInt(
      values.cancellationCutoffHours,
      10,
    ),
  };
}

function shapeToUpdate(
  values: FormShape,
  initial: FormShape,
  edit: Editability,
): UpdateEventRequest {
  const out: UpdateEventRequest = {};
  if (edit.title && values.title !== initial.title) out.title = values.title.trim();
  if (edit.description && values.description !== initial.description)
    out.description = values.description.trim();
  if (edit.location && values.location !== initial.location)
    out.location = values.location.trim();
  if (edit.startAt && values.startAt !== initial.startAt)
    out.startAt = localInputToIso(values.startAt);
  if (edit.endAt && values.endAt !== initial.endAt)
    out.endAt = localInputToIso(values.endAt);
  if (edit.capacity && values.capacity !== initial.capacity)
    out.capacity = Number.parseInt(values.capacity, 10);
  if (edit.price && values.price !== initial.price) out.price = values.price.trim();
  if (edit.coverImageUrl && values.coverImageUrl !== initial.coverImageUrl) {
    out.coverImageUrl = values.coverImageUrl.trim() || null;
  }
  if (
    edit.cancellationCutoffHours &&
    values.cancellationCutoffHours !== initial.cancellationCutoffHours
  ) {
    out.cancellationCutoffHours = Number.parseInt(
      values.cancellationCutoffHours,
      10,
    );
  }
  return out;
}

export function EventForm(props: EventFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const edit = useMemo(
    () => editabilityFor(props.mode, props.status),
    [props.mode, props.status],
  );

  const initialValues: FormShape = useMemo(
    () => (props.mode === "edit" ? initialFromEvent(props.initial) : EMPTY_INITIAL),
    [props],
  );

  const form = useForm<FormShape>({
    defaultValues: initialValues,
    mode: "onSubmit",
  });

  const allDisabled = props.mode === "edit" && props.status === "CANCELLED";

  function onSubmit(values: FormShape) {
    setSubmitError(null);

    if (props.mode === "create") {
      const body = shapeToCreate(values);
      const parsed = createEventSchema.safeParse(
        body as unknown as CreateEventInput,
      );
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        setSubmitError(first?.message ?? "Invalid input");
        return;
      }
      startTransition(async () => {
        const result = await createEventAction(body);
        if (!result.ok) {
          setSubmitError(result.error.message);
          return;
        }
        toast.success("Event created as draft.");
        router.push(`/dashboard/events/${result.data.id}/edit`);
        router.refresh();
      });
      return;
    }

    const body = shapeToUpdate(values, initialValues, edit);
    if (Object.keys(body).length === 0) {
      toast.message("No changes to save.");
      return;
    }
    const parsed = updateEventSchema.safeParse(body as unknown as UpdateEventInput);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setSubmitError(first?.message ?? "Invalid input");
      return;
    }
    const eventId = props.initial.id;
    startTransition(async () => {
      const result = await updateEventAction(eventId, body);
      if (!result.ok) {
        setSubmitError(result.error.message);
        return;
      }
      toast.success("Event updated.");
      router.refresh();
    });
  }

  const lockedTitle = "Locked once published";

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-sm"
      noValidate
    >
      <div className="grid grid-cols-1 gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          {...form.register("title")}
          disabled={!edit.title || allDisabled}
          title={!edit.title ? lockedTitle : undefined}
          maxLength={200}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={6}
          {...form.register("description")}
          disabled={!edit.description || allDisabled}
          title={!edit.description ? lockedTitle : undefined}
          maxLength={5000}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          {...form.register("location")}
          disabled={!edit.location || allDisabled}
          title={!edit.location ? lockedTitle : undefined}
          maxLength={500}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="startAt">Starts</Label>
          <Input
            id="startAt"
            type="datetime-local"
            {...form.register("startAt")}
            disabled={!edit.startAt || allDisabled}
            title={!edit.startAt ? lockedTitle : undefined}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="endAt">Ends</Label>
          <Input
            id="endAt"
            type="datetime-local"
            {...form.register("endAt")}
            disabled={!edit.endAt || allDisabled}
            title={!edit.endAt ? lockedTitle : undefined}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="capacity">Capacity</Label>
          <Input
            id="capacity"
            type="number"
            min={1}
            step={1}
            {...form.register("capacity")}
            disabled={!edit.capacity || allDisabled}
            title={!edit.capacity ? lockedTitle : undefined}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="price">Price (USD)</Label>
          <Input
            id="price"
            inputMode="decimal"
            placeholder="0.00"
            {...form.register("price")}
            disabled={!edit.price || allDisabled}
            title={!edit.price ? lockedTitle : undefined}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cancellationCutoffHours">Cancellation cutoff (h)</Label>
          <Input
            id="cancellationCutoffHours"
            type="number"
            min={0}
            max={168}
            step={1}
            {...form.register("cancellationCutoffHours")}
            disabled={!edit.cancellationCutoffHours || allDisabled}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        <Label htmlFor="coverImageUrl">Cover image URL (optional)</Label>
        <Input
          id="coverImageUrl"
          type="url"
          placeholder="https://…"
          {...form.register("coverImageUrl")}
          disabled={!edit.coverImageUrl || allDisabled}
        />
      </div>

      {submitError ? (
        <p className="text-sm text-destructive" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button
          type="submit"
          disabled={pending || allDisabled}
          size="lg"
        >
          {pending ? <Loader2 className="animate-spin" /> : null}
          {props.mode === "create" ? "Create event" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
