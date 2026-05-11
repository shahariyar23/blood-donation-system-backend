import { Router } from "express";
import {
	getBloodGroupAvailability,
	getImpactStats,
	getLatestBloodRequests,
	getNearbyDonors,
	getUrgentBloodRequest,
} from "./public.controller";

const router = Router();

router.get("/blood-groups/availability", getBloodGroupAvailability);
router.get("/donors/nearby", getNearbyDonors);
router.get("/blood-requests/latest", getLatestBloodRequests);
router.get("/stats/impact", getImpactStats);
router.get("/blood-requests/urgent", getUrgentBloodRequest);

export default router;