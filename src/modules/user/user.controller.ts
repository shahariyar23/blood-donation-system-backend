import { Request, Response } from "express";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import User from "./User.schema";
import { ApiResponse, ApiError, asyncHandler, paginate } from "../../shared/utils";

// ── Helper ─────────────────────────────────────────────
const isValidId = (id: string) => mongoose.Types.ObjectId.isValid(id);

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

  res
    .status(200)
    .json(new ApiResponse(200, "Profile fetched successfully", user));
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
    "name avatar bloodType location isAvailable totalDonations lastDonationDate role isDonorVerified createdAt"
  );

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, "User fetched successfully", user));
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

  res
    .status(200)
    .json(new ApiResponse(200, "Profile updated successfully", updated));
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

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role !== "donor") {
    throw new ApiError(403, "Only donors can toggle availability");
  }

  user.isAvailable = !user.isAvailable;
  await user.save();

  res.status(200).json(
    new ApiResponse(200, `You are now ${user.isAvailable ? "available" : "unavailable"} for donation`, {
      isAvailable: user.isAvailable,
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

  await User.findByIdAndUpdate(userId, {
    $set: {
      isActive:    false,
      isAvailable: false,
    },
  });

  res
    .status(200)
    .json(new ApiResponse(200, "Account deactivated successfully"));
});

// ══════════════════════════════════════════════════════
//  GET /users/donors
//  Search available verified donors (public)
// ══════════════════════════════════════════════════════
export const getDonors = asyncHandler(async (req: Request, res: Response) => {
  const { bloodType, district, city } = req.query;
  const { skip, limit, page, totalPages } = paginate(req.query);

  const filter: Record<string, any> = {
    role:            "donor",
    isAvailable:     true,
    isActive:        true,
    isDonorVerified: true,
  };

  if (bloodType) filter.bloodType                      = bloodType;
  if (district)  filter["location.state_district"]     = district;
  if (city)      filter["location.city"]               = city;

  const [donors, total] = await Promise.all([
    User.find(filter)
      .select(
        "name avatar bloodType location isAvailable totalDonations lastDonationDate createdAt"
      )
      .skip(skip)
      .limit(limit)
      .sort({ totalDonations: -1 }),
    User.countDocuments(filter),
  ]);

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

  if (user.isDonorVerified) {
    throw new ApiError(400, "Donor is already verified");
  }

  user.isDonorVerified = true;
  await user.save();

  res.status(200).json(
    new ApiResponse(200, "Donor verified successfully", {
      id:              user._id,
      name:            user.name,
      isDonorVerified: user.isDonorVerified,
    })
  );
});