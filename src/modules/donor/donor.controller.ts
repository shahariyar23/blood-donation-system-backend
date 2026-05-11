import { Request, Response } from "express";
import { DonorService } from "./donor.service";
import { ApiResponse, asyncHandler } from "../../shared/utils";
import { logActivity } from "../user/activity.logger";

// ══════════════════════════════════════════════════════
//  GET /donors
//  Search donors with distance filtering (public)
// ══════════════════════════════════════════════════════
export const getDonors = asyncHandler(async (req: Request, res: Response) => {
	const data = await DonorService.searchDonors(req.query as any);

	await logActivity(req, {
		userId: req.user?.id,
		event: "donor_search",
		meta: {
			bloodType: req.query.bloodType || null,
			radiusKm: req.query.radiusKm || null,
			page: req.query.page || 1,
		},
	});

	res.status(200).json(
		new ApiResponse(200, "Donors fetched successfully", data)
	);
});

// ══════════════════════════════════════════════════════
//  GET /donors/home
//  Home page donors: nearest 6 within 20km for logged-in users, otherwise latest 6 (public)
// ══════════════════════════════════════════════════════
export const getHomeDonors = asyncHandler(async (req: Request, res: Response) => {
	const userId = req.user?.id;
	const donors = await DonorService.getHomeDonors(userId);

	res.status(200).json(new ApiResponse(200, "Home donors fetched successfully", donors));
});

