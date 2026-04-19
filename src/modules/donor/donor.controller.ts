import { Request, Response } from "express";
import { DonorService } from "./donor.service";
import { ApiResponse, asyncHandler } from "../../shared/utils";

// ══════════════════════════════════════════════════════
//  GET /donors
//  Search donors with distance filtering (public)
// ══════════════════════════════════════════════════════
export const getDonors = asyncHandler(async (req: Request, res: Response) => {
	const data = await DonorService.searchDonors(req.query as any);

	res.status(200).json(
		new ApiResponse(200, "Donors fetched successfully", data)
	);
});

