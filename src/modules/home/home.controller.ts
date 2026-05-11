import { Request, Response } from "express";
import { ApiResponse, asyncHandler } from "../../shared/utils";
import { HomeService } from "./home.service";

// ══════════════════════════════════════════════════════
//  GET /api/home/stats/active-users
//  Returns count of active users
// ══════════════════════════════════════════════════════
export const getActiveUsersCount = asyncHandler(async (req: Request, res: Response) => {
	const data = await HomeService.getActiveUsersCount();
	res.status(200).json(new ApiResponse(200, "Active users count fetched", data));
});

// ══════════════════════════════════════════════════════
//  GET /api/home/stats/active-donors
//  Returns count of active donors
// ══════════════════════════════════════════════════════
export const getActiveDonorsCount = asyncHandler(async (req: Request, res: Response) => {
	const data = await HomeService.getActiveDonorsCount();
	res.status(200).json(new ApiResponse(200, "Active donors count fetched", data));
});

// ══════════════════════════════════════════════════════
//  GET /api/home/stats/successful-donations
//  Returns count of successful donations
// ══════════════════════════════════════════════════════
export const getSuccessfulDonationsCount = asyncHandler(async (req: Request, res: Response) => {
	const data = await HomeService.getSuccessfulDonationsCount();
	res.status(200).json(new ApiResponse(200, "Successful donations count fetched", data));
});

// ══════════════════════════════════════════════════════
//  GET /api/home/stats/collected-requests
//  Returns count of collected blood requests (fulfilled)
// ══════════════════════════════════════════════════════
export const getCollectedBloodRequestsCount = asyncHandler(async (req: Request, res: Response) => {
	const data = await HomeService.getCollectedBloodRequestsCount();
	res.status(200).json(new ApiResponse(200, "Collected blood requests count fetched", data));
});

// ══════════════════════════════════════════════════════
//  GET /api/home/stats
//  Returns all statistics together
// ══════════════════════════════════════════════════════
export const getAllStatistics = asyncHandler(async (req: Request, res: Response) => {
	const data = await HomeService.getAllStatistics();
	res.status(200).json(new ApiResponse(200, "All statistics fetched", data));
});

// ══════════════════════════════════════════════════════
//  GET /api/home/donors/groups
//  Returns donors grouped by blood type with counts and availability
// ══════════════════════════════════════════════════════
export const getDonorGroupsByBloodType = asyncHandler(async (req: Request, res: Response) => {
  const data = await HomeService.getDonorGroupsByBloodType();
  res.status(200).json(new ApiResponse(200, "Donor groups fetched", data));
});
