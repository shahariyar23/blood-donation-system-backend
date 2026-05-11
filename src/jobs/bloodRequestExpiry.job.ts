import cron from "node-cron";
import { BloodRequestService } from "../modules/bloodRequest/bloodRequest.service";

let isScheduled = false;

export const startBloodRequestExpiryJob = () => {
	if (isScheduled) {
		return;
	}

	isScheduled = true;

	cron.schedule("0 * * * *", async () => {
		try {
			await BloodRequestService.expireBloodRequests();
		} catch (error) {
			console.error("Blood request expiry job failed:", error);
		}
	});
};