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
  requesterId: objectId,
  bloodType: bloodTypeEnum,
  units: z.number().int().min(1).max(10).optional(),
  patientInfo: z.any().optional(),
  notes: z.string().trim().optional(),
});

export const rejectDonationSchema = z.object({
  reportNote: z.string().trim().optional(),
});

export const createDonationRequestSchema = z.object({
  donorId: objectId,
  bloodType: bloodTypeEnum,
  collectionId: objectId,
});

export const listMyDonationRequestQuerySchema = z.object({
  status: z
    .enum(["request", "pending", "approved", "rejected", "completed", "cancelled"])
    .optional(),
  page: z.preprocess(
    (value) => (value === undefined ? undefined : Number(value)),
    z.number().int().min(1).optional(),
  ),
  limit: z.preprocess(
    (value) => (value === undefined ? undefined : Number(value)),
    z.number().int().min(1).max(100).optional(),
  ),
});

export const listDonationQuerySchema = z.object({
  search: z.string().trim().optional(),
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

export const searchDonationRequestSchema = z.object({
  identifier: z.string().trim().min(3, "Identifier is required"),
});

export const searchDonationSuggestionsQuerySchema = z.object({
  q: z.string().trim().min(1, "Search query is required"),
});

export type CreateDonationInput = z.infer<typeof createDonationSchema>;
export type RejectDonationInput = z.infer<typeof rejectDonationSchema>;
export type CreateDonationRequestInput = z.infer<typeof createDonationRequestSchema>;
export type ListMyDonationRequestQuery = z.infer<typeof listMyDonationRequestQuerySchema>;
export type ListDonationQuery = z.infer<typeof listDonationQuerySchema>;
export type SearchDonationRequestInput = z.infer<typeof searchDonationRequestSchema>;
export type SearchDonationSuggestionsQuery = z.infer<typeof searchDonationSuggestionsQuerySchema>;
