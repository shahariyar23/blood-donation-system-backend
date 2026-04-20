import { Request, Response } from "express";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import User from "./User.schema";
import { Donor, CommunityReport, UserActivity } from "../index";
import { logActivity } from "./activity.logger";
import {
  ApiResponse,
  ApiError,
  asyncHandler,
  paginate,
} from "../../shared/utils";

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
    "isAvailable totalDonations lastDonationDate nextAvailableAt isVerified",
  );

  const now = new Date();
  const computedAvailable = donor?.nextAvailableAt
    ? now >= donor.nextAvailableAt
    : donor?.isAvailable ?? false;

  return {
    ...base,
    isAvailable: computedAvailable,
    isDonorVerified: donor?.isVerified ?? false,
    totalDonations: donor?.totalDonations ?? 0,
    lastDonationDate: donor?.lastDonationDate ?? null,
  };
};

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
    "name email phone gender bloodType location role createdAt lastReceivedDate totalReceived socialLinks communityFlags",
  );

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const payload = await attachDonorFields(user);

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_view",
    meta: {
      action: "view_public_profile",
      targetUserId: id,
    },
  });

  res
    .status(200)
    .json(new ApiResponse(200, "User fetched successfully", payload));
});

// ══════════════════════════════════════════════════════
//  DEV: POST /users/dev/promote-admin
//  Promote a user to admin (dev only)
// ══════════════════════════════════════════════════════
export const promoteToAdmin = asyncHandler(async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === "production") {
    throw new ApiError(403, "This endpoint is disabled in production");
  }

  const { email, userId } = req.body as { email?: string; userId?: string };

  if (!email && !userId) {
    throw new ApiError(400, "email or userId is required");
  }

  if (userId && !isValidId(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const normalizedEmail = email ? email.toLowerCase().trim() : null;
  const user = await User.findOne(
    userId ? { _id: userId } : { email: normalizedEmail },
  ).select("name email role isVerified");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role === "admin") {
    throw new ApiError(400, "User is already an admin");
  }

  user.role = "admin";
  user.isVerified = true;
  await user.save();

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_update",
    meta: {
      action: "promote_to_admin",
      targetUserId: user._id,
      targetEmail: user.email,
    },
  });

  res.status(200).json(
    new ApiResponse(200, "User promoted to admin", {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    }),
  );
});

// ══════════════════════════════════════════════════════
//  PUT /users/me/avatar
//  Upload or update avatar (multer middleware required)
// ══════════════════════════════════════════════════════
export const updateAvatar = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const file = (req as any).file;

    if (!file) {
      throw new ApiError(400, "No file uploaded");
    }

    const avatarUrl = `/uploads/${file.filename}`;

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: { avatar: avatarUrl } },
      { new: true },
    ).select("avatar");

    await logActivity(req, {
      userId,
      event: "avatar_upload",
      meta: { action: "update_avatar" },
    });

    res
      .status(200)
      .json(new ApiResponse(200, "Avatar updated successfully", updated));
  },
);

// ══════════════════════════════════════════════════════
//  PATCH /users/me/availability
//  Toggle donor availability on/off
// ══════════════════════════════════════════════════════
export const toggleAvailability = asyncHandler(
  async (req: Request, res: Response) => {
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

    await logActivity(req, {
      userId,
      event: "availability_toggle",
      meta: {
        action: "toggle_availability",
        isAvailable: donor.isAvailable,
      },
    });

    res.status(200).json(
      new ApiResponse(
        200,
        `You are now ${donor.isAvailable ? "available" : "unavailable"} for donation`,
        {
          isAvailable: donor.isAvailable,
        },
      ),
    );
  },
);

// ══════════════════════════════════════════════════════
//  ADMIN: GET /admin/users
//  Get all users with filters (admin only)
// ══════════════════════════════════════════════════════
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const { role, isActive, bloodType, search } = req.query;
  const { skip, limit, page, totalPages } = paginate(req.query);

  const filter: Record<string, any> = {};

  if (role) filter.role = role;
  if (bloodType) filter.bloodType = bloodType;
  if (isActive !== undefined) filter.isActive = isActive === "true";

  // search by name or email
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
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

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_view",
    meta: {
      action: "admin_list_users",
      role: role || "",
      bloodType: bloodType || "",
      search: search || "",
      page,
      limit,
      total,
    },
  });

  res.status(200).json(
    new ApiResponse(200, "Users fetched successfully", {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: totalPages(total),
      },
    }),
  );
});

// ══════════════════════════════════════════════════════
//  ADMIN: POST /admin/hospitals
//  Create hospital account (admin only)
// ══════════════════════════════════════════════════════
export const createHospital = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, phone, password, location } = req.body as Record<string, any>;

  if (!name || !email || !phone || !password) {
    throw new ApiError(400, "name, email, phone, and password are required");
  }

  if (typeof password !== "string" || password.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const [emailExists, phoneExists] = await Promise.all([
    User.findOne({ email: normalizedEmail }),
    User.findOne({ phone: String(phone).trim() }),
  ]);

  if (emailExists) throw new ApiError(409, "Email is already registered");
  if (phoneExists) throw new ApiError(409, "Phone is already registered");

  const passwordHash = await bcrypt.hash(password, 12);

  const hospitalLocation = location && typeof location === "object"
    ? {
        displayName: location.displayName || "",
        road: location.road || "",
        quarter: location.quarter || "",
        suburb: location.suburb || "",
        city: location.city || location.county || "",
        county: location.county || "",
        state_district: location.state_district || "",
        state: location.state || "",
        postcode: location.postcode || "",
        country: location.country || "",
        country_code: location.country_code || "",
        coordinates: {
          lat: location.coordinates?.lat ?? null,
          lng: location.coordinates?.lng ?? null,
        },
      }
    : {
        displayName: "",
        road: "",
        quarter: "",
        suburb: "",
        city: "",
        county: "",
        state_district: "",
        state: "",
        postcode: "",
        country: "",
        country_code: "",
        coordinates: { lat: null, lng: null },
      };

  const hospital = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    phone: String(phone).trim(),
    passwordHash,
    role: "hospital",
    isVerified: true,
    isActive: true,
    location: hospitalLocation,
  });

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_update",
    meta: {
      action: "admin_create_hospital",
      targetUserId: hospital._id,
      targetEmail: hospital.email,
    },
  });

  res.status(201).json(
    new ApiResponse(201, "Hospital created", {
      id: hospital._id,
      name: hospital.name,
      email: hospital.email,
      role: hospital.role,
    }),
  );
});

// ══════════════════════════════════════════════════════
//  ADMIN: PATCH /admin/users/:id/status
//  Ban or activate any user (admin only)
// ══════════════════════════════════════════════════════
export const updateUserStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
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
      { new: true },
    ).select("name email isActive");

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    await logActivity(req, {
      userId: req.user?.id,
      event: "profile_update",
      meta: {
        action: "admin_update_user_status",
        targetUserId: id,
        isActive,
      },
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          `User ${isActive ? "activated" : "banned"} successfully`,
          user,
        ),
      );
  },
);

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

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_update",
    meta: {
      action: "admin_verify_donor",
      targetUserId: id,
      isDonorVerified: true,
    },
  });

  res.status(200).json(
    new ApiResponse(200, "Donor verified successfully", {
      id: user._id,
      name: user.name,
      isDonorVerified: donor.isVerified,
    }),
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

    await logActivity(req, {
      userId: req.user?.id,
      event: "profile_update",
      meta: {
        action: "admin_update_community_flags",
        targetUserId: id,
        operation: action,
        value: value ?? null,
        communityFlags: updated.communityFlags,
      },
    });

    res.status(200).json(
      new ApiResponse(200, "Community flags updated", {
        id,
        communityFlags: updated.communityFlags,
      }),
    );
  },
);
