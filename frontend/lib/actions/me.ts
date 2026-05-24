"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { serverFetch } from "@/lib/auth/server";
import { COOKIE_NAME } from "@/lib/auth/cookies";
import type {
  ChangePasswordRequest,
  UpdateProfileRequest,
  UserResponse,
} from "@/types/api";

import { actionError, type ActionResult } from "./result";

export async function updateProfileAction(
  input: UpdateProfileRequest,
): Promise<ActionResult<UserResponse>> {
  try {
    const user = await serverFetch<UserResponse>("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    revalidatePath("/", "layout");
    return { ok: true, data: user };
  } catch (err) {
    return actionError(err, "Could not update profile.");
  }
}

export async function changePasswordAction(
  input: ChangePasswordRequest,
): Promise<ActionResult> {
  try {
    await serverFetch<void>("/api/users/me/password", {
      method: "POST",
      body: JSON.stringify(input),
    });
    // The backend invalidates the JWT; clear the cookie so the user re-authenticates.
    const jar = await cookies();
    jar.delete(COOKIE_NAME);
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not change password.");
  }
}

export async function becomeOrganizerAction(): Promise<ActionResult<UserResponse>> {
  try {
    const user = await serverFetch<UserResponse>("/api/me/become-organizer", {
      method: "POST",
    });
    revalidatePath("/", "layout");
    return { ok: true, data: user };
  } catch (err) {
    return actionError(err, "Could not enable organizer access.");
  }
}

export async function deleteAccountAction(): Promise<ActionResult> {
  try {
    await serverFetch<void>("/api/users/me", { method: "DELETE" });
    const jar = await cookies();
    jar.delete(COOKIE_NAME);
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (err) {
    return actionError(err, "Could not delete account.");
  }
}
