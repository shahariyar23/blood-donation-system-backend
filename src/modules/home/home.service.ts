import User from "../user/User.schema";
import Donation from "../donation/Donation.schema";
import BloodRequest from "../bloodRequest/BloodRequest.schema";

export class HomeService {
	static async getActiveUsersCount() {
		// Count all active users (includes donors, admins, hospitals etc.)
		const count = await User.countDocuments({
			isActive: true,
			isDeleted: false,
		});

		return { count };
	}

	static async getActiveDonorsCount() {
		const count = await User.countDocuments({
			role: "donor",
			isActive: true,
			isDeleted: false,
		});

		return { count };
	}

	static async getSuccessfulDonationsCount() {
		// Treat approved donations as successful
		const count = await Donation.countDocuments({
			status: "approved",
		});

		return { count };
	}

	static async getCollectedBloodRequestsCount() {
		const count = await BloodRequest.countDocuments();

		return { count };
	}

	static async getAllStatistics() {
		const [activeUsers, activeDonors, successfulDonations, collectedRequests] = 
			await Promise.all([
				this.getActiveUsersCount(),
				this.getActiveDonorsCount(),
				this.getSuccessfulDonationsCount(),
				this.getCollectedBloodRequestsCount(),
			]);

		return {
			activeUsers: activeUsers.count,
			activeDonors: activeDonors.count,
			successfulDonations: successfulDonations.count,
			collectedBloodRequests: collectedRequests.count,
		};
	}

	static async getDonorGroupsByBloodType() {
		const now = new Date();

		const pipeline = [
			{ $match: { role: "donor", isActive: true, isDeleted: false } },
			{
				$lookup: {
					from: "donors",
					localField: "_id",
					foreignField: "userId",
					as: "donor",
				},
			},
			{ $unwind: { path: "$donor", preserveNullAndEmptyArrays: true } },
			{
				$addFields: {
					isAvailable: {
						$cond: [
							{
								$or: [
									{ $eq: ["$donor.isAvailable", true] },
									{ $eq: ["$donor.nextAvailableAt", null] },
									{ $lte: ["$donor.nextAvailableAt", now] },
								],
							},
							1,
							0,
						],
					},
				},
			},
			{
				$group: {
					_id: "$bloodType",
					donors: { $sum: 1 },
					availableCount: { $sum: "$isAvailable" },
				},
			},
			{
				$project: {
					group: "$_id",
					donors: 1,
					available: { $gt: ["$availableCount", 0] },
					_id: 0,
				},
			},
		];

		const agg = await User.aggregate(pipeline as any[]);

		const types = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
		const map: Record<string, any> = {};
		agg.forEach((r: any) => {
			if (r && r.group) map[r.group] = r;
		});

		return types.map((t) => ({ group: t, donors: map[t]?.donors ?? 0, available: !!map[t]?.available }));
	}
}
