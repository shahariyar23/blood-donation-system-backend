import fs from "fs/promises";
import os from "os";
import path from "path";
import { Types } from "mongoose";
import PDFDocument from "pdfkit";
import { writeToBuffer } from "fast-csv";
import { ApiError, paginate, sendEmail } from "../../shared/utils";
import { BloodRequest, CommunityReport, Donation, Donor, User, UserActivity, Verification, Settings, Hospital, Report, DeletedUser, ReportJob, ReportAuditLog } from "../index";
import type { ISettings } from "./Settings.schema";
import type { ReportFormat, ReportSection } from "./ReportJob.schema";

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

type ReportRequestContext = {
  ip: string;
  userAgent: string;
};

type ExportColumn = {
  key: string;
  label: string;
};

type AdminBulkEmailPayload = {
  emails: string[];
  subject: string;
  body: string;
};

const reportSections: ReportSection[] = [
  "users",
  "deleted-users",
  "blood-requests",
  "donations",
  "hospitals",
  "reports",
  "verifications",
];

const reportFormats: ReportFormat[] = ["pdf", "csv"];
const adminUserVisibleRoles = ["user", "donor"];

const safeString = (value: any): string => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const isHtmlContent = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value);

const toEmailHtml = (body: string) => {
  if (isHtmlContent(body)) return body;

  return body
    .split(/\r?\n/)
    .map((line) => `<p>${line.trim() || "&nbsp;"}</p>`)
    .join("");
};

const pickFilters = (query: Record<string, any>) => {
  const filters: Record<string, any> = {};

  Object.entries(query).forEach(([key, value]) => {
    if (["format", "page", "limit"].includes(key)) return;
    if (value === undefined || value === null || value === "") return;
    filters[key] = value;
  });

  return filters;
};

const buildUserFilter = (query: Record<string, any>) => {
  const { role, isActive, bloodType, search } = query;
  const filter: Record<string, any> = {
    role: { $in: adminUserVisibleRoles },
    isDeleted: { $ne: true },
  };

  if (role && adminUserVisibleRoles.includes(String(role))) {
    filter.role = role;
  }

  if (role && !adminUserVisibleRoles.includes(String(role))) {
    filter.role = { $in: [] };
  }

  if (bloodType) filter.bloodType = bloodType;
  if (isActive !== undefined) filter.isActive = isActive === "true";

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  return filter;
};

const assertVisibleUserRole: (
  user: any,
  message?: string,
) => asserts user = (
  user: { role?: string } | null,
  message = "User not found",
) => {
  if (!user || !adminUserVisibleRoles.includes(String(user.role))) {
    throw new ApiError(404, message);
  }
};

const buildDeletedUserFilter = (query: Record<string, any>) => {
  const filter: Record<string, any> = {};

  if (query.search) {
    const regex = new RegExp(String(query.search), "i");
    filter.$or = [
      { "userSnapshot.name": { $regex: regex } },
      { "userSnapshot.email": { $regex: regex } },
    ];
  }

  return filter;
};

const buildHospitalFilter = (query: Record<string, any>) => {
  const filter: Record<string, any> = { isDeleted: { $ne: true } };

  if (query.search) {
    const regex = new RegExp(String(query.search), "i");
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

  return filter;
};

const buildSimpleStatusFilter = (query: Record<string, any>) => {
  const filter: Record<string, any> = {};
  if (query.status) filter.status = query.status;
  return filter;
};

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

  static async sendBulkEmail(adminId: string, payload: AdminBulkEmailPayload) {
    const admin = await User.findById(adminId).select("name email role");
    if (!admin) {
      throw new ApiError(404, "Admin user not found");
    }

    const uniqueEmails = [...new Set(payload.emails.map((email) => email.toLowerCase().trim()))];
    const html = toEmailHtml(payload.body);

    const settled = await Promise.allSettled(
      uniqueEmails.map((email) =>
        sendEmail({
          to: email,
          subject: payload.subject,
          html,
        }),
      ),
    );

    const recipients = settled.map((result, index) => ({
      email: uniqueEmails[index],
      status: result.status === "fulfilled" ? "sent" : "failed",
      error:
        result.status === "rejected"
          ? result.reason?.message || "Failed to send email"
          : null,
    }));

    const sent = recipients.filter((recipient) => recipient.status === "sent").length;
    const failed = recipients.length - sent;

    return {
      requestedBy: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
      },
      subject: payload.subject,
      totalRecipients: recipients.length,
      sent,
      failed,
      recipients,
    };
  }

  static async getDashboard(adminId: string, query: Record<string, any> = {}) {
    const monthKeys = getRecentMonthKeys(6);
    const dateKeys = getRecentDateKeys(7);
    const monthlyStart = new Date(`${monthKeys[0]}-01T00:00:00.000Z`);
    const weeklyStart = new Date(`${dateKeys[0]}T00:00:00.000Z`);
    const activeDonationStatuses = ["approved", "completed"];

    // Pagination for user activity (default: page 1, limit 10)
    const {
      skip: activitySkip,
      limit: activityLimit,
      page: activityPage,
      totalPages: activityTotalPages,
    } = paginate(query);

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
      totalCommunityReports,
      communityReportStatusBreakdown,
      communityReportReasonBreakdown,
      recentCommunityReports,
      totalUserActivities,
      userActivityEventBreakdown,
      recentUserActivities,
      totalReportAuditLogs,
      reportAuditActionBreakdown,
      reportAuditSectionBreakdown,
      recentReportAuditLogs,
    ] = await Promise.all([
      User.countDocuments(buildUserFilter({})),
      User.countDocuments({ role: "admin", isDeleted: { $ne: true } }),
      User.countDocuments({ role: "donor", isDeleted: { $ne: true } }),
      Hospital.countDocuments({ isDeleted: { $ne: true } }),
      User.countDocuments(buildUserFilter({ isActive: "true" })),
      Report.countDocuments({ status: "pending" }),
      Report.countDocuments({}),
      Donation.countDocuments({}),
      BloodRequest.countDocuments({}),
      User.find(buildUserFilter({}))
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
      CommunityReport.countDocuments({}),
      CommunityReport.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      CommunityReport.aggregate([
        {
          $group: {
            _id: "$reason",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      CommunityReport.find({})
        .select("reason status description createdAt reportedBy reportedUser reviewedBy")
        .populate("reportedBy", "name email role")
        .populate("reportedUser", "name email role")
        .populate("reviewedBy", "name email role")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      UserActivity.countDocuments({}),
      UserActivity.aggregate([
        {
          $group: {
            _id: "$event",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      UserActivity.find({})
        .select("userId event meta ip userAgent timestamp")
        .populate("userId", "name email role")
        .sort({ timestamp: -1 })
        .skip(activitySkip)
        .limit(activityLimit)
        .lean(),
      ReportAuditLog.countDocuments({}),
      ReportAuditLog.aggregate([
        {
          $group: {
            _id: "$action",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      ReportAuditLog.aggregate([
        {
          $group: {
            _id: "$section",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      ReportAuditLog.find({})
        .populate("jobId", "section format status requestedAt completedAt")
        .populate("adminId", "name email role")
        .sort({ timestamp: -1 })
        .limit(10)
        .lean(),
    ]);

    const donors = await Donor.find({
      userId: { $in: recentUsers.map((user: any) => user._id) },
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
        reportStatusBreakdown: reportStatusBreakdown.map((item: any) => ({
          status: item._id,
          count: item.count,
        })),
        reportAuditActionBreakdown: reportAuditActionBreakdown.map((item: any) => ({
          action: item._id,
          count: item.count,
        })),
        reportAuditSectionBreakdown: reportAuditSectionBreakdown.map((item: any) => ({
          section: item._id,
          count: item.count,
        })),
      },
      recentUsers: recentUsers.map((user: any) => {
        const donor = donorByUserId.get(String(user._id));

        return {
          ...user,
          isDonorVerified: donor?.isVerified ?? false,
          isVerifyDonor: donor?.isVerified ?? false,
        };
      }),
      recentReports,
      moderationSnapshot: {
        totalReports,
        totalCommunityReports,
        pendingReports,
        communityReportStatusBreakdown: communityReportStatusBreakdown.map((item: any) => ({
          status: item._id,
          count: item.count,
        })),
        communityReportReasonBreakdown: communityReportReasonBreakdown.map((item: any) => ({
          reason: item._id,
          count: item.count,
        })),
        recentCommunityReports,
      },
      userActivity: {
        totalUserActivities,
        eventBreakdown: userActivityEventBreakdown.map((item: any) => ({
          event: item._id,
          count: item.count,
        })),
        recentUserActivities: recentUserActivities.map((activity: any) => ({
          ...activity,
          user: activity.userId,
          userId: activity.userId?._id ?? null,
        })),
        pagination: {
          total: totalUserActivities,
          page: activityPage,
          limit: activityLimit,
          totalPages: activityTotalPages(totalUserActivities),
          hasPrevPage: activityPage > 1,
          hasNextPage: activityPage < activityTotalPages(totalUserActivities),
        },
      },
      reportAuditLogs: {
        total: totalReportAuditLogs,
        actionBreakdown: reportAuditActionBreakdown.map((item: any) => ({
          action: item._id,
          count: item.count,
        })),
        sectionBreakdown: reportAuditSectionBreakdown.map((item: any) => ({
          section: item._id,
          count: item.count,
        })),
        logs: recentReportAuditLogs,
      },
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
    const { skip, limit, page, totalPages } = paginate(query as Record<string, any>);
    const filter = buildUserFilter(query);

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
    assertVisibleUserRole(user);

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

    return userObj;
  }
  static async getDeletedUsers(query: Record<string, any>) {
    const { skip, limit, page, totalPages } = paginate(query as Record<string, any>);
    const filter = buildDeletedUserFilter(query);

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

    const existingUser = await User.findById(targetUserId).select("_id role");
    assertVisibleUserRole(existingUser);

    const user = await User.findByIdAndUpdate(
      targetUserId,
      { $set: { isActive } },
      { new: true },
    ).select("_id name email role isActive");

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
    assertVisibleUserRole(user);

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
    const filter = buildHospitalFilter(query);

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

    const existingUser = await User.findById(targetUserId).select("_id role");
    assertVisibleUserRole(existingUser);

    let updated: any = null;

    switch (action) {
      case "increment": {
        const delta = typeof value === "number" ? value : 1;
        if (delta <= 0) throw new ApiError(400, "value must be greater than 0");
        updated = await User.findByIdAndUpdate(
          targetUserId,
          { $inc: { communityFlags: delta } },
          { new: true },
        ).select("_id role communityFlags");
        break;
      }
      case "decrement": {
        const delta = typeof value === "number" ? value : 1;
        if (delta <= 0) throw new ApiError(400, "value must be greater than 0");
        updated = await User.findByIdAndUpdate(
          targetUserId,
          { $inc: { communityFlags: -delta } },
          { new: true },
        ).select("_id role communityFlags");

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
        ).select("_id role communityFlags");
        break;
      }
      case "reset": {
        updated = await User.findByIdAndUpdate(
          targetUserId,
          { $set: { communityFlags: 0 } },
          { new: true },
        ).select("_id role communityFlags");
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
    const { skip, limit, page, totalPages } = paginate(query);
    const filter = buildSimpleStatusFilter(query);

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
    const { skip, limit, page, totalPages } = paginate(query);
    const filter = buildSimpleStatusFilter(query);

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
    const { skip, limit, page, totalPages } = paginate(query);
    const filter = buildSimpleStatusFilter(query);

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

  static async requestReportExport(
    section: ReportSection,
    format: ReportFormat,
    adminId: string,
    query: Record<string, any>,
    context: ReportRequestContext,
  ) {
    if (!reportSections.includes(section)) {
      throw new ApiError(400, "Invalid report section");
    }

    if (!reportFormats.includes(format)) {
      throw new ApiError(400, "format must be pdf or csv");
    }

    const filtersApplied = pickFilters(query);
    const job = await ReportJob.create({
      section,
      format,
      status: "pending",
      requestedBy: new Types.ObjectId(adminId),
      requestedAt: new Date(),
      filtersApplied,
    });

    await this.createReportAuditLog(String(job._id), adminId, "requested", context);

    void this.processReportJob(String(job._id), context).catch(() => undefined);

    return {
      jobId: job._id,
      status: job.status,
      section: job.section,
      format: job.format,
      requestedAt: job.requestedAt,
    };
  }

  static async processReportJob(jobId: string, context: ReportRequestContext) {
    const job = await ReportJob.findById(jobId);
    if (!job) return;

    try {
      job.status = "processing";
      await job.save();

      const { rows, columns } = await this.getExportRows(
        job.section,
        job.filtersApplied || {},
      );

      const buffer = job.format === "csv"
        ? await this.generateCsv(rows, columns)
        : await this.generatePdf(rows, columns, job);

      const reportDir = path.join(os.tmpdir(), "bloodconnect-report-jobs");
      await fs.mkdir(reportDir, { recursive: true });

      const fileName = `${job.section}-${job._id}.${job.format}`;
      const filePath = path.join(reportDir, fileName);
      await fs.writeFile(filePath, buffer);

      job.status = "ready";
      job.completedAt = new Date();
      job.totalRecords = rows.length;
      job.fileSize = buffer.length;
      job.filePath = filePath;
      job.fileName = fileName;
      job.contentType = job.format === "csv" ? "text/csv" : "application/pdf";
      job.errorMessage = null;
      await job.save();
    } catch (err: any) {
      job.status = "failed";
      job.errorMessage = err?.message || "Report generation failed";
      await job.save();
      await this.createReportAuditLog(String(job._id), String(job.requestedBy), "failed", context);
    }
  }

  static async listReportJobs(query: Record<string, any>) {
    const { skip, limit, page, totalPages } = paginate(query);
    const filter: Record<string, any> = {};

    if (query.status) filter.status = query.status;
    if (query.section) filter.section = query.section;
    if (query.format) filter.format = query.format;
    if (query.requestedBy && Types.ObjectId.isValid(String(query.requestedBy))) {
      filter.requestedBy = new Types.ObjectId(String(query.requestedBy));
    }

    const [jobs, total] = await Promise.all([
      ReportJob.find(filter)
        .populate("requestedBy", "name email role")
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReportJob.countDocuments(filter),
    ]);

    return {
      jobs,
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

  static async getReportJob(jobId: string) {
    validateObjectId(jobId, "report job ID");

    const job = await ReportJob.findById(jobId)
      .populate("requestedBy", "name email role")
      .lean();

    if (!job) {
      throw new ApiError(404, "Report job not found");
    }

    return job;
  }

  static async prepareReportDownload(
    jobId: string,
    adminId: string,
    context: ReportRequestContext,
  ) {
    validateObjectId(jobId, "report job ID");

    const job = await ReportJob.findById(jobId);
    if (!job) {
      throw new ApiError(404, "Report job not found");
    }

    if (job.status !== "ready" && job.status !== "downloaded") {
      throw new ApiError(400, `Report is not ready for download. Current status: ${job.status}`);
    }

    if (!job.filePath || !job.fileName || !job.contentType) {
      throw new ApiError(404, "Generated report file was not found");
    }

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(job.filePath);
    } catch {
      throw new ApiError(404, "Generated report file was not found");
    }

    job.status = "downloaded";
    job.downloadedAt = new Date();
    job.downloadCount += 1;
    await job.save();

    await this.createReportAuditLog(String(job._id), adminId, "downloaded", context);

    return {
      buffer,
      fileName: job.fileName,
      contentType: job.contentType,
      fileSize: buffer.length,
    };
  }

  static async listReportAuditLogs(query: Record<string, any>) {
    const { skip, limit, page, totalPages } = paginate(query);
    const filter: Record<string, any> = {};

    if (query.adminId && Types.ObjectId.isValid(String(query.adminId))) {
      filter.adminId = new Types.ObjectId(String(query.adminId));
    }
    if (query.section) filter.section = query.section;
    if (query.action) filter.action = query.action;

    if (query.from || query.to) {
      filter.timestamp = {};
      if (query.from) filter.timestamp.$gte = new Date(String(query.from));
      if (query.to) filter.timestamp.$lte = new Date(String(query.to));
    }

    const [logs, total] = await Promise.all([
      ReportAuditLog.find(filter)
        .populate("jobId", "section format status requestedAt completedAt")
        .populate("adminId", "name email role")
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReportAuditLog.countDocuments(filter),
    ]);

    return {
      logs,
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

  private static async createReportAuditLog(
    jobId: string,
    adminId: string,
    action: "requested" | "downloaded" | "failed",
    context: ReportRequestContext,
  ) {
    const [job, admin] = await Promise.all([
      ReportJob.findById(jobId).lean(),
      User.findById(adminId).select("name email").lean(),
    ]);

    if (!job || !admin) return;

    await ReportAuditLog.create({
      jobId: job._id,
      adminId: new Types.ObjectId(adminId),
      adminName: admin.name || "",
      adminEmail: admin.email || "",
      section: job.section,
      format: job.format,
      action,
      timestamp: new Date(),
      ip: context.ip,
      userAgent: context.userAgent,
      filters: job.filtersApplied || {},
    });
  }

  private static async getExportRows(
    section: ReportSection,
    filters: Record<string, any>,
  ): Promise<{ rows: Record<string, any>[]; columns: ExportColumn[] }> {
    switch (section) {
      case "users": {
        const users = await User.find(buildUserFilter(filters))
          .select("name email phone role bloodType isVerified isActive communityFlags createdAt")
          .sort({ createdAt: -1 })
          .lean();
        const donors = await Donor.find({ userId: { $in: users.map((user) => user._id) } }).lean();
        const donorByUserId = new Map(donors.map((donor) => [String(donor.userId), donor]));

        return {
          columns: [
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
            { key: "role", label: "Role" },
            { key: "bloodType", label: "Blood Type" },
            { key: "isVerified", label: "Verified" },
            { key: "isActive", label: "Active" },
            { key: "isDonorVerified", label: "Donor Verified" },
            { key: "communityFlags", label: "Flags" },
            { key: "createdAt", label: "Created At" },
          ],
          rows: users.map((user: any) => ({
            id: String(user._id),
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            bloodType: user.bloodType,
            isVerified: user.isVerified,
            isActive: user.isActive,
            isDonorVerified: donorByUserId.get(String(user._id))?.isVerified ?? false,
            communityFlags: user.communityFlags || 0,
            createdAt: user.createdAt,
          })),
        };
      }
      case "deleted-users": {
        const docs = await DeletedUser.find(buildDeletedUserFilter(filters))
          .sort({ deletedAt: -1 })
          .lean();

        return {
          columns: [
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role" },
            { key: "reason", label: "Reason" },
            { key: "deletedAt", label: "Deleted At" },
          ],
          rows: docs.map((doc: any) => ({
            id: String(doc._id),
            userId: doc.userId,
            name: doc.userSnapshot?.name || "",
            email: doc.userSnapshot?.email || "",
            role: doc.userSnapshot?.role || "",
            reason: doc.reason || "",
            deletedAt: doc.deletedAt,
          })),
        };
      }
      case "blood-requests": {
        const requests = await BloodRequest.find(buildSimpleStatusFilter(filters))
          .populate("requestedBy", "name email role")
          .select("requestedBy patientName bloodType units urgency status respondedDonors neededBy createdAt")
          .sort({ createdAt: -1 })
          .lean();

        return {
          columns: [
            { key: "patientName", label: "Patient" },
            { key: "requester", label: "Requester" },
            { key: "bloodType", label: "Blood Type" },
            { key: "unitsNeeded", label: "Units" },
            { key: "urgencyLevel", label: "Urgency" },
            { key: "status", label: "Status" },
            { key: "respondents", label: "Respondents" },
            { key: "neededBy", label: "Needed By" },
          ],
          rows: requests.map((request: any) => ({
            id: String(request._id),
            patientName: request.patientName,
            requester: request.requestedBy?.name || "",
            bloodType: request.bloodType,
            unitsNeeded: request.units,
            urgencyLevel: request.urgency,
            status: request.status,
            respondents: request.respondedDonors?.length || 0,
            neededBy: request.neededBy,
            createdAt: request.createdAt,
          })),
        };
      }
      case "donations": {
        const donations = await Donation.find(buildSimpleStatusFilter(filters))
          .populate("donorId", "name")
          .populate("requestedBy", "name")
          .select("donorId hospitalId requestedBy bloodType units donatedAt status notes createdAt")
          .sort({ createdAt: -1 })
          .lean();
        const hospitalIds = donations.map((donation: any) => donation.hospitalId).filter(Boolean);
        const hospitalUsers = await User.find({ _id: { $in: hospitalIds } }).select("name").lean();
        const hospitalUserMap = new Map(hospitalUsers.map((user: any) => [String(user._id), user.name]));

        return {
          columns: [
            { key: "donor", label: "Donor" },
            { key: "requestedBy", label: "Requested By" },
            { key: "hospital", label: "Hospital" },
            { key: "bloodType", label: "Blood Type" },
            { key: "unitsCollected", label: "Units" },
            { key: "donationDate", label: "Donation Date" },
            { key: "status", label: "Status" },
          ],
          rows: donations.map((donation: any) => ({
            id: String(donation._id),
            donor: donation.donorId?.name || "",
            requestedBy: donation.requestedBy?.name || "",
            hospital: hospitalUserMap.get(String(donation.hospitalId)) || "Unknown",
            bloodType: donation.bloodType,
            unitsCollected: donation.units,
            donationDate: donation.donatedAt,
            status: donation.status,
            notes: donation.notes,
          })),
        };
      }
      case "hospitals": {
        const hospitals = await Hospital.find(buildHospitalFilter(filters))
          .select("hospitalName registrationNumber email phone licenseNumber adminName isVerified isActive address createdAt")
          .sort({ createdAt: -1 })
          .lean();

        return {
          columns: [
            { key: "hospitalName", label: "Hospital" },
            { key: "registrationNumber", label: "Reg No" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
            { key: "adminName", label: "Admin" },
            { key: "isVerified", label: "Verified" },
            { key: "isActive", label: "Active" },
            { key: "createdAt", label: "Created At" },
          ],
          rows: hospitals.map((hospital: any) => ({
            id: String(hospital._id),
            hospitalName: hospital.hospitalName,
            registrationNumber: hospital.registrationNumber,
            email: hospital.email,
            phone: hospital.phone,
            licenseNumber: hospital.licenseNumber,
            adminName: hospital.adminName,
            isVerified: hospital.isVerified,
            isActive: hospital.isActive,
            address: hospital.address,
            createdAt: hospital.createdAt,
          })),
        };
      }
      case "reports": {
        const filter: Record<string, any> = {};
        if (filters.status) filter.status = filters.status;
        if (filters.reason) filter.reason = filters.reason;

        if (filters.search) {
          const regex = new RegExp(String(filters.search), "i");
          const users = await User.find({ $or: [{ name: regex }, { email: regex }] }).select("_id");
          const ids = users.map((user) => new Types.ObjectId(String(user._id)));
          filter.$or = ids.length ? [{ reportedBy: { $in: ids } }, { reportedUser: { $in: ids } }] : [{ _id: null }];
        }

        const reports = await Report.find(filter)
          .populate("reportedBy", "name email role")
          .populate("reportedUser", "name email role")
          .populate("reviewedBy", "name email role")
          .sort({ createdAt: -1 })
          .lean();

        return {
          columns: [
            { key: "reason", label: "Reason" },
            { key: "status", label: "Status" },
            { key: "reportedBy", label: "Reported By" },
            { key: "reportedUser", label: "Reported User" },
            { key: "reviewedBy", label: "Reviewed By" },
            { key: "createdAt", label: "Created At" },
          ],
          rows: reports.map((report: any) => ({
            id: String(report._id),
            reason: report.reason,
            status: report.status,
            reportedBy: report.reportedBy?.name || "",
            reportedUser: report.reportedUser?.name || "",
            reviewedBy: report.reviewedBy?.name || "",
            description: report.description,
            createdAt: report.createdAt,
          })),
        };
      }
      case "verifications": {
        const verifications = await Verification.find(buildSimpleStatusFilter(filters))
          .populate("userId", "name email bloodType phone")
          .populate("verifiedBy", "name email role")
          .select("userId documentType documentUrl status submittedAt verifiedAt verifiedBy notes createdAt")
          .sort({ createdAt: -1 })
          .lean();

        return {
          columns: [
            { key: "user", label: "User" },
            { key: "email", label: "Email" },
            { key: "documentType", label: "Document" },
            { key: "status", label: "Status" },
            { key: "submittedAt", label: "Submitted At" },
            { key: "verifiedAt", label: "Verified At" },
            { key: "verifiedBy", label: "Verified By" },
          ],
          rows: verifications.map((verification: any) => ({
            id: String(verification._id),
            user: verification.userId?.name || "",
            email: verification.userId?.email || "",
            bloodType: verification.userId?.bloodType || "",
            documentType: verification.documentType,
            status: verification.status,
            submittedAt: verification.submittedAt,
            verifiedAt: verification.verifiedAt,
            verifiedBy: verification.verifiedBy?.name || "",
            notes: verification.notes,
          })),
        };
      }
      default:
        throw new ApiError(400, "Invalid report section");
    }
  }

  private static async generateCsv(rows: Record<string, any>[], columns: ExportColumn[]) {
    const csvRows = rows.map((row) =>
      columns.reduce<Record<string, string>>((acc, column) => {
        acc[column.label] = safeString(row[column.key]);
        return acc;
      }, {}),
    );

    return writeToBuffer(csvRows, {
      headers: columns.map((column) => column.label),
      writeHeaders: true,
    });
  }

  private static async generatePdf(
    rows: Record<string, any>[],
    columns: ExportColumn[],
    job: any,
  ) {
    const admin = await User.findById(job.requestedBy).select("name email").lean();
    const pdfColumns = columns;

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ layout: "landscape", margin: 36, size: "A4" });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fillColor("#b91c1c").fontSize(18).text(`${job.section} Report`, { underline: false });
      doc.moveDown(0.5);
      doc.fillColor("#111827").fontSize(10);
      doc.text(`Generated at: ${new Date().toISOString()}`);
      doc.text(`Generated by: ${admin?.name || "Admin"} (${admin?.email || ""})`);
      doc.text(`Total records: ${rows.length}`);
      doc.text(`Filters: ${Object.keys(job.filtersApplied || {}).length ? JSON.stringify(job.filtersApplied) : "None"}`);
      doc.moveDown();

      const tableLeft = 36;
      const tableWidth = doc.page.width - 72;
      const columnWidth = tableWidth / pdfColumns.length;
      const rowHeight = 28;

      const drawHeader = () => {
        const y = doc.y;

        doc.rect(tableLeft, y, tableWidth, rowHeight).fill("#b91c1c");
        doc.fillColor("#ffffff").fontSize(7);
        pdfColumns.forEach((column, index) => {
          doc.text(column.label, tableLeft + index * columnWidth + 4, y + 8, {
            width: columnWidth - 8,
            height: rowHeight - 8,
            ellipsis: true,
          });
        });
        doc.y = y + rowHeight;
        doc.fillColor("#111827");
      };

      drawHeader();

      rows.forEach((row, rowIndex) => {
        if (doc.y > doc.page.height - 72) {
          doc.addPage();
          drawHeader();
        }

        const y = doc.y;
        doc.rect(tableLeft, y, tableWidth, rowHeight).fill(rowIndex % 2 === 0 ? "#ffffff" : "#f9fafb");
        doc.strokeColor("#e5e7eb").rect(tableLeft, y, tableWidth, rowHeight).stroke();
        doc.fillColor("#111827").fontSize(6.5);

        pdfColumns.forEach((column, index) => {
          doc.text(safeString(row[column.key]), tableLeft + index * columnWidth + 4, y + 7, {
            width: columnWidth - 8,
            height: rowHeight - 8,
            ellipsis: true,
          });
        });

        doc.y = y + rowHeight;
      });

      doc.end();
    });
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

