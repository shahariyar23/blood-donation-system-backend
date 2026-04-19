import { z } from "zod";

export const searchHospitalDonorSchema = z.object({
  identifier: z
    .string({ required_error: "identifier is required" })
    .trim()
    .min(3, "identifier is too short"),
});

export type SearchHospitalDonorQuery = z.infer<typeof searchHospitalDonorSchema>;
