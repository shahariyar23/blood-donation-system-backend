import { Types } from "mongoose";
import { ApiError, paginate } from "../../shared/utils";
import { BloodRequest, CommunityReport, Donation, Donor, User, Verification, Settings, Hospital, Report, DeletedUser } from "../index";
import type { ISettings } from "./Settings.schema";

type AdminUsersQuery = {
  role?: string;
  isActive?: string;
  bloodType?: string;
  search?: string;
  page?: string;
  limit?: string;
};

type AdminReportsQuery = {
  status?: string;
  reason?: string;
  search?: string;
  page?: string;
  limit?: string;
};

type CommunityFlagsAction = "increment" | "decrement" | "set" | "reset";

const validateObjectId = (id: string, label: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid ${label}`);
  }
};

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

const toMonthKey = (date: Date) => date.toISOString().slice(0, 7);

const getRecentMonthKeys = (count: number) => {
  const now = new Date();
  const months: string[] = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    months.push(
      toMonthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))),
    );
  }

  return months;
};

const getRecentDateKeys = (count: number) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const dates: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - offset);
    dates.push(toDateKey(date));
  }

  return dates;
};

const normalizeCountMap = <T extends { _id: string; count: number }>(items: T[]) =>
  new Map(items.map((item) => [item._id, item.count]));

export class AdminService {
  static async getAdminMe(adminId: string) {
    const admin = await User.findById(adminId).select(
      "name email phone avatar role isVerified isActive createdAt updatedAt",
    );

    if (!admin) {
      throw new ApiError(404, "Admin user not found");
    }

    return admin;
  }

  static async getDashboard(adminId: string) {
    const monthKeys = getRecentMonthKeys(6);
    const dateKeys = getRecentDateKeys(7);
    const monthlyStart = new Date(`${monthKeys[0]}-01T00:00:00.000Z`);
    const weeklyStart = new Date(`${dateKeys[0]}T00:00:00.000Z`);
    const activeDonationStatuses = ["approved", "completed"];

    // Fetch admin user data
    const admin = await User.findById(adminId).select(
      "name email phone avatar role isVerified isActive createdAt updatedAt"
    );

    const [
      totalUsers,
      totalAdmins,
      totalDonors,
      totalHospitals,
      activeUsers,
      pendingReports,
      totalReports,
      totalDonations,
      totalBloodRequests,
      recentUsers,
      recentReports,
      monthlyDonations,
      monthlyRequests,
      weeklyDonorRegistrations,
      bloodTypeDistribution,
      reportStatusBreakdown,
    ] = await Promise.all([
      User.countDocuments({ isDeleted: { $ne: true } }),
      User.countDocuments({ role: "admin", isDeleted: { $ne: true } }),
      User.countDocuments({ role: "donor", isDeleted: { $ne: true } }),
      Hospital.countDocuments({ isDeleted: { $ne: true } }),
      User.countDocuments({ isActive: true, isDeleted: { $ne: true } }),
      Report.countDocuments({ status: "pending" }),
      Report.countDocuments({}),
      Donation.countDocuments({}),
      BloodRequest.countDocuments({}),
      User.find({ isDeleted: { $ne: true } })
        .select("name email role bloodType isVerified isActive createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Report.find({})
        .select("reason status createdAt reportedBy reportedUser")
        .populate("reportedBy", "name email role")
        .populate("reportedUser", "name email role")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Donation.aggregate([
        {
          $match: {
            status: { $in: activeDonationStatuses },
            createdAt: { $gte: monthlyStart },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
      ]),
      BloodRequest.aggregate([
        { $match: { createdAt: { $gte: monthlyStart } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
      ]),
      User.aggregate([
        {
          $match: {
            role: "donor",
            isDeleted: { $ne: true },
            createdAt: { $gte: weeklyStart },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
      ]),
      User.aggregate([
        {
          $match: {
            role: "donor",
            isDeleted: { $ne: true },
            bloodType: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: "$bloodType",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Report.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const donors = await Donor.find({
      userId: { $in: recentUsers.map((user) => user._id) },
    }).lean();
    const donorByUserId = new Map(donors.map((donor) => [String(donor.userId), donor]));

    const donationCountByMonth = normalizeCountMap(monthlyDonations);
    const requestCountByMonth = normalizeCountMap(monthlyRequests);
    const donorRegistrationCountByDate = normalizeCountMap(weeklyDonorRegistrations);

    return {
      stats: {
        totalUsers,
        totalAdmins,
        totalDonors,
        totalHospitals,
        activeUsers,
        pendingReports,
        totalReports,
        totalDonations,
        totalBloodRequests,
      },
      charts: {
        monthlyTrend: monthKeys.map((month) => ({
          month,
          donations: donationCountByMonth.get(month) || 0,
          requests: requestCountByMonth.get(month) || 0,
        })),
        weeklyDonorRegistrations: dateKeys.map((date) => ({
          date,
          count: donorRegistrationCountByDate.get(date) || 0,
        })),
        bloodTypeDistribution: bloodTypeDistribution.map((item) => ({
          bloodType: item._id,
          count: item.count,
        })),
        reportStatusBreakdown: reportStatusBreakdown.map((item) => ({
          status: item._id,
          count: item.count,
        })),
      },
      recentUsers: recentUsers.map((user) => {
        const donor = donorByUserId.get(String(user._id));

        return {
          ...user,
          isDonorVerified: donor?.isVerified ?? false,
          isVerifyDonor: donor?.isVerified ?? false,
        };
      }),
      recentReports,
      admin: admin ? {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        avatar: admin.avatar,
        role: admin.role,
        isVerified: admin.isVerified,
        isActive: admin.isActive,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      } : null,
    };
  }

  static async getUsers(query: AdminUsersQuery) {
    const { role, isActive, bloodType, search } = query;
    const { skip, limit, page, totalPages } = paginate(query as Record<string, any>);

    const filter: Record<string, any> = {};

    if (role) filter.role = role;
    if (bloodType) filter.bloodType = bloodType;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("name email phone avatar role bloodType isVerified isActive communityFlags createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const donors = await Donor.find({
      userId: { $in: users.map((user) => user._id) },
    }).lean();

    const donorByUserId = new Map(
      donors.map((donor) => [String(donor.userId), donor]),
    );

    return {
      users: users.map((user) => {
        const donor = donorByUserId.get(String(user._id));

        return {
          ...user,
          donor: donor || null,
          isVerifyDonor: donor?.isVerified ?? false,
        };
      }),
      pagination: {
        total,
        page,
        limit,
        totalPages: totalPages(total),
      },
    };
  }

  static async getUserById(userId: string) {
    validateObjectId(userId, "user ID");

    const user = await User.findById(userId).select(
      "name email phone avatar role bloodType isVerified isActive communityFlags createdAt updatedAt",
    );

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const userObj: any = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar || null,
      role: user.role,
      bloodType: user.bloodType,
      isVerified: user.isVerified,
      isActive: user.isActive,
      communityFlags: user.communityFlags || 0,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // If user is a donor, fetch donor details
    if (user.role === "donor") {
      const donor = await Donor.findOne({ userId: user._id });
      if (donor) {
        const totalDonations = await Donation.countDocuments({ donorId: user._id, status: "approved" });
        const lastDonation = await Donation.findOne({ donorId: user._id, status: "approved" })
          .sort({ donatedAt: -1 })
          .select("donatedAt units");

        userObj.donorInfo = {
          _id: donor._id,
          isVerified: donor.isVerified || false,
          totalDonations,
          lastDonationDate: lastDonation?.donatedAt || null,
          lastDonationUnits: lastDonation?.units || null,
        };
      }
    }

    // If user is a hospital, fetch hospital details
    if (user.role === "hospital") {
      const hospital = await Hospital.findById(user._id).select(
        "hospitalName registrationNumber email phone website licenseNumber adminName adminEmail adminPhone totalBedCapacity bloodBankCapacity isVerified isActive address location",
      );

      if (hospital) {
        const totalDonationsReceived = await Donation.countDocuments({ hospitalId: user._id, status: "approved" });
        const totalUnitsReceived = await Donation.aggregate([
          {
            $match: {
              hospitalId: hospital._id,
              status: "approved",
            },
          },
          {
            $group: {
              _id: null,
              totalUnits: { $sum: "$units" },
            },
          },
        ]);

        userObj.hospitalInfo = {
          _id: hospital._id,
          hospitalName: hospital.hospitalName,
          registrationNumber: hospital.registrationNumber,
          email: hospital.email,
          phone: hospital.phone,
          website: hospital.website,
          licenseNumber: hospital.licenseNumber,
          adminName: hospital.adminName,
          adminEmail: hospital.adminEmail,
          adminPhone: hospital.adminPhone,
          totalBedCapacity: hospital.totalBedCapacity,
          bloodBankCapacity: hospital.bloodBankCapacity,
          isVerified: hospital.isVerified,
          isActive: hospital.isActive,
          address: hospital.address,
          location: hospital.location,
          stats: {
            totalDonationsReceived,
            totalUnitsReceived: totalUnitsReceived[0]?.totalUnits || 0,
          },
        };
      }
    }

    return userObj;
  }
  static async getDeletedUsers(query: Record<string, any>) {
    const { search } = query;
    const { skip, limit, page, totalPages } = paginate(query as Record<string, any>);

    const filter: Record<string, any> = {};

    if (search) {
      const regex = new RegExp(String(search), "i");
      filter.$or = [
        { "userSnapshot.name": { $regex: regex } },
        { "userSnapshot.email": { $regex: regex } },
      ];
    }

    const [items, total] = await Promise.all([
      DeletedUser.find(filter)
        .sort({ deletedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DeletedUser.countDocuments(filter),
    ]);

    const deletedUsers = items.map((d: any) => ({
      id: d._id,
      userId: d.userId,
      name: d.userSnapshot?.name || null,
      email: d.userSnapshot?.email || null,
      role: d.userSnapshot?.role || null,
      reason: d.reason || null,
      deletedAt: d.deletedAt,
      meta: d.meta || {},
    }));

    return {
      deletedUsers,
      pagination: {
        total,
        page,
        limit,
        totalPages: totalPages(total),
      },
    };
  }

  static async getDeletedUserById(deletedId: string) {
    validateObjectId(deletedId, "deleted user ID");

    const doc = await DeletedUser.findById(deletedId).lean();
    if (!doc) throw new ApiError(404, "Deleted user not found");

    return doc;
  }

  static async restoreDeletedUser(deletedId: string) {
    validateObjectId(deletedId, "deleted user ID");

    const doc: any = await DeletedUser.findById(deletedId);
    if (!doc) throw new ApiError(404, "Deleted user not found");

    // If a user with same id already exists, prevent overwrite
    const existing = await User.findById(doc.userId);
    if (existing) throw new ApiError(400, "User already exists");

    const userSnapshot = doc.userSnapshot ? { ...doc.userSnapshot } : {};
    // ensure flags are sensible on restore
    userSnapshot.isDeleted = false;
    userSnapshot.isActive = true;

    // Recreate user with original _id when possible
    const restoredUser = await User.create(userSnapshot);

    if (doc.donorSnapshot) {
      const donorSnapshot = { ...doc.donorSnapshot, userId: restoredUser._id };
      await Donor.create(donorSnapshot).catch(() => {});
    }

    // remove the DeletedUser snapshot after successful restore
    await DeletedUser.findByIdAndDelete(deletedId);

    return restoredUser;
  }

  static async permanentlyDeleteDeletedUser(deletedId: string) {
    validateObjectId(deletedId, "deleted user ID");

    const doc = await DeletedUser.findById(deletedId);
    if (!doc) throw new ApiError(404, "Deleted user not found");

    await DeletedUser.findByIdAndDelete(deletedId);

    return { id: deletedId, deleted: true };
  }
  
  static async updateUserStatus(targetUserId: string, isActive: boolean) {
    validateObjectId(targetUserId, "user ID");

    const user = await User.findByIdAndUpdate(
      targetUserId,
      { $set: { isActive } },
      { new: true },
    ).select("_id name email role isActive");

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return user;
  }
    static async verifyDonor(
    targetUserId: string,
    isVerified = true,
    isActive?: boolean,
  ) {
    validateObjectId(targetUserId, "user ID");

    const user = await User.findById(targetUserId).select("_id name role");
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

    donor.isVerified = isVerified;
    await donor.save();

    if (typeof isActive === "boolean") {
      await User.findByIdAndUpdate(user._id, { $set: { isActive } });
    }

    const updatedUser = await User.findById(user._id).select("_id name isActive");

    return {
      id: user._id,
      name: user.name,
      isDonorVerified: donor.isVerified,
      isActive: updatedUser?.isActive ?? true,
    };
  }
    static async verifyUser(
    targetUserId: string,
    isVerified = true,
    isActive?: boolean,
  ) {
    validateObjectId(targetUserId, "user ID");

    const user = await User.findById(targetUserId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    user.isVerified = isVerified;

    if (typeof isActive === "boolean") {
      user.isActive = isActive;
    }

    await user.save();

    return {
      _id: user._id,
      isVerified: user.isVerified,
      isActive: user.isActive,
    };
  }







  static async getHospitals(query: Record<string, any>) {
    const { search } = query;

    const filter: Record<string, any> = { isDeleted: { $ne: true } };

    if (search) {
      const regex = new RegExp(String(search), "i");
      filter.$or = [
        { hospitalName: { $regex: regex } },
        { registrationNumber: { $regex: regex } },
        { email: { $regex: regex } },
        { phone: { $regex: regex } },
        { adminName: { $regex: regex } },
        { adminEmail: { $regex: regex } },
        { licenseNumber: { $regex: regex } },
      ];
    }

    const hospitals = await Hospital.find(filter)
      .select(
        "hospitalName email phone isVerified isActive createdAt updatedAt",
      )
      .sort({ createdAt: -1 });

    const formatted = hospitals.map((hospital: any) => ({
      _id: hospital._id,
      hospitalName: hospital.hospitalName,
      registrationNumber: hospital.registrationNumber,
      email: hospital.email,
      phone: hospital.phone,
      website: hospital.website,
      licenseNumber: hospital.licenseNumber,
      adminName: hospital.adminName,
      adminEmail: hospital.adminEmail,
      adminPhone: hospital.adminPhone,
      totalBedCapacity: hospital.totalBedCapacity,
      bloodBankCapacity: hospital.bloodBankCapacity,
      isVerified: hospital.isVerified,
      isActive: hospital.isActive,
      isDeleted: hospital.isDeleted,
      address: hospital.address,
      location: hospital.location,
      createdAt: hospital.createdAt,
      updatedAt: hospital.updatedAt,
    }));

    return {
      hospitals: formatted,
      total: formatted.length,
    };
  }
  static async getHospitalById(hospitalId: string) {
    validateObjectId(hospitalId, "hospital ID");

    const hospital = await Hospital.findById(hospitalId).select(
      "hospitalName registrationNumber email phone website licenseNumber adminName adminEmail adminPhone totalBedCapacity bloodBankCapacity isVerified isActive isDeleted address location createdAt updatedAt",
    );

    if (!hospital) {
      throw new ApiError(404, "Hospital not found");
    }

    const [totalDonationsReceived, unitsAgg] = await Promise.all([
      Donation.countDocuments({ hospitalId: hospital._id, status: "approved" }),
      Donation.aggregate([
        {
          $match: {
            hospitalId: hospital._id,
            status: "approved",
          },
        },
        {
          $group: {
            _id: null,
            totalUnits: { $sum: "$units" },
          },
        },
      ]),
    ]);

    return {
      _id: hospital._id,
      hospitalName: hospital.hospitalName,
      registrationNumber: hospital.registrationNumber,
      email: hospital.email,
      phone: hospital.phone,
      website: hospital.website,
      licenseNumber: hospital.licenseNumber,
      adminName: hospital.adminName,
      adminEmail: hospital.adminEmail,
      adminPhone: hospital.adminPhone,
      totalBedCapacity: hospital.totalBedCapacity,
      bloodBankCapacity: hospital.bloodBankCapacity,
      isVerified: hospital.isVerified,
      isActive: hospital.isActive,
      isDeleted: hospital.isDeleted,
      address: hospital.address,
      location: hospital.location,
      stats: {
        totalDonationsReceived,
        totalUnitsReceived: unitsAgg[0]?.totalUnits || 0,
      },
      createdAt: hospital.createdAt,
      updatedAt: hospital.updatedAt,
    };
  }
  static async updateHospitalStatus(hospitalId: string, isActive: boolean) {
    validateObjectId(hospitalId, "hospital ID");

    const hospital = await Hospital.findByIdAndUpdate(
      hospitalId,
      { $set: { isActive } },
      { new: true },
    ).select("_id isActive");

    if (!hospital) {
      throw new ApiError(404, "Hospital not found");
    }

    return hospital;
  }
  static async verifyHospital(hospitalId: string) {
    validateObjectId(hospitalId, "hospital ID");

    const hospital = await Hospital.findById(hospitalId).select("_id isVerified");
    if (!hospital) {
      throw new ApiError(404, "Hospital not found");
    }

    hospital.isVerified = true;
    await hospital.save();

    return {
      _id: hospital._id,
      isVerified: hospital.isVerified,
    };
  }
  static async unverifyHospital(hospitalId: string) {
    validateObjectId(hospitalId, "hospital ID");

    const hospital = await Hospital.findById(hospitalId).select("_id isVerified");
    if (!hospital) {
      throw new ApiError(404, "Hospital not found");
    }

    hospital.isVerified = false;
    await hospital.save();

    return {
      _id: hospital._id,
      isVerified: hospital.isVerified,
    };
  }








  static async getReports(query: AdminReportsQuery) {
    const { status, reason, search } = query;
    const { skip, limit, page, totalPages } = paginate(query as Record<string, any>);

    const filter: Record<string, any> = {};

    if (status) filter.status = status;
    if (reason) filter.reason = reason;

    if (search) {
      const regex = new RegExp(search, "i");
      const users = await User.find({
        $or: [{ name: regex }, { email: regex }],
      }).select("_id");

      const ids = users.map((user) => new Types.ObjectId(String(user._id)));
      if (ids.length === 0) {
        return {
          reports: [],
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        };
      }

      filter.$or = [{ reportedBy: { $in: ids } }, { reportedUser: { $in: ids } }];
    }

    const [reports, total] = await Promise.all([
      Report.find(filter)
        .populate("reportedBy", "name email role")
        .populate("reportedUser", "name email role")
        .populate("reviewedBy", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Report.countDocuments(filter),
    ]);

    return {
      reports,
      pagination: {
        total,
        page,
        limit,
        totalPages: totalPages(total),
      },
    };
  }
  static async updateCommunityFlags(
    targetUserId: string,
    action: CommunityFlagsAction,
    value?: number,
  ) {
    validateObjectId(targetUserId, "user ID");

    let updated: any = null;

    switch (action) {
      case "increment": {
        const delta = typeof value === "number" ? value : 1;
        if (delta <= 0) throw new ApiError(400, "value must be greater than 0");
        updated = await User.findByIdAndUpdate(
          targetUserId,
          { $inc: { communityFlags: delta } },
          { new: true },
        ).select("_id communityFlags");
        break;
      }
      case "decrement": {
        const delta = typeof value === "number" ? value : 1;
        if (delta <= 0) throw new ApiError(400, "value must be greater than 0");
        updated = await User.findByIdAndUpdate(
          targetUserId,
          { $inc: { communityFlags: -delta } },
          { new: true },
        ).select("_id communityFlags");

        if (updated && updated.communityFlags < 0) {
          updated.communityFlags = 0;
          await updated.save();
        }
        break;
      }
      case "set": {
        if (typeof value !== "number" || value < 0) {
          throw new ApiError(400, "value must be a non-negative number");
        }
        updated = await User.findByIdAndUpdate(
          targetUserId,
          { $set: { communityFlags: value } },
          { new: true },
        ).select("_id communityFlags");
        break;
      }
      case "reset": {
        updated = await User.findByIdAndUpdate(
          targetUserId,
          { $set: { communityFlags: 0 } },
          { new: true },
        ).select("_id communityFlags");
        break;
      }
      default:
        throw new ApiError(400, "Invalid action");
    }

    if (!updated) {
      throw new ApiError(404, "User not found");
    }

    return {
      id: updated._id,
      communityFlags: updated.communityFlags,
    };
  }
  static async reviewReport(
    reportId: string,
    adminId: string,
    body: {
      status: "reviewed" | "dismissed";
      reviewNote?: string;
      banUser?: boolean;
    },
  ) {
    validateObjectId(reportId, "report ID");

    const report = await Report.findById(reportId);
    if (!report) {
      throw new ApiError(404, "Report not found");
    }

    const allowedStatus = ["reviewed", "dismissed"];
    if (!allowedStatus.includes(body.status)) {
      throw new ApiError(400, "Invalid report status");
    }

    report.status = body.status;
    report.reviewedBy = new Types.ObjectId(adminId);
    report.reviewNote = body.reviewNote?.trim() || "";
    await report.save();

    const shouldBanUser = body.banUser === true;
    if (shouldBanUser) {
      await User.findByIdAndUpdate(report.reportedUser, {
        $set: { isActive: false },
      });
    }

    const populatedReport = await Report.findById(report._id)
      .populate("reportedBy", "name email role")
      .populate("reportedUser", "name email role isActive")
      .populate("reviewedBy", "name email role");

    return populatedReport;
  }






  static async getBloodRequests(query: Record<string, any>) {
    const { status } = query;
    const { skip, limit, page, totalPages } = paginate(query);

    const filter: Record<string, any> = {};
    if (status) filter.status = status;

    const [requests, total] = await Promise.all([
      BloodRequest.find(filter)
        .populate("requestedBy", "name email role")
        .select(
          "requestedBy patientName bloodType units urgency notes status respondedDonors neededBy createdAt",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      BloodRequest.countDocuments(filter),
    ]);

    const formattedRequests = requests.map((request: any) => ({
      _id: request._id,
      requestedBy: request.requestedBy,
      patientName: request.patientName,
      bloodType: request.bloodType,
      unitsNeeded: request.units,
      urgencyLevel: request.urgency,
      status: request.status,
      respondents: request.respondedDonors?.length || 0,
      neededBy: request.neededBy,
      createdAt: request.createdAt,
    }));

    return {
      requests: formattedRequests,
      pagination: {
        total,
        page,
        limit,
        totalPages: totalPages(total),
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages(total),
      },
    };
  }

  static async getBloodRequestById(requestId: string) {
    validateObjectId(requestId, "blood request ID");

    const request: any = await BloodRequest.findById(requestId)
      .populate(
        "requestedBy",
        "name email phone avatar role bloodType isVerified isActive location totalReceived createdAt",
      )
      .populate(
        "respondedDonors",
        "name email phone avatar role bloodType isVerified isActive location createdAt",
      )
      .populate(
        "fulfilledBy",
        "name email phone avatar role bloodType isVerified isActive location createdAt",
      )
      .select(
        "requestedBy patientName bloodType units hospital location latitude longitude locationDetails phone urgency neededBy expiresAt notes agreeTerms status respondedDonors fulfilledBy isExpired createdAt updatedAt",
      )
      .lean();

    if (!request) {
      throw new ApiError(404, "Blood request not found");
    }

    const respondedDonorUsers = Array.isArray(request.respondedDonors)
      ? request.respondedDonors
      : [];
    const respondedDonorIds = respondedDonorUsers
      .map((donor: any) => donor?._id)
      .filter(Boolean);

    const donorProfiles = await Donor.find({
      userId: { $in: respondedDonorIds },
    }).lean();
    const donorProfileByUserId = new Map(
      donorProfiles.map((donor) => [String(donor.userId), donor]),
    );

    const formatUser = (user: any) => {
      if (!user) return null;

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar || null,
        role: user.role,
        bloodType: user.bloodType,
        isVerified: user.isVerified,
        isActive: user.isActive,
        location: user.location,
        totalReceived: user.totalReceived,
        createdAt: user.createdAt,
      };
    };

    const formatRespondedDonor = (user: any) => {
      const donorProfile = donorProfileByUserId.get(String(user?._id));

      return {
        ...formatUser(user),
        donor: donorProfile
          ? {
              _id: donorProfile._id,
              isAvailable: donorProfile.isAvailable,
              isVerified: donorProfile.isVerified,
              totalDonations: donorProfile.totalDonations,
              lastDonationDate: donorProfile.lastDonationDate,
              nextAvailableAt: donorProfile.nextAvailableAt,
            }
          : null,
        isDonorVerified: donorProfile?.isVerified ?? false,
        isVerifyDonor: donorProfile?.isVerified ?? false,
      };
    };

    return {
      _id: request._id,
      requestedBy: formatUser(request.requestedBy),
      patientName: request.patientName,
      bloodType: request.bloodType,
      unitsNeeded: request.units,
      hospital: request.hospital,
      location: request.location,
      latitude: request.latitude,
      longitude: request.longitude,
      locationDetails: request.locationDetails,
      phone: request.phone,
      urgencyLevel: request.urgency,
      urgency: request.urgency,
      neededBy: request.neededBy,
      expiresAt: request.expiresAt,
      notes: request.notes,
      agreeTerms: request.agreeTerms,
      status: request.status,
      isExpired: request.isExpired,
      respondents: respondedDonorUsers.length,
      respondedDonors: respondedDonorUsers.map(formatRespondedDonor),
      fulfilledBy: formatUser(request.fulfilledBy),
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  static async getDonations(query: Record<string, any>) {
    const { status } = query;
    const { skip, limit, page, totalPages } = paginate(query);

    const filter: Record<string, any> = {};
    if (status) filter.status = status;

    const [donations, total] = await Promise.all([
      Donation.find(filter)
        .populate("donorId", "name")
        .populate("requestedBy", "name")
        .select(
          "donorId hospitalId requestedBy bloodType units donatedAt status notes createdAt",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Donation.countDocuments(filter),
    ]);

    const hospitalIds = [
      ...new Set(
        donations
          .map((donation: any) => (donation.hospitalId ? String(donation.hospitalId) : null))
          .filter(Boolean),
      ),
    ];

    const hospitalUsers = await User.find({ _id: { $in: hospitalIds } }).select("hospitalName");

    const hospitalUserMap = new Map(
      hospitalUsers.map((user: any) => [String(user._id), user.name]),
    );

    const formattedDonations = donations.map((donation: any) => ({
      _id: donation._id,
      donor: {
        _id: donation.donorId?._id,
        name: donation.donorId?.name,
      },
      requestedBy: donation.requestedBy
        ? {
            _id: donation.requestedBy?._id,
            name: donation.requestedBy?.name,
          }
        : null,
      bloodType: donation.bloodType,
      unitsCollected: donation.units,
      donationDate: donation.donatedAt,
      status: donation.status,
      notes: donation.notes,
      hospital: {
        _id: donation.hospitalId || null,
        name: hospitalUserMap.get(String(donation.hospitalId)) || "Unknown",
      },
    }));

    return {
      donations: formattedDonations,
      pagination: {
        total,
        page,
        limit,
        totalPages: totalPages(total),
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages(total),
      },
    };
  }

  static async updateDonationStatus(
    donationId: string,
    body: { status: string; notes?: string },
    adminId: string,
  ) {
    validateObjectId(donationId, "donation ID");

    const donation: any = await Donation.findById(donationId);
    if (!donation) {
      throw new ApiError(404, "Donation not found");
    }

    const allowed = ["pending", "approved", "rejected", "request"];
    if (!body.status || typeof body.status !== "string") {
      throw new ApiError(400, "Invalid status");
    }

    donation.status = body.status;
    donation.notes = body.notes?.trim() || donation.notes || "";

    if (body.status === "approved") {
      donation.approvedBy = new Types.ObjectId(adminId);
      donation.approvedAt = new Date();
      donation.donatedAt = donation.donatedAt || new Date();
    } else if (body.status === "rejected") {
      donation.approvedBy = new Types.ObjectId(adminId);
      donation.approvedAt = donation.approvedAt || new Date();
    }

    await donation.save();

    // Prepare SMS info for frontend or SMS service to use
    let sms: null | { to: string; message: string } = null;
    try {
      const donorUser = donation.donorId
        ? await User.findById(donation.donorId).select("phone name")
        : null;

      if (donorUser && donorUser.phone) {
        const msg = `Donation ${String(donation._id)} status updated to ${donation.status}. Notes: ${donation.notes || ""}`;
        sms = { to: donorUser.phone, message: msg };
      }
    } catch (e) {
      // ignore sms preparation errors
      sms = null;
    }

    return { donation, sms };
  }

  static async getDonationById(donationId: string) {
    validateObjectId(donationId, "donation ID");

    const donation = (await Donation.findById(donationId)
      .populate("donorId", "name email phone bloodType role isVerified isActive avatar")
      .populate("requestedBy", "name email phone role totalReceived isVerified isActive")
      .populate("approvedBy", "name email phone role isVerified isActive")
      .populate("collectedBy", "name email phone role isVerified isActive")
      .select(
        "donorId hospitalId requestedBy approvedBy collectedBy patientInfo bloodType units donatedAt status notes createdAt",
      )) as any;

    if (!donation) {
      throw new ApiError(404, "Donation not found");
    }

    const hospitalId = donation.hospitalId ? String(donation.hospitalId) : null;

    const [hospitalUser, hospitalProfile] = await Promise.all([
      hospitalId ? User.findById(hospitalId).select("name email phone bloodType role isVerified isActive avatar") : Promise.resolve(null),
      hospitalId ? Hospital.findById(hospitalId).select(
        "hospitalName registrationNumber email phone website licenseNumber adminName adminEmail adminPhone totalBedCapacity bloodBankCapacity isVerified isActive address location",
      ) : Promise.resolve(null),
    ]);

    const receiver = donation.requestedBy
      ? {
          _id: donation.requestedBy?._id,
          name: donation.requestedBy?.name,
          email: donation.requestedBy?.email,
          phone: donation.requestedBy?.phone,
          role: donation.requestedBy?.role,
          totalReceived: donation.requestedBy?.totalReceived || 0,
          isVerified: donation.requestedBy?.isVerified ?? false,
          isActive: donation.requestedBy?.isActive ?? false,
        }
      : null;

    const hospitalUserInfo = hospitalUser
      ? {
          _id: hospitalUser._id,
          name: hospitalUser.name,
          email: hospitalUser.email,
          phone: hospitalUser.phone,
          bloodType: hospitalUser.bloodType,
          role: hospitalUser.role,
          isVerified: hospitalUser.isVerified,
          isActive: hospitalUser.isActive,
          avatar: hospitalUser.avatar || null,
        }
      : null;

    const hospitalProfileInfo = hospitalProfile
      ? {
          _id: hospitalProfile._id,
          hospitalName: hospitalProfile.hospitalName,
          registrationNumber: hospitalProfile.registrationNumber,
          email: hospitalProfile.email,
          phone: hospitalProfile.phone,
          website: hospitalProfile.website,
          licenseNumber: hospitalProfile.licenseNumber,
          adminName: hospitalProfile.adminName,
          adminEmail: hospitalProfile.adminEmail,
          adminPhone: hospitalProfile.adminPhone,
          totalBedCapacity: hospitalProfile.totalBedCapacity,
          bloodBankCapacity: hospitalProfile.bloodBankCapacity,
          isVerified: hospitalProfile.isVerified,
          isActive: hospitalProfile.isActive,
          address: hospitalProfile.address,
          location: hospitalProfile.location,
        }
      : null;

    const patientInfo = donation.patientInfo
      ? {
          name: donation.patientInfo.name,
          address: donation.patientInfo.address,
          phone: donation.patientInfo.phone,
          age: donation.patientInfo.age ?? null,
          gender: donation.patientInfo.gender ?? "other",
          reasonForBlood: donation.patientInfo.reasonForBlood,
          medicalCondition: donation.patientInfo.medicalCondition ?? "",
          doctorName: donation.patientInfo.doctorName ?? "",
          doctorPhone: donation.patientInfo.doctorPhone ?? "",
        }
      : null;

    const donorId = donation.donorId?._id ? String(donation.donorId._id) : null;
    let donorTotalDonations = 0;
    if (donorId) {
      donorTotalDonations = await Donation.countDocuments({ donorId, status: "approved" });
    }

    let hospitalTotalReceived = 0;
    let hospitalTotalUnits = 0;
    if (hospitalId) {
      hospitalTotalReceived = await Donation.countDocuments({ hospitalId, status: "approved" });

      const totalUnitsResult = await Donation.aggregate([
        {
          $match: {
            hospitalId: donation.hospitalId,
            status: "approved",
          },
        },
        {
          $group: {
            _id: null,
            totalUnits: { $sum: "$units" },
          },
        },
      ]);

      hospitalTotalUnits = totalUnitsResult[0]?.totalUnits || 0;
    }

    return {
      _id: donation._id,
      donor: {
        _id: donation.donorId?._id,
        name: donation.donorId?.name,
        email: donation.donorId?.email,
        phone: donation.donorId?.phone,
        bloodType: donation.donorId?.bloodType,
        role: donation.donorId?.role,
        isVerified: donation.donorId?.isVerified,
        isActive: donation.donorId?.isActive,
        avatar: donation.donorId?.avatar || null,
      },
      receiver,
      patientInfo,
      hospital: {
        _id: donation.hospitalId || null,
        user: hospitalUserInfo,
        profile: hospitalProfileInfo,
      },
      bloodType: donation.bloodType,
      unitsCollected: donation.units,
      donationDate: donation.donatedAt,
      status: donation.status,
      notes: donation.notes,
      approvedBy: donation.approvedBy || null,
      donorStats: {
        totalDonations: donorTotalDonations,
      },
      hospitalStats: {
        totalReceived: hospitalTotalReceived,
        totalDonationsReceived: hospitalTotalReceived,
        totalUnitsReceived: hospitalTotalUnits,
      },
    };
  }

  static async getVerifications(query: Record<string, any>) {
    const { status } = query;
    const { skip, limit, page, totalPages } = paginate(query);

    const filter: Record<string, any> = {};
    if (status) filter.status = status;

    const [verifications, total] = await Promise.all([
      Verification.find(filter)
        .populate("userId", "name email bloodType phone")
        .populate("verifiedBy", "name email role")
        .select(
          "userId documentType documentUrl status submittedAt verifiedAt verifiedBy notes createdAt",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Verification.countDocuments(filter),
    ]);

    const formattedVerifications = verifications.map((verification: any) => ({
      _id: verification._id,
      user: {
        _id: verification.userId?._id,
        name: verification.userId?.name,
        email: verification.userId?.email,
        bloodType: verification.userId?.bloodType,
        phone: verification.userId?.phone,
      },
      documentType: verification.documentType,
      documentUrl: verification.documentUrl,
      status: verification.status,
      submittedAt: verification.submittedAt,
      verifiedAt: verification.verifiedAt,
      verifiedBy: verification.verifiedBy,
      notes: verification.notes,
    }));

    return {
      verifications: formattedVerifications,
      pagination: {
        total,
        page,
        limit,
        totalPages: totalPages(total),
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages(total),
      },
    };
  }

  static async verifyVerification(
    verificationId: string,
    adminId: string,
    body: {
      status: "verified" | "rejected";
      notes?: string;
    },
  ) {
    validateObjectId(verificationId, "verification ID");

    const verification = await Verification.findById(verificationId);
    if (!verification) {
      throw new ApiError(404, "Verification not found");
    }

    const allowedStatus = ["verified", "rejected"];
    if (!allowedStatus.includes(body.status)) {
      throw new ApiError(400, "Invalid verification status");
    }

    verification.status = body.status;
    verification.verifiedBy = new Types.ObjectId(adminId);
    verification.verifiedAt = new Date();
    verification.notes = body.notes?.trim() || "";
    await verification.save();

    return {
      _id: verification._id,
      status: verification.status,
      verifiedAt: verification.verifiedAt,
    };
  }

  static async getSettings() {
    let settings = await Settings.findOne({});

    if (!settings) {
      settings = new Settings({});
      await settings.save();
    }

    return {
      systemSettings: {
        appName: settings.appName,
        version: settings.version,
        maintenanceMode: settings.maintenanceMode,
        donationEligibilityDays: settings.donationEligibilityDays,
        autoEmailNotifications: settings.autoEmailNotifications,
        emailNotificationDelay: settings.emailNotificationDelay,
      },
      bloodBankSettings: {
        minDonorsPerBank: settings.minDonorsPerBank,
        maxRequestsPerDay: settings.maxRequestsPerDay,
        requestExpirationDays: settings.requestExpirationDays,
      },
      userSettings: {
        maxReportsPerDay: settings.maxReportsPerDay,
        minCommunityFlagsToBlock: settings.minCommunityFlagsToBlock,
        autoVerifyDonors: settings.autoVerifyDonors,
      },
    };
  }

  static async updateSettings(body: Partial<ISettings>) {
    let settings = await Settings.findOne({});

    if (!settings) {
      settings = new Settings(body);
    } else {
      Object.assign(settings, body);
    }

    await settings.save();

    return {
      maintenanceMode: settings.maintenanceMode,
      donationEligibilityDays: settings.donationEligibilityDays,
      autoEmailNotifications: settings.autoEmailNotifications,
      autoVerifyDonors: settings.autoVerifyDonors,
    };
  }
}

