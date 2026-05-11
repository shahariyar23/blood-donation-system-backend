import { Request, Response } from "express";
import { ApiResponse, asyncHandler } from "../../shared/utils";
import { PublicService } from "./public.service";

export const getBloodGroupAvailability = asyncHandler(async (_req: Request, res: Response) => {
	const data = await PublicService.getBloodGroupAvailability();
	res.status(200).json(new ApiResponse(200, "Blood group availability fetched", data));
});

export const getNearbyDonors = asyncHandler(async (req: Request, res: Response) => {
	const data = await PublicService.getNearbyDonors(req.query as Record<string, any>);
	res.status(200).json(new ApiResponse(200, "Nearby donors fetched", data));
});

export const getLatestBloodRequests = asyncHandler(async (req: Request, res: Response) => {
	const data = await PublicService.getLatestBloodRequests(req.query as Record<string, any>);
	res.status(200).json(new ApiResponse(200, "Latest blood requests fetched", data));
});

export const getImpactStats = asyncHandler(async (_req: Request, res: Response) => {
	const data = await PublicService.getImpactStats();
	res.status(200).json(new ApiResponse(200, "Impact stats fetched", data));
});

export const getUrgentBloodRequest = asyncHandler(async (_req: Request, res: Response) => {
	const data = await PublicService.getUrgentBloodRequest();
	res.status(200).json(new ApiResponse(200, "Urgent blood request fetched", data));
});