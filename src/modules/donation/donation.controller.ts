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
