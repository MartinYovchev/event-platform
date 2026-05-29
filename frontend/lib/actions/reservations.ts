"use server";

import { revalidatePath } from "next/cache";

import { serverFetch } from "@/lib/auth/server";
import type {
  CreateReservationRequest,
  ReservationResponse,
  ReserveResponse,
} from "@/types/api";

import { actionError, type ActionResult } from "./result";

export async function reserveAction(
  eventId: number,
  input: CreateReservationRequest,
): Promise<ActionResult<ReserveResponse>> {
  try {
    const reservation = await serverFetch<ReserveResponse>(
      `/api/events/${eventId}/reservations`,
      { method: "POST", body: JSON.stringify(input) },
    );
    revalidatePath(`/events/${eventId}`);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/reservations");
    return { ok: true, data: reservation };
  } catch (err) {
    return actionError(err, "Could not complete reservation.");
  }
}

export async function cancelReservationAction(
  reservationId: number,
  eventId?: number,
): Promise<ActionResult<ReservationResponse>> {
  try {
    const reservation = await serverFetch<ReservationResponse>(
      `/api/me/reservations/${reservationId}/cancel`,
      { method: "POST" },
    );
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/reservations");
    if (typeof eventId === "number") {
      revalidatePath(`/events/${eventId}`);
    }
    return { ok: true, data: reservation };
  } catch (err) {
    return actionError(err, "Could not cancel reservation.");
  }
}
