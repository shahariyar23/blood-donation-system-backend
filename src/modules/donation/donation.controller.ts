import { Request, Response } from "express";
import { DonationService } from "./donation.service";
import { ApiResponse, asyncHandler } from "../../shared/utils";
import { logActivity } from "../user/activity.logger";

// ══════════════════════════════════════════════════════
//  POST /hospital/donations
//  Create donation (hospital)
// ══════════════════════════════════════════════════════
export const createDonation = asyncHandler(
	async (req: Request, res: Response) => {
		const hospitalId = req.user!.id;
		const donation = await DonationService.createDonation(hospitalId, req.body);

		await logActivity(req, {
			userId: hospitalId,
			event: "request_create",
			meta: {
				action: "hospital_create_donation",
				donationId: donation?._id,
				donorId: donation?.donorId,
				bloodType: donation?.bloodType,
			},
		});

		res
			.status(201)
			.json(new ApiResponse(201, "Donation created", donation));
	},
);

// ══════════════════════════════════════════════════════
//  PATCH /hospital/donations/:id/approve
// ══════════════════════════════════════════════════════
export const approveDonation = asyncHandler(
	async (req: Request, res: Response) => {
		const hospitalId = req.user!.id;
		const donation = await DonationService.approveDonation(
			hospitalId,
			req.params.id,
		);

		await logActivity(req, {
			userId: hospitalId,
			event: "request_respond",
			meta: {
				action: "hospital_approve_donation",
				donationId: req.params.id,
				status: "approved",
				donorId: donation?.donorId,
			},
		});

		res
			.status(200)
			.json(new ApiResponse(200, "Donation approved", donation));
	},
);

// ══════════════════════════════════════════════════════
//  PATCH /hospital/donations/:id/reject
// ══════════════════════════════════════════════════════
export const rejectDonation = asyncHandler(
	async (req: Request, res: Response) => {
		const hospitalId = req.user!.id;
		const donation = await DonationService.rejectDonation(
			hospitalId,
			req.params.id,
			req.body,
		);

		await logActivity(req, {
			userId: hospitalId,
			event: "request_respond",
			meta: {
				action: "hospital_reject_donation",
				donationId: req.params.id,
				status: "rejected",
				reason: req.body?.reportNote || "",
				donorId: donation?.donorId,
			},
		});

		res
			.status(200)
			.json(new ApiResponse(200, "Donation rejected", donation));
	},
);

// ══════════════════════════════════════════════════════
//  GET /hospital/donations
// ══════════════════════════════════════════════════════
export const listHospitalDonations = asyncHandler(
	async (req: Request, res: Response) => {
		const hospitalId = req.user!.id;
		const data = await DonationService.listHospitalDonations(
			hospitalId,
			req.query as any,
		);

		await logActivity(req, {
			userId: hospitalId,
			event: "request_view",
			meta: {
				action: "hospital_list_donations",
				page: req.query.page || 1,
				limit: req.query.limit || 10,
				search: req.query.search || "",
			},
		});

		res
			.status(200)
			.json(new ApiResponse(200, "Donations fetched", data));
	},
);

// ══════════════════════════════════════════════════════
//  POST /donations/request
//  User creates blood request to a donor
// ══════════════════════════════════════════════════════
export const createDonationRequest = asyncHandler(
	async (req: Request, res: Response) => {
		const requesterId = req.user!.id;
		const donation = await DonationService.createDonationRequest(requesterId, req.body);

		await logActivity(req, {
			userId: requesterId,
			event: "request_create",
			meta: {
				action: "user_create_donation_request",
				donationId: donation?._id,
				donorId: donation?.donorId,
				status: donation?.status,
			},
		});

		res
			.status(201)
			.json(new ApiResponse(201, "Donation request sent successfully", donation));
	},
);

// ══════════════════════════════════════════════════════
//  GET /donations/my-requests
//  User lists own requests
// ══════════════════════════════════════════════════════
export const listMyDonationRequests = asyncHandler(
	async (req: Request, res: Response) => {
		const requesterId = req.user!.id;
		const data = await DonationService.listMyDonationRequests(
			requesterId,
			req.query as any,
		);

		await logActivity(req, {
			userId: requesterId,
			event: "request_view",
			meta: {
				action: "user_list_my_donation_requests",
				page: req.query.page || 1,
				limit: req.query.limit || 10,
				status: req.query.status || "",
			},
		});

		res
			.status(200)
			.json(new ApiResponse(200, "Donation requests fetched successfully", data));
	},
);

// ══════════════════════════════════════════════════════
//  POST /hospital/donations/search-request
//  Hospital searches donation request by one identifier (email/phone)
// ══════════════════════════════════════════════════════
export const searchDonationRequestForHospital = asyncHandler(
	async (req: Request, res: Response) => {
		console.log(req.body);
		
		const hospitalId = req.user!.id;
		const data = await DonationService.searchDonationRequestForHospital(
			hospitalId,
			req.body,
		);

		await logActivity(req, {
			userId: hospitalId,
			event: "request_view",
			meta: {
				action: "hospital_search_donation_request",
				identifier: req.body.identifier,
			},
		});

		res
			.status(200)
			.json(new ApiResponse(200, "Donation request found", data));
	},
);

// ══════════════════════════════════════════════════════
//  GET /hospital/donations/search-suggestions
//  Hospital searches donor/user suggestions by phone or email
// ══════════════════════════════════════════════════════
export const searchDonationSuggestions = asyncHandler(
	async (req: Request, res: Response) => {
		const hospitalId = req.user!.id;
		const q = String(req.query.q || "").trim();
		const data = await DonationService.searchDonationSuggestions(q);

		await logActivity(req, {
			userId: hospitalId,
			event: "request_view",
			meta: {
				action: "hospital_search_donation_suggestions",
				query: q,
			},
		});

		res
			.status(200)
			.json(new ApiResponse(200, "Suggestions fetched successfully", data));
	},
);
