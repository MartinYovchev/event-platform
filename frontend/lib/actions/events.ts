"use server";

import { revalidatePath } from "next/cache";

import { serverFetch } from "@/lib/auth/server";
import type {
  CreateEventRequest,
  EventResponse,
  UpdateEventRequest,
} from "@/types/api";

import { actionError, type ActionResult } from "./result";

function revalidateEventViews(id?: number): void {
  revalidatePath("/events");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/events");
  if (typeof id === "number") {
    revalidatePath(`/events/${id}`);
    revalidatePath(`/dashboard/events/${id}/edit`);
  }
}

export async function createEventAction(
  input: CreateEventRequest,
): Promise<ActionResult<EventResponse>> {
  try {
    const event = await serverFetch<EventResponse>("/api/events", {
      method: "POST",
      body: JSON.stringify(input),
    });
    revalidateEventViews(event.id);
    return { ok: true, data: event };
  } catch (err) {
    return actionError(err, "Could not create event.");
  }
}

export async function updateEventAction(
  id: number,
  input: UpdateEventRequest,
): Promise<ActionResult<EventResponse>> {
  try {
    const event = await serverFetch<EventResponse>(`/api/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    revalidateEventViews(id);
    return { ok: true, data: event };
  } catch (err) {
    return actionError(err, "Could not update event.");
  }
}

export async function publishEventAction(
  id: number,
): Promise<ActionResult<EventResponse>> {
  try {
    const event = await serverFetch<EventResponse>(
      `/api/events/${id}/publish`,
      { method: "POST" },
    );
    revalidateEventViews(id);
    return { ok: true, data: event };
  } catch (err) {
    return actionError(err, "Could not publish event.");
  }
}

export async function cancelEventAction(
  id: number,
): Promise<ActionResult<EventResponse>> {
  try {
    const event = await serverFetch<EventResponse>(
      `/api/events/${id}/cancel`,
      { method: "POST" },
    );
    revalidateEventViews(id);
    revalidatePath("/dashboard/reservations");
    return { ok: true, data: event };
  } catch (err) {
    return actionError(err, "Could not cancel event.");
  }
}

export async function deleteEventAction(
  id: number,
): Promise<ActionResult> {
  try {
    await serverFetch<void>(`/api/events/${id}`, { method: "DELETE" });
    revalidateEventViews(id);
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not delete event.");
  }
}
