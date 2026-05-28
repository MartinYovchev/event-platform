"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { serverFetch } from "@/lib/auth/server";
import { COOKIE_NAME, cookieOptions } from "@/lib/auth/cookies";
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  UserResponse,
} from "@/types/api";

import { actionError, type ActionResult } from "./result";

export async function loginAction(
  input: LoginRequest,
): Promise<ActionResult<UserResponse>> {
  const email = input.email?.trim() ?? "";
  const password = input.password ?? "";
  if (!email || !password) {
    return {
      ok: false,
      error: { code: "INVALID_REQUEST", message: "Email and password are required" },
    };
  }

  try {
    const auth = await serverFetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password }),
    });
    const jar = await cookies();
    jar.set(COOKIE_NAME, auth.token, cookieOptions(auth.expiresInSeconds));
    revalidatePath("/", "layout");
    return { ok: true, data: auth.user };
  } catch (err) {
    return actionError(err, "Sign in failed. Please try again.");
  }
}

export async function registerAction(
  input: RegisterRequest,
): Promise<ActionResult<UserResponse>> {
  const email = input.email?.trim() ?? "";
  const password = input.password ?? "";
  const displayName = input.displayName?.trim() ?? "";
  if (!email || !password || !displayName) {
    return {
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message: "Email, password, and display name are required",
      },
    };
  }

  try {
    const auth = await serverFetch<AuthResponse>("/api/auth/register", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password, displayName }),
    });
    const jar = await cookies();
    jar.set(COOKIE_NAME, auth.token, cookieOptions(auth.expiresInSeconds));
    revalidatePath("/", "layout");
    return { ok: true, data: auth.user };
  } catch (err) {
    return actionError(err, "Registration failed. Please try again.");
  }
}

export async function googleAuthAction(
  idToken: string,
): Promise<ActionResult<UserResponse>> {
  if (!idToken) {
    return { ok: false, error: { code: "INVALID_REQUEST", message: "Missing Google credential" } };
  }
  try {
    const auth = await serverFetch<AuthResponse>("/api/auth/google", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ idToken }),
    });
    const jar = await cookies();
    jar.set(COOKIE_NAME, auth.token, cookieOptions(auth.expiresInSeconds));
    revalidatePath("/", "layout");
    return { ok: true, data: auth.user };
  } catch (err) {
    return actionError(err, "Google sign in failed. Please try again.");
  }
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  revalidatePath("/", "layout");
}
