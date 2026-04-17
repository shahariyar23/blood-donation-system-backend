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
  country_code: z.string().optional(),

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
  { errorMap: () => ({ message: "Invalid blood type" }) },
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
  name: z
    .string({ required_error: "Name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(50),
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .email("Invalid email address")
    .toLowerCase(),
  phone: z
    .string({ required_error: "Phone number is required" })
    .trim()
    .refine(
      (val) => {
        const digits = val.replace(/\D/g, "");
        // 01XXXXXXXXX (11 digits) or 8801XXXXXXXXX (13 digits)
        return (
          /^(01[3-9]\d{8})$/.test(digits) || /^(8801[3-9]\d{8})$/.test(digits)
        );
      },
      {
        message:
          "Enter a valid Bangladeshi phone number (e.g. 01712345678 or +8801712345678)",
      },
    ),
  password: passwordSchema,
  bloodType: bloodTypeEnum,
  location: locationSchema,
  role: z.enum(["user", "donor"]).default("user"),
  dateOfBirth: z.coerce.date({ required_error: "Date of birth is required" }),
  avatar: z.string().trim().url("Invalid avatar URL").nullable().optional(),

  // optional donor info
  age: z.number().int().min(18, "Must be at least 18 years old").optional(),

  gender: z.enum(["male", "female"]).optional(),

  weight: z.number().min(50, "Minimum weight is 50 kg").optional(),
  isAvailable: z.boolean().optional(),
  totalDonations: z.number().min(0).optional(),
  lastDonationDate: z.coerce.date().optional().nullable(),
  socialLinks: z
    .object({
      facebook: z.string().url("Invalid Facebook URL").nullable().optional(),
      instagram: z.string().url("Invalid Instagram URL").nullable().optional(),
      twitter: z.string().url("Invalid Twitter URL").nullable().optional(),
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
    .refine((val) => emailRegex.test(val) || phoneRegex.test(val), {
      message: "Enter a valid email or Bangladeshi phone number",
    }),

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
  token: z.string().min(1, "Reset token is required"),
  newPassword: passwordSchema,
});

// ══════════════════════════════════════════════════════
//  EMAIL OTP
// ══════════════════════════════════════════════════════
export const sendOtpSchema = z.object({
  email: z.string().trim().email("Invalid email address").toLowerCase(),
});

export const verifyOtpSchema = z.object({
  email: z.string().trim().email("Invalid email address").toLowerCase(),
  otp: z
    .string()
    .regex(/^\d{6}$/, "OTP must be a 6-digit code"),
});

// ── Inferred TypeScript types ──────────────────────────
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
