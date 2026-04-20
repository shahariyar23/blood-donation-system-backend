import { z } from "zod";

// ── Reusable Schemas ───────────────────────────────────

const passwordSchema = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .max(64, "Password is too long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

const locationSchema = z.object({
  area: z.string().min(1, "Area is required"),
  district: z.string().min(1, "District is required"),
  division: z.string().min(1, "Division is required"),
  coordinates: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});

// ══════════════════════════════════════════════════════
//  REGISTER HOSPITAL (Admin Only)
// ══════════════════════════════════════════════════════
export const registerHospitalSchema = z.object({
  hospitalName: z
    .string({ required_error: "Hospital name is required" })
    .trim()
    .min(2, "Hospital name is too short")
    .max(100, "Hospital name is too long"),

  registrationNumber: z
    .string({ required_error: "Registration number is required" })
    .trim()
    .min(1, "Registration number cannot be empty"),

  email: z
    .string({ required_error: "Email is required" })
    .email("Invalid email format")
    .toLowerCase(),

  password: passwordSchema,

  phone: z
    .string({ required_error: "Phone is required" })
    .trim()
    .min(10, "Phone number is too short"),

  licenseNumber: z
    .string({ required_error: "License number is required" })
    .trim()
    .min(1, "License number cannot be empty"),

  address: z
    .string({ required_error: "Address is required" })
    .trim()
    .min(5, "Address is too short"),

  location: locationSchema,

  website: z
    .string()
    .url("Invalid website URL")
    .optional()
    .nullable()
    .default(null),

  adminName: z
    .string({ required_error: "Admin name is required" })
    .trim()
    .min(2, "Admin name is too short"),

  adminEmail: z
    .string({ required_error: "Admin email is required" })
    .email("Invalid admin email format")
    .toLowerCase(),

  adminPhone: z
    .string({ required_error: "Admin phone is required" })
    .trim()
    .min(10, "Admin phone is too short"),

  totalBedCapacity: z
    .number({ required_error: "Total bed capacity is required" })
    .min(1, "Minimum 1 bed required"),

  bloodBankCapacity: z
    .number({ required_error: "Blood bank capacity is required" })
    .min(1, "Minimum 1 unit capacity required"),
});

export type RegisterHospitalRequest = z.infer<typeof registerHospitalSchema>;

// ══════════════════════════════════════════════════════
//  LOGIN
// ══════════════════════════════════════════════════════
export const hospitalLoginSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .email("Invalid email format")
    .toLowerCase(),

  password: z
    .string({ required_error: "Password is required" })
    .min(1, "Password cannot be empty"),
});

export type HospitalLoginRequest = z.infer<typeof hospitalLoginSchema>;

// ══════════════════════════════════════════════════════
//  FORGOT PASSWORD
// ══════════════════════════════════════════════════════
export const hospitalForgotPasswordSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .email("Invalid email format")
    .toLowerCase(),
});

export type HospitalForgotPasswordRequest = z.infer<typeof hospitalForgotPasswordSchema>;

// ══════════════════════════════════════════════════════
//  RESET PASSWORD
// ══════════════════════════════════════════════════════
export const hospitalResetPasswordSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .email("Invalid email format")
    .toLowerCase(),

  resetToken: z
    .string({ required_error: "Reset token is required" })
    .min(1, "Reset token cannot be empty"),

  newPassword: passwordSchema,

  confirmPassword: z
    .string({ required_error: "Confirm password is required" })
    .min(1, "Confirm password cannot be empty"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type HospitalResetPasswordRequest = z.infer<typeof hospitalResetPasswordSchema>;

// ══════════════════════════════════════════════════════
//  CHANGE PASSWORD (Authenticated Hospital)
// ══════════════════════════════════════════════════════
export const changePasswordSchema = z.object({
  currentPassword: z
    .string({ required_error: "Current password is required" })
    .min(1, "Current password cannot be empty"),

  newPassword: passwordSchema,

  confirmPassword: z
    .string({ required_error: "Confirm password is required" })
    .min(1, "Confirm password cannot be empty"),
})
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
