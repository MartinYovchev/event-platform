import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().min(1),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  displayName: z.string().min(1).max(100),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

const isoInstant = z
  .string()
  .min(1)
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: "Invalid date" });

const priceString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, { message: "Must be a non-negative number with up to 2 decimals" });

export const createEventSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    location: z.string().min(1).max(500),
    startAt: isoInstant.refine((s) => Date.parse(s) > Date.now(), {
      message: "startAt must be in the future",
    }),
    endAt: isoInstant,
    capacity: z.number().int().min(1),
    price: priceString,
    coverImageUrl: z.union([z.string().url(), z.literal("")]).optional(),
    cancellationCutoffHours: z.number().int().min(0).max(168).optional(),
  })
  .refine((data) => Date.parse(data.endAt) > Date.parse(data.startAt), {
    path: ["endAt"],
    message: "endAt must be after startAt",
  });
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(5000).optional(),
    location: z.string().min(1).max(500).optional(),
    startAt: isoInstant.optional(),
    endAt: isoInstant.optional(),
    capacity: z.number().int().min(1).optional(),
    price: priceString.optional(),
    coverImageUrl: z.union([z.string().url(), z.literal("")]).optional(),
    cancellationCutoffHours: z.number().int().min(0).max(168).optional(),
  })
  .refine(
    (data) =>
      data.startAt === undefined ||
      data.endAt === undefined ||
      Date.parse(data.endAt) > Date.parse(data.startAt),
    { path: ["endAt"], message: "endAt must be after startAt" },
  );
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const createReservationSchema = z.object({
  quantity: z.number().int().min(1).max(20),
});
export type CreateReservationInput = z.infer<typeof createReservationSchema>;
