import { Request, Response } from "express";
import { ApiError, ApiResponse, asyncHandler } from "../../shared/utils";
import { AdminService } from "./admin.service";
import { logActivity } from "../user/activity.logger";

const parseVerificationBody = (body: any) => {
  if (typeof body?.isVerified === "boolean") {
    return {
      isVerified: body.isVerified,
      isActive: typeof body?.isActive === "boolean" ? body.isActive : undefined,
      status: body.isVerified ? "verified" : "unverified",
    };
  }

  const status = String(body?.status || "").trim().toLowerCase();

  if (["verified", "verify"].includes(status)) {
    return { isVerified: true, isActive: undefined, status: "verified" };
  }

  if (["unverified", "unverify"].includes(status)) {
    return { isVerified: false, isActive: undefined, status: "unverified" };
  }

  if (["blocked", "block", "banned", "ban"].includes(status)) {
    return { isVerified: false, isActive: false, status: "blocked" };
  }

  throw new ApiError(400, "status must be verified, unverified, or blocked");
};

export const getAdminMe = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdminService.getAdminMe(req.user!.id);

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_view",
    meta: {
      action: "admin_me",
    },
  });

  res.status(200).json(new ApiResponse(200, "Admin profile fetched successfully", data));
});

export const getAdminDashboard = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdminService.getDashboard();

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_view",
    meta: {
      action: "admin_dashboard",
    },
  });

  res.status(200).json(new ApiResponse(200, "Admin dashboard fetched successfully", data));
});

export const getAdminUsers = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdminService.getUsers(req.query as Record<string, string>);

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_view",
    meta: {
      action: "admin_users",
      filters: req.query,
    },
  });

  res.status(200).json(new ApiResponse(200, "Admin users fetched successfully", data));
});

export const getAdminHospitals = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdminService.getHospitals(req.query as Record<string, string>);

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_view",
    meta: {
      action: "admin_hospitals",
      filters: req.query,
    },
  });

  res.status(200).json(new ApiResponse(200, "Hospitals fetched successfully", data));
});

export const getAdminHospitalById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = await AdminService.getHospitalById(id);

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_view",
    meta: {
      action: "admin_hospital_details",
      targetHospitalId: id,
    },
  });

  res.status(200).json(new ApiResponse(200, "Hospital details fetched successfully", data));
});

export const getAdminUserById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = await AdminService.getUserById(id);

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_view",
    meta: {
      action: "admin_user_details",
      targetUserId: id,
    },
  });

  res.status(200).json(new ApiResponse(200, "User details fetched successfully", data));
});

export const getAdminReports = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdminService.getReports(req.query as Record<string, string>);

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_view",
    meta: {
      action: "admin_reports",
      filters: req.query,
    },
  });

  res.status(200).json(new ApiResponse(200, "Admin reports fetched successfully", data));
});

export const updateAdminUserStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { isActive } = req.body as { isActive: boolean };

    if (typeof isActive !== "boolean") {
      throw new ApiError(400, "isActive must be a boolean");
    }

    const data = await AdminService.updateUserStatus(id, isActive);

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
          data,
        ),
      );
  },
);

export const updateAdminHospitalStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { isActive } = req.body as { isActive: boolean };

    if (typeof isActive !== "boolean") {
      throw new ApiError(400, "isActive must be a boolean");
    }

    const data = await AdminService.updateHospitalStatus(id, isActive);

    await logActivity(req, {
      userId: req.user?.id,
      event: "profile_update",
      meta: {
        action: "admin_update_hospital_status",
        targetHospitalId: id,
        isActive,
      },
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          `Hospital ${isActive ? "activated" : "deactivated"} successfully`,
          data,
        ),
      );
  },
);

export const verifyAdminHospital = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = await AdminService.verifyHospital(id);

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_update",
    meta: {
      action: "admin_verify_hospital",
      targetHospitalId: id,
      isVerified: true,
    },
  });

  res.status(200).json(new ApiResponse(200, "Hospital verified successfully", data));
});

export const unverifyAdminHospital = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = await AdminService.unverifyHospital(id);

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_update",
    meta: {
      action: "admin_unverify_hospital",
      targetHospitalId: id,
      isVerified: false,
    },
  });

  res.status(200).json(new ApiResponse(200, "Hospital unverified successfully", data));
});

export const verifyAdminDonor = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isVerified, isActive, status } = parseVerificationBody(req.body);
  const data = await AdminService.verifyDonor(id, isVerified, isActive);

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_update",
    meta: {
      action: "admin_verify_donor",
      targetUserId: id,
      status,
      isDonorVerified: isVerified,
      isActive,
    },
  });

  res.status(200).json(new ApiResponse(200, `Donor ${status} successfully`, data));
});

export const updateAdminCommunityFlags = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { action, value } = req.body as {
      action: "increment" | "decrement" | "set" | "reset";
      value?: number;
    };

    const data = await AdminService.updateCommunityFlags(id, action, value);

    await logActivity(req, {
      userId: req.user?.id,
      event: "profile_update",
      meta: {
        action: "admin_update_community_flags",
        targetUserId: id,
        operation: action,
        value: value ?? null,
      },
    });

    res.status(200).json(new ApiResponse(200, "Community flags updated", data));
  },
);

export const reviewAdminReport = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = await AdminService.reviewReport(id, req.user!.id, req.body);

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_update",
    meta: {
      action: "admin_review_report",
      reportId: id,
      status: req.body?.status,
      banUser: req.body?.banUser ?? false,
    },
  });

  res.status(200).json(new ApiResponse(200, "Report reviewed successfully", data));
});

export const verifyAdminUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isVerified, isActive, status } = parseVerificationBody(req.body);
  const data = await AdminService.verifyUser(id, isVerified, isActive);

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_update",
    meta: {
      action: "admin_verify_user",
      targetUserId: id,
      status,
      isVerified,
      isActive,
    },
  });

  res.status(200).json(new ApiResponse(200, `User ${status} successfully`, data));
});

export const getAdminBloodRequests = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await AdminService.getBloodRequests(
      req.query as Record<string, string>,
    );

    await logActivity(req, {
      userId: req.user?.id,
      event: "profile_view",
      meta: {
        action: "admin_blood_requests",
        filters: req.query,
      },
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Blood requests retrieved successfully",
          data,
        ),
      );
  },
);

export const getAdminBloodRequestById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = await AdminService.getBloodRequestById(id);

    await logActivity(req, {
      userId: req.user?.id,
      event: "profile_view",
      meta: {
        action: "admin_blood_request_details",
        bloodRequestId: id,
      },
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Blood request details retrieved successfully",
          data,
        ),
      );
  },
);

export const getAdminDonations = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdminService.getDonations(req.query as Record<string, string>);

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_view",
    meta: {
      action: "admin_donations",
      filters: req.query,
    },
  });

  res
    .status(200)
    .json(new ApiResponse(200, "Donations retrieved successfully", data));
});

export const getAdminDeletedUsers = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdminService.getDeletedUsers(req.query as Record<string, string>);

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_view",
    meta: { action: "admin_deleted_users", filters: req.query },
  });

  res.status(200).json(new ApiResponse(200, "Deleted users fetched successfully", data));
});

export const getAdminDeletedUserById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = await AdminService.getDeletedUserById(id);

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_view",
    meta: { action: "admin_deleted_user_detail", targetDeletedId: id },
  });

  res.status(200).json(new ApiResponse(200, "Deleted user details fetched successfully", data));
});

export const restoreAdminDeletedUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = await AdminService.restoreDeletedUser(id);

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_update",
    meta: { action: "admin_restore_deleted_user", targetDeletedId: id },
  });

  res.status(200).json(new ApiResponse(200, "Deleted user restored successfully", data));
});

export const permanentlyDeleteAdminDeletedUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = await AdminService.permanentlyDeleteDeletedUser(id);

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_update",
    meta: { action: "admin_permanent_delete_snapshot", targetDeletedId: id },
  });

  res.status(200).json(new ApiResponse(200, "Deleted user snapshot removed permanently", data));
});

export const getAdminDonationById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = await AdminService.getDonationById(id);

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_view",
    meta: {
      action: "admin_donation_details",
      donationId: id,
    },
  });

  res
    .status(200)
    .json(new ApiResponse(200, "Donation retrieved successfully", data));
});

export const updateAdminDonationStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const payload = req.body as { status: string; notes?: string };

  if (!payload || typeof payload.status !== "string") {
    throw new ApiError(400, "status is required");
  }

  const result = await AdminService.updateDonationStatus(id, payload, req.user!.id);
  const data = { _id: result.donation._id, status: result.donation.status, sms: result.sms };

  await logActivity(req, {
    userId: req.user?.id,
    event: "profile_update",
    meta: {
      action: "admin_update_donation_status",
      donationId: id,
      status: payload.status,
    },
  });

  res
    .status(200)
    .json(new ApiResponse(200, "Donation status updated successfully", data));
});

export const getAdminVerifications = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await AdminService.getVerifications(
      req.query as Record<string, string>,
    );

    await logActivity(req, {
      userId: req.user?.id,
      event: "profile_view",
      meta: {
        action: "admin_verifications",
        filters: req.query,
      },
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Verifications retrieved successfully",
          data,
        ),
      );
  },
);

export const verifyAdminVerification = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = await AdminService.verifyVerification(
      id,
      req.user!.id,
      req.body,
    );

    await logActivity(req, {
      userId: req.user?.id,
      event: "profile_update",
      meta: {
        action: "admin_verify_verification",
        verificationId: id,
        status: req.body?.status,
      },
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Verification updated successfully",
          data,
        ),
      );
  },
);

export const getAdminSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await AdminService.getSettings();

    await logActivity(req, {
      userId: req.user?.id,
      event: "profile_view",
      meta: {
        action: "admin_settings",
      },
    });

    res
      .status(200)
      .json(new ApiResponse(200, "Settings retrieved successfully", data));
  },
);

export const updateAdminSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await AdminService.updateSettings(req.body);

    await logActivity(req, {
      userId: req.user?.id,
      event: "profile_update",
      meta: {
        action: "admin_update_settings",
        updates: Object.keys(req.body),
      },
    });

    res
      .status(200)
      .json(new ApiResponse(200, "Settings updated successfully", data));
  },
);

