import { Types } from "mongoose";
import { ApiError, paginate } from "../../shared/utils";
import { BloodRequest, CommunityReport, Donation, Donor, User, Verification, Settings, Hospital } from "../index";
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

  static async getDashboard() {
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
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "donor" }),
      User.countDocuments({ role: "hospital" }),
      User.countDocuments({ isActive: true, isDeleted: { $ne: true } }),
      CommunityReport.countDocuments({ status: "pending" }),
      CommunityReport.countDocuments({}),
      Donation.countDocuments({}),
      BloodRequest.countDocuments({}),
      User.find({}).select("name email role isActive createdAt").sort({ createdAt: -1 }).limit(5),
      CommunityReport.find({})
        .select("reason status createdAt reportedBy reportedUser")
        .populate("reportedBy", "name email role")
        .populate("reportedUser", "name email role")
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

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
      recentUsers,
      recentReports,
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
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: totalPages(total),
      },
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
      CommunityReport.find(filter)
        .populate("reportedBy", "name email role")
        .populate("reportedUser", "name email role")
        .populate("reviewedBy", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      CommunityReport.countDocuments(filter),
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

  static async verifyDonor(targetUserId: string) {
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

    if (donor.isVerified) {
      throw new ApiError(400, "Donor is already verified");
    }

    donor.isVerified = true;
    await donor.save();

    return {
      id: user._id,
      name: user.name,
      isDonorVerified: true,
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
      status: "reviewed" | "dismissed" | "banned";
      reviewNote?: string;
      banUser?: boolean;
    },
  ) {
    validateObjectId(reportId, "report ID");

    const report = await CommunityReport.findById(reportId);
    if (!report) {
      throw new ApiError(404, "Report not found");
    }

    const allowedStatus = ["reviewed", "dismissed", "banned"];
    if (!allowedStatus.includes(body.status)) {
      throw new ApiError(400, "Invalid report status");
    }

    report.status = body.status;
    report.reviewedBy = new Types.ObjectId(adminId);
    report.reviewNote = body.reviewNote?.trim() || "";
    await report.save();

    const shouldBanUser = body.status === "banned" || body.banUser === true;
    if (shouldBanUser) {
      await User.findByIdAndUpdate(report.reportedUser, {
        $set: { isActive: false },
      });
    }

    const populatedReport = await CommunityReport.findById(report._id)
      .populate("reportedBy", "name email role")
      .populate("reportedUser", "name email role isActive")
      .populate("reviewedBy", "name email role");

    return populatedReport;
  }

  static async verifyUser(targetUserId: string) {
    validateObjectId(targetUserId, "user ID");

    const user = await User.findById(targetUserId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (user.isVerified) {
      throw new ApiError(400, "User is already verified");
    }

    user.isVerified = true;
    await user.save();

    return {
      _id: user._id,
      isVerified: true,
    };
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

