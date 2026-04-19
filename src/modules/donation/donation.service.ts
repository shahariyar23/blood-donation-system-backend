import Donation from "./Donation.schema";
import User from "../user/User.schema";
import Donor from "../donor/donor.schema";
import { ApiError, paginate } from "../../shared/utils";
import {
	CreateDonationInput,
	ListDonationQuery,
	RejectDonationInput,
} from "./donation.validation";

export class DonationService {
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
		const filter: Record<string, any> = { hospitalId };
		if (query.status) filter.status = query.status;

		const { skip, limit, page, totalPages } = paginate(
			query as Record<string, any>,
		);

		const [donations, total] = await Promise.all([
			Donation.find(filter)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit),
			Donation.countDocuments(filter),
		]);

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
