import { Request, Response } from "express";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import User from "./User.schema";
import { Donor, CommunityReport, UserActivity, DeletedUser } from "../index";
import { ApiResponse, ApiError, asyncHandler, paginate } from "../../shared/utils";

// ── Helper ─────────────────────────────────────────────
const isValidId = (id: string) => mongoose.Types.ObjectId.isValid(id);

const attachDonorFields = async (user: any) => {
  if (!user) return null;

  const base = typeof user.toObject === "function" ? user.toObject() : user;

  if (base.role !== "donor") {
    return {
      ...base,
      isAvailable: false,
      isDonorVerified: false,
      totalDonations: 0,
      lastDonationDate: null,
    };
  }

  const donor = await Donor.findOne({ userId: base._id }).select(
    "isAvailable totalDonations lastDonationDate isVerified",
  );

  return {
    ...base,
    isAvailable: donor?.isAvailable ?? false,
    isDonorVerified: donor?.isVerified ?? false,
    totalDonations: donor?.totalDonations ?? 0,
    lastDonationDate: donor?.lastDonationDate ?? null,
  };
};

// ══════════════════════════════════════════════════════
//  GET /users/me
//  Get the currently logged-in user's own profile
// ══════════════════════════════════════════════════════
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;

  const user = await User.findById(userId).select(
    "-security.twoFactorSecret"
  );

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const payload = await attachDonorFields(user);

  res
    .status(200)
    .json(new ApiResponse(200, "Profile fetched successfully", payload));
});

// ══════════════════════════════════════════════════════
//  GET /users/:id
//  Get a public profile of any user by ID
// ══════════════════════════════════════════════════════
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const user = await User.findOne({ _id: id, isActive: true }).select(
    "name avatar bloodType location role createdAt lastReceivedDate totalReceived"
  );

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const payload = await attachDonorFields(user);

  res
    .status(200)
    .json(new ApiResponse(200, "User fetched successfully", payload));
});

// ══════════════════════════════════════════════════════
//  PUT /users/me
//  Update the currently logged-in user's profile
// ══════════════════════════════════════════════════════
export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;

  // Strip fields the user is NOT allowed to change
  const forbidden = [
    "role",
    "isVerified",
    "isDonorVerified",
    "isActive",
    "communityFlags",
    "passwordHash",
    "security",
    "totalDonations",
    "lastReceivedDate",
    "totalReceived",
  ];
  forbidden.forEach((field) => delete req.body[field]);

  const updated = await User.findByIdAndUpdate(
    userId,
    { $set: req.body },
    { new: true, runValidators: true }
  ).select("-security.twoFactorSecret");

  if (!updated) {
    throw new ApiError(404, "User not found");
  }

  const payload = await attachDonorFields(updated);

  res
    .status(200)
    .json(new ApiResponse(200, "Profile updated successfully", payload));
});

// ══════════════════════════════════════════════════════
//  PUT /users/me/avatar
//  Upload or update avatar (multer middleware required)
// ══════════════════════════════════════════════════════
export const updateAvatar = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const file   = (req as any).file;

  if (!file) {
    throw new ApiError(400, "No file uploaded");
  }

  const avatarUrl = `/uploads/${file.filename}`;

  const updated = await User.findByIdAndUpdate(
    userId,
    { $set: { avatar: avatarUrl } },
    { new: true }
  ).select("avatar");

  res
    .status(200)
    .json(new ApiResponse(200, "Avatar updated successfully", updated));
});

// ══════════════════════════════════════════════════════
//  PATCH /users/me/availability
//  Toggle donor availability on/off
// ══════════════════════════════════════════════════════
export const toggleAvailability = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;

  const user = await User.findById(userId).select("role");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role !== "donor") {
    throw new ApiError(403, "Only donors can toggle availability");
  }

  const donor = await Donor.findOne({ userId: user._id });

  if (!donor) {
    throw new ApiError(404, "Donor profile not found");
  }

  donor.isAvailable = !donor.isAvailable;
  await donor.save();

  res.status(200).json(
    new ApiResponse(200, `You are now ${donor.isAvailable ? "available" : "unavailable"} for donation`, {
      isAvailable: donor.isAvailable,
    })
  );
});

// ══════════════════════════════════════════════════════
//  PUT /users/me/change-password
//  Change password — requires current password
// ══════════════════════════════════════════════════════
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "Both current and new password are required");
  }

  if (newPassword.length < 8) {
    throw new ApiError(400, "New password must be at least 8 characters");
  }

  if (currentPassword === newPassword) {
    throw new ApiError(400, "New password must be different from current password");
  }

  // passwordHash is select:false — must explicitly request it
  const user = await User.findById(userId).select("+passwordHash");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!isMatch) {
    throw new ApiError(401, "Current password is incorrect");
  }

  user.passwordHash              = await bcrypt.hash(newPassword, 12);
  user.security.passwordChangedAt = new Date();
  user.security.activeSessions    = 0; // force logout all other sessions
  await user.save();

  res
    .status(200)
    .json(new ApiResponse(200, "Password changed successfully. Please log in again."));
});

// ══════════════════════════════════════════════════════
//  DELETE /users/me
//  Soft delete — sets isActive: false, keeps data intact
// ══════════════════════════════════════════════════════
export const deleteMe = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const reason = (req.body?.reason as string) || "";

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const donor = await Donor.findOne({ userId });

  await DeletedUser.create({
    userId: user._id,
    deletedBy: user._id,
    reason: reason.trim() || "user_requested",
    userSnapshot: user.toObject(),
    donorSnapshot: donor ? donor.toObject() : null,
    meta: {
      ip: req.ip || "",
      userAgent: req.headers["user-agent"] || "",
    },
    deletedAt: new Date(),
  });

  user.isActive = false;
  user.isDeleted = true;
  user.deletedAt = new Date();
  user.security.activeSessions = 0;
  await user.save();

  await Promise.all([
    Donor.findOneAndUpdate(
      { userId },
      { $set: { isAvailable: false } },
    ),
  ]);

  res
    .status(200)
    .json(new ApiResponse(200, "Account deleted successfully"));
});

// ══════════════════════════════════════════════════════
//  GET /users/donors
//  Search available verified donors (public)
// ══════════════════════════════════════════════════════
export const getDonors = asyncHandler(async (req: Request, res: Response) => {
  const { bloodType, district, city } = req.query;
  const { skip, limit, page, totalPages } = paginate(req.query);

  const userMatch: Record<string, any> = {
    role:     "donor",
    isActive: true,
  };

  if (bloodType) userMatch.bloodType = bloodType;
  if (district)  userMatch["location.state_district"] = district;
  if (city)      userMatch["location.city"] = city;

  const donorMatch: Record<string, any> = {
    "donor.isAvailable": true,
    "donor.isVerified": true,
  };

  const basePipeline = [
    { $match: userMatch },
    {
      $lookup: {
        from: "donors",
        localField: "_id",
        foreignField: "userId",
        as: "donor",
      },
    },
    { $unwind: "$donor" },
    { $match: donorMatch },
  ];

  const [donors, totalResult] = await Promise.all([
    User.aggregate([
      ...basePipeline,
      { $sort: { "donor.totalDonations": -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          name: 1,
          avatar: 1,
          bloodType: 1,
          location: 1,
          createdAt: 1,
          isAvailable: "$donor.isAvailable",
          totalDonations: "$donor.totalDonations",
          lastDonationDate: "$donor.lastDonationDate",
          isDonorVerified: "$donor.isVerified",
        },
      },
    ]),
    User.aggregate([
      ...basePipeline,
      { $count: "total" },
    ]),
  ]);

  const total = totalResult[0]?.total || 0;

  res.status(200).json(
    new ApiResponse(200, "Donors fetched successfully", {
      donors,
      pagination: {
        total,
        page,
        limit,
        totalPages: totalPages(total),
      },
    })
  );
});

// ══════════════════════════════════════════════════════
//  ADMIN: GET /admin/users
//  Get all users with filters (admin only)
// ══════════════════════════════════════════════════════
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const { role, isActive, bloodType, search } = req.query;
  const { skip, limit, page, totalPages }     = paginate(req.query);

  const filter: Record<string, any> = {};

  if (role)               filter.role      = role;
  if (bloodType)          filter.bloodType = bloodType;
  if (isActive !== undefined)
    filter.isActive = isActive === "true";

  // search by name or email
  if (search) {
    filter.$or = [
      { name:  { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select("-security.twoFactorSecret")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    User.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(200, "Users fetched successfully", {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: totalPages(total),
      },
    })
  );
});

// ══════════════════════════════════════════════════════
//  ADMIN: PATCH /admin/users/:id/status
//  Ban or activate any user (admin only)
// ══════════════════════════════════════════════════════
export const updateUserStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id }       = req.params;
  const { isActive } = req.body;

  if (!isValidId(id)) {
    throw new ApiError(400, "Invalid user ID");
  }

  if (typeof isActive !== "boolean") {
    throw new ApiError(400, "isActive must be a boolean");
  }

  const user = await User.findByIdAndUpdate(
    id,
    { $set: { isActive } },
    { new: true }
  ).select("name email isActive");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json(
    new ApiResponse(
      200,
      `User ${isActive ? "activated" : "banned"} successfully`,
      user
    )
  );
});

// ══════════════════════════════════════════════════════
//  ADMIN: PATCH /admin/users/:id/verify-donor
//  Verify a donor account (admin only)
// ══════════════════════════════════════════════════════
export const verifyDonor = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const user = await User.findById(id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role !== "donor") {
    throw new ApiError(400, "User is not a donor");
  }

  const donor = await Donor.findOne({ userId: user._id });

  if (!donor) {
    throw new ApiError(404, "Donor profile not found");
  }

  if (donor.isVerified) {
    throw new ApiError(400, "Donor is already verified");
  }

  donor.isVerified = true;
  await donor.save();

  res.status(200).json(
    new ApiResponse(200, "Donor verified successfully", {
      id:              user._id,
      name:            user.name,
      isDonorVerified: donor.isVerified,
    })
  );
});

// ══════════════════════════════════════════════════════
//  POST /users/:id/report
//  Report a user (community flag)
// ══════════════════════════════════════════════════════
export const reportUser = asyncHandler(async (req: Request, res: Response) => {
  const reportedUserId = req.params.id;
  const reporterId = req.user!.id;
  const { reason, description } = req.body as {
    reason: "fake_profile" | "no_response" | "wrong_info" | "abusive" | "other";
    description?: string;
  };

  if (!isValidId(reportedUserId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  if (reportedUserId === reporterId) {
    throw new ApiError(400, "You cannot report yourself");
  }

  const allowedReasons = [
    "fake_profile",
    "no_response",
    "wrong_info",
    "abusive",
    "other",
  ];

  if (!allowedReasons.includes(reason)) {
    throw new ApiError(400, "Invalid report reason");
  }

  const reportedUser = await User.findById(reportedUserId).select("isActive");
  if (!reportedUser || !reportedUser.isActive) {
    throw new ApiError(404, "User not found");
  }

  const report = await CommunityReport.create({
    reportedBy: reporterId,
    reportedUser: reportedUserId,
    reason,
    description: description || "",
  });

  const updated = await User.findByIdAndUpdate(
    reportedUserId,
    { $inc: { communityFlags: 1 } },
    { new: true },
  ).select("communityFlags");

  await UserActivity.create({
    userId: reporterId,
    sessionId: req.user!.sessionId,
    event: "report_submit",
    meta: { reportedUserId, reason, reportId: report._id },
    ip: req.ip,
    userAgent: req.headers["user-agent"] || "",
    timestamp: new Date(),
  }).catch(() => {});

  res.status(201).json(
    new ApiResponse(201, "Report submitted successfully", {
      reportId: report._id,
      communityFlags: updated?.communityFlags ?? 0,
    }),
  );
});

// ══════════════════════════════════════════════════════
//  PATCH /admin/users/:id/community-flags
//  Adjust community flags (admin)
// ══════════════════════════════════════════════════════
export const updateCommunityFlags = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { action, value } = req.body as {
      action: "increment" | "decrement" | "set" | "reset";
      value?: number;
    };

    if (!isValidId(id)) {
      throw new ApiError(400, "Invalid user ID");
    }

    if (!action) {
      throw new ApiError(400, "Action is required");
    }

    let updated: any = null;

    switch (action) {
      case "increment": {
        const delta = typeof value === "number" ? value : 1;
        if (delta <= 0) throw new ApiError(400, "Value must be > 0");
        updated = await User.findByIdAndUpdate(
          id,
          { $inc: { communityFlags: delta } },
          { new: true },
        ).select("communityFlags");
        break;
      }
      case "decrement": {
        const delta = typeof value === "number" ? value : 1;
        if (delta <= 0) throw new ApiError(400, "Value must be > 0");
        updated = await User.findByIdAndUpdate(
          id,
          { $inc: { communityFlags: -delta } },
          { new: true },
        ).select("communityFlags");

        if (updated && updated.communityFlags < 0) {
          updated = await User.findByIdAndUpdate(
            id,
            { $set: { communityFlags: 0 } },
            { new: true },
          ).select("communityFlags");
        }
        break;
      }
      case "set": {
        if (typeof value !== "number" || value < 0) {
          throw new ApiError(400, "Value must be a non-negative number");
        }
        updated = await User.findByIdAndUpdate(
          id,
          { $set: { communityFlags: value } },
          { new: true },
        ).select("communityFlags");
        break;
      }
      case "reset": {
        updated = await User.findByIdAndUpdate(
          id,
          { $set: { communityFlags: 0 } },
          { new: true },
        ).select("communityFlags");
        break;
      }
      default:
        throw new ApiError(400, "Invalid action");
    }

    if (!updated) {
      throw new ApiError(404, "User not found");
    }

    res.status(200).json(
      new ApiResponse(200, "Community flags updated", {
        id,
        communityFlags: updated.communityFlags,
      }),
    );
  },
);