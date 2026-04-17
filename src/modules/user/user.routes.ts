import { Router } from "express";
import {
	getMe,
	getUserById,
	updateMe,
	updateAvatar,
	toggleAvailability,
	changePassword,
	deleteMe,
	getDonors,
	getAllUsers,
	updateUserStatus,
	verifyDonor,
	reportUser,
	updateCommunityFlags,
} from "./user.controller";
import { protect } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/role.middleware";
import { upload } from "../../middleware/upload.middleware";

const router = Router();

// ── Admin routes ─────────────────────────────────────
router.get("/", protect, authorize("admin"), getAllUsers);
router.patch("/:id/status", protect, authorize("admin"), updateUserStatus);
router.patch("/:id/verify-donor", protect, authorize("admin"), verifyDonor);
router.patch(
	"/:id/community-flags",
	protect,
	authorize("admin"),
	updateCommunityFlags,
);

// ── Authenticated routes ─────────────────────────────
router.get("/me", protect, getMe);
router.put("/me", protect, updateMe);
router.put("/me/avatar", protect, upload.avatar, updateAvatar);
router.patch("/me/availability", protect, toggleAvailability);
router.put("/me/change-password", protect, changePassword);
router.delete("/me", protect, deleteMe);
router.post("/:id/report", protect, reportUser);

// ── Public routes ────────────────────────────────────
router.get("/donors", getDonors);
router.get("/:id", getUserById);

export default router;
