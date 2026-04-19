import Donation from "./Donation.schema";
import { PipelineStage, Types } from "mongoose";
import User from "../user/User.schema";
import Donor from "../donor/donor.schema";
import { ApiError, paginate } from "../../shared/utils";
import {
	CreateDonationInput,
	ListDonationQuery,
	RejectDonationInput,
} from "./donation.validation";

export class DonationService {
	private static normalizeSearch(search: string) {
		return search
			.trim()
			.replace(/^donor\s*#\s*/i, "")
			.replace(/^#/, "")
			.replace(/\s+/g, "")
			.toLowerCase();
	}

	private static escapeRegex(value: string) {
		return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}

	static async createDonation(hospitalId: string, body: CreateDonationInput) {
		const donorUser = await User.findById(body.donorId).select(
			"role isActive bloodType",
		);

		if (!donorUser || !donorUser.isActive || donorUser.role !== "donor") {
			throw new ApiError(404, "Donor not found");
		}

		const donorProfile = await Donor.findOne({ userId: donorUser._id }).select(
			"_id",
		);

		if (!donorProfile) {
			throw new ApiError(404, "Donor profile not found");
		}

		const donation = await Donation.create({
			donorId: donorUser._id,
			hospitalId,
			bloodType: body.bloodType,
			units: body.units ?? 1,
			patientInfo: body.patientInfo || "",
			notes: body.notes || "",
			status: "pending",
			approvedBy: null,
			approvedAt: null,
			donatedAt: null,
		});

		return donation;
	}

	static async approveDonation(hospitalId: string, donationId: string) {
		const donation = await Donation.findOne({
			_id: donationId,
			hospitalId,
		});

		if (!donation) {
			throw new ApiError(404, "Donation not found");
		}

		if (donation.status !== "pending") {
			throw new ApiError(400, "Donation is already processed");
		}

		const donor = await Donor.findOne({ userId: donation.donorId });
		if (!donor) {
			throw new ApiError(404, "Donor profile not found");
		}

		const now = new Date();
		const nextAvailableAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

		donation.status = "approved";
		donation.approvedBy = donation.hospitalId;
		donation.approvedAt = now;
		donation.donatedAt = now;
		await donation.save();

		donor.lastDonationDate = now;
		donor.nextAvailableAt = nextAvailableAt;
		donor.isAvailable = false;
		donor.totalDonations += 1;
		await donor.save();

		return donation;
	}

	static async rejectDonation(
		hospitalId: string,
		donationId: string,
		body: RejectDonationInput,
	) {
		const donation = await Donation.findOne({
			_id: donationId,
			hospitalId,
		});

		if (!donation) {
			throw new ApiError(404, "Donation not found");
		}

		if (donation.status !== "pending") {
			throw new ApiError(400, "Donation is already processed");
		}

		donation.status = "rejected";
		donation.approvedBy = donation.hospitalId;
		donation.approvedAt = new Date();
		donation.reportNote = body.reportNote || "";
		await donation.save();

		return donation;
	}

	static async listHospitalDonations(hospitalId: string, query: ListDonationQuery) {
		const search = query.search?.trim();
		const normalizedSearch = search ? this.normalizeSearch(search) : "";
		const bloodTypeValues = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
		const baseMatch: Record<string, any> = {
			hospitalId: Types.ObjectId.isValid(hospitalId)
				? new Types.ObjectId(hospitalId)
				: hospitalId,
		};
		if (query.status) baseMatch.status = query.status;

		const searchMatch: Record<string, any> = {};
		if (normalizedSearch) {
			if (Types.ObjectId.isValid(normalizedSearch)) {
				const objectId = new Types.ObjectId(normalizedSearch);
				searchMatch.$or = [{ _id: objectId }, { donorId: objectId }];
			} else if (bloodTypeValues.includes(normalizedSearch.toUpperCase())) {
				searchMatch.bloodType = normalizedSearch.toUpperCase();
			} else {
				const escaped = this.escapeRegex(normalizedSearch);
				searchMatch.$or = [
					{
						$expr: {
							$regexMatch: {
								input: { $toString: "$donorId" },
								regex: `${escaped}$`,
								options: "i",
							},
						},
					},
					{
						$expr: {
							$regexMatch: {
								input: { $toString: "$_id" },
								regex: `${escaped}$`,
								options: "i",
							},
						},
					},
					{ bloodType: { $regex: `^${escaped}$`, $options: "i" } },
				];
			}
		}

		const { skip, limit, page, totalPages } = paginate(
			query as Record<string, any>,
		);

		const pipeline: PipelineStage[] = [
			{ $match: baseMatch } as PipelineStage.Match,
		];

		if (Object.keys(searchMatch).length > 0) {
			pipeline.push({ $match: searchMatch } as PipelineStage.Match);
		}

		pipeline.push(
			{ $sort: { createdAt: -1 } } as PipelineStage.Sort,
			{
				$facet: {
					donations: [
						{ $skip: skip } as PipelineStage.Skip,
						{ $limit: limit } as PipelineStage.Limit,
					],
					meta: [{ $count: "total" } as PipelineStage.Count],
				},
			} as PipelineStage.Facet,
		);

		const [result] = await Donation.aggregate(pipeline);
		const donations = result?.donations || [];
		const total = result?.meta?.[0]?.total || 0;

		return {
			donations,
			pagination: {
				total,
				page,
				limit,
				totalPages: totalPages(total),
			},
		};
	}
}
