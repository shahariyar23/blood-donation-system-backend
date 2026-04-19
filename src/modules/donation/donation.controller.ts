import { Request, Response } from "express";
import { DonationService } from "./donation.service";
import { ApiResponse, asyncHandler } from "../../shared/utils";

// ══════════════════════════════════════════════════════
//  POST /hospital/donations
//  Create donation (hospital)
// ══════════════════════════════════════════════════════
export const createDonation = asyncHandler(
	async (req: Request, res: Response) => {
		const hospitalId = req.user!.id;
		const donation = await DonationService.createDonation(hospitalId, req.body);

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

		res
			.status(200)
			.json(new ApiResponse(200, "Donations fetched", data));
	},
);
