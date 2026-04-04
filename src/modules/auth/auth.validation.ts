import { z } from "zod";

// ── Reusable pieces ────────────────────────────────────

const locationSchema = z.object({
  displayName: z.string().default(""),

  // Detailed address
  road: z.string().optional().default(""),
  quarter: z.string().optional().default(""),
  suburb: z.string().optional().default(""),

  city: z.string().optional().default(""),
  county: z.string().optional().default(""),
  state_district: z.string().optional().default(""),
  state: z.string().optional().default(""),

  postcode: z.string().optional().default(""),

  country: z.string().default(""),
  country_code: z
    .string()
    .optional(),

  // Coordinates
  coordinates: z
    .object({
      lat: z.number().nullable().default(null),
      lng: z.number().nullable().default(null),
    })
    .default({ lat: null, lng: null }),
});

const bloodTypeEnum = z.enum(
  ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
  { errorMap: () => ({ message: "Invalid blood type" }) }
);

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(64, "Password is too long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

// ══════════════════════════════════════════════════════
//  REGISTER
// ══════════════════════════════════════════════════════
export const registerSchema = z.object({
  // required
  name:      z.string().trim().min(2, "Name must be at least 2 characters").max(50),
  email:     z.string().trim().email("Invalid email address").toLowerCase(),
  phone:     z.string().trim().min(7, "Invalid phone number").max(15),
  password:  passwordSchema,
  bloodType: bloodTypeEnum,
  location:  locationSchema,

  // optional donor info
  age: z
    .number()
    .int()
    .min(18, "Must be at least 18 years old")
    .optional(),

  gender: z.enum(["male", "female"]).optional(),

  weight: z
    .number()
    .min(50, "Minimum weight is 50 kg")
    .optional(),

  socialLinks: z
    .object({
      facebook:  z.string().url("Invalid Facebook URL").nullable().optional(),
      instagram: z.string().url("Invalid Instagram URL").nullable().optional(),
      twitter:   z.string().url("Invalid Twitter URL").nullable().optional(),
    })
    .optional(),
});

// ══════════════════════════════════════════════════════
//  LOGIN
// ══════════════════════════════════════════════════════
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^(01[3-9]\d{8})$|^(8801[3-9]\d{8})$/;

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, "Email or phone is required")
    .refine(
      (val) => emailRegex.test(val) || phoneRegex.test(val),
      { message: "Enter a valid email or Bangladeshi phone number" }
    ),

  password: z.string().min(1, "Password is required"),

  location: locationSchema.optional(),
});

// ══════════════════════════════════════════════════════
//  FORGOT PASSWORD
// ══════════════════════════════════════════════════════
export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email address").toLowerCase(),
});

// ══════════════════════════════════════════════════════
//  RESET PASSWORD
// ══════════════════════════════════════════════════════
export const resetPasswordSchema = z.object({
  token:       z.string().min(1, "Reset token is required"),
  newPassword: passwordSchema,
});

// ── Inferred TypeScript types ──────────────────────────
export type RegisterInput       = z.infer<typeof registerSchema>;
export type LoginInput          = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput  = z.infer<typeof resetPasswordSchema>;