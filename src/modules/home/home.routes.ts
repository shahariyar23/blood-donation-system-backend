import { Router } from "express";
import { getLatestBloodRequests } from "../bloodRequest/bloodRequest.controller";
import { getHomeDonors } from "../donor/donor.controller";
import {
	getActiveUsersCount,
	getActiveDonorsCount,
	getSuccessfulDonationsCount,
	getCollectedBloodRequestsCount,
	getAllStatistics,
} from "./home.controller";
import { getDonorGroupsByBloodType } from "./home.controller";

const router = Router();

// ══════════════════════════════════════════════════════
//  HOME PAGE ROUTES
// ══════════════════════════════════════════════════════

// GET /api/home/blood-requests/latest
// Returns 6 latest active blood requests
router.get("/blood-requests/latest", getLatestBloodRequests);

// GET /api/home/donors
// Returns 6 nearest donors (20km) for logged-in users, or latest for anonymous
router.get("/donors", getHomeDonors);

// ══════════════════════════════════════════════════════
//  STATISTICS ROUTES
// ══════════════════════════════════════════════════════

// GET /api/home/stats
// Returns all statistics together
router.get("/stats", getAllStatistics);

// GET /api/home/stats/active-users
router.get("/stats/active-users", getActiveUsersCount);

// GET /api/home/stats/active-donors
router.get("/stats/active-donors", getActiveDonorsCount);

// GET /api/home/stats/successful-donations
router.get("/stats/successful-donations", getSuccessfulDonationsCount);

// GET /api/home/stats/collected-requests
router.get("/stats/collected-requests", getCollectedBloodRequestsCount);

// GET /api/home/donors/groups
// Returns donor counts grouped by blood type and availability
router.get("/donors/groups", getDonorGroupsByBloodType);

export default router;
