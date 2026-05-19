import { Router } from "express";
import { protect } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import {
  getBloodBankAdminSettings,
  getBloodBankPublicSettings,
  searchBloodBanks,
  updateBloodBankAdminSettings,
} from "./bloodBank.controller";

const router = Router();

router.get("/settings", getBloodBankPublicSettings);
router.get("/search", searchBloodBanks);

router.use("/admin", protect, requireRole("admin"));
router.get("/admin/settings", getBloodBankAdminSettings);
router.patch("/admin/settings", updateBloodBankAdminSettings);
router.put("/admin/settings", updateBloodBankAdminSettings);

export default router;
