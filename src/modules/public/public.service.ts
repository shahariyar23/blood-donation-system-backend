import { Types } from "mongoose";
import { ApiError, isDonorAvailable, donorAvailabilityMatch, sanitizePublicDonor } from "../../shared/utils";
import { BloodRequest, Donation, Donor, User } from "../index";

type DonorSuggestion = {
	identifier: string;
	name: string;
	role: "donor";
	email: string;
	phone: string;
};

type NearbyDonor = {
	id: string;
	name: string;
	bloodGroup: string;
	location: string;
	distance: string;
	lastDonated: string;
	available: boolean;
	donations: number;
	email: string;
	phone: string;
	settings?: any;
};

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

const isValidNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value);

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toNumber = (value: unknown, fallback: number) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const buildRelativeTime = (date: Date | null | undefined) => {
	if (!date) {
		return "Never";
	}

	const diffMs = Date.now() - new Date(date).getTime();
	const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

	if (diffMinutes < 60) {
		return `${diffMinutes} min ago`;
	}

	const diffHours = Math.floor(diffMinutes / 60);
	if (diffHours < 24) {
		return `${diffHours} hr${diffHours === 1 ? "" : "s"} ago`;
	}

	const diffDays = Math.floor(diffHours / 24);
	if (diffDays < 30) {
		return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
	}

	const diffMonths = Math.floor(diffDays / 30);
	return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
};

const formatLocation = (user: any) => {
	const displayName = user?.location?.displayName?.trim();
	if (displayName) {
		return displayName;
	}

	const city = user?.location?.city?.trim();
	const state = user?.location?.state?.trim();
	if (city && state) {
		return `${city}, ${state}`;
	}

	return city || state || "";
};

const computeDistanceKm = (
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number,
) => {
	const toRadians = (value: number) => (value * Math.PI) / 180;
	const earthRadiusKm = 6371;
	const dLat = toRadians(lat2 - lat1);
	const dLng = toRadians(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
		Math.sin(dLng / 2) * Math.sin(dLng / 2);

	return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getAvailability = (donor: any) => isDonorAvailable(donor);

export class PublicService {
	static async getBloodGroupAvailability() {
		const donorUsers = await User.aggregate([
			{
				$match: {
					role: "donor",
					isActive: true,
					isDeleted: { $ne: true },
				},
			},
			{
				$lookup: {
					from: "donors",
					localField: "_id",
					foreignField: "userId",
					as: "donor",
				},
			},
			{ $unwind: "$donor" },
			{
				$match: donorAvailabilityMatch(new Date()),
			},
			{
				$group: {
					_id: "$bloodType",
					donors: { $sum: 1 },
				},
			},
		]);

		const countMap = new Map<string, number>();
		for (const item of donorUsers as Array<{ _id: string; donors: number }>) {
			if (item._id) {
				countMap.set(item._id, item.donors);
			}
		}

		return {
			location: "",
			bloodGroups: BLOOD_GROUPS.map((group) => ({
				group,
				donors: countMap.get(group) || 0,
				available: (countMap.get(group) || 0) >= 10,
			})),
		};
	}

	static async getNearbyDonors(query: Record<string, any>) {
		const lat = toNumber(query.lat, NaN);
		const lng = toNumber(query.lng, NaN);

		if (!isValidNumber(lat) || !isValidNumber(lng)) {
			throw new ApiError(400, "lat and lng are required and must be valid numbers");
		}

		const radius = toNumber(query.radius, 10);
		const limit = Math.min(Math.max(toNumber(query.limit, 3), 1), 20);

		const latDelta = radius / 110.574;
		const lngDelta = radius / (111.32 * Math.cos((lat * Math.PI) / 180));

		const candidates = await User.aggregate([
			{
				$match: {
					role: "donor",
					isActive: true,
					isDeleted: { $ne: true },
					"location.coordinates.lat": { $gte: lat - latDelta, $lte: lat + latDelta },
					"location.coordinates.lng": { $gte: lng - lngDelta, $lte: lng + lngDelta },
				},
			},
			{
				$lookup: {
					from: "donors",
					localField: "_id",
					foreignField: "userId",
					as: "donor",
				},
			},
			{ $unwind: "$donor" },
		]);

		const donors = (candidates as any[])
			.filter((user) => getAvailability(user.donor))
			.map((user) => {
				const donorLat = user?.location?.coordinates?.lat;
				const donorLng = user?.location?.coordinates?.lng;
				if (!isValidNumber(donorLat) || !isValidNumber(donorLng)) {
					return null;
				}

				const distanceKm = computeDistanceKm(lat, lng, donorLat, donorLng);
				if (distanceKm > radius) {
					return null;
				}

				return {
					id: String(user._id),
					name: user.name || "",
					bloodGroup: user.bloodType || "",
					location: formatLocation(user),
					distance: `${distanceKm.toFixed(1)} km`,
					lastDonated: buildRelativeTime(user.donor.lastDonationDate),
					available: true,
					donations: user.donor.totalDonations || 0,
					email: user.email || "",
					phone: user.phone || "",
					settings: user.settings,
					distanceKm,
				};
			})
			.filter((donor): donor is NearbyDonor & { settings: any; distanceKm: number } => donor !== null)
			.sort((left, right) => left.distanceKm - right.distanceKm)
			.slice(0, limit)
			.map(({ distanceKm, ...donor }) => sanitizePublicDonor(donor));

		return {
			donors,
			userLocation: {
				lat,
				lng,
				city: "",
			},
		};
	}

	static async getLatestBloodRequests(query: Record<string, any>) {
		const limit = Math.min(Math.max(toNumber(query.limit, 6), 1), 20);
		const location = typeof query.location === "string" ? query.location.trim() : "";

		const filter: Record<string, any> = { status: "active" };
		if (location) {
			filter["hospital.location.district"] = { $regex: escapeRegex(location), $options: "i" };
		}

		const requests = await BloodRequest.find(filter)
			.sort({ createdAt: -1 })
			.limit(limit)
			.select("patientName bloodType hospital location units urgency status createdAt neededBy");

		const resolveHospitalName = (request: any) =>
			typeof request.hospital === "string"
				? request.hospital
				: (request.hospital as any)?.name || "";

		const resolveLocation = (request: any) =>
			typeof request.location === "string"
				? request.location
				: (request.hospital as any)?.location?.district || (request.hospital as any)?.address || "";

		return {
			requests: requests.map((request: any) => {
				const postedMinutes = Math.floor((Date.now() - new Date(request.createdAt).getTime()) / 60000);
				return {
					id: String(request._id),
					bloodGroup: request.bloodType,
					patientName: request.patientName,
					hospital: resolveHospitalName(request),
					location: resolveLocation(request),
					units: request.units,
					postedAt: buildRelativeTime(request.createdAt),
					urgent: postedMinutes <= 60 || request.urgency === "critical" || request.urgency === "urgent",
					createdAt: request.createdAt,
					status: request.status,
				};
			}),
		};
	}

	static async getImpactStats() {
		const [approvedDonations, totalRequests, activeDonors, locations, livesSaved] = await Promise.all([
			Donation.countDocuments({ status: "approved" }),
			BloodRequest.countDocuments({}),
			User.aggregate([
				{
					$match: {
						role: "donor",
						isActive: true,
						isDeleted: { $ne: true },
					},
				},
				{
					$lookup: {
						from: "donors",
						localField: "_id",
						foreignField: "userId",
						as: "donor",
					},
				},
				{ $unwind: "$donor" },
				{
					$match: donorAvailabilityMatch(new Date()),
				},
				{ $count: "total" },
			]),
			User.aggregate([
				{
					$match: {
						"location.city": { $exists: true, $ne: "" },
					},
				},
				{
					$group: {
						_id: { $toLower: "$location.city" },
					},
				},
				{ $count: "total" },
			]),
			Donation.aggregate([
				{ $match: { status: "approved" } },
				{ $group: { _id: null, total: { $sum: "$units" } } },
			]),
		]);

		const activeDonorCount = (activeDonors as Array<{ total: number }>)[0]?.total || 0;
		const districtCount = (locations as Array<{ total: number }>)[0]?.total || 0;
		const approvedDonationUnits = (livesSaved as Array<{ total: number }>)[0]?.total || 0;
		const requestsFulfilled = totalRequests > 0 ? Math.round((approvedDonations / totalRequests) * 100) : 0;

		return {
			stats: [
				{ value: String(approvedDonationUnits), label: "Lives Saved", emoji: "❤️" },
				{ value: String(activeDonorCount), label: "Active Donors", emoji: "🙋" },
				{ value: String(districtCount), label: "Districts Covered", emoji: "📍" },
				{ value: String(requestsFulfilled), label: "Requests Fulfilled", emoji: "✅" },
			],
		};
	}

	static async getUrgentBloodRequest() {
		const request = await BloodRequest.findOne({
			status: "active",
			$or: [{ urgency: "critical" }, { urgency: "urgent" }],
		})
			.sort({ createdAt: 1 })
			.select("bloodType hospital location units createdAt urgency");

		const requestData = request as any;
		const hospitalName = typeof requestData.hospital === "string" ? requestData.hospital : requestData.hospital?.name || "";
		const requestLocation = typeof requestData.location === "string"
			? requestData.location
			: requestData.hospital?.location?.district || requestData.hospital?.address || "";

		if (!request) {
			return { request: null };
		}

		return {
			request: {
				id: String(request._id),
				bloodGroup: request.bloodType,
				hospital: hospitalName,
				location: requestLocation,
				units: request.units,
				postedAt: buildRelativeTime(request.createdAt),
				urgent: true,
			},
		};
	}
}
