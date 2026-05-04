import { Router } from "express";
import {
	getUserById,
	promoteToAdmin,
	updateAvatar,
	toggleAvailability,
	getAllUsers,
	createHospital,
	updateUserStatus,
	verifyDonor,
	reportUser,
	updateCommunityFlags,
	myDonation,
} from "./user.controller";
import { protect } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/role.middleware";
import { upload } from "../../middleware/upload.middleware";

const router = Router();

// ── Dev routes ───────────────────────────────────────
router.post("/dev/promote-admin", promoteToAdmin);

// ── Admin routes ─────────────────────────────────────
router.get("/", protect, authorize("admin"), getAllUsers);
router.post("/hospitals", protect, authorize("admin"), createHospital);
router.patch("/:id/status", protect, authorize("admin"), updateUserStatus);
router.patch("/:id/verify-donor", protect, authorize("admin"), verifyDonor);
router.patch(
	"/:id/community-flags",
	protect,
	authorize("admin"),
	updateCommunityFlags,
);

// ── Authenticated routes ─────────────────────────────
router.put("/me/avatar", protect, upload.avatar, updateAvatar);
router.patch("/me/availability", protect, toggleAvailability);
router.post("/:id/report", protect, reportUser);

// ── get routes ────────────────────────────────────
router.get("/:id",protect, getUserById);
router.get("/my-donation/:id",protect, myDonation);

export default router;
