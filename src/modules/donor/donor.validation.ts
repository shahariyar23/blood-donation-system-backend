import { z } from "zod";

const bloodTypeEnum = z.enum(
	["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
	{ errorMap: () => ({ message: "Invalid blood type" }) },
);

const booleanLike = z.preprocess(
	(value) => {
		if (value === undefined || value === null || value === "") return undefined;
		if (value === true || value === "true" || value === "1") return true;
		if (value === false || value === "false" || value === "0") return false;
		return value;
	},
	z.boolean().optional(),
);

const radiusSchema = z.preprocess(
	(value) => (value === undefined ? undefined : Number(value)),
	z
		.number()
		.optional()
		.default(10)
		.refine((value) => [5, 10, 20, 30].includes(value), {
			message: "radiusKm must be one of 5, 10, 20, or 30",
		}),
);

export const searchDonorSchema = z.object({
	bloodType: bloodTypeEnum,
	excludeUserId: z
		.string()
		.regex(/^[0-9a-fA-F]{24}$/, "excludeUserId must be a valid id")
		.optional(),
	lat: z.preprocess(
		(value) => Number(value),
		z.number().min(-90, "lat is out of range").max(90, "lat is out of range"),
	),
	lng: z.preprocess(
		(value) => Number(value),
		z.number().min(-180, "lng is out of range").max(180, "lng is out of range"),
	),
	radiusKm: radiusSchema,
	availableOnly: booleanLike,
	verifiedOnly: booleanLike,
	sortBy: z.enum(["distance", "donations"]).optional().default("distance"),
	page: z.preprocess(
		(value) => (value === undefined ? undefined : Number(value)),
		z.number().int().min(1).optional(),
	),
	limit: z.preprocess(
		(value) => (value === undefined ? undefined : Number(value)),
		z.number().int().min(1).max(100).optional(),
	),
});

export type SearchDonorQuery = z.infer<typeof searchDonorSchema>;
