import { Types } from "mongoose";
import BloodRequest from "./BloodRequest.schema";
import { ApiError, paginate, sendEmail } from "../../shared/utils";
import User from "../user/User.schema";
import {
	CancelBloodRequestParams,
	CreateBloodRequestInput,
	GetUserBloodRequestsQuery,
} from "./bloodRequest.validation";

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
		const filter: Record<string, any> = { requestedBy: new Types.ObjectId(userId) };

		if (query.status) {
			filter.status = query.status;
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

	static async respondToRequest(donorId: string, requestId: string, message?: string) {
		const request = await BloodRequest.findById(requestId);

		if (!request) {
			throw new ApiError(404, "Blood request not found");
		}

		if (request.status !== "active") {
			throw new ApiError(400, "Cannot respond to a non-active blood request");
		}

		const donorObjectId = new Types.ObjectId(donorId);
		// prevent duplicate responses
		if (request.respondedDonors?.some((d) => d.equals(donorObjectId))) {
			throw new ApiError(400, "You have already responded to this request");
		}

		request.respondedDonors = request.respondedDonors || [];
		request.respondedDonors.push(donorObjectId);
		await request.save();

		// Fetch requester and donor details
		const [requester, donor] = await Promise.all([
			User.findById(request.requestedBy).select("email name").lean(),
			User.findById(donorId).select("name phone bloodType email").lean(),
		]);

		if (requester?.email) {
			// compose email
			const subject = `Someone responded to your blood request (${request.bloodType})`;
			const donorInfo = donor
				? `<p><strong>Name:</strong> ${donor.name || "-"}</p>
				   <p><strong>Phone:</strong> ${donor.phone || "-"}</p>
				   <p><strong>Blood Type:</strong> ${donor.bloodType || "-"}</p>
				   <p><strong>Email:</strong> ${donor.email || "-"}</p>`
				: "";

			const html = `
				<p>Hello,</p>
				<p>A donor has responded to your blood request for <strong>${request.bloodType}</strong> (patient: ${request.patientName}).</p>
				${donorInfo}
				${message ? `<p><strong>Message from donor:</strong> ${message}</p>` : ""}
				<p>Please login to your account to view and coordinate the donation.</p>
				`;

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