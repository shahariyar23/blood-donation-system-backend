import { Types } from "mongoose";
import BloodRequest from "./BloodRequest.schema";
import { ApiError, paginate, sendEmail } from "../../shared/utils";
import User from "../user/User.schema";
import {
	CancelBloodRequestParams,
	CreateBloodRequestInput,
	FulfillBloodRequestParams,
	GetUserBloodRequestsQuery,
	GetAllBloodRequestsQuery,
} from "./bloodRequest.validation";
import { donorRespondedTemplate } from "../../utils/email.payloads";

const addDays = (date: Date, days: number) => {
	const nextDate = new Date(date);
	nextDate.setDate(nextDate.getDate() + days);
	return nextDate;
};

export class BloodRequestService {
	static calculateExpiresAt(urgency: CreateBloodRequestInput["urgency"], neededBy: Date) {
		const offsets: Record<CreateBloodRequestInput["urgency"], number> = {
			critical: 1,
			urgent: 1,
			moderate: 3,
			planned: 7,
		};

		return addDays(new Date(neededBy), offsets[urgency]);
	}

	static async createBloodRequest(requestedBy: string, body: CreateBloodRequestInput) {
		const neededBy = new Date(body.neededBy);
		const expiresAt = this.calculateExpiresAt(body.urgency, neededBy);

		const bloodRequest = await BloodRequest.create({
			requestedBy: new Types.ObjectId(requestedBy),
			patientName: body.patientName,
			bloodType: body.bloodType,
			units: body.units,
			hospital: body.hospital,
			location: body.location,
			latitude: body.latitude ?? null,
			longitude: body.longitude ?? null,
			locationDetails: body.locationDetails ?? null,
			phone: body.phone,
			urgency: body.urgency,
			neededBy,
			expiresAt,
			notes: body.notes || "",
			agreeTerms: body.agreeTerms,
			status: "active",
			respondedDonors: [],
			fulfilledBy: null,
			isExpired: false,
		});

		return bloodRequest;
	}

	static async getUserBloodRequests(userId: string, query: GetUserBloodRequestsQuery) {
		const { skip, limit, page, totalPages } = paginate(query as Record<string, any>);
		const baseFilter: Record<string, any> = { requestedBy: new Types.ObjectId(userId) };

		const listFilter = { ...baseFilter };
		if (query.status) {
			if (query.status === "all") {
				listFilter.status = { $in: ["active", "expired"] };
			} else {
				listFilter.status = query.status;
			}
		}

		const [requests, total, statsResult] = await Promise.all([
			BloodRequest.find(listFilter)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.populate("respondedDonors", "name phone bloodType email")
				.populate("fulfilledBy", "name phone bloodType email"),
			BloodRequest.countDocuments(listFilter),
			BloodRequest.aggregate([
				{ $match: baseFilter },
				{
					$group: {
						_id: null,
						total: { $sum: 1 },
						active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
						fulfilled: { $sum: { $cond: [{ $eq: ["$status", "fulfilled"] }, 1, 0] } },
						cancelled: {
							$sum: {
								$cond: [
									{ $in: ["$status", ["expired", "cancelled"]] },
									1,
									0,
								],
							},
						},
					},
				},
			]),
		]);

		const stats = statsResult[0] || { total: 0, active: 0, fulfilled: 0, cancelled: 0 };

		return {
			requests,
			stats: {
				total: stats.total,
				active: stats.active,
				fulfilled: stats.fulfilled,
				cancelled: stats.cancelled,
			},
			pagination: {
				total,
				page,
				limit,
				totalPages: totalPages(total),
			},
		};
	}

	static async getAllBloodRequests(userId: string | null, query: GetAllBloodRequestsQuery) {
		const { skip, limit, page, totalPages } = paginate(query as Record<string, any>);
		const filter: Record<string, any> = {};
		console.log("[user id:]", userId)
		console.log("[requestdBy id:]", filter)

		// If user is logged in, exclude requests created by that user; else show all
		if (userId) {
			filter.requestedBy = { $ne: new Types.ObjectId(userId) };
		}

		if (query.status) {
			if (query.status === "all") {
				filter.status = { $in: ["active", "expired"] };
			} else {
				filter.status = query.status;
			}
		}

		const [requests, total] = await Promise.all([
			BloodRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
			BloodRequest.countDocuments(filter),
		]);

		return {
			requests,
			pagination: {
				total,
				page,
				limit,
				totalPages: totalPages(total),
			},
		};
	}

	static async cancelBloodRequest(userId: string, params: CancelBloodRequestParams) {
		const request = await BloodRequest.findOne({
			_id: params.id,
			requestedBy: new Types.ObjectId(userId),
		});

		if (!request) {
			throw new ApiError(404, "Blood request not found");
		}

		if (request.status !== "active") {
			throw new ApiError(400, "Only active blood requests can be cancelled");
		}

		request.status = "cancelled";
		request.isExpired = false;
		await request.save();

		return request;
	}

	static async fulfillBloodRequest(userId: string, params: FulfillBloodRequestParams) {
		const request = await BloodRequest.findById(params.id);

		if (!request) {
			throw new ApiError(404, "Blood request not found");
		}

		if (!request.requestedBy.equals(new Types.ObjectId(userId))) {
			throw new ApiError(403, "Only the user who created this blood request can fulfill it");
		}

		if (request.status !== "active") {
			throw new ApiError(400, "Only active blood requests can be fulfilled");
		}

		request.status = "fulfilled";
		request.isExpired = false;
		await request.save();

		return request;
	}

	static async respondToRequest(donorId: string, requestId: string, message?: string) {
		const request = await BloodRequest.findById(requestId);

		if (!request) {
			throw new ApiError(404, "Blood request not found");
		}

		if (request.status !== "active") {
			throw new ApiError(400, "Cannot respond to a non-active blood request");
		}

		const donorObjectId = new Types.ObjectId(donorId);

		// Check if the donor is the same as the requester
		if (request.requestedBy.equals(donorObjectId)) {
			// Get donor's phone number for SMS
			const donorUser = await User.findById(donorId).select("phone name settings").lean();
			if (donorUser?.phone && donorUser.settings?.notifications?.smsAlerts === true) {
				const smsMessage = "You created this blood request, so you cannot respond to it.";
				console.log(`[SMS] To: ${donorUser.phone} - ${smsMessage}`);
			}
			throw new ApiError(400, "You cannot respond to your own blood request");
		}

		// prevent duplicate responses
		if (request.respondedDonors?.some((d) => d.equals(donorObjectId))) {
			throw new ApiError(400, "You have already responded to this request");
		}

		request.respondedDonors = request.respondedDonors || [];
		request.respondedDonors.push(donorObjectId);
		await request.save();

		// Fetch requester and donor details
		const [requester, donor] = await Promise.all([
			User.findById(request.requestedBy).select("email name settings").lean(),
			User.findById(donorId).select("name phone bloodType email").lean(),
		]);

		const shouldEmailRequester = requester?.settings?.notifications?.donorResponses !== false;

		if (requester?.email && shouldEmailRequester) {
			// compose email
			const subject = `Someone responded to your blood request (${request.bloodType})`;
			const donorInfo = donor
				? `<p><strong>Name:</strong> ${donor.name || "-"}</p>
				   <p><strong>Phone:</strong> ${donor.phone || "-"}</p>
				   <p><strong>Blood Type:</strong> ${donor.bloodType || "-"}</p>
				   <p><strong>Email:</strong> ${donor.email || "-"}</p>`
				: "";

			const html = donorRespondedTemplate({
				bloodType: request.bloodType,
				patientName: request.patientName,
				donorInfo,
				message,
			});

			try {
				await sendEmail({ to: requester.email, subject, html });
			} catch (err) {
				// don't fail the operation if email sending fails; log or ignore silently
			}
		}

		return request;
	}

	static async expireBloodRequests() {
		const now = new Date();
		const result = await BloodRequest.updateMany(
			{ status: "active", expiresAt: { $lte: now } },
			{ $set: { status: "expired", isExpired: true } },
		);

		return {
			matchedCount: result.matchedCount,
			modifiedCount: result.modifiedCount,
		};
	}

	static async getLatestBloodRequests() {
		const requests = await BloodRequest.find({ status: "active" })
			.sort({ createdAt: -1 })
			.limit(6);

		return requests;
	}
}
