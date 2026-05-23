import { Router } from "express";
import { protect } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { login } from "../auth/auth.controller";
import { authLimiter } from "../../middleware/rateLimiter.middleware";
import { validate } from "../../middleware/validation.middleware";
import { loginSchema } from "../auth/auth.validation";
import { adminBulkEmailSchema } from "./admin.validation";
import {
  getAdminDashboard,
  getAdminMe,
  getAdminReports,
  getAdminUsers,
  getAdminUserById,
  getAdminHospitals,
  getAdminHospitalById,
  updateAdminHospitalStatus,
  verifyAdminHospital,
  unverifyAdminHospital,
  reviewAdminReport,
  updateAdminCommunityFlags,
  updateAdminUserStatus,
  verifyAdminDonor,
  verifyAdminUser,
  getAdminBloodRequests,
  getAdminBloodRequestById,
  getAdminDonations,
  getAdminDonationById,
  updateAdminDonationStatus,
  getAdminDeletedUsers,
  getAdminDeletedUserById,
  restoreAdminDeletedUser,
  permanentlyDeleteAdminDeletedUser,
  getAdminVerifications,
  verifyAdminVerification,
  getAdminSettings,
  updateAdminSettings,
  sendAdminBulkEmail,
  exportAdminUsers,
  exportAdminDeletedUsers,
  exportAdminBloodRequests,
  exportAdminDonations,
  exportAdminHospitals,
  exportAdminReports,
  exportAdminVerifications,
  getAdminReportJobs,
  getAdminReportJobById,
  downloadAdminReportJob,
  getAdminReportAuditLogs,
} from "./admin.controller";

const router = Router();

router.post("/auth/login", authLimiter, validate(loginSchema), login);

router.use(protect, requireRole("admin"));

router.get("/me", getAdminMe);
router.get("/dashboard", getAdminDashboard);
router.post("/emails/send", validate(adminBulkEmailSchema), sendAdminBulkEmail);
router.get("/report-jobs", getAdminReportJobs);
router.get("/report-jobs/:id", getAdminReportJobById);
router.get("/report-jobs/:id/download", downloadAdminReportJob);
router.get("/report-audit-logs", getAdminReportAuditLogs);


router.get("/users/export", exportAdminUsers);
router.get("/users", getAdminUsers);
router.get("/users/:id", getAdminUserById);
router.patch("/users/:id/status", updateAdminUserStatus);
router.patch("/users/:id/verify-donor", verifyAdminDonor);
router.patch("/users/:id/verify-user", verifyAdminUser);
router.patch("/users/:id/community-flags", updateAdminCommunityFlags);

router.get("/hospitals/export", exportAdminHospitals);
router.get("/hospitals", getAdminHospitals);
router.get("/hospitals/:id", getAdminHospitalById);
router.patch("/hospitals/:id/status", updateAdminHospitalStatus);
router.patch("/hospitals/:id/verify", verifyAdminHospital);
router.patch("/hospitals/:id/unverify", unverifyAdminHospital);


router.get("/reports/export", exportAdminReports);
router.get("/reports", getAdminReports);
router.patch("/reports/:id/review", reviewAdminReport);

router.get("/blood-requests/export", exportAdminBloodRequests);
router.get("/blood-requests", getAdminBloodRequests);
router.get("/blood-requests/:id", getAdminBloodRequestById);


router.get("/donations/export", exportAdminDonations);
router.get("/donations", getAdminDonations);
router.get("/donations/:id", getAdminDonationById);
router.patch("/donations/:id/status", updateAdminDonationStatus);
router.get("/deleted-users/export", exportAdminDeletedUsers);
router.get("/deleted-users", getAdminDeletedUsers);
router.get("/deleted-users/:id", getAdminDeletedUserById);
router.post("/deleted-users/:id/restore", restoreAdminDeletedUser);
router.delete("/deleted-users/:id", permanentlyDeleteAdminDeletedUser);
router.get("/verifications/export", exportAdminVerifications);
router.get("/verifications", getAdminVerifications);
router.get("/settings", getAdminSettings);
router.patch("/verifications/:id/verify", verifyAdminVerification);
router.patch("/settings", updateAdminSettings);

export default router;
