import { Request, Response } from "express";
import { ApiResponse, asyncHandler } from "../../shared/utils";
import { BloodBankService } from "./bloodBank.service";

export const getBloodBankPublicSettings = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = await BloodBankService.getPublicSettings();

    res
      .status(200)
      .json(new ApiResponse(200, "Blood bank settings retrieved successfully", data));
  },
);

export const searchBloodBanks = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await BloodBankService.search(req.query as Record<string, string>);

    res
      .status(200)
      .json(new ApiResponse(200, "Blood bank search completed successfully", data));
  },
);

export const getBloodBankAdminSettings = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = await BloodBankService.getAdminSettings();

    res
      .status(200)
      .json(new ApiResponse(200, "Blood bank admin settings retrieved successfully", data));
  },
);

export const updateBloodBankAdminSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await BloodBankService.updateSettings(req.body);

    res
      .status(200)
      .json(new ApiResponse(200, "Blood bank settings updated successfully", data));
  },
);
