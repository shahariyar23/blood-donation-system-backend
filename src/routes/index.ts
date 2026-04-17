import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import userRoutes from "../modules/user/user.routes";
// import bloodBankRoutes    from "../modules/bloodBank/bloodBank.routes";
// import bloodRequestRoutes from "../modules/bloodRequest/bloodRequest.routes";
// import donationRoutes     from "../modules/donation/donation.routes";
// import notificationRoutes from "../modules/notification/notification.routes";
// import adminRoutes        from "../modules/admin/admin.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users",         userRoutes);
// router.use("/blood-banks",   bloodBankRoutes);
// router.use("/blood-requests", bloodRequestRoutes);
// router.use("/donations",     donationRoutes);
// router.use("/notifications", notificationRoutes);
// router.use("/admin",         adminRoutes);

export default router;
