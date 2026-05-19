import { Request, Response } from "express";
import { ApiResponse, asyncHandler } from "../../shared/utils";
import { BloodRequestService } from "./bloodRequest.service";

export const createBloodRequest = asyncHandler(async (req: Request, res: Response) => {
	const requestedBy = req.user!.id;
	const bloodRequest = await BloodRequestService.createBloodRequest(requestedBy, req.body);
	res.status(201).json(new ApiResponse(201, "Blood request created successfully", bloodRequest));
});

export const getUserBloodRequests = asyncHandler(async (req: Request, res: Response) => {
	const userId = req?.user!.id;
	console.log("[get user blood request]: ", req.user)
	const data = await BloodRequestService.getUserBloodRequests(userId, req.query as any);
	res.status(200).json(new ApiResponse(200, "Blood requests fetched successfully", data));
});

export const cancelBloodRequest = asyncHandler(async (req: Request, res: Response) => {
	const userId = req.user!.id;
	const bloodRequest = await BloodRequestService.cancelBloodRequest(userId, req.params as any);
	res.status(200).json(new ApiResponse(200, "Blood request cancelled successfully", bloodRequest));
});

export const fulfillBloodRequest = asyncHandler(async (req: Request, res: Response) => {
	const userId = req.user!.id;
	const bloodRequest = await BloodRequestService.fulfillBloodRequest(userId, req.params as any);
	res.status(200).json(new ApiResponse(200, "Blood request fulfilled successfully", bloodRequest));
});

export const respondDonor = asyncHandler(async (req: Request, res: Response) => {
	const donorId = req.user!.id;
	const requestId = req.params.id;
	const message = (req.body && req.body.message) ? String(req.body.message) : undefined;

	const result = await BloodRequestService.respondToRequest(donorId, requestId, message);

	res.status(200).json(new ApiResponse(200, "Response recorded and requester notified", result));
});

export const getLatestBloodRequests = asyncHandler(async (req: Request, res: Response) => {
	const requests = await BloodRequestService.getLatestBloodRequests();
	res.status(200).json(new ApiResponse(200, "Latest blood requests fetched successfully", requests));
});

export const getAllBloodRequests = asyncHandler(async (req: Request, res: Response) => {
	const userId = req.user?.id || null; // null if not logged in
	const data = await BloodRequestService.getAllBloodRequests(userId, req.query as any);
	res.status(200).json(new ApiResponse(200, "Blood requests fetched successfully", data));
});
