import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import userRoutes from "../modules/user/user.routes";
import donorRoutes from "../modules/donor/donor.routes";
import donationRoutes from "../modules/donation/donation.routes";
import bloodRequestRoutes from "../modules/bloodRequest/bloodRequest.routes";
import hospitalRoutes from "../modules/hospital/hospital.routes";
import adminRoutes from "../modules/admin/admin.routes";
import publicRoutes from "../modules/public/public.routes";
import homeRoutes from "../modules/home/home.routes";
// import bloodBankRoutes    from "../modules/bloodBank/bloodBank.routes";
// import bloodRequestRoutes from "../modules/bloodRequest/bloodRequest.routes";
// import donationRoutes     from "../modules/donation/donation.routes";
// import notificationRoutes from "../modules/notification/notification.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/home", homeRoutes);
router.use("/users", userRoutes);
router.use("/donors", donorRoutes);
router.use("/hospital/donations", donationRoutes);
router.use("/donations", donationRoutes);
router.use("/blood-requests", bloodRequestRoutes);
router.use("/hospital", hospitalRoutes);
router.use("/admin", adminRoutes);
router.use("/public", publicRoutes);
// router.use("/blood-banks",   bloodBankRoutes);
// router.use("/blood-requests", bloodRequestRoutes);
// router.use("/donations",     donationRoutes);
// router.use("/notifications", notificationRoutes);

export default router;
