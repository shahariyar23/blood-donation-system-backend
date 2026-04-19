import { z } from "zod";

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

const bloodTypeEnum = z.enum(
  ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
  { errorMap: () => ({ message: "Invalid blood type" }) },
);

export const createDonationSchema = z.object({
  donorId: objectId,
  bloodType: bloodTypeEnum,
  units: z.number().int().min(1).max(10).optional(),
  patientInfo: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const rejectDonationSchema = z.object({
  reportNote: z.string().trim().optional(),
});

export const listDonationQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  page: z.preprocess(
    (value) => (value === undefined ? undefined : Number(value)),
    z.number().int().min(1).optional(),
  ),
  limit: z.preprocess(
    (value) => (value === undefined ? undefined : Number(value)),
    z.number().int().min(1).max(100).optional(),
  ),
});

export type CreateDonationInput = z.infer<typeof createDonationSchema>;
export type RejectDonationInput = z.infer<typeof rejectDonationSchema>;
export type ListDonationQuery = z.infer<typeof listDonationQuerySchema>;
