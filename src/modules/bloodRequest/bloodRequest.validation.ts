import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

const urgencyEnum = z.enum(["critical", "urgent", "moderate", "planned"]);

const statusEnum = z.enum(["active", "fulfilled", "expired", "cancelled"]);

const futureDate = z.preprocess((value) => {
	if (value instanceof Date) {
		return value;
	}

	if (typeof value === "string" || typeof value === "number") {
		return new Date(value);
	}

	return value;
}, z.date().refine((date) => date.getTime() > Date.now(), {
	message: "Needed by date must be in the future",
}));

const optionalNumber = z.preprocess((value) => {
	if (value === "" || value === null || value === undefined) {
		return undefined;
	}

	const parsed = Number(value);
	return Number.isNaN(parsed) ? value : parsed;
}, z.number().optional());

export const createBloodRequestSchema = z.object({
	patientName: z.string().trim().min(2, "Patient name is required"),
	bloodType: z.enum(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"], {
		errorMap: () => ({ message: "Invalid blood type" }),
	}),
	units: z.preprocess((value) => Number(value), z.number().int().min(1).max(10)),
	hospital: z.string().trim().min(2, "Hospital name is required"),
	location: z.string().trim().min(3, "Location is required"),
	latitude: optionalNumber,
	longitude: optionalNumber,
	locationDetails: z.any().nullable().optional(),
	phone: z.string().trim().min(7, "Contact number is required"),
	urgency: urgencyEnum,
	neededBy: futureDate,
	notes: z.string().trim().max(500).optional().default(""),
	agreeTerms: z.literal(true, {
		errorMap: () => ({ message: "You must agree to the terms" }),
	}),
});

export const getUserBloodRequestsQuerySchema = z.object({
	status: statusEnum.optional(),
	page: z.preprocess((value) => {
		if (value === undefined || value === null || value === "") {
			return undefined;
		}

		return Number(value);
	}, z.number().int().min(1).optional()),
	limit: z.preprocess((value) => {
		if (value === undefined || value === null || value === "") {
			return undefined;
		}

		return Number(value);
	}, z.number().int().min(1).max(100).optional()),
});

export const cancelBloodRequestParamsSchema = z.object({
	id: objectId,
});

export const respondBloodRequestParamsSchema = z.object({
  id: objectId,
});

export type CreateBloodRequestInput = z.infer<typeof createBloodRequestSchema>;
export type GetUserBloodRequestsQuery = z.infer<typeof getUserBloodRequestsQuerySchema>;
export type CancelBloodRequestParams = z.infer<typeof cancelBloodRequestParamsSchema>;