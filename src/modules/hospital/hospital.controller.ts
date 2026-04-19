import { Request, Response } from "express";
import { HospitalService } from "./hospital.service";
import { ApiResponse, asyncHandler } from "../../shared/utils";

// ══════════════════════════════════════════════════════
//  GET /hospital/donors/search
//  Search donor by email or phone (hospital only)
// ══════════════════════════════════════════════════════
export const searchHospitalDonor = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await HospitalService.searchDonor(req.query as any);

    res
      .status(200)
      .json(new ApiResponse(200, "Donor fetched successfully", data));
  },
);
